import sharp from "sharp";

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function buildDhash(buffer, width, height) {
  const bits = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = buffer[y * width + x];
      const right = buffer[y * width + x + 1];
      bits.push(left < right ? "1" : "0");
    }
  }

  let hex = "";
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4).join(""), 2).toString(16);
  }

  return hex;
}

function buildAhash(buffer) {
  const mean = average([...buffer]);
  const bits = [...buffer].map((value) => (value >= mean ? "1" : "0"));
  let hex = "";

  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4).join(""), 2).toString(16);
  }

  return hex;
}

async function collectMetrics(filePath) {
  const image = sharp(filePath, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const stats = await image.stats();
  const small = await image
    .clone()
    .resize({
      fit: "inside",
      height: 256,
      width: 256,
      withoutEnlargement: true,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const dHashBuffer = await image
    .clone()
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();
  const aHashBuffer = await image
    .clone()
    .resize(8, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const luminanceMean =
    0.2126 * (stats.channels[0]?.mean ?? 0) +
    0.7152 * (stats.channels[1]?.mean ?? stats.channels[0]?.mean ?? 0) +
    0.0722 * (stats.channels[2]?.mean ?? stats.channels[0]?.mean ?? 0);
  const contrast =
    0.2126 * (stats.channels[0]?.stdev ?? 0) +
    0.7152 * (stats.channels[1]?.stdev ?? stats.channels[0]?.stdev ?? 0) +
    0.0722 * (stats.channels[2]?.stdev ?? stats.channels[0]?.stdev ?? 0);

  const smallPixels = [...small.data];
  let edgeTotal = 0;
  let edgeSamples = 0;

  for (let y = 1; y < small.info.height - 1; y += 1) {
    for (let x = 1; x < small.info.width - 1; x += 1) {
      const center = smallPixels[y * small.info.width + x];
      const left = smallPixels[y * small.info.width + x - 1];
      const right = smallPixels[y * small.info.width + x + 1];
      const top = smallPixels[(y - 1) * small.info.width + x];
      const bottom = smallPixels[(y + 1) * small.info.width + x];
      edgeTotal += Math.abs(4 * center - left - right - top - bottom);
      edgeSamples += 1;
    }
  }

  return {
    aHash: buildAhash(aHashBuffer),
    contrast: clamp(contrast / 80, 0, 1),
    dHash: buildDhash(dHashBuffer, 9, 8),
    height: metadata.height ?? 0,
    luminanceMean: clamp(luminanceMean / 255, 0, 1),
    path: filePath,
    sharpness: clamp(edgeTotal / Math.max(edgeSamples * 96, 1), 0, 1),
    width: metadata.width ?? 0,
  };
}

async function main() {
  const raw = await new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", reject);
  });

  const filePaths = JSON.parse(String(raw));
  const results = [];

  for (const filePath of filePaths) {
    try {
      results.push(await collectMetrics(filePath));
    } catch (error) {
      results.push({
        error: error instanceof Error ? error.message : "metric generation failed",
        path: filePath,
      });
    }
  }

  process.stdout.write(JSON.stringify(results));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
