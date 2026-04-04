/* Photo Sync — client-side logic */

let currentSync = null; // active EventSource
let pendingDelete = null; // { folder } waiting for confirm

// ── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  await loadConfig();
  await loadStatus();
}

async function loadConfig() {
  try {
    const r = await fetch("/api/config");
    const { localRoot, sshHost, remoteRoot } = await r.json();
    document.getElementById("config-paths").innerHTML =
      `Local &nbsp;→ ${esc(localRoot)}<br>Remote → ${esc(sshHost)}:${esc(remoteRoot)}`;
  } catch {
    document.getElementById("config-paths").textContent = "Failed to load config";
  }
}

async function loadStatus() {
  const btn = document.getElementById("btn-refresh");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scanning…';

  const tbody = document.getElementById("folder-table");
  tbody.innerHTML = '<tr class="loading-row"><td colspan="5"><span class="spinner"></span> Scanning…</td></tr>';

  try {
    const r = await fetch("/api/status");
    const { sshOk, folders } = await r.json();

    // Update SSH badge
    const badge = document.getElementById("ssh-badge");
    badge.className = "ssh-badge " + (sshOk ? "ok" : "fail");
    badge.querySelector("span:last-child").textContent = sshOk ? "SSH connected" : "SSH offline";

    renderTable(folders, sshOk);

    const ts = new Date().toLocaleTimeString();
    document.getElementById("last-updated").textContent = `Last checked ${ts}`;
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Failed to load status: ${esc(String(err))}</td></tr>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Refresh status";
  }
}

function renderTable(folders, sshOk) {
  const tbody = document.getElementById("folder-table");

  if (!folders.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No folders found.</td></tr>';
    return;
  }

  tbody.innerHTML = folders.map(f => rowHtml(f, sshOk)).join("");
}

function rowHtml({ folder, local, remote }, sshOk) {
  const localTxt  = local  ? `${local.files} files · ${fmtBytes(local.bytes)}`  : "—";
  const remoteTxt = remote ? `${remote.files} files · ${fmtBytes(remote.bytes)}` : (sshOk ? "not on server" : "—");

  const status = getStatus(local, remote, sshOk);

  const canSync = !!local;
  const syncBtn = canSync
    ? `<button class="btn-secondary btn-sm" onclick="startSync(${esc(JSON.stringify(folder))}, false)">Sync →</button>`
    : "";
  const deleteBtn = canSync
    ? `<button class="btn-danger btn-sm" style="margin-left:0.4rem" onclick="confirmDelete(${esc(JSON.stringify(folder))})">Sync + delete</button>`
    : "";

  return `<tr id="row-${esc(folder)}">
    <td class="name">${esc(folder)}</td>
    <td class="stat">${esc(localTxt)}</td>
    <td class="stat">${esc(remoteTxt)}</td>
    <td><span class="status-pill ${status.cls}">${status.label}</span></td>
    <td class="actions">${syncBtn}${deleteBtn}</td>
  </tr>`;
}

function getStatus(local, remote, sshOk) {
  if (!sshOk)          return { cls: "status-empty",  label: "SSH down" };
  if (!local && !remote) return { cls: "status-empty",  label: "empty" };
  if (!local)           return { cls: "status-remote", label: "remote only" };
  if (!remote || remote.files === 0) return { cls: "status-local",  label: "not synced" };

  // Both exist — compare file counts
  if (local.files === remote.files) return { cls: "status-ok",     label: "in sync" };
  if (local.files > remote.files)   return { cls: "status-behind", label: "needs sync" };
  return { cls: "status-remote", label: "server ahead" };
}

// ── Sync ─────────────────────────────────────────────────────────────────────

function confirmDelete(folder) {
  pendingDelete = { folder };
  document.getElementById("confirm-folder").textContent = folder;
  document.getElementById("confirm-overlay").classList.add("visible");
  document.getElementById("confirm-ok").onclick = () => {
    closeConfirm();
    startSync(folder, true);
  };
}

function closeConfirm() {
  document.getElementById("confirm-overlay").classList.remove("visible");
  pendingDelete = null;
}

function startSync(folder, deleteMissing) {
  if (currentSync) {
    currentSync.close();
    currentSync = null;
  }

  const logPanel = document.getElementById("log-panel");
  const logOutput = document.getElementById("log-output");
  const logTitle = document.getElementById("log-title");

  logTitle.textContent = deleteMissing
    ? `Syncing ${folder} (--delete)`
    : `Syncing ${folder}`;
  logOutput.innerHTML = "";
  logPanel.classList.add("visible");
  logPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  appendLog(`Starting sync for ${folder}…\n`);

  fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder, deleteMissing }),
  }).then(res => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) return;
        buf += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part.split("\n").find(l => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine.slice(6));
            handleSyncMsg(msg, folder);
          } catch {}
        }

        read();
      });
    }
    read();
  }).catch(err => {
    appendLog(`\nConnection error: ${err}\n`, "err");
  });
}

function handleSyncMsg(msg, folder) {
  if (msg.status === "starting") {
    appendLog(`rsync started\n`);
  } else if (msg.line) {
    appendLog(msg.line + "\n");
  } else if (msg.error) {
    appendLog(msg.error + "\n", "err");
  } else if (msg.done) {
    if (msg.exitCode === 0) {
      appendLog(`\n✓ Sync complete for ${folder}\n`, "done");
      // Refresh status after a short delay
      setTimeout(loadStatus, 1500);
    } else {
      appendLog(`\n✗ rsync exited with code ${msg.exitCode}\n`, "err");
    }
  }
}

function appendLog(text, cls) {
  const out = document.getElementById("log-output");
  if (cls) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    out.appendChild(span);
  } else {
    out.appendChild(document.createTextNode(text));
  }
  out.scrollTop = out.scrollHeight;
}

function closeLog() {
  document.getElementById("log-panel").classList.remove("visible");
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + units[i];
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
