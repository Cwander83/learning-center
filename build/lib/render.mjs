// Markdown -> HTML for the learning center.
// One marked instance per document so heading slugs are stable and local.
import { Marked } from "marked";
import GithubSlugger from "github-slugger";

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Strip the guide's meta header so it never lands in the body:
// the H1 title, the lede blockquote (rendered separately), and the
// "Last verified / Series" lines plus a leading horizontal rule.
function stripHeader(md) {
  const lines = md.split("\n");
  const out = [];
  let seenH2 = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) seenH2 = true;
    if (!seenH2) {
      if (/^#\s/.test(line)) continue; // H1 title
      if (/^>\s?/.test(line)) continue; // lede blockquote
      if (/^\*{0,2}(Last verified|Series:)/i.test(line)) continue;
      if (/^-{3,}\s*$/.test(line)) continue; // leading rule
    }
    out.push(line);
  }
  return out.join("\n");
}

// Drop the trailing "Bonus - Handoff Prompt" block. It is author-to-agent
// tooling, not reader content, and it leaks local file paths.
function stripTrailer(md) {
  const lines = md.split("\n");
  const cut = lines.findIndex((l) => /^##\s+Bonus\s+[-\u2014]\s+Handoff Prompt/i.test(l));
  return cut >= 0 ? lines.slice(0, cut).join("\n") : md;
}

const isMeta = (t) => /^(?:\*{0,2})(Last verified|Series:)/i.test(t.trim());

function blockquoteText(token) {
  return token.text
    .split("\n")
    .map((l) => l.replace(/^>\s?/, "").trim())
    .filter((l) => l && !isMeta(l))
    .join(" ")
    .trim();
}

// Collect title / lede / long blurb from the raw markdown.
export function extractMeta(md) {
  const lexer = new Marked();
  const tokens = lexer.lexer(md);

  const h1 = tokens.find((t) => t.type === "heading" && t.depth === 1);
  const title = h1 ? h1.text.trim() : "Untitled";

  const ledeIdx = tokens.findIndex((t) => t.type === "blockquote");
  let lede = ledeIdx >= 0 ? blockquoteText(tokens[ledeIdx]) : "";
  if (!lede) {
    const p = tokens.find((t) => t.type === "paragraph" && !isMeta(t.text));
    lede = p ? p.text.trim() : "";
  }

  let long = "";
  const start = ledeIdx >= 0 ? ledeIdx + 1 : 0;
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "paragraph") continue;
    const text = t.text.trim();
    if (isMeta(text) || text.length < 60) continue;
    long = text.length > 640 ? text.slice(0, 637).replace(/\s+\S*$/, "") + "…" : text;
    break;
  }

  const ledeInline = lede ? lexer.parseInline(lede) : "";
  const longInline = long ? lexer.parseInline(long) : "";
  return { title, lede: ledeInline, long: longInline };
}

export function countMeta(md) {
  const prose = md.replace(/```[\s\S]*?```/g, ""); // ignore fenced examples
  const parts = (prose.match(/^##\s+Part\s+\d+/gim) || []).length;
  const tasks = (prose.match(/^\s*[-*]\s+\[[ xX]\]/gm) || []).length;
  const words = md.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 300));
  return { parts, tasks, mins };
}

// Render body HTML + a flat heading list (h2/h3) for the sidebar TOC.
export function renderBody(md) {
  const slugger = new GithubSlugger();
  const headings = [];
  const renderer = {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const raw = tokens.map((t) => t.raw ?? "").join("");
      const id = slugger.slug(raw.replace(/[`*_~]/g, "").trim());
      if (depth === 2 || depth === 3) headings.push({ depth, id, text });
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const l = lang ? esc(lang.trim()) : "";
      return `<div class="codewrap"><pre data-lang="${l}"><code>${esc(text)}</code></pre></div>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const t = title ? ` title="${esc(title)}"` : "";
      const ext = /^https?:/i.test(href);
      const attr = ext ? ' target="_blank" rel="noopener"' : "";
      return `<a href="${esc(href)}"${t}${attr}>${text}</a>`;
    },
  };
  const marked = new Marked({ gfm: true, breaks: false, renderer });
  const bodyHtml = marked.parse(stripHeader(stripTrailer(md)));
  return { bodyHtml, headings };
}

// Wrap each h2 (and everything until the next h2) in a <section id> so the
// sidebar scroll-spy has stable targets.
export function wrapSections(bodyHtml) {
  const chunks = bodyHtml.split(/(?=<h2\b)/);
  return chunks
    .map((ch) => {
      const m = ch.match(/^<h2\b[^>]*\sid="([^"]+)"/);
      return m ? `<section id="${m[1]}">${ch}</section>` : ch;
    })
    .join("");
}

// Group headings into Start / Parts / Reference for the sidebar.
export function groupHeadings(headings) {
  const groups = [
    { head: "Start", items: [] },
    { head: "Parts", items: [] },
    { head: "Reference", items: [] },
  ];
  const pick = (title) => {
    if (/^(The Big Picture|Prerequisites)/i.test(title)) return groups[0];
    if (/^Part\s+\d/i.test(title)) return groups[1];
    return groups[2];
  };
  let current = groups[0];
  for (const h of headings) {
    if (h.depth === 2) {
      current = pick(h.text.replace(/<[^>]+>/g, ""));
      current.items.push({ ...h, sub: false });
    } else {
      current.items.push({ ...h, sub: true });
    }
  }
  return groups.filter((g) => g.items.length);
}
