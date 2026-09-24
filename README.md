# Learning Center

A static site of long-form, follow-along guides. Content lives as Markdown in
`markdown_docs/`; a small Node generator renders the dashboard and one
interactive page per guide.

## Layout

```
markdown_docs/        source of truth (edit these)
build/
  build.mjs           generator entry point
  lib/                markdown → HTML, catalog, page templates
  assets/             CSS + JS (copied to /assets on build)
index.html            generated dashboard
guides/<slug>.html    generated guide pages
assets/               generated copy of build/assets
```

Generated output (`index.html`, `guides/`, `assets/`) is overwritten on every
build — don't edit it by hand.

## Build

```bash
npm install      # once
npm run build    # render everything
npm run watch    # rebuild on change
npm run clean    # remove generated output
```

Open `index.html` in a browser. No server required.

## Add a guide

1. Drop a `.md` file into `markdown_docs/`.
2. `npm run build`.

The generator reads the `# ` title, the first `>` blockquote as the card blurb,
the first paragraph after it as the "Read more" excerpt, and the `##` / `###`
headings as the sidebar table of contents.

To control category and ordering, add an entry in `build/lib/catalog.mjs`
keyed by the file's slug (the filename lowercased, non-alphanumerics → `-`).
Files listed in `IGNORE` there are skipped.

## What the renderer supports

Standard GitHub-flavored Markdown: headings, tables, fenced code blocks (with
copy buttons), blockquotes (styled as callouts), links, and `- [ ]` task lists
(checkbox state persists in `localStorage`). The `Last verified` / `Series`
header lines and a leading `---` are stripped from the rendered body.

## Design

"Near-neutral ink" theme: off-white / near-black neutral surfaces with a single
restrained blue accent, crisp 1px hairlines, one small radius scale, and no
decorative shadows. Light + dark theme (shared toggle, persisted under
`lc-theme`). Tokens and shared chrome live in `build/assets/base.css`; each
surface adds only its own rules in `dashboard.css` or `guide.css`.

- Light: bg `#f7f8fa`, panel `#ffffff`, text `#0e1116`, accent `#1d4ed8`
- Dark: bg `#0b0d11`, panel `#14171d`, text `#e7eaf0`, accent `#4d8dff`

Icons are authored inline SVG (no icon font, no emoji). Browser surfaces —
selection, caret, scrollbars, focus rings, tabular numerals — are themed from
the palette.

Category filtering lives in the pill row alone; the sort `<select>` sits beside
the search field. One way to filter, one way to sort.

On the guide page the contents rail is a sticky sidebar on wide screens and a
collapsed "Contents" disclosure below 960px, so the article always starts in
the first viewport.

## License

- Code (generator, assets, config) — [MIT](LICENSE)
- Written guides (`markdown_docs/`, `guides/`) — [CC BY 4.0](LICENSE-CONTENT)
