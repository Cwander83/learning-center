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

"Deep Sea" palette, solid buttons with subtle squared corners, light + dark
theme (shared toggle, persisted under `lc-theme`). Tokens are defined at the
top of `build/assets/guide.css` and `build/assets/dashboard.css`.

- Light: bg `#f2f7fa`, panel `#ffffff`, text `#00171f`, accent `#007ea7`
- Dark: bg `#00171f`, panel `#02222f`, text `#e6f4fa`, accent `#00a8e8`

## License

- Code (generator, assets, config) — [MIT](LICENSE)
- Written guides (`markdown_docs/`, `guides/`) — [CC BY 4.0](LICENSE-CONTENT)
