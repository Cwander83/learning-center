# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primarily the author's own future self (a **personal reference shelf**), with close peers as a secondary audience. The situation: a topic comes up again months later and the exact steps, code, and gotchas have faded. The job: pick up the guide and reproduce the work end to end without re-deriving it or hunting for the original context. Success is fast, faithful recall — not traffic or reach.

Repo evidence for the author: guides carry `Series: Chris Wander · New Paper Series`.

## Product Purpose

A static shelf of long-form, follow-along guides. Each guide turns a topic the author actually worked through into a durable, reproducible walkthrough. The product exists so that hard-won operational knowledge can be re-read and re-applied later, in full, instead of being re-learned.

## Positioning

**Follow-along completeness.** Each guide is a full end-to-end walkthrough — runnable code, ordered steps, and a progress checklist — rather than a topical overview or a link roundup. A neighboring guide site cannot truthfully copy this, because these guides are personally worked through, not aggregated from others.

## Operating Context

- Source of truth is `markdown_docs/*.md`; the author edits these.
- A small Node generator (`build/build.mjs`, `build/lib/*`) renders `index.html` (the dashboard), `guides/<slug>.html` (one interactive page per guide), and copies `assets/`.
- Build commands: `npm run build`, `npm run watch`, `npm run clean`. Output opens directly in a browser — no server required.
- Guides carry a `Last verified` date and a `Series` header line; the renderer strips these from the body and uses the H1, lede blockquote, and first paragraph for the card, blurb, and excerpt.
- Category and ordering are hand-curated in `build/lib/catalog.mjs`; files in its `IGNORE` list are skipped.
- Reader state persists in the browser: checklist checkbox state and theme (`lc-theme`).

Exactly two reader-facing surfaces, a standard parent/child shape: the dashboard (`index.html`) is the parent list — think a blog index — and one page per guide (`guides/<slug>.html`) is the post. There are no other routes. Do not add an about, colophon, home, or other standalone page; new needs land inside these two or are declined.

## Capabilities and Constraints

- Standard GitHub-flavored Markdown: headings, tables, fenced code blocks (with copy buttons), blockquotes styled as callouts, links, and `- [ ]` task lists with persistent state.
- Static only: no backend, no auth, no server. Generated output (`index.html`, `guides/`, `assets/`) is overwritten on every build and must never be hand-edited.
- One way to filter (the pill row), one way to sort (the `<select>` beside search).
- Content is authored by the author; the shelf is not an aggregator. Whether the deployed site is intended to be public or effectively private is an **open decision** (a Vercel deploy config exists, but audience was described as personal).

## Brand Commitments

Product name: **Learning Center**.

License split is a standing commitment: code (generator, assets, config) under MIT; written guides (`markdown_docs/`, `guides/`) under CC BY 4.0.

## Evidence on Hand

- 10 reader-facing guides authored in `markdown_docs/`, spanning AI agents, data/backend, the web platform, infra/dev-env, workflow, and business/billing.
- Real `Last verified` dates on each guide (e.g. *September 2026*); these reflect genuine re-checks.
- **No fabricated proof.** There are no testimonials, reader counts, customers, benchmarks, or third-party citations on hand, and future work must not invent any — including dates, metrics, or endorsements.

## Product Principles

1. **Write to reproduce, not to survey.** Every guide is a full walkthrough a reader can follow top to bottom and get the same result.
2. **Honesty over polish.** Verify dates reflect real re-checks; never invent proof, dates, or benchmarks.
3. **One source of truth.** Markdown is edited; generated output is disposable and regenerated.
4. **Own the shelf.** Uncommon breadth across the stack in one place — AI agents, data, web platform, infra, and billing.
5. **Content outlives chrome.** The interface serves the guide; it never competes with the reading.
