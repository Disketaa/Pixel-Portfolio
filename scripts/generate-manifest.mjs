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
import { imageSize } from "image-size";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKS_DIR = path.join(ROOT, "assets", "works");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const ICONS_DIR = path.join(ROOT, "assets", "icons");
const ALLOWED_EXT = new Set([".png", ".gif"]);

function resolveIcon(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  const base = name.trim();
  try {
    const files = readdirSync(ICONS_DIR);
    const match = files.find(
      (f) =>
        path.basename(f, path.extname(f)).toLowerCase() === base.toLowerCase(),
    );
    if (match) return `assets/icons/${match}`;
  } catch {}
  console.error(`  icon "${base}" not found in assets/icons/`);
  return null;
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
    width,
    height,
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
    const icon = resolveIcon(layout.icon);
    result[key] = { cols, order, icon };
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

  const output = entries.map(({ addedAt, ...rest }) => rest);

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

  const filtered = output.filter((e) => {
    if (!e.folder) return true;
    if (!folderHasLayout.has(e.folder)) return true;
    return layoutFiles.has(e.file);
  });

  if (filtered.length !== output.length) {
    const removed = output.length - filtered.length;
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
