#!/usr/bin/env node
// Auto-sync the Sections table in docs/tekkal-guide.md with the actual
// files in docs/guide/. Each guide file carries its own metadata in a
// top-of-file HTML comment:
//
//   <!-- guide-meta: { "label": "Shape", "desc": "..." } -->
//
// The filename prefix (e.g. 04c-elem-shape.md) supplies the order/number
// column. Missing metadata falls back to the file's H1 title for the label
// and an empty description (which the script reports as a warning).
//
// Usage:
//   node scripts/sync-guide-index.mjs           # rewrite tekkal-guide.md
//   node scripts/sync-guide-index.mjs --check   # exit 1 on drift, no write
//
// The table in tekkal-guide.md must be wrapped in marker comments:
//   <!-- guide-index:start -->
//   ...table...
//   <!-- guide-index:end -->

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolvePath(__dirname, "..");
const GUIDE_DIR = resolvePath(REPO_ROOT, "docs/guide");
const INDEX_FILE = resolvePath(REPO_ROOT, "docs/tekkal-guide.md");
const START_MARKER = "<!-- guide-index:start -->";
const END_MARKER = "<!-- guide-index:end -->";

const META_RE = /<!--\s*guide-meta:\s*(\{[\s\S]*?\})\s*-->/;
const H1_RE = /^#\s+(.+)$/m;
const FILENAME_RE = /^(\d+[a-z]?)-/;

function parseGuideFile(filename) {
  const path = resolvePath(GUIDE_DIR, filename);
  const text = readFileSync(path, "utf8");

  const orderMatch = filename.match(FILENAME_RE);
  if (!orderMatch) {
    throw new Error(`${filename}: filename must start with "<number>-" (e.g. 04c-foo.md)`);
  }
  const order = orderMatch[1];

  const metaMatch = text.match(META_RE);
  let label = null;
  let desc = "";
  if (metaMatch) {
    try {
      const meta = JSON.parse(metaMatch[1]);
      label = typeof meta.label === "string" ? meta.label : null;
      desc = typeof meta.desc === "string" ? meta.desc : "";
    } catch (e) {
      throw new Error(`${filename}: invalid guide-meta JSON: ${e.message}`);
    }
  }
  if (!label) {
    const h1 = text.match(H1_RE);
    label = h1 ? h1[1].trim() : filename.replace(FILENAME_RE, "").replace(/\.md$/, "");
  }

  return { filename, order, label, desc };
}

function buildTable(entries) {
  const lines = [
    "| # | File | Description |",
    "|---|------|-------------|",
  ];
  for (const e of entries) {
    const descCell = e.desc || "(no description — add a `guide-meta` comment)";
    // Strip leading zeros from the display number: "01" → "1", "04c" → "4c"
    const displayNum = e.order.replace(/^0+(?=\d)/, "");
    lines.push(`| ${displayNum} | [${e.label}](./guide/${e.filename}) | ${descCell} |`);
  }
  return lines.join("\n");
}

function naturalOrderKey(order) {
  // "04c" → { num: 4, suffix: "c" } so 4, 4a, 4b, 4c sort naturally
  const m = order.match(/^(\d+)([a-z]?)$/);
  return m ? [parseInt(m[1], 10), m[2]] : [Infinity, ""];
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const [aNum, aSuf] = naturalOrderKey(a.order);
    const [bNum, bSuf] = naturalOrderKey(b.order);
    if (aNum !== bNum) return aNum - bNum;
    return aSuf.localeCompare(bSuf);
  });
}

function main() {
  const check = process.argv.includes("--check");

  const files = readdirSync(GUIDE_DIR)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !f.startsWith("."));

  const entries = sortEntries(files.map(parseGuideFile));

  // Warn about entries with no description
  const missing = entries.filter((e) => !e.desc);
  if (missing.length > 0) {
    console.warn(
      `[sync-guide-index] ${missing.length} guide file(s) missing guide-meta description:`,
    );
    for (const e of missing) console.warn(`  - ${e.filename}`);
  }

  const newTable = buildTable(entries);

  // Read current index file and splice in the new table
  const current = readFileSync(INDEX_FILE, "utf8");
  const startIdx = current.indexOf(START_MARKER);
  const endIdx = current.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    console.error(
      `[sync-guide-index] ${INDEX_FILE} is missing the markers ` +
        `"${START_MARKER}" / "${END_MARKER}" — add them around the Sections table.`,
    );
    process.exit(2);
  }
  if (endIdx < startIdx) {
    console.error(`[sync-guide-index] end marker appears before start marker`);
    process.exit(2);
  }

  const before = current.slice(0, startIdx + START_MARKER.length);
  const after = current.slice(endIdx);
  const next = `${before}\n${newTable}\n${after}`;

  if (check) {
    if (next !== current) {
      console.error(
        `[sync-guide-index] DRIFT — tekkal-guide.md Sections table is out of sync with docs/guide/. Run: node scripts/sync-guide-index.mjs`,
      );
      process.exit(1);
    }
    console.log("[sync-guide-index] OK — index matches filesystem");
    return;
  }

  if (next === current) {
    console.log("[sync-guide-index] no changes");
    return;
  }
  writeFileSync(INDEX_FILE, next);
  console.log(`[sync-guide-index] rewrote Sections table (${entries.length} entries)`);
}

main();
