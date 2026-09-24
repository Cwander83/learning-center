import { esc } from "./render.mjs";

function navHtml(groups) {
  return groups
    .map(
      (g) =>
        `<div class="navhead">${esc(g.head)}</div><div class="navlinks">` +
        g.items
          .map(
            (it) =>
              `<a href="#${it.id}" data-sec="${it.id}"${it.sub ? ' class="sub"' : ""}>${it.text}</a>`
          )
          .join("") +
        `</div>`
    )
    .join("\n");
}

export function renderGuidePage(item) {
  const {
    slug,
    title,
    file,
    category,
    lede,
    mins,
    parts,
    tasks,
    groups,
    sections,
  } = item;

  const meta = [
    parts ? `${parts} parts` : null,
    tasks ? `${tasks}-item checklist` : null,
    `~${mins} min`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Learning Center</title>
<meta name="description" content="${descAttr(lede)}">
<link rel="stylesheet" href="../assets/guide.css">
</head>
<body data-key="${slug}">
<header class="topbar">
  <a class="homebtn" href="../index.html">⌂ Home</a>
  <span class="brand">${esc(title)}</span>
  <button id="themeToggle" title="Toggle dark / light">🌙 Dark</button>
  <div class="readbar" aria-hidden="true"><i id="readbarFill"></i></div>
</header>
<div class="layout">
<nav id="side" aria-label="Guide contents">
${navHtml(groups)}
</nav>
<main>
<h1>${esc(title)}</h1>
<div class="callout lede">${lede}</div>
${sections}
</main>
</div>
<footer class="guidefoot">
  <span class="cat">${esc(category)}</span> · ${meta} · Generated from <code>markdown_docs/${esc(file)}</code>
</footer>
<script src="../assets/theme.js"></script>
<script src="../assets/guide.js"></script>
</body>
</html>
`;
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// Plain-text value for a <meta content="..."> attribute.
function descAttr(html) {
  return esc(decodeEntities(stripTags(html)));
}

function card(item) {
  const meta = [
    item.parts ? `${item.parts} parts` : `${item.sections} sections`,
    item.tasks ? `${item.tasks}-item checklist` : null,
    `~${item.mins} min`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `    <article class="card" data-href="guides/${item.slug}.html" data-cat="${esc(item.category)}" data-mins="${item.mins}" data-title="${esc(item.title)}">
      <div class="body">
        <span class="cat">${esc(item.category)}</span>
        <div><a class="g-name" href="guides/${item.slug}.html">${esc(item.title)}</a></div>
        <div class="g-meta">${meta}</div>
        <span class="g-short">${item.lede}</span>
${item.long ? `        <div class="g-long">${item.long}</div>\n        <button class="readmore" type="button">Read more</button>\n` : ""}      </div>
      <div class="action"><a class="btn" href="guides/${item.slug}.html">Open →</a></div>
    </article>`;
}

export function renderDashboard(items, pageSize) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning Center</title>
<meta name="description" content="A shelf of long-form, follow-along guides on AI agents, databases, the web platform, and the tools behind modern software.">
<link rel="stylesheet" href="assets/dashboard.css">
</head>
<body data-page-size="${pageSize}">
<header class="topbar">
  <span class="brand">Learning Center<small>Guides &amp; interactive walkthroughs</small></span>
  <button id="themeToggle" title="Toggle dark / light">🌙 Dark</button>
</header>

<main class="dash">
  <div class="hero">
    <h1>Learning Center</h1>
    <p>A shelf of long-form guides on the tools and ideas behind modern software — AI agents, databases, containers, billing, and the web platform.</p>
    <p>Each guide is a full walkthrough: read it top to bottom, copy the code as you go, and tick off the checklist to track your progress. <strong>Filter below, or open any guide to start.</strong></p>
  </div>

  <div class="toolbar">
    <div class="searchrow">
      <input id="searchInput" type="search" placeholder="Search guides by title or topic…" autocomplete="off" aria-label="Search guides">
    </div>
    <select id="catSelect" aria-label="Filter by category"></select>
    <select id="sortSelect" aria-label="Sort guides">
      <option value="order">Sort: Recommended</option>
      <option value="az">Sort: A → Z</option>
      <option value="time">Sort: Longest first</option>
    </select>
  </div>

  <div class="pills" id="pills"></div>

  <div class="resultbar">
    <span id="resultCount"></span>
    <button id="clearBtn" type="button" hidden>Clear filters</button>
  </div>

  <div class="list" id="list">
${items.map(card).join("\n")}
  </div>

  <p class="empty" id="empty" hidden>No guides match that filter. Try a shorter term or another category.</p>
  <nav class="pager" id="pager" aria-label="Pagination"></nav>
</main>

<p class="note">Generated by <code>npm run build</code> from <code>markdown_docs/</code>. ${items.length} guides.</p>

<script src="assets/theme.js"></script>
<script src="assets/dashboard.js"></script>
</body>
</html>
`;
}
