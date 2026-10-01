# The Complete Guide: Payload CMS — The Research Paper

> Payload installs into your Next.js app, generates its admin panel from your TypeScript config, and exposes your database through three APIs that share one query language. Here is how it actually works — and the kinks nobody mentions until you hit them.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Payload is not a CMS you log into at some vendor's domain. It is a **config-as-code application framework** that installs *inside* your Next.js app. You write one TypeScript file — the Payload Config — and out of it falls: a full React admin panel, a REST API, a GraphQL API, a straight-to-database Node API, authentication, access control, file uploads, versioning, localization, and a database schema with migrations. You own all of it, and it all deploys together with your app.

The mental model that unlocks everything else: **Payload is an ORM with superpowers.** At its core is a `payload` package that knows how to run operations — `find`, `create`, `update`, `delete` — and every one of those operations executes your access control, your hooks, and your validation on the way through. The admin panel and the REST/GraphQL APIs are just *clients* of those same operations. That is why a rule you write once secures both your API and your editor UI.

```
   ONE REPO, ONE APP — WHAT PAYLOAD ADDS TO A NEXT.JS PROJECT

   ┌───────────────────────────────────────────────────────────────┐
   │  YOUR NEXT.JS APP                                             │
   │                                                               │
   │   app/(payload)/                 app/(my-app)/                │
   │   ┌──────────────────┐           ┌──────────────────┐         │
   │   │  /admin          │           │  your pages,     │         │
   │   │  /api   (REST)   │           │  server comps,   │         │
   │   │  /api/graphql    │           │  server actions  │         │
   │   └────────┬─────────┘           └────────┬─────────┘         │
   │            │                              │                   │
   │            ▼                              ▼                   │
   │      ┌─────────────────────────────────────────────┐          │
   │      │  payload.config.ts — the single source      │          │
   │      │  collections · globals · fields · access    │          │
   │      │  hooks · auth · localization · jobs         │          │
   │      └───────────────────┬─────────────────────────┘          │
   │                          ▼                                    │
   │      ┌─────────────────────────────────────────────┐          │
   │      │  Local API: payload.find / create / ...     │          │
   │      │  (no HTTP — straight to the database)       │          │
   │      └───────────────────┬─────────────────────────┘          │
   └──────────────────────────┼────────────────────────────────────┘
                              ▼
                   ┌───────────────────────┐
                   │   Database Adapter    │
                   │  MongoDB · Postgres   │
                   │  SQLite               │
                   └───────────────────────┘
```

The single most important idea: **the config is the product.** Collections, fields, access rules, hooks, and the admin UI are all derived from one typed object. When you change the config, the admin panel, the APIs, and the generated TypeScript types all change with it — and when you use the Local API, you are calling the same machinery the admin panel calls, just without the HTTP hop.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Payload Config** | The blueprint for the whole building | One file drives the admin UI, APIs, and DB schema |
| **Collection** | A table + its form + its API endpoint, in one | Where you model `posts`, `orders`, `users` |
| **Document** | One row / one record | What CRUD operations act on |
| **Global** | A table with exactly one row | Settings, navigation, footer |
| **Field** | A column that also knows how to edit itself | Auto-generates the matching admin input |
| **Local API** | A phone line inside the building | Server-side queries with zero HTTP overhead |
| **REST / GraphQL** | The public entrances | Same data, for any client |
| **Hook** | A checkpoint at the door | Run your code at exact points in a document's life |
| **Access Control** | The bouncer, at every door | Secures APIs and hides UI, from the same function |
| **Database Adapter** | The foundation you chose | MongoDB, Postgres, or SQLite behind one API |
| **Migration** | A construction permit | Versioned schema changes for relational databases |
| **Draft / Version** | Save-for-later and the undo history | Real editorial workflows, not just autosave |
| **Job / Task** | An outbox and a to-do routine | Background work and scheduled publishing |
| **Lexical** | The word processor engine | Rich text stored as JSON, rendered by you |
| **MCP** | A socket for AI agents | Let agents read and write your content safely |

> **The one-sentence version:** Payload is a config-as-code CMS that lives inside your Next.js app — one TypeScript file generates the admin panel, the APIs, and the schema, and the same access functions that secure your API also decide what your editors see.

---

## The 60-Second Version (TL;DR)

1. **Payload 3.x is the stable line; latest is 3.90.2 (23 September 2026).** Payload **4.0 is in beta** — plan for it, don't build on it yet. Section 8 and Part 9 cover the upgrade story.
2. **It installs into a Next.js app.** `npx create-payload-app` scaffolds one; the install requires **Node 20.9+** and a supported Next.js version range — currently **15.2.9–15.2.x, 15.3.9–15.3.x, 15.4.11–15.4.x, or 16.2.6+**. This coupling is the #1 kink (see 8.1).
3. **Your database is yours.** Pick MongoDB, Postgres, or SQLite through an adapter. Postgres/SQLite use Drizzle; migrations are first-party and written in TypeScript.
4. **Three APIs, one query language.** Local API (fastest, server-only), REST at `/api`, GraphQL at `/api/graphql-playground`. The same `where` syntax works in all three.
5. **The Local API skips access control by default in 3.x** (`overrideAccess: true`). This is a documented footgun — and in 4.0 the default **flips to `false`**. Be explicit today (8.3).
6. **Rich text is Lexical, stored as JSON.** You convert to JSX/HTML/Markdown when rendering. Slate is legacy and **will be removed in 4.0**.
7. **A critical security release shipped 18 September 2026 (3.90.0 / 4.0 line).** If you run Payload, be on 3.90.1+ and read those notes — password/session behavior, upload hardening, and API-key visibility all changed.
8. **Keep every `@payloadcms/*` package on the same version.** They are published in lockstep; mixing versions is a classic self-inflicted wound.
9. **Payload joined Figma in March 2025.** It remains open source and self-hostable; the enterprise motion (SSO, workflows, AI features) has grown alongside. Microsoft, ASICS, and Blue Origin are public customers.
10. **The ecosystem is real:** plugins for SEO, search, redirects, forms, multi-tenancy, ecommerce, and MCP; official Vercel and Cloudflare deployment paths; and `llms.txt` / agent-skill files so your AI tools stay accurate.

---

## Prerequisites

| Requirement | Why | How to check / get |
|---|---|---|
| Node.js **20.9.0+** | Payload's floor | `node --version` |
| A package manager | pnpm is preferred; **yarn 1.x is not supported** | `pnpm --version` |
| Next.js in a supported range | Payload 3 mounts inside the app | `15.2.9–15.2.x`, `15.3.9–15.3.x`, `15.4.11–15.4.x`, `16.2.6+` |
| A database | Pick one adapter | MongoDB, Postgres, or SQLite (local is fine to start) |
| `sharp` (optional) | Image resizing, cropping, focal point | `pnpm i sharp` |
| `graphql` (optional) | Only if you want the GraphQL API | `pnpm i graphql` |
| An editor + AI agent | Not required, but the docs ship `llms.txt` | Your agent reads version-matched docs |

> **Before you start:** decide your database adapter before you model anything. Switching MongoDB → Postgres later is a data migration project, not a config change.

---

## Part 1 — What Payload Actually Is

**It is a framework first, a CMS second.** Payload's own docs open with: *"Payload is the Next.js fullstack framework."* The CMS story — content modeling, editorial workflow, media — is one use case among several (internal tools, headless commerce, digital asset management). That framing matters because it tells you who this is for: developers who want to *build on* their CMS, not just install one.

**The history in five beats.** Payload 1.0 launched in June 2022 as an Express-based CMS. Version 2.0 (September 2023) added Postgres, Live Preview, and the Lexical rich text editor. Version 3.0 (October 2024) was the big pivot: Payload stopped being a standalone server and became something that **installs directly into any Next.js app** — the admin panel became React Server Components served from your own `/admin` route. In March 2025, Payload joined Figma. And through 2025–2026 the 3.x line matured toward 4.0 (currently in beta), which adds an admin UI redesign, TanStack Start support, MCP, and a few breaking changes we'll get to.

**It is genuinely open source.** The core is MIT-licensed TypeScript on GitHub — ~45k stars as of September 2026 — with an enterprise tier layered on top (SSO, publishing workflows, visual editor, A/B testing). You can read every line that touches your data.

**Who it is for.** Teams already living in Next.js and TypeScript who want content and application logic in *one* codebase, one deploy, one type system. Agencies who want to hand clients a clean editing UI without maintaining a CMS fork. Solo builders (hello) who refuse to run a second server for content.

**Who it is not for.** If your stack is PHP-first, Payload means adopting Node. If you want zero code and a click-only setup, this is the wrong tool. If you want a hosted SaaS where someone else runs the database, that is Contentful/Sanity territory — Payload's bet is the opposite: *you own it.*

### The comparison in one table

| Alternative | The honest difference |
|---|---|
| **WordPress + ACF** | Payload is the "you never fight the CMS" version: no plugins of plugins, config is code, APIs are typed |
| **Strapi** | Both are Node CMSes; Strapi is admin-first with a plugin market, Payload is code-first and lives inside your Next app |
| **Directus** | Directus wraps an existing SQL database with a no-code admin; Payload defines schema in code and manages migrations for you |
| **Contentful / Sanity** | Hosted SaaS with editorial polish; Payload is self-hosted OSS with unlimited seats and full data ownership |
| **Building it yourself** | You get Payload's admin UI, auth, access control, uploads, versions, and jobs for free instead of re-inventing them |

---

## Part 2 — The Anatomy of a Payload App

**Installation, the honest version.** `npx create-payload-app` scaffolds everything. To add Payload to an existing Next.js app, you install `payload` and `@payloadcms/next`, plus a database adapter, then copy a small set of files into a `(payload)` route group in your `app/` folder. Those files never regenerate and you never edit them — they just wire the REST/GraphQL routes and admin panel into Next.js. Your own pages move into their own route group (commonly `(my-app)` or `(frontend)`), and the two coexist:

```text
app/
├─ (payload)/
│  ├─ admin/[[...segments]]/   ← the auto-generated admin panel
│  ├─ api/[...slug]/           ← REST API
│  └─ api/graphql/             ← GraphQL API (optional)
└─ (my-app)/
   ├─ layout.tsx               ← your frontend
   └─ page.tsx
```

**The Next.js plugin.** You wrap your Next config with `withPayload`:

```ts
// next.config.mjs  — note the ESM requirement
import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withPayload(nextConfig)
```

Two gotchas live in those four lines. First, `withPayload` is **ESM-only** — your `next.config` needs to be `.mjs`, or your `package.json` needs `"type": "module"`, and any `require`/`module.exports` must become `import`/`export`. Second, Payload's own packages are ESM too; that is why the plugin exists at all (it teaches Next to bundle things like `mongodb` and `drizzle-kit` correctly).

**The config.** Every project has one `payload.config.ts`, usually at the repo root, usually wired to a tsconfig path alias:

```ts
// payload.config.ts — the minimum viable config
import { buildConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import sharp from 'sharp'

export default buildConfig({
  editor: lexicalEditor(),          // rich text engine (optional)
  collections: [],                   // your data model goes here
  secret: process.env.PAYLOAD_SECRET || '',
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
  }),
  sharp,                             // image manipulation (optional)
})
```

```json
// tsconfig.json — so `@payload-config` resolves everywhere
{ "compilerOptions": { "paths": { "@payload-config": ["./payload.config.ts"] } } }
```

Then `pnpm dev`, open `http://localhost:3000/admin`, and create the first user. That is the entire bootstrap.

**Collections and globals.** A **Collection** is a group of documents sharing a schema — `posts`, `media`, `users`. A **Global** is the degenerate case: exactly one document, for settings and nav. Both are defined with **Fields**, and the field list is long enough to model almost anything without plugins: text, textarea, number, email, select, radio, checkbox, date, point, json, code, richText, upload, relationship, join, array, blocks (the layout builder), group, row, collapsible, tabs, and UI (presentational). Every field auto-generates its own admin input, and field-level options control validation, defaults, access, and hooks.

**Type generation.** The config is typed at runtime; your *data* gets typed by a command:

```bash
pnpm payload generate:types
# → src/payload-types.ts — Post, Media, User interfaces from your config
```

Local API calls then infer their return types from those generated interfaces, which is the closest thing to "the CMS has types" you will find.

---

## Part 3 — The Three APIs

Payload exposes everything through three doors, and **all three share one query language** — same `where` operators, same sort, same pagination shape.

| API | Where | Use it when |
|---|---|---|
| **Local API** | In-process, any server context | Server Components, hooks, access control, seed scripts — always your first choice on the server |
| **REST** | `/api` in your app | External clients, mobile apps, webhooks, anything that speaks HTTP |
| **GraphQL** | `/api/graphql-playground` | Clients that already live in GraphQL; requires installing `graphql` |

**The Local API is the headline.** There is no HTTP hop — you are calling operations that go straight to the database:

```ts
// Inside a React Server Component or a hook
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

const posts = await payload.find({
  collection: 'posts',
  where: { status: { equals: 'published' } },
  sort: '-publishedAt',
  limit: 10,
})
```

Inside hooks and access functions you don't even import it — it is handed to you as `req.payload`. The operations cover the full lifecycle: `create`, `find`, `findByID`, `count`, `findDistinct`, `update` (single and many), `delete` (single and many), plus auth operations (`login`, `forgotPassword`, `resetPassword`, `verifyEmail`, `unlock`, `auth`) and globals (`findGlobal`, `updateGlobal`).

**The options list is where the power is.** Every operation accepts a common set: `depth` (how far to auto-populate relationships), `locale` / `fallbackLocale`, `select` (field projection), `populate`, `showHiddenFields`, `context` (passed through to hooks), `disableErrors`, `disableTransaction`, `overrideLock`, `user`, and — the important one — `overrideAccess`.

**Access control is skipped by default in the Local API (3.x).** This surprises everyone. The Local API assumes *your server code is trusted*, so `overrideAccess` defaults to `true`. If you are querying on behalf of a user, you must opt back in:

```ts
const posts = await payload.find({
  collection: 'posts',
  overrideAccess: false,   // enforce access control…
  user,                    // …as this user
})
```

In **Payload 4.0 the default flips to `false`** (access control enforced unless you opt out). The release notes list it as a breaking change and the codemod flags it — meaning the 3.x default is now officially the legacy behavior. Start being explicit today; it is the single best upgrade-prep habit (see 8.3).

**Transactions thread through `req`.** If your database supports transactions (Postgres always; MongoDB with replica sets), pass `req` into nested Local API calls so they join the same transaction:

```ts
await payload.update({
  collection: 'orders',
  id: order.id,
  data: { status: 'paid' },
  req,   // stay inside the current transaction
})
```

---

## Part 4 — Data, Databases, and the Migration Question

**Bring your own database.** Payload is database-agnostic behind the adapter interface, and each adapter is a real, first-class implementation:

| Adapter | Package | Character |
|---|---|---|
| **MongoDB** | `@payloadcms/db-mongodb` | Payload's native home; flexible documents suit blocks/arrays; transactions need a replica set |
| **Postgres** | `@payloadcms/db-postgres` | Drizzle ORM under the hood; relational rigor; migrations are mandatory in production |
| **SQLite** | `@payloadcms/db-sqlite` | Drizzle too; perfect for local dev and small deploys |
| **Vercel Postgres** | `@payloadcms/db-vercel-postgres` | The Postgres adapter aimed at Vercel's storage |

**Migrations are a first-party, TypeScript affair.** In development, relational adapters can push schema changes automatically. In production, you generate and run migrations:

```bash
pnpm payload migrate:create add-reset-password-requested-at
pnpm payload migrate
```

The 3.90.0 security release is a perfect illustration: it added a `resetPasswordRequestedAt` field to auth collections and told every relational-database user to run a migration. If you skip migrations, your schema drifts and things break in exactly the places you can't debug quickly.

**Indexes, transactions, and the sharp edges.** Payload lets you declare indexes per field (do this for anything you filter on). Transactions are supported — but they are opt-in per request path, and you have to thread `req` (see Part 3). And there is one genuinely sharp relational edge: **polymorphic joins got stricter `where` validation in 3.90.0** — filters that traverse relationships, hit localized fields, or reach into nested arrays now throw a `QueryError` instead of silently doing something approximate. If you lean on joins with multiple target collections, read that release note.

**The decision, made simple.** Starting fresh and unsure? **Postgres** if your team already lives in SQL, **MongoDB** if you love document flexibility and want Payload's oldest, most-exercised path. SQLite is a gift for local development regardless of where you deploy.

---

## Part 5 — Auth, Access Control, and Uploads

**Authentication is built in.** Mark a collection with `auth: true` and it becomes a user collection with login, logout, email verification, password reset, lockout handling, and your choice of cookie/JWT/API-key strategies. The admin panel needs at least one auth-enabled collection; your own frontends can reuse the same users — that portability ("one auth system for the CMS *and* your app") is a deliberate design goal.

**Access control is the best idea in Payload.** Three scopes — **collection**, **global**, and **field** — each an async function that answers one question: *can this request do this operation?*

```ts
// Collection-level: anyone can read published posts; only admins write
const Posts = {
  slug: 'posts',
  access: {
    read: ({ req: { user } }) => {
      if (user) return true
      return { status: { equals: 'published' } }   // a WHERE query, not a boolean
    },
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [ /* ... */ ],
}
```

Two details make this more powerful than it looks. First, access functions can return **query constraints**, not just booleans — "this user may read *their own* orders" is one return value. Second, **the admin panel reflects your access rules**: hide a collection from a role and it disappears from their sidebar, using the same function that protects your API. That is why Payload calls it "the Access Operation" — on login, it runs every access function across collections, globals, and fields to build a map of what the user can do.

**The Access Operation caveat.** When your functions run at the top level like that, there is no specific document, so `id`, `data`, `siblingData`, `blockData`, and `doc` are `undefined` — and any `where` query you return is *not run*; Payload assumes no access instead. Guard accordingly:

```ts
const access = ({ req: { user }, id }) => {
  if (!id) return Boolean(user)     // top-level check — no document yet
  return user?.id === id            // document-level check
}
```

**Uploads are a first-class field type.** An upload-enabled collection stores files locally by default; swap in storage adapters for S3, GCS, Azure, Vercel Blob, and more when you deploy serverless. With `sharp` installed you get image resizing, cropping, and focal-point selection. Upload collections get the same access control as everything else — files are not a special case.

And because this is September 2026: the 3.90.0 security release hardened this entire surface. SVG/XML uploads are now strictly validated, client uploads across all adapters are hardened, external file fetches must come from a trusted origin, filenames are sanitized, and **multipart uploads are capped at 50 MB by default** (raise `requestSizeLimit` if you legitimately need more). If you built an upload pipeline before mid-September, read those notes.

---

## Part 6 — Content Workflows: Drafts, Versions, Localization, Jobs

**Drafts and versions are built into the document model.** Enable `versions` on a collection and you get a version history with diffs and restore; enable `drafts` and documents gain a `_status` field (`draft` / `published`), plus autosave and **scheduled publishing**. The subtle part is querying drafts: fetching unpublished content requires `draft: true` *and* `overrideAccess: false` with a real user — the preview path is exactly where you want access control live.

**Localization is field-level.** Declare locales once in the config, then mark any field `localized: true`; Payload stores per-locale values and serves them by `locale` with `fallbackLocale` chains. You can even write locale-specific access control by reading `req.locale` in your access functions.

**Jobs turn Payload into a worker queue.** The jobs system has four nouns worth memorizing: **queues** (ordered groups), **jobs** (units of offloaded work), **tasks** (typed function declarations with input/output, runnable inside jobs), and **schedules** (cron-style recurring jobs). Scheduled publishing rides on this system, and long-running work (transcodes, syncs, emails) belongs here rather than in a hook that blocks the request.

**Folders, Trash, and Query Presets** are the admin-side quality-of-life trio added across the 3.x line: group documents across collections, soft-delete with a recoverable trash, and save/share list filters and columns for your editors.

---

## Part 7 — The Ecosystem: Admin, Live Preview, Plugins, MCP

**The admin panel is a React app you can bend.** Every field has a generated UI, but you can swap in custom components for fields, cells, labels, views, the dashboard, and the root layout. `@payloadcms/ui` exports the panel's own component library — Button, Banner, Pill, Table, DatePicker, Modals, and a few dozen more — which is exactly what powers custom admin work. (Fittingly, the docs for those components only fully landed in June 2026; before that, custom admin work meant reading source. It is much better now.)

**Live Preview renders your real frontend inside the admin.** You configure a URL pattern, Payload iframes your app beside the editor, and changes stream through as the editor types — no save required. There are server-side and client-side integration guides, and on Vercel the Content Link integration closes the loop from rendered page back to the exact field.

**Plugins cover the boring 20%.** Official plugins include SEO, search, redirects, nested docs, form builder, import/export, multi-tenant scaffolding, Sentry, Stripe, cloud storage adapters, the full ecommerce suite, and — the one I care about most — **MCP**.

**MCP is the agent-native move.** The MCP plugin exposes your Payload instance as a Model Context Protocol server, so AI agents (the ones living in your editor, or your own harnesses) can read and write content through a defined, permissioned interface instead of you scripting ad-hoc API calls. Combined with the fact that Payload ships `llms.txt` files and — in 4.0 — an **agent skill inside the `payload` package itself**, this is a CMS built by people who assume you code with agents now. More on that in the advanced guide.

**Enterprise features exist** (SSO, publishing workflows, visual editor, static A/B testing, AI auto-embedding) and are the paid layer on top of the OSS core. Nothing in this paper depends on them.

---

## Part 8 — The Kinks (The Honest Section)

Every framework has a tax. Here is Payload's, in the order you will meet it.

### 8.1 The Next.js coupling is real

Payload 3 doesn't just *work with* Next.js — it lives inside it, and the version compatibility window is explicit: `15.2.9–15.2.x`, `15.3.9–15.3.x`, `15.4.11–15.4.x`, `16.2.6+`. Notice the *patch floors*. You cannot blindly ride the newest Next.js canary, and when Next ships a security patch, Payload ships a matching bump across core and templates. Practical consequences: keep an eye on Payload release notes when upgrading Next, and know that `cacheComponents` (Next 16's caching model) can run alongside Payload without admin-panel errors, but full compatibility is explicitly not guaranteed yet.

### 8.2 ESM, everywhere

`withPayload` is an ECMAScript module. Your `next.config` must be `.mjs` (or your package must be `"type": "module"`), and old `require`/`module.exports` habits in that file must become `import`/`export`. Five-minute fix, guaranteed first-run papercut.

### 8.3 The `overrideAccess` default will bite you eventually

In 3.x, Local API calls skip access control by default. Server code that *assumes* access control is enforced — say, a custom endpoint that queries with a user's session — will happily leak unpublished drafts or other users' rows until you pass `overrideAccess: false`. This is not hypothetical; it is why 4.0 flips the default. **Habit to adopt today: every Local API call on behalf of a user is explicit** — `overrideAccess: false, user` — even when it feels redundant.

### 8.4 Migrations discipline (relational databases)

Dev-mode schema push is convenient and dangerous: it is not a migration, and it does not exist in production. Every config change to a relational schema needs `migrate:create` → review the generated SQL → `migrate` in the deploy. The 3.90.0 release is the case study: new auth fields, an explicit migration command in the notes, and a population of users who had to learn this quickly. Also regenerate types after config changes (`generate:types`), or your editor will lie to you.

### 8.5 Serverless uploads need a plan

Default local-disk storage plus serverless functions equals disappearing files. If you deploy to Vercel or Cloudflare, budget time for a storage adapter (S3, Vercel Blob, R2…) and know the September 2026 hardening changes: 50 MB multipart cap by default, strict SVG/XML validation, trusted-origin checks on external fetches.

### 8.6 Lexical is powerful and different

Rich text is stored as **JSON**, not HTML — rendering means running converters (`@payloadcms/richtext-lexical` ships JSX, HTML, Markdown, and plaintext converters). Custom editor features are a genuine learning curve (Lexical is a framework, not a textarea), and one rule is non-negotiable: **never install `lexical` yourself** — use Payload's re-exports (`@payloadcms/richtext-lexical/lexical`), because version mismatches corrupt the editor. Also note: Slate is legacy and **removed in 4.0**.

### 8.7 Custom admin work means React

The config covers 95% of admin needs; the last 5% means writing React components inside Next.js's server/client component split, with `@payloadcms/ui` as your kit. It is well-documented *now* (June 2026 onward) — but it is still app code with app-code complexity.

### 8.8 The Access Operation's null fields

Covered in Part 5, repeated here because it causes real bugs: top-level access checks run with `id`, `data`, `doc` all `undefined`, and returned `where` queries are not executed. If your access function does `user.id === doc.author` without guarding, it will throw on login.

### 8.9 The release cadence is fast — read the security notes

There have been dozens of 3.x minors and hundreds of patches; the changelog is a firehose. But some releases are not routine. **18 September 2026 (3.90.0)** was a critical security release: password changes now revoke other sessions, password reset clears lockouts and is throttled (with a new field), API keys are no longer readable after generation (restore old behavior with `auth.useAPIKey.reveal`), scheduled-publish jobs now preserve the scheduling user's auth collection, and the upload hardening in 8.5 landed. If you run Payload and have not upgraded past 3.90.1, that is your next task.

### 8.10 Figma owns it now

Payload joined Figma in March 2025 — a company whose design-tool ethos is a decent cultural match, and so far the open-source posture has held (still MIT, still self-hostable, still shipping weekly). But be clear-eyed: the center of gravity is moving upmarket (SSO, workflows, enterprise AI). The 4.0 beta's headline features — admin redesign, TanStack, MCP — are framework investments, which is a good sign for people building on it. Nothing in this paper assumes the acquisition changes your self-hosted deployment.

---

## Part 9 — Should You Use It? (and the 4.0 Question)

**Pick Payload if:** you ship Next.js, you want content and app in one repo, you value typed access to your own database, and you would rather write a config than click through an installer.

**Skip it if:** your team is not in JavaScript, you need a click-only setup, or you want someone else to host and operate the CMS.

**The 4.0 decision, plainly:**

- **New project today: start on 3.90.x.** It is the stable line, it is where the docs' `v3` set points, and it is what production users run. Do not start on the 4.0 beta.
- **Existing project:** upgrade to at least 3.90.1 for the security fixes. Then do the prep work that makes 4.0 a boring upgrade — be explicit about `overrideAccess`, know whether you use Slate rich text (it is removed in 4.0), and keep packages in sync.
- **Watch for:** the admin UI redesign, TanStack Start as a supported framework (v4 docs already show auth server functions for "Next.js or TanStack Start"), the MCP plugin's maturity, the `overrideAccess` default flip, locale publish behavior changes, and the 3.0→4.0 migration guide — which already exists in the v4 docs, alongside an agent-assisted upgrade codemod.

The short version: 3.x is the product you can build on; 4.0 is the direction of travel. Both facts are stable enough to plan around.

---

## Cheat Sheet

**Commands**

| Command | What it does |
|---|---|
| `npx create-payload-app` | Scaffold a new Payload project |
| `pnpm payload generate:types` | Regenerate `payload-types.ts` from your config |
| `pnpm payload migrate:create <name>` | Create a migration (relational DBs) |
| `pnpm payload migrate` | Run pending migrations |
| `pnpm payload migrate:status` | See what is pending |
| `pnpm dev` → `localhost:3000/admin` | First user, then everything |

**Config snippet bank**

```ts
// Auth-enabled collection (the admin panel needs one)
const Users = {
  slug: 'users',
  auth: true,
  admin: { useAsTitle: 'email' },
  fields: [{ name: 'role', type: 'select', options: ['admin', 'editor'], defaultValue: 'editor' }],
}
```

```ts
// Drafts + versions on a content collection
const Posts = {
  slug: 'posts',
  versions: { drafts: { autosave: true } },
  // documents now carry _status: 'draft' | 'published'
}
```

```ts
// Local API on behalf of a user — be explicit, always
const mine = await payload.find({
  collection: 'orders',
  overrideAccess: false,
  user,
  where: { customer: { equals: user.id } },
})
```

**Where operators (same in all three APIs):** `equals`, `not_equals`, `greater_than(_equal)`, `less_than(_equal)`, `in`, `not_in`, `exists`, `like`, `contains`, `all`, `near`, `within`, `intersects` — combined with `AND` / `OR`.

**Query tuning:** `depth` (relationship population), `select` (projection), `populate` (lean relationship reads), `pagination: false` (skip counts), `limit`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `withPayload` import error on boot | `next.config` is CommonJS | Rename to `.mjs` or set `"type": "module"`; convert `require`s |
| Admin panel 404s after install | `(payload)` files not copied / route group misplaced | Re-copy from the Blank Template; check `app/(payload)/` |
| "Unsupported Next.js version" | Next outside the supported ranges | Pin to a supported range (e.g. 16.2.6+), then rebuild |
| Custom endpoint leaks drafts/other users' data | Local API `overrideAccess` defaults to `true` | Pass `overrideAccess: false` + `user`; audit every user-facing query |
| Schema drift in production | Used dev push instead of migrations | `migrate:create`, review SQL, run `migrate` in deploy |
| Types out of date after a config change | Forgot to regenerate | `pnpm payload generate:types`; wire it into CI |
| Editor crashes / weird paste behavior after installing `lexical` | Direct dependency on Lexical | Remove it; import from `@payloadcms/richtext-lexical/lexical` |
| Uploads vanish on serverless | Local-disk storage | Add a storage adapter (S3 / Vercel Blob / R2 / …) |
| 413 on large multipart uploads | New 50 MB default cap | Raise `upload.requestSizeLimit` deliberately |
| Access function throws on login | Access Operation runs with `id`/`doc` undefined | Guard for the top-level case first |
| Join query suddenly throws `QueryError` | Stricter polymorphic join validation (3.90.0) | Rewrite filters to direct, supported field paths |
| API keys unreadable in admin | Security change in 3.90.0 | Expected; opt back in with `auth.useAPIKey.reveal` if truly needed |

---

## Video Library

YouTube **search** links only — Payload moves fast, and fixed video links rot.

| Search | What you'll find |
|---|---|
| [Payload CMS tutorial 2026](https://www.youtube.com/results?search_query=Payload+CMS+tutorial+2026) | Current beginner walkthroughs |
| [Payload CMS Next.js install](https://www.youtube.com/results?search_query=Payload+CMS+Next.js+install) | The v3-in-Next.js setup end to end |
| [Payload CMS vs Strapi](https://www.youtube.com/results?search_query=Payload+CMS+vs+Strapi) | Head-to-head for Node CMS choices |
| [Payload CMS access control](https://www.youtube.com/results?search_query=Payload+CMS+access+control) | Roles, field-level, and admin visibility |
| [Payload CMS local API](https://www.youtube.com/results?search_query=Payload+CMS+local+API) | Querying from Server Components |
| [Payload CMS Postgres migrations](https://www.youtube.com/results?search_query=Payload+CMS+Postgres+migrations) | The migrate workflow in practice |
| [Payload CMS drafts versions](https://www.youtube.com/results?search_query=Payload+CMS+drafts+versions) | Editorial workflow setup |
| [Payload CMS Lexical rich text](https://www.youtube.com/results?search_query=Payload+CMS+Lexical+rich+text) | Converters and custom features |
| [Payload CMS live preview](https://www.youtube.com/results?search_query=Payload+CMS+live+preview) | Wiring preview into a frontend |
| [Payload CMS MCP plugin](https://www.youtube.com/results?search_query=Payload+CMS+MCP+plugin) | Agents talking to your CMS |

---

## Written References & Docs

Payload's docs are versioned (`/docs/v3/...`, `/docs/v4/...`) — match them to your installed major version.

| Source | URL |
|---|---|
| Documentation home | `https://payloadcms.com/docs` |
| What is Payload? | `https://payloadcms.com/docs/v3/getting-started/what-is-payload` |
| Concepts | `https://payloadcms.com/docs/v3/getting-started/concepts` |
| Installation | `https://payloadcms.com/docs/v3/getting-started/installation` |
| The Payload Config | `https://payloadcms.com/docs/v3/configuration/overview` |
| Fields overview | `https://payloadcms.com/docs/v3/fields/overview` |
| Access control | `https://payloadcms.com/docs/v3/access-control/overview` |
| Hooks | `https://payloadcms.com/docs/v3/hooks/overview` |
| Local API | `https://payloadcms.com/docs/v3/local-api/overview` |
| REST API | `https://payloadcms.com/docs/v3/rest-api/overview` |
| GraphQL | `https://payloadcms.com/docs/v3/graphql/overview` |
| Queries | `https://payloadcms.com/docs/v3/queries/overview` |
| Database | `https://payloadcms.com/docs/v3/database/overview` |
| Migrations | `https://payloadcms.com/docs/v3/database/migrations` |
| Versions & drafts | `https://payloadcms.com/docs/v3/versions/drafts` |
| Uploads | `https://payloadcms.com/docs/v3/upload/overview` |
| Jobs queue | `https://payloadcms.com/docs/v3/jobs-queue/overview` |
| Plugins | `https://payloadcms.com/docs/v3/plugins/overview` |
| MCP plugin | `https://payloadcms.com/docs/v3/plugins/mcp` |
| Rich text (Lexical) | `https://payloadcms.com/docs/v3/rich-text/overview` |
| Live Preview | `https://payloadcms.com/docs/v3/live-preview/overview` |
| Admin panel | `https://payloadcms.com/docs/v3/admin/overview` |
| Custom components | `https://payloadcms.com/docs/v3/custom-components/overview` |
| UI components | `https://payloadcms.com/docs/v3/ui-components/overview` |
| Deployment | `https://payloadcms.com/docs/v3/production/deployment` |
| Performance | `https://payloadcms.com/docs/v3/performance/overview` |
| Troubleshooting | `https://payloadcms.com/docs/v3/troubleshooting/troubleshooting` |
| 3.0 → 4.0 migration guide | `https://payloadcms.com/docs/v4/migration-guide/v4` |
| Releases (changelogs) | `https://github.com/payloadcms/payload/releases` |
| GitHub | `https://github.com/payloadcms/payload` |
| Discord | `https://discord.com/invite/r6sCXqVk3v` |

---

## Glossary

| Term | Meaning |
|---|---|
| **Access Operation** | The login-time run of every access function that maps what a user can do in the admin panel |
| **Adapter** | The package that connects Payload to your database or file storage |
| **Collection** | A group of documents sharing a schema |
| **Config** | `payload.config.ts` — the single source of truth for the whole system |
| **Depth** | How many levels of related documents get auto-populated in a query |
| **Draft** | An unpublished document version, tracked via `_status` |
| **Field** | A schema unit that also generates its own admin UI |
| **Global** | A one-document collection (settings, nav, footer) |
| **Hook** | Your code, run at defined points in a document's lifecycle |
| **Job / Task / Queue / Schedule** | The jobs system: offloaded work, typed routines, ordered groups, cron timing |
| **Lexical** | The rich text engine; stores JSON, converts to JSX/HTML/Markdown |
| **Local API** | In-process operations (`payload.find(...)`) with no HTTP overhead |
| **MCP** | Model Context Protocol — the plugin that exposes your content to AI agents |
| **Migration** | Versioned, reviewable schema change (relational databases) |
| **overrideAccess** | The Local API switch that skips access control — `true` by default in 3.x, flipping to `false` in 4.0 |
| **Select / Populate** | Query projection: which fields to return, and how to lean out populated relationships |
| **Slate** | Payload's legacy rich text editor; removed in 4.0 |
| **Version** | A stored historical revision of a document |

---

## FAQ & Next Steps

**Is Payload free?** The core is open source (MIT) and self-hostable with no seat limits. There is a paid enterprise tier (SSO, publishing workflows, visual editor, A/B testing, AI features) — nothing in this paper requires it.

**Do I have to use Next.js?** In 3.x, Next.js is the supported primary path — the admin panel *is* Next.js routes in your app. Payload can run outside Next.js for scripts and other frameworks (there's a dedicated docs page), and 4.0 broadens this further with TanStack Start support. If you hate Next.js, treat that as a real cost, not a footnote.

**MongoDB or Postgres?** Both are first-class. Postgres if your team is SQL-native or you want relational rigor plus Drizzle; MongoDB if you want document flexibility and the longest-trodden path. Decide before you model data.

**How is this different from Strapi?** Strapi is admin-first with a plugin market; Payload is code-first and installs into your app. If you want to write your CMS as TypeScript that lives next to your pages, Payload. If you want a standalone admin you configure mostly by clicking, Strapi.

**Should I wait for 4.0?** No — start on 3.90.x, and do the prep from Part 9 so the eventual upgrade is routine. 4.0 is in beta with a migration guide and a codemod already in the repo.

**How do I keep my AI coding agent accurate about Payload?** Point it at the versioned `llms.txt` (`https://payloadcms.com/docs/v3/llms.txt`), and watch the 4.0 line: the `payload` package itself now ships an agent skill for exactly this.

**What should I read next in this series?**

- [Payload CMS, Mastered](23-payload-cms-mastered.html) — the working guide: Local API idioms, access recipes, hooks without footguns, and the 4.0 upgrade checklist.
- [Next.js in 2026](13-nextjs-2026.html) — the framework Payload installs into, including the caching model it currently plays nicest with.
- [Postgres as the Whole Backend](03-postgres-as-the-whole-backend.html) — if you pick the Postgres adapter, this is the database half of the story.
- [TypeScript 7 and the Year the Compiler Learned Go](19-typescript-7-go-compiler-2026.html) — the type system your config and generated types live in.

---

## Verification Note

Verified against Payload's official documentation (v3 and v4 sets, via `payloadcms.com/docs/v3/llms.txt` and `/docs/v4/llms.txt`), the official release notes for 3.90.0–3.90.2 and the 4.0 canary line, and Payload's own blog, in September 2026. Version numbers, supported Next.js ranges, and security-release details were taken from those primary sources; nothing has been invented. Payload ships frequently — treat the structural facts here as stable and the exact version numbers as moving. When in doubt, `llms.txt` for your installed major version is the fastest ground truth, and release notes are the source for breaking changes.

---

## Your Setup Notes

Record your actual choices here, so future-you doesn't have to re-derive them.

```text
Payload version installed:         ____________________
Next.js version:                   ____________________
Database adapter:                  ____________________
  Mongo / Postgres / SQLite / Vercel Postgres

AUTH
  User collections:                ____________________
  Strategies in use:               cookie / JWT / API key
  First admin email:               ____________________

CONTENT MODEL
  Collections:                     ____________________
  Globals:                         ____________________
  Drafts + versions enabled on:    ____________________

DEPLOY TARGET
  Vercel / Cloudflare / Docker / other:  ____________________
  File storage:                    local / S3 / Vercel Blob / R2 / other
  Migrations in deploy pipeline?   [ ]

UPGRADE WATCHLIST
  On 3.90.1+?                      [ ]
  overrideAccess made explicit everywhere?   [ ]
  Slate anywhere in the project?   [ ] (must be gone before 4.0)
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js app, uses opencode and AI coding agents daily, takes
notes in Markdown, and learns by doing. He is new to Payload CMS and wants to learn it deeply
before adopting it.

Paper: markdown_docs/22-payload-cms-research-paper.md
Companion: markdown_docs/23-payload-cms-mastered.md (the advanced working guide — keep them in sync)
Topic: Payload CMS from zero — what it is (Next.js fullstack framework / config-as-code CMS),
how it installs into a Next.js app, the three APIs (Local/REST/GraphQL), database adapters and
migrations, auth/access control/uploads, drafts/versions/localization/jobs, the plugin + MCP
ecosystem, the honest kinks, and the 3.x → 4.0 upgrade story.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only, version-matched) → Glossary →
FAQ & Next Steps → Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure
Markdown, no HTML. Every fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words; (B) add a Part he names (choosing
Postgres vs MongoDB in depth, the ecommerce plugin suite, multi-tenant architecture, writing a
custom plugin, hosting on Cloudflare vs Vercel); (C) re-verify the whole paper against the
current release notes and refresh version numbers.

Rules: never invent Payload APIs, config keys, CLI commands, package names, or version numbers —
verify each against payloadcms.com/docs (match the major version!) or the payloadcms/payload
GitHub releases. Distinguish stable-line (3.x) facts from 4.0 beta facts at all times. Never
state pricing or licensing facts without citing Payload's own pages. Keep the structure.
Report path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://payloadcms.com/docs
https://payloadcms.com/docs/v3/llms.txt
https://payloadcms.com/docs/v4/llms.txt
https://payloadcms.com/docs/v3/getting-started/installation
https://payloadcms.com/docs/v3/getting-started/concepts
https://payloadcms.com/docs/v3/local-api/overview
https://payloadcms.com/docs/v3/access-control/overview
https://payloadcms.com/docs/v3/database/migrations
https://payloadcms.com/docs/v3/plugins/mcp
https://payloadcms.com/docs/v4/migration-guide/v4
https://github.com/payloadcms/payload/releases
https://payloadcms.com/blog
```
