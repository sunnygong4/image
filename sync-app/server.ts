/**
 * Sync App Server
 * Runs locally on Windows. Compares local LRC Saved folder against the
 * server via SSH, then triggers rsync (via WSL) per folder.
 *
 * Start: npm start
 * Open:  http://localhost:3335
 */

import { spawn } from "child_process";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const LOCAL_ROOT  = process.env.LOCAL_ROOT  || "C:\\Users\\sunny\\Pictures\\LRC Saved";
const SSH_HOST    = process.env.SSH_HOST    || "host@sunnyserver2";
const REMOTE_ROOT = process.env.REMOTE_ROOT || "/mnt/nas/photos/library";
const PORT        = parseInt(process.env.SYNC_PORT || "3335");

// ── Helpers ───────────────────────────────────────────────────────────────────

function toWslPath(winPath: string): string {
  // C:\Foo\Bar -> /mnt/c/Foo/Bar
  return winPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}

/** Run a command via WSL, return stdout */
function wsl(args: string[], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("wsl", args, { shell: false });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `exit ${code}`));
    });
  });
}

/** SSH and run a shell command on the server */
function sshRun(cmd: string, timeoutMs = 20_000): Promise<string> {
  return wsl(["ssh", "-o", "ConnectTimeout=10", "-o", "BatchMode=yes", SSH_HOST, cmd], timeoutMs);
}

interface FolderStat { files: number; bytes: number }

/** Count files + total bytes in a local directory tree */
async function statLocal(dir: string): Promise<FolderStat | null> {
  try {
    await fs.access(dir);
  } catch {
    return null;
  }

  let files = 0;
  let bytes = 0;

  async function walk(d: string) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    await Promise.all(
      entries.map(async (e) => {
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else if (e.isFile()) {
          const stat = await fs.stat(full).catch(() => null);
          if (stat) { files++; bytes += stat.size; }
        }
      }),
    );
  }

  await walk(dir);
  return { files, bytes };
}

/** Count files + total bytes in a remote directory via SSH */
async function statRemote(remoteDir: string): Promise<FolderStat | null> {
  try {
    const out = await sshRun(
      `if [ -d "${remoteDir}" ]; then find "${remoteDir}" -type f | wc -l && du -sb "${remoteDir}" | cut -f1; fi`,
    );
    const lines = out.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { files: 0, bytes: 0 };
    return { files: parseInt(lines[0] ?? "0"), bytes: parseInt(lines[1] ?? "0") };
  } catch {
    return null; // SSH failed
  }
}

/** List top-level folders in LOCAL_ROOT */
async function listLocalFolders(): Promise<string[]> {
  try {
    const entries = await fs.readdir(LOCAL_ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** List top-level folders in REMOTE_ROOT via SSH */
async function listRemoteFolders(): Promise<string[] | null> {
  try {
    const out = await sshRun(`ls -1 "${REMOTE_ROOT}" 2>/dev/null || echo ""`);
    return out.split("\n").map((l) => l.trim()).filter(Boolean).sort().reverse();
  } catch {
    return null;
  }
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** GET /api/config — return paths for display */
app.get("/api/config", (_req, res) => {
  res.json({ localRoot: LOCAL_ROOT, sshHost: SSH_HOST, remoteRoot: REMOTE_ROOT });
});

/** GET /api/status — compare all folders */
app.get("/api/status", async (_req, res) => {
  // Gather local + remote folder lists in parallel
  const [localFolders, remoteFolders] = await Promise.all([
    listLocalFolders(),
    listRemoteFolders(),
  ]);

  const sshOk = remoteFolders !== null;
  const allFolders = [
    ...new Set([...localFolders, ...(remoteFolders ?? [])]),
  ].sort().reverse();

  // Stat every folder concurrently (but cap SSH parallelism)
  const results = await Promise.all(
    allFolders.map(async (folder) => {
      const localDir  = path.join(LOCAL_ROOT, folder);
      const remoteDir = `${REMOTE_ROOT}/${folder}`;

      const [local, remote] = await Promise.all([
        localFolders.includes(folder) ? statLocal(localDir) : Promise.resolve(null),
        sshOk ? statRemote(remoteDir) : Promise.resolve(undefined),
      ]);

      return {
        folder,
        local,                          // null = doesn't exist locally
        remote: remote ?? null,         // null = doesn't exist on server, undefined if SSH down
        sshOk: remote !== undefined || !sshOk,
      };
    }),
  );

  res.json({ sshOk, folders: results });
});

/** POST /api/sync — stream rsync progress as SSE */
app.post("/api/sync", async (req, res) => {
  const { folder, deleteMissing } = req.body as {
    folder: string;
    deleteMissing?: boolean;
  };

  if (!folder || folder.includes("..") || folder.includes("/")) {
    return res.status(400).json({ error: "Invalid folder name." });
  }

  const localDir  = toWslPath(path.join(LOCAL_ROOT, folder)) + "/";
  const remoteDir = `${SSH_HOST}:${REMOTE_ROOT}/${folder}/`;

  const args = [
    "rsync",
    "-avz",
    "--progress",
    "--exclude=*.lrcat",
    "--exclude=*.lrdata",
    "--exclude=Thumbs.db",
    "--exclude=.DS_Store",
  ];
  if (deleteMissing) args.push("--delete");
  args.push(localDir, remoteDir);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function send(data: object) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  send({ status: "starting", folder, deleteMissing: !!deleteMissing });

  const proc = spawn("wsl", args, { shell: false });

  proc.stdout.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n").filter((l) => l.trim());
    for (const line of lines) {
      send({ line });
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    send({ error: chunk.toString().trim() });
  });

  proc.on("close", (code) => {
    send({ done: true, exitCode: code });
    res.end();
  });

  req.on("close", () => proc.kill());
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Sync app running at http://localhost:${PORT}`);
  console.log(`  Local : ${LOCAL_ROOT}`);
  console.log(`  Server: ${SSH_HOST}:${REMOTE_ROOT}\n`);
});
