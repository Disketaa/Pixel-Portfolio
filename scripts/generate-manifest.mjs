import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import zlib from "node:zlib";
import { imageSize } from "image-size";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKS_DIR = path.join(ROOT, "works");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const ALLOWED_EXT = new Set([".png", ".gif"]);

function toTitleCase(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getGitAddedDate(filePath) {
  try {
    const relPath = path.relative(ROOT, filePath);
    const output = execSync(
      `git log --diff-filter=A --follow --format=%aI -- "${relPath}"`,
      { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    if (output.length > 0) {
      return output[output.length - 1].slice(0, 10);
    }
  } catch {}
  const stats = statSync(filePath);
  return stats.mtime.toISOString().slice(0, 10);
}

function hasTransparentPixels(buffer, width, height) {
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return false;
  const colorType = buffer[25];
  if (colorType !== 6 && colorType !== 4 && colorType !== 3) return false;
  if (colorType === 3) {
    for (let i = 8; i < buffer.length - 11; i++) {
      if (
        buffer[i] === 116 &&
        buffer[i + 1] === 82 &&
        buffer[i + 2] === 78 &&
        buffer[i + 3] === 83
      )
        return true;
    }
    return false;
  }

  let data = Buffer.alloc(0);
  let pos = 8;
  while (pos < buffer.length - 12) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    if (type === "IDAT") {
      data = Buffer.concat([data, buffer.subarray(pos + 8, pos + 8 + len)]);
    }
    if (type === "IEND") break;
    pos += 12 + len;
  }
  if (data.length === 0) return false;

  let raw;
  try {
    raw = zlib.inflateSync(data);
  } catch {
    return false;
  }

  const bpp = colorType === 6 ? 4 : 2;
  const sl = width * bpp + 1;
  const offset = colorType === 6 ? 3 : 1;
  const above = new Uint8Array(width);
  const curr = new Uint8Array(width);

  const step = Math.max(1, Math.floor(height / 100));

  for (let y = 0; y < height; y++) {
    const row = y * sl;
    const filter = raw[row];

    for (let x = 0; x < width; x++) {
      const rawA = raw[row + 1 + x * bpp + offset];
      const left = x > 0 ? curr[x - 1] : 0;
      const up = above[x];
      const upLeft = x > 0 ? above[x - 1] : 0;

      let a;
      if (filter === 0) a = rawA;
      else if (filter === 1) a = (rawA + left) & 0xff;
      else if (filter === 2) a = (rawA + up) & 0xff;
      else if (filter === 3) a = (rawA + ((left + up) >> 1)) & 0xff;
      else {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        a = (rawA + pr) & 0xff;
      }

      curr[x] = a;
    }

    if (y % step === 0) {
      for (let x = 0; x < width; x++) {
        if (curr[x] < 255) return true;
      }
    }
    above.set(curr);
  }
  return false;
}

function walkDir(dir, baseDir) {
  const results = [];
  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = baseDir ? `${baseDir}/${item.name}` : item.name;
    if (item.isDirectory()) {
      results.push(...walkDir(fullPath, relPath));
    } else if (
      item.isFile() &&
      ALLOWED_EXT.has(path.extname(item.name).toLowerCase())
    ) {
      results.push(relPath);
    }
  }
  return results;
}

function toDisplayName(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildEntry(relPath) {
  const filePath = path.join(WORKS_DIR, relPath);
  const ext = path.extname(relPath).toLowerCase();
  const buffer = readFileSync(filePath);
  const { width, height } = imageSize(buffer);
  const isAnimated = ext === ".gif";
  const hasAlpha = isAnimated
    ? false
    : hasTransparentPixels(buffer, width, height);

  const parts = relPath.split(/[/\\]/);
  let folder = null;
  let subfolder = null;
  if (parts.length > 1) {
    folder = toDisplayName(parts[0]);
    if (parts.length > 2) {
      subfolder = toDisplayName(parts[1]);
    }
  }

  return {
    file: relPath,
    title: toTitleCase(relPath),
    width,
    height,
    ratio: Number((width / height).toFixed(3)),
    hasAlpha,
    isAnimated,
    addedAt: getGitAddedDate(filePath),
    folder,
    subfolder,
  };
}

function parseJsonLayout(content, folderPath, folderName) {
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    console.error(`  ${path.join(folderPath, "layout.json")}: invalid JSON`);
    return null;
  }

  if (!json.layouts || typeof json.layouts !== "object") {
    console.error(
      `  ${path.join(folderPath, "layout.json")}: missing "layouts" object`,
    );
    return null;
  }

  const result = {};
  let hasError = false;

  for (const [subKey, layout] of Object.entries(json.layouts)) {
    if (!layout.images || !Array.isArray(layout.images)) {
      console.error(
        `  ${path.join(folderPath, "layout.json")}: "${subKey}" has no "images" array`,
      );
      hasError = true;
      continue;
    }

    const isRoot = subKey === ".";
    const subDirPath = isRoot ? folderPath : path.join(folderPath, subKey);

    const nameMap = {};
    try {
      const items = readdirSync(subDirPath, { withFileTypes: true });
      for (const entry of items) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (!ALLOWED_EXT.has(ext)) continue;
        const base = path.basename(entry.name, ext);
        nameMap[base] = entry.name;
        nameMap[base.toLowerCase()] = entry.name;
      }
    } catch {
      console.error(
        `  ${path.join(folderPath, "layout.json")}: subfolder "${subKey}" not found`,
      );
      hasError = true;
      continue;
    }

    const cols = [];
    const order = [];
    let rowOk = true;

    for (const row of layout.images) {
      if (!Array.isArray(row)) {
        console.error(
          `  ${path.join(folderPath, "layout.json")}: "${subKey}" row is not an array`,
        );
        hasError = true;
        rowOk = false;
        break;
      }
      cols.push(row.length);
      for (const name of row) {
        const fileName = nameMap[name] || nameMap[name.toLowerCase()] || null;
        if (!fileName) {
          console.error(
            `  ${path.join(folderPath, "layout.json")}: "${subKey}" — "${name}" not found`,
          );
          hasError = true;
          rowOk = false;
          break;
        }
        if (isRoot) {
          order.push(`${folderName}/${fileName}`);
        } else {
          order.push(`${folderName}/${subKey}/${fileName}`);
        }
      }
      if (!rowOk) break;
    }

    if (!rowOk) continue;

    const key = isRoot ? folderName : `${folderName}/${subKey}`;
    result[key] = { cols, order };
    console.log(
      `  layout.json: ${key} (${cols.join("+")} slots, ${order.length} files)`,
    );
  }

  if (hasError && Object.keys(result).length === 0) return null;
  return Object.keys(result).length ? result : null;
}

function scanJsonLayouts() {
  const result = {};
  const items = readdirSync(WORKS_DIR, { withFileTypes: true });
  for (const item of items) {
    if (!item.isDirectory()) continue;
    const folderPath = path.join(WORKS_DIR, item.name);
    const jsonFile = path.join(folderPath, "layout.json");
    if (existsSync(jsonFile)) {
      const content = readFileSync(jsonFile, "utf8");
      const parsed = parseJsonLayout(content, folderPath, item.name);
      if (parsed) Object.assign(result, parsed);
    }
  }
  return result;
}

function main() {
  if (!existsSync(WORKS_DIR)) {
    console.error(`No works directory found at ${WORKS_DIR}`);
    process.exit(1);
  }

  const files = walkDir(WORKS_DIR, "").sort();

  const entries = files.map(buildEntry);

  entries.sort((a, b) => {
    if (a.addedAt !== b.addedAt) return b.addedAt.localeCompare(a.addedAt);
    return a.file.localeCompare(b.file);
  });

  console.log(`Scanning for layout.json files...`);
  const layouts = scanJsonLayouts();

  const layoutFiles = new Set();
  for (const order of Object.values(layouts)) {
    for (const f of order.order) layoutFiles.add(f);
  }

  const folderHasLayout = new Set(
    readdirSync(WORKS_DIR, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          existsSync(path.join(WORKS_DIR, d.name, "layout.json")),
      )
      .map((d) => d.name),
  );

  const filtered = entries.filter((e) => {
    if (!e.folder) return true;
    if (!folderHasLayout.has(e.folder)) return true;
    return layoutFiles.has(e.file);
  });

  if (filtered.length !== entries.length) {
    const removed = entries.length - filtered.length;
    console.log(`  filtered out ${removed} file(s) not in any layout`);
  }

  const manifest = { entries: filtered, layouts };
  const nextContent = JSON.stringify(manifest, null, 2) + "\n";
  const prevContent = existsSync(MANIFEST_PATH)
    ? readFileSync(MANIFEST_PATH, "utf8")
    : null;

  if (prevContent === nextContent) {
    const count = Object.keys(layouts).length;
    console.log(
      `manifest.json unchanged (${filtered.length} works, ${count} layouts)`,
    );
    return;
  }

  writeFileSync(MANIFEST_PATH, nextContent, "utf8");
  const count = Object.keys(layouts).length;
  console.log(
    `manifest.json updated: ${filtered.length} works, ${count} layouts`,
  );
}

main();
