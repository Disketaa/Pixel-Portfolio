import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { imageSize } from 'image-size';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORKS_DIR = path.join(ROOT, 'works');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const ALLOWED_EXT = new Set(['.png', '.gif']);
const HERO_AREA_THRESHOLD = 1_000_000;
const HERO_RATIO_MIN = 0.75;
const HERO_RATIO_MAX = 1.35;

function getGridSpan(width, height, ratio) {
  const area = width * height;
  const isBigEnough = area >= 4096;

  if (ratio >= 2.4 && isBigEnough) return { col: 3, row: 1 };
  if (ratio >= 1.6 && isBigEnough) return { col: 2, row: 1 };
  if (ratio <= 0.6 && isBigEnough) return { col: 1, row: 2 };
  return { col: 1, row: 1 };
}

function maybeUpgradeToHero(span, width, height, ratio) {
  const isSquareBucket = span.col === 1 && span.row === 1;
  const isLargeEnough = width * height >= HERO_AREA_THRESHOLD;
  const isNearSquare = ratio >= HERO_RATIO_MIN && ratio <= HERO_RATIO_MAX;
  if (isSquareBucket && isLargeEnough && isNearSquare) {
    return { col: 2, row: 2 };
  }
  return span;
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

function buildEntry(filename) {
  const filePath = path.join(WORKS_DIR, filename);
  const buffer = readFileSync(filePath);
  const { width, height } = imageSize(buffer);
  const ratio = width / height;
  const baseSpan = getGridSpan(width, height, ratio);
  const gridSpan = maybeUpgradeToHero(baseSpan, width, height, ratio);

  return {
    file: filename,
    title: toTitleCase(filename),
    width,
    height,
    ratio: Number(ratio.toFixed(3)),
    gridSpan,
    isAnimated: path.extname(filename).toLowerCase() === '.gif',
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
