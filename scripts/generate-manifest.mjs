import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import { imageSize } from 'image-size';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORKS_DIR = path.join(ROOT, 'works');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const ALLOWED_EXT = new Set(['.png', '.gif']);

function getGridSpan(width, height) {
  const area = width * height;
  const ratio = width / height;

  if (ratio > 2.5) {
    if (area >= 50000) return { col: 4, row: 2 };
    return { col: 4, row: 1 };
  }
  if (ratio > 1.2) {
    if (area >= 400000) return { col: 4, row: 2 };
    if (area >= 50000) return { col: 3, row: 2 };
    return { col: 2, row: 1 };
  }

  if (ratio < 0.4) {
    if (area >= 50000) return { col: 2, row: 4 };
    return { col: 1, row: 3 };
  }
  if (ratio < 0.85) {
    if (area >= 400000) return { col: 2, row: 4 };
    if (area >= 50000) return { col: 2, row: 3 };
    return { col: 1, row: 2 };
  }

  if (area >= 50000) return { col: 2, row: 2 };
  return { col: 1, row: 1 };
}

function toTitleCase(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getGitAddedDate(filePath) {
  try {
    const relPath = path.relative(ROOT, filePath);
    const output = execSync(
      `git log --diff-filter=A --follow --format=%aI -- "${relPath}"`,
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }
    )
      .toString()
      .trim()
      .split('\n')
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
      if (buffer[i] === 116 && buffer[i+1] === 82 && buffer[i+2] === 78 && buffer[i+3] === 83) return true;
    }
    return false;
  }

  let data = Buffer.alloc(0);
  let pos = 8;
  while (pos < buffer.length - 12) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    if (type === 'IDAT') {
      data = Buffer.concat([data, buffer.subarray(pos + 8, pos + 8 + len)]);
    }
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (data.length === 0) return false;

  let raw;
  try { raw = zlib.inflateSync(data); } catch { return false; }

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
      else if (filter === 1) a = (rawA + left) & 0xFF;
      else if (filter === 2) a = (rawA + up) & 0xFF;
      else if (filter === 3) a = (rawA + ((left + up) >> 1)) & 0xFF;
      else {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const pr = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
        a = (rawA + pr) & 0xFF;
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

function buildEntry(filename) {
  const filePath = path.join(WORKS_DIR, filename);
  const ext = path.extname(filename).toLowerCase();
  const buffer = readFileSync(filePath);
  const { width, height } = imageSize(buffer);
  const ratio = width / height;
  const gridSpan = getGridSpan(width, height);
  const isAnimated = ext === '.gif';
  const hasAlpha = isAnimated ? false : hasTransparentPixels(buffer, width, height);

  return {
    file: filename,
    title: toTitleCase(filename),
    width,
    height,
    ratio: Number(ratio.toFixed(3)),
    gridSpan,
    hasAlpha,
    isAnimated,
    addedAt: getGitAddedDate(filePath),
  };
}

function main() {
  if (!existsSync(WORKS_DIR)) {
    console.error(`No works directory found at ${WORKS_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(WORKS_DIR)
    .filter((name) => ALLOWED_EXT.has(path.extname(name).toLowerCase()))
    .sort();

  const entries = files.map(buildEntry);

  entries.sort((a, b) => {
    if (a.addedAt !== b.addedAt) return b.addedAt.localeCompare(a.addedAt);
    return a.file.localeCompare(b.file);
  });

  const nextContent = JSON.stringify(entries, null, 2) + '\n';
  const prevContent = existsSync(MANIFEST_PATH)
    ? readFileSync(MANIFEST_PATH, 'utf8')
    : null;

  if (prevContent === nextContent) {
    console.log(`manifest.json unchanged (${entries.length} works)`);
    return;
  }

  writeFileSync(MANIFEST_PATH, nextContent, 'utf8');
  console.log(`manifest.json updated: ${entries.length} works`);
}

main();
