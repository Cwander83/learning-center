#!/usr/bin/env node
// Learning Center generator.
//
//   markdown_docs/*.md  ->  guides/<slug>.html + index.html + assets/
//
// Run with `npm run build`, or `npm run watch` to rebuild on change.
// Drop a new .md in markdown_docs/ and re-run — no registry to edit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  extractMeta,
  countMeta,
  renderBody,
  wrapSections,
  groupHeadings,
} from "./lib/render.mjs";
import { renderGuidePage, renderDashboard } from "./lib/template.mjs";
import { GUIDES, IGNORE } from "./lib/catalog.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SRC = path.join(ROOT, "markdown_docs");
const OUT = path.join(ROOT, "guides");
const ASSETS_SRC = path.join(ROOT, "build", "assets");
const ASSETS_OUT = path.join(ROOT, "assets");
const PAGE_SIZE = 8; // cards per dashboard page; higher = fewer pages

const slugify = (s) =>
  s
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Leading number in the filename, e.g. `12-new-thing.md` -> 12. Used as the
// default order so a freshly added guide lands at the top without a catalog entry.
const prefixNum = (f) => {
  const m = f.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
};

function build() {
  const files = fs
    .readdirSync(SRC)
    .filter((f) => f.endsWith(".md") && !IGNORE.includes(f))
    .sort();

  const items = files.map((file) => {
    const md = fs.readFileSync(path.join(SRC, file), "utf8");
    const slug = slugify(file);
    const cfg = GUIDES[slug] || {};
    const meta = extractMeta(md);
    const counts = countMeta(md);
    const { bodyHtml, headings } = renderBody(md);

    const title = (cfg.title || meta.title)
      .replace(/^The Complete Guide:\s*/i, "")
      .replace(/\s*[—-]\s*How-To Guide\s*$/i, "")
      .trim();

    // No point offering "Read more" when the long blurb repeats the lede.
    const plain = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const long = plain(meta.long) === plain(meta.lede) ? "" : meta.long;

    return {
      file,
      slug,
      title,
      category: cfg.category || "Uncategorized",
      order: cfg.order ?? prefixNum(file) ?? 999,
      lede: meta.lede,
      long,
      ...counts,
      sections: headings.filter((h) => h.depth === 2).length,
      groups: groupHeadings(headings),
      sectionsHtml: wrapSections(bodyHtml),
    };
  });

  // Newest first: the highest order number (the newest guide) sorts to the top,
  // so adding a guide puts it first instead of last.
  items.sort((a, b) => b.order - a.order || a.title.localeCompare(b.title));

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(ASSETS_OUT, { recursive: true, force: true });
  fs.cpSync(ASSETS_SRC, ASSETS_OUT, { recursive: true });

  for (const item of items) {
    const html = renderGuidePage({
      ...item,
      sections: item.sectionsHtml,
    });
    fs.writeFileSync(path.join(OUT, `${item.slug}.html`), html);
  }

  fs.writeFileSync(
    path.join(ROOT, "index.html"),
    renderDashboard(items, PAGE_SIZE)
  );

  console.log(
    `built ${items.length} guides + index.html  (page size ${PAGE_SIZE})`
  );
  for (const it of items) console.log(`  · guides/${it.slug}.html`);
}

build();

if (process.argv.includes("--watch")) {
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
      } catch (e) {
        console.error(e);
      }
    }, 120);
  };
  fs.watch(SRC, schedule);
  fs.watch(ASSETS_SRC, schedule);
  console.log("watching markdown_docs/ and build/assets/ for changes…");
}
