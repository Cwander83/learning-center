# The Complete Guide: Payload CMS, Mastered

> Once Payload is running, the real questions start: when to use the Local API versus REST, how access control actually composes, why your Postgres migration is out of sync, and which of the ninety-odd 3.x releases quietly changed something you rely on. This is the working guide.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Part one of this pair ([The Research Paper](22-payload-cms-research-paper.html)) taught you what Payload *is*. This one assumes you are building with it — and that you have discovered the difference between "it works" and "it works the way it should."

Mastery of Payload is not knowing more config keys. It is internalizing one flow — **access → hooks → database → hooks → output** — and knowing exactly where your code runs in it, what it is allowed to assume, and which defaults will betray you when you forget them. Every section in this guide is that flow viewed from a different angle.

```
   ONE OPERATION, TOP TO BOTTOM — WHERE YOUR CODE RUNS

   payload.find / create / update / delete
   (Local API · REST · GraphQL · Admin UI — all the same path)
        │
        ▼
   ┌──────────────────────┐
   │ 1. ACCESS CONTROL    │   collection · global · field level
   │                      │   returns true/false OR a where query
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 2. HOOKS (in)        │   beforeValidate → beforeChange
   │                      │   shape input, transform, guard via context
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 3. DATABASE          │   adapter · transaction (thread `req`) · indexes
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 4. HOOKS (out)       │   afterChange → queue jobs, sync, notify
   │                      │   beforeRead → afterRead (shape output)
   └──────────────────────┘
```

The five surfaces where production bugs actually live:

1. **The `overrideAccess` default** — the Local API skips access control in 3.x; 4.0 flips it. Every user-facing query must be explicit. (Part 1)
2. **Access functions running without a document** — the Access Operation calls them with `id`/`data`/`doc` undefined at login. (Part 2)
3. **Hooks calling hooks** — an `afterChange` that updates its own collection will recurse unless you carry a flag through `req.context`. (Part 3)
4. **Drafts vs access** — previewing unpublished content is exactly where `overrideAccess: false` must be true to its word. (Part 4)
5. **Schema drift** — dev-mode push is not a migration, and September 2026 proved it with a mandatory `resetPasswordRequestedAt` migration. (Part 5)

### The analogy table

| Term | Plain-English analogy | Why it matters in practice |
|---|---|---|
| **overrideAccess** | The master key on your keyring | Convenient on the server, catastrophic on user-facing paths — be explicit, always |
| **`req` threading** | Staying inside the same phone call | Passing `req` into nested operations keeps them in one transaction |
| **Access Operation** | The badge printer at reception | Runs your access functions with no document — guard for undefined |
| **`req.context`** | A sticky note passed between hooks | Coordinates hooks, prevents recursion, carries intent |
| **Depth / Select / Populate** | Ordering at a restaurant | How much related data comes back, and how much you actually wanted |
| **Draft (`_status`)** | The "not final" stamp | Fetching drafts requires the right access context, not just a flag |
| **Autosave** | The colleague saving every 30 seconds | Lovely for editors, a write-amplification source for your DB |
| **Push vs Migrate** | Sketching vs filing blueprints | Push is for dev only; production gets reviewed migrations |
| **Client uploads** | The courier going straight to storage | Bypasses your server — hardening rules apply to all adapters |
| **Jobs / Tasks** | The outbox and the SOP manual | Offload slow work; typed inputs/outputs make workflows testable |
| **MCP** | A permissioned socket for agents | Agents read/write content through a defined interface — mind the keys |
| **Version inheritance** | The auditor using the same door policy | Versions now inherit read access when `readVersions` is unset |

> **The one-sentence version:** mastery is being explicit where Payload's defaults are permissive, guarding where its callbacks are document-less, and reviewing the changelog like it's production code — because it is.

---

## The 60-Second Version (TL;DR)

1. **Be explicit on every user-facing Local API call:** `overrideAccess: false` + `user`. The 3.x default (`true`) is now legacy behavior; 4.0 enforces access by default.
2. **Thread `req` through nested operations** or you silently opt out of transactions.
3. **Guard access functions for the no-document case** (`id`/`doc` undefined) — that's the Access Operation running at login.
4. **Use `select` and sane `depth` in lists.** The default `depth` populates relationships you often don't render.
5. **Carry `req.context` flags** to stop `afterChange` hooks from recursing into themselves.
6. **`afterChange` should queue jobs, not do slow work inline.**
7. **Drafts: `draft: true` needs `overrideAccess: false` + a real user** — that pairing *is* your preview security model.
8. **Relational DBs: every schema change gets a reviewed migration.** 3.90.0's `resetPasswordRequestedAt` is the cautionary tale.
9. **Read the 3.90.0 release notes if you haven't.** Password/session behavior, API-key visibility, upload hardening, and multipart caps all changed on 18 September 2026.
10. **4.0 prep is five checks:** explicit `overrideAccess`, no Slate, locale publish expectations, jobs access review, and a codemod dry run. Details in Part 9.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| A working Payload app | This guide starts where the paper ends | `/admin` loads, one collection exists |
| Payload **3.90.1+** | September 2026 security fixes | `pnpm why payload` |
| One relational OR non-relational DB, chosen | Parts 5 differs by adapter | Your `payload.config.ts` |
| `payload generate:types` wired in | Every pattern here leans on types | `pnpm payload generate:types` |
| 30 minutes and a scratch collection | You will want to try each pattern | Any non-production environment |

> **Read first:** [Payload CMS — The Research Paper](22-payload-cms-research-paper.html). This guide assumes the vocabulary from its analogy table.

---

## Part 1 — The Local API, Properly

### 1.1 The one habit that prevents the worst class of bug

The Local API is your primary interface, and its most important option is the one people skip. In 3.x:

```ts
// DANGEROUS on any path a user can reach — skips access control silently
const orders = await payload.find({ collection: 'orders' })

// CORRECT — the same query, on behalf of a user, with their rules applied
const orders = await payload.find({
  collection: 'orders',
  overrideAccess: false,
  user,
})
```

Adopt a house rule: **every Local API call in user-facing code is explicit about `overrideAccess`**, even when you *know* it's fine. The ones that are legitimately privileged (seed scripts, migrations, admin tooling) get a comment saying so. This single habit makes the 4.0 default flip a non-event, and it turns code review into a grep:

```bash
# Find every call that forgot to decide
rg 'payload\.(find|create|update|delete)' --glob '!**/node_modules/**'
```

### 1.2 Where `payload` comes from

Three access patterns, in order of preference:

```ts
// 1. Inside hooks / access functions / endpoints — it's handed to you
const posts = await req.payload.find({ collection: 'posts' })

// 2. Server Components, route handlers, scripts — initialize it
import { getPayload } from 'payload'
import config from '@payload-config'
const payload = await getPayload({ config })

// 3. In development, getPayload plays nicely with HMR —
//    config changes are picked up without a restart
```

### 1.3 Performance knobs that matter in production

| Option | Default behavior | The move |
|---|---|---|
| `depth` | Populates relationships to a depth (often 2) | Lists: `depth: 0` or `1`; detail pages: raise deliberately |
| `select` | Returns every field | Project only what the view renders — especially rich text and JSON |
| `populate` | Populates by default | Use it to lean out *which* related fields load when you do populate |
| `limit` + `pagination: false` | Count queries run for pagination metadata | Lists without a count UI: disable pagination to skip the count |
| `disableErrors` | Throws on `findByID` miss | `true` turns misses into `null` / empty arrays — handy in bulk jobs |

### 1.4 Transactions, locks, and context

```ts
await payload.update({
  collection: 'invoices',
  id: invoice.id,
  data: { status: 'paid' },
  req,                        // same transaction as the caller
  overrideAccess: false,
  user,
  context: { source: 'stripe-webhook' },   // readable in hooks via req.context
})
```

- **`req`** is how nested operations join the caller's transaction (Postgres always; MongoDB with replica sets). Omit it and you get a second connection doing its own thing.
- **`overrideLock: false`** enforces document locks — the same locks the admin panel uses to stop two editors clobbering each other.
- **`context`** is the sanctioned side channel into your hooks. `triggerBeforeChange`-style flags, request origins, idempotency keys — anything that isn't document data goes here, not into the data itself.

### 1.5 `findDistinct` and the operations you forget exist

Beyond the CRUD six, the Local API has a few quiet wins: `findDistinct` (unique values of a field with a count — perfect for filter UIs), `count`, `update`/`delete` *many* (batch with per-document error reporting), and `duplicateFromID` on create. Auth collections add `login`, `auth`, `forgotPassword`, `resetPassword`, `verifyEmail`, `unlock`.

---

## Part 2 — Access Control Recipes

### 2.1 The shape of a good access module

Keep access logic in shared helpers, not inline spaghetti:

```ts
// access/roles.ts — one import, used everywhere
import type { Access } from 'payload'

export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  return { id: { equals: user.id } }     // where-query access
}

export const publishedOrLoggedIn: Access = ({ req: { user } }) =>
  user ? true : { status: { equals: 'published' } }
```

`Access` functions receive `{ req, id, data, siblingData, blockData, doc }`. The ones you can trust depend on context (2.4).

### 2.2 The recipes

**Document-level ("own orders"):**

```ts
access: { read: isAdminOrSelf }   // where-query: { id: { equals: user.id } }
```

**Organization / tenant scoping:** the standard pattern is a `tenants` relationship on each document plus a `tenant` field on users, with access returning `{ tenant: { in: user.tenants.map(t => t.id) } }`. The multi-tenant plugin scaffolds exactly this (and the 3.87–3.90 releases hardened its cookie/confirm flows — upgrade if you use it).

**Field-level:**

```ts
{
  name: 'internalNotes',
  type: 'textarea',
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
  },
}
```

Field access is how you keep a secret *inside* a document rather than a secret collection. Combine with `showHiddenFields` on Local API calls when privileged code genuinely needs them.

**Locale-specific:**

```ts
const access = ({ req }) => req.locale === 'en' || req.user?.role === 'translator'
```

### 2.3 The admin panel is downstream of your functions

Hide a collection from a role and it vanishes from their sidebar — same function that protects the API. That symmetry is the feature. It also means: if your access functions are inconsistent, your admin panel *lies to you*, showing buttons that fail on click. When editors report "it says I can but I can't," the bug is in your access functions, not the UI.

### 2.4 The Access Operation: guard the no-document case

At login, Payload runs every access function at top level to build the permission map. In that pass: `id`, `data`, `siblingData`, `blockData`, `doc` are **undefined**, and any `where` query you return is **not executed** — Payload assumes no access instead. Write every function so it answers the top-level question first:

```ts
const access = ({ req: { user }, id, doc }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!id && !doc) return false          // top-level: only admins get a blanket yes
  return { owner: { equals: user.id } }  // document-level: scoped where-query
}
```

### 2.5 Test access like you test anything else

Access control is the one part of a CMS that deserves a test suite. A plain script beats manual clicking:

```ts
// scripts/verify-access.ts — run with `payload run`
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })

const asEditor = await payload.find({
  collection: 'orders',
  overrideAccess: false,
  user: editorUser,
})

const asAdmin = await payload.find({
  collection: 'orders',
  overrideAccess: false,
  user: adminUser,
})

console.assert(asEditor.totalDocs < asAdmin.totalDocs, 'editor sees fewer orders')
```

Assert the *shape* of each role's world (totals, hidden fields, denied operations), and run it whenever access code changes.

---

## Part 3 — Hooks Without Footguns

### 3.1 The lifecycle map

| Hook | Fires | Use it for |
|---|---|---|
| `beforeValidate` | Before validation, after access | Coerce input, set defaults from `req` |
| `beforeChange` | After validation, before write | Derived fields (slugs, totals), final transforms |
| `afterChange` | After the write, in the same request | **Queue jobs**; light synchronous side effects |
| `beforeRead` | Before returning documents | Inject virtual values, enforce read-time rules |
| `afterRead` | After documents load | Shape output, resolve computed fields, hide data |
| `beforeDelete` / `afterDelete` | Around deletes | Cleanup, cascade notes, audit trails |
| `afterError` | On operation errors | Structured logging, alerting |
| Field hooks (`beforeValidate` / `beforeChange` / `afterRead`) | Per field | Field-local logic that shouldn't know the collection |

Global hooks mirror the collection set; auth collections add login/logout/refresh hooks.

### 3.2 Recursion: the bug every Payload codebase writes once

An `afterChange` hook that updates the *same* collection re-enters itself. The fix is a context flag:

```ts
const syncSlug: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (req.context?.skipSlugSync) return doc
  if (operation !== 'create' && operation !== 'update') return doc

  await req.payload.update({
    collection: 'posts',
    id: doc.id,
    data: { slug: deriveSlug(doc.title) },
    req,                                   // same transaction
    context: { skipSlugSync: true },       // the recursion brake
  })

  return doc
}
```

Two rules make this safe: always pass the flag via `req.context` (never as document data), and always thread `req` so the nested write is in the same transaction as the outer one.

### 3.3 `afterChange` is a doorway, not a workspace

Anything slow — emails, image pipelines, external API calls, search indexing — belongs in the **jobs queue**, not inline in a hook. The pattern:

```ts
const queueSync: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (operation === 'update' || operation === 'create') {
    await req.payload.jobs.queue({
      task: 'syncToSearch',
      input: { docId: doc.id },
      req,   // queueing inside the transaction means no phantom jobs on rollback
    })
  }
  return doc
}
```

Queue *inside* the transaction (pass `req`) and the job only exists if the write commits. Queue outside it and rollbacks leave you reconciling jobs for documents that never existed.

### 3.4 Field hooks vs collection hooks

Field hooks are for logic that should travel with the field wherever it's used — trimming, formatting, currency math. Collection hooks are for logic about the *document*. When a field hook needs the whole document, that's your signal it belongs in a collection hook instead. (And if you're overriding Payload's built-in fields — timestamps, IDs — the 3.89 docs added a dedicated guide; read it before touching them.)

---

## Part 4 — Drafts, Versions, and Publishing

### 4.1 `_status` is the whole game

Enable drafts and every document grows a `_status` of `draft` or `published`. Public reads should filter on it; preview reads should not. The only correct way to read drafts is:

```ts
const preview = await payload.find({
  collection: 'posts',
  draft: true,             // include drafts in the result set
  overrideAccess: false,   // enforce access control…
  user,                    // …as this specific editor
})
```

That trio — `draft: true`, `overrideAccess: false`, a real `user` — *is* your preview security model. If any leg is missing, you have either a broken preview or a data leak. Pick which one deliberately.

### 4.2 Autosave is a write-amplification decision

Autosave drafts are wonderful for editors and constant writes for your database. Enable per collection, not globally; keep an eye on your version tables' growth; and set retention deliberately (keep N versions, not infinity) for high-churn collections.

### 4.3 Scheduled publishing: read the 3.90.0 note

Scheduled publish/unpublish rides the jobs queue, and the September 2026 release changed how it tracks *who* scheduled the event:

- Pending scheduled publish/unpublish events **queued before the upgrade should be re-created**.
- Custom code that queues `schedulePublish` must now pass `user: { relationTo, value }` (with the user ID as `value`).
- No database migration was required for this one — but the queue semantics changed.

If you schedule content and you haven't upgraded to 3.90.x, audit those events as part of the upgrade, not after.

### 4.4 Version access now inherits

Historically, version reads were governed by `readVersions` alone. As of the 3.90 line, when `readVersions` is *not* configured, version operations **inherit the collection's `read` access**. Explicit `readVersions` remains authoritative. Net effect: fewer accidental version leaks by omission — but if you were relying on the old permissive behavior, make your `readVersions` explicit now.

### 4.5 Preview wiring

Pair drafts with Live Preview (Part 7): the admin iframes your frontend with a preview URL pattern, your frontend reads with `draft: true` under the editor's session, and published reads elsewhere stay clean. On Vercel, Content Link closes the loop from a rendered page back to the exact field that controls it.

---

## Part 5 — Databases in Production

### 5.1 Push is a development luxury

Relational adapters can auto-push schema changes in dev. That convenience has one rule with no exceptions: **production gets migrations.**

```bash
# The loop, every time
pnpm payload migrate:create add-invoice-indexes
# → review the generated SQL like it's a PR
pnpm payload migrate
```

Treat the generated migration as reviewable code. The 3.90.0 upgrade made this concrete for every relational user: a new `resetPasswordRequestedAt` field on auth collections shipped with an explicit migration command in the release notes. If your deploy pipeline doesn't run migrations, that release was a broken login waiting to happen.

### 5.2 The polymorphic join restrictions (3.90.0)

Joins whose `collection` spans multiple collections now validate `where` constraints strictly — unsupported filters throw `QueryError` instead of approximating. The unsupported list is worth memorizing if you use polymorphic joins or folder browsing:

- Localized fields
- Fields nested inside arrays or blocks
- Paths traversing relationship, upload, or JSON fields (e.g. `owner.email`)
- The `near`, `within`, `intersects`, and `all` operators
- The same path defined incompatibly across joined collections (number in one, text in another)

Also: read-access rules and admin `baseListFilter`s on join targets are evaluated under these rules — a join can start failing because of a *filter in a different collection's access function*. When a join query suddenly errors, walk the target collections' access rules first.

### 5.3 Indexes are not optional at scale

Declare indexes on every field you filter, sort, or join on — status, slug, tenant, foreign keys. Payload's performance docs cover the mechanics; the discipline is reviewing queries and indexes together whenever a list view gets slow. The cheapest performance work in Payload is `select` + index + sane `depth`, in that order.

### 5.4 Mongo vs Postgres, one last time

- **MongoDB:** document flexibility suits blocks/arrays; transactions need a replica set; no migration ceremony.
- **Postgres:** Drizzle underneath; strict schemas, strict migrations, first-class transactions; the stricter join validation above applies most visibly here.
- **SQLite:** local dev and small deploys; same Drizzle family.

And for containers: Payload documents **building without a database connection** — the pattern that keeps your Docker image build from demanding a live DB.

---

## Part 6 — Uploads & Media at Scale

### 6.1 The adapter decision comes first

Local disk works until the moment you deploy serverless — then files evaporate between invocations. Choose early: S3, GCS, Azure, Vercel Blob, R2, Uploadthing, or a custom adapter. Everything below assumes an adapter.

### 6.2 The September 2026 hardening, as a checklist

The 3.90.0 release rewrote the security posture of uploads. If you built media pipelines before it, walk this list:

- **SVG / XHTML / XML uploads** are now strictly validated; direct client uploads (especially Azure/custom) must send required metadata. Legacy behavior requires `allowRestrictedFileTypes: true` — don't reach for it casually.
- **Client uploads** (`clientUploads: true`) are hardened across S3/GCS/Azure/custom. GCS users: add the `x-goog-if-generation-match` header to CORS allowed headers.
- **Azure containers default to private.** If you relied on `containerAccess: 'blob'`, set it explicitly.
- **External file fetches need a trusted origin.** Relative URLs requiring a Payload session cookie now fail; configure `serverURL` or CORS/CSRF origins, and review `externalFileHeaderFilter` — it receives context now, and should strip `cookie`/`authorization` for cross-origin destinations.
- **Filenames are sanitized.** Custom "prefix" fields used as ordinary data need renaming; storage-prefix changes ride along with file replacement.
- **Multipart uploads cap at 50 MB by default.** Raise `upload.requestSizeLimit` deliberately (the release notes' example: 75 MiB), never reflexively.

### 6.3 The day-two details

Image sizes and focal point live in the upload collection config (with `sharp` installed). Access control applies to files like any document — that's how you build private media. And when replacing a file, remember the release-note nuance: draft re-uploads and storage-prefix changes have specific semantics now; read before scripting bulk media migrations.

---

## Part 7 — Custom Admin & Live Preview

### 7.1 Custom components: the map

| You want to… | The slot |
|---|---|
| Change how a field edits | `admin.components.Field` on the field |
| Change how a field renders in lists | `Cell` |
| Add a dashboard panel | `admin.components.beforeDashboard` / `afterDashboard` (Dashboard Widgets) |
| Add a whole page | Custom views (`admin.components.views`) |
| Wrap the admin in your own context | Custom providers (root components) |
| Restyle | `admin.custom.scss` + CSS variables |

`@payloadcms/ui` exports the panel's own components — Button, Banner, Pill, Table, DatePicker, Modals, Shimmer, and the rest — so custom admin work looks native instead of adjacent. The component library docs (June 2026) are the map; read them before hand-rolling a component that already exists.

### 7.2 Server vs client components in admin code

The admin panel is React Server Components. Custom components that use state, effects, or event handlers must be client components (`'use client'`); data-heavy renders can stay server-side. The classic admin bug is importing a client-only library into a server component — the error message is usually clear, the instinct to "fix" it by marking everything `'use client'` is not. Mark the smallest component that needs interactivity.

### 7.3 Live Preview, wired correctly

Live Preview has server-side and client-side integration paths; both boil down to: the admin iframes your frontend at a configured URL, and your frontend listens for draft updates (`@payloadcms/live-preview-react` on the client). The security pairing from Part 4 applies — preview reads are `draft: true` + `overrideAccess: false` + the editor's `user`. Do not build a "preview mode" that skips access control; that is how internal drafts end up in search engines.

### 7.4 The admin conveniences you should turn on

- **Document locking** — prevents two editors from overwriting each other; respect it in custom endpoints via `overrideLock`.
- **Folders** — organize documents across collections (and note: folder browsing uses `baseListFilter`, which Part 5.2 says is now under stricter join validation).
- **Query Presets** — let editors save filters/columns/sort orders instead of re-building them.
- **Trash** — soft deletes with recovery; check your retention expectations before enabling everywhere.

---

## Part 8 — Jobs, Tasks, and Scheduled Work

### 8.1 The vocabulary, precisely

| Noun | What it is |
|---|---|
| **Queue** | An ordered group of jobs |
| **Job** | One unit of offloaded work (a task + input), persisted and retryable |
| **Task** | A typed function declaration with input/output schemas — the runnable |
| **Workflow** | Tasks composed into multi-step sequences |
| **Schedule** | Cron-style timing for recurring jobs |

### 8.2 The task pattern

Tasks are where Payload's typing pays off: input and output schemas make workflows inspectable and testable.

```ts
import type { TaskConfig } from 'payload'

export const syncToSearch: TaskConfig<'syncToSearch'> = {
  slug: 'syncToSearch',
  inputSchema: [{ name: 'docId', type: 'text', required: true }],
  outputSchema: [{ name: 'indexed', type: 'checkbox' }],
  handler: async ({ input, req }) => {
    await searchClient.index(input.docId, req.payload)
    return { output: { indexed: true } }
  },
}
```

### 8.3 Access defaults changed — twice

The jobs system's access defaults were tightened in the 3.89 line and again for 4.0 (the 3.89 note literally says it "backports the v4 jobs access changes"). Concretely: jobs operations now carry explicit access expectations, and v4 extends the `overrideAccess` default flip to `payload.jobs.*` as well. If you built custom job-processing endpoints or queue code in early 3.x, re-read the access behavior on upgrade.

### 8.4 Running workers

Jobs execute via your app (`autoRun`) or via the Payload CLI for worker-style processing (`npx payload jobs:run` — check `npx payload --help` for your version's exact surface). Schedules cover recurring work (nightly syncs, cleanup). The operational rule from Part 3 stands: queue from hooks *inside* transactions; process in workers; never do the slow thing inline.

---

## Part 9 — Types, Tooling, and Upgrade Discipline

### 9.1 Types are a build artifact — treat them like one

`payload generate:types` is not a convenience; it's a compile step. Wire it into CI and fail the build if the generated file drifts from what's committed. Local API calls infer their types from `payload-types.ts`, so stale types mean your editor (and your agent) confidently autocompletes yesterday's schema. There's also an experimental **TypeScript plugin** for IDE support on `PayloadComponent` import paths — inline validation, autocomplete, go-to-definition — worth trying if you do custom admin work.

### 9.2 Version sync, or you will meet the hardest bugs

Every official `@payloadcms/*` package is published in lockstep. Mixed versions produce runtime errors that look like logic bugs. Pin them together (one version, one bump), and let the release notes drive the upgrade — especially when the release is titled "security."

### 9.3 The security-release playbook (learned from 3.90.0)

When a release like 18 September 2026 lands, run this sequence:

1. **Read the notes before upgrading.** The 3.90.0 notes listed affected conditions per change ("Affected if you…") — scan for your own setup.
2. **Regenerate types:** `pnpm payload generate:types`.
3. **Relational databases: create and run the migration** (`migrate:create` → review → `migrate`).
4. **Re-create pending scheduled publish events** and update custom `schedulePublish` queue code to the new `user: { relationTo, value }` shape.
5. **Walk the upload checklist** (Part 6.2) if you touch SVG/XML, client uploads, Azure, external fetches, or multipart.
6. **Check the small print:** API keys no longer readable after generation (`auth.useAPIKey.reveal` restores); form-builder submission read defaults tightened; polymorphic joins now throw on unsupported filters.
7. **If you maintain custom Lexical features:** verify they compile and paste correctly — and remove any direct `lexical` dependency (use Payload's re-exports).

That seven-step list generalizes: every security release follows roughly this shape.

### 9.4 The 4.0 prep checklist

4.0 is in beta with a published migration guide. Do this now so it stays boring:

- [ ] **Every Local API call explicit about `overrideAccess`** — including `payload.jobs.*` call sites.
- [ ] **No Slate anywhere** — Slate rich text is removed in 4.0; migrate to Lexical first (the v3 docs carry the migration guide).
- [ ] **Locale publish behavior reviewed** — 4.0 publishes the active locale by default and removes `defaultLocalePublishOption`.
- [ ] **Jobs access review** — the 3.89 backport was the early warning.
- [ ] **Versions access made explicit** — set `readVersions` deliberately; inheritance is now the fallback.
- [ ] **Run the codemod** — 4.0 ships an agent-assisted upgrade command; dry-run it and read the diff.
- [ ] **Decide your framework story** — 4.0 adds TanStack Start as a supported target alongside Next.js; if you were waiting for options, they're coming.

### 9.5 Keeping your agents accurate

Payload ships `llms.txt` and `llms-full.txt` per major version — point your coding agent at the *version-matched* one. In the 4.0 line, the `payload` package itself ships an **agent skill**, and the repo has migrated to `AGENTS.md`, so agents get version-accurate guidance instead of hallucinated config keys. If your agent writes Payload code from memory, it is writing 2024-era Payload. Fix the input.

---

## Part 10 — Plugins & the MCP Era

### 10.1 The catalog that earns its keep

| Plugin | What it saves you |
|---|---|
| **SEO** | Metadata fields + a tab editors actually understand |
| **Search** | Fast search records generated from your documents |
| **Redirects** | A redirects collection your editors control |
| **Nested Docs** | Parent/child/sibling trees with slugs |
| **Form Builder** | Dynamic forms + submission handling (read the 3.90 access defaults) |
| **Import / Export** | CSV/JSON pipelines for bulk content ops |
| **Multi-Tenant** | Tenant scaffolding + scoped access patterns |
| **Stripe / Ecommerce suite** | Payments and a commerce data model |
| **Sentry** | Error tracking inside Payload's lifecycle |
| **Cloud storage adapters** | S3/GCS/Azure/Vercel Blob/R2 wiring |
| **MCP** | The agent interface — next section |

### 10.2 Writing your own, without forking

Plugins are functions that receive and return the config — that's the whole trick. The plugin API grew an advanced layer (`definePlugin`, `RegisteredPlugins`) for execution ordering and typed cross-plugin communication. The best practice for internal plugins: keep them in-repo (a `plugins/` folder that transforms your config) until they're genuinely reusable; then extract.

### 10.3 MCP: your content, as an agent tool

The MCP plugin exposes your Payload instance as a Model Context Protocol server — agents can list collections, read documents, and (per configured permissions) create/update content. Three working notes from the release line:

- **Access control is the point.** The plugin's API-keys collection got tightened access defaults (3.88), and the v4/3.90 jobs-access philosophy applies: assume agents start with the *least* privilege and widen deliberately.
- **Watch the version pairings.** 3.90.2 fixed MCP create/update tools crashing under TypeScript 6 — a reminder that plugin + TS-version interactions are real.
- **Treat agent writes like any other untrusted input.** Schema validation on, access control explicit, and — because agents hallucinate structure — prefer narrow, purpose-built tasks over blanket "manage everything" grants.

If you're also hardening the agent side of the fence, the [Prompt Injection & Agent Security](02-prompt-injection-agent-security.html) paper in this series is the companion read.

---

## Cheat Sheet

**Local API options that matter**

| Option | Default | Reach for it when |
|---|---|---|
| `overrideAccess` | `true` (3.x) — **be explicit** | Always, on user-facing paths |
| `user` | — | Pair with `overrideAccess: false` |
| `req` | — | Inside hooks/endpoints, to join the transaction |
| `depth` | config-driven | Tuning list vs detail payloads |
| `select` | all fields | Trimming rich text/JSON from lists |
| `populate` | default | Lean relationship loading |
| `draft` | `false` | Preview flows (with `overrideAccess: false` + `user`) |
| `pagination: false` | `false` | Skipping count queries |
| `context` | `{}` | Passing intent to hooks |
| `overrideLock` | `true` | Enforcing document locks |
| `disableErrors` | `false` | Bulk operations that tolerate misses |

**Hook map (collection)**

`beforeOperation → beforeValidate → beforeChange → [DB] → afterChange → beforeRead → afterRead → (beforeDelete → afterDelete) → afterError`

**Where operators (all APIs):** `equals`, `not_equals`, `greater_than(_equal)`, `less_than(_equal)`, `in`, `not_in`, `exists`, `like`, `contains`, `all`, `near`, `within`, `intersects` + `AND` / `OR`.

**Commands**

| Command | Use |
|---|---|
| `pnpm payload generate:types` | Refresh `payload-types.ts` (CI!) |
| `pnpm payload migrate:create <name>` | Draft a migration |
| `pnpm payload migrate` / `migrate:status` | Apply / inspect |
| `npx payload jobs:run` | Process queued jobs (check `--help` for your version) |

**The access helper you'll copy into every project**

```ts
import type { Access } from 'payload'

export const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

export const scoped: Access = ({ req: { user }, id }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!id) return false                    // Access Operation pass
  return { owner: { equals: user.id } }
}
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Drafts/private rows appear in a custom endpoint | `overrideAccess` default (`true`) on a user-facing query | Pass `overrideAccess: false` + `user`; grep every `payload.*` call |
| Access function throws during login | Access Operation runs with `id`/`doc` undefined | Guard the no-document case first (2.4) |
| Duplicate writes / infinite loops after save | `afterChange` hook updating its own collection | `req.context` flag + thread `req` (3.2) |
| Phantom jobs after a failed write | Job queued outside the transaction | Queue with `req` inside the hook |
| Emails/syncs slow down saves | Slow work inline in hooks | Move to jobs queue |
| Editor preview shows published content only | Query missing `draft: true` | Preview reads: `draft: true` + `overrideAccess: false` + `user` |
| Version history visible to the wrong people | `readVersions` unset (inheritance behavior) | Set `readVersions` explicitly |
| `QueryError` on a join that used to work | Stricter polymorphic join validation (3.90.0) | Rewrite filters to direct, supported paths (5.2) |
| Scheduled publish stopped after upgrade | Pre-3.90 events not re-created / old `user` shape | Re-create pending events; pass `user: { relationTo, value }` |
| Login/session oddities after upgrading | Password-change/session-revocation changes in 3.90.0 | Expected behavior; communicate to users |
| Can't read an API key in the admin anymore | 3.90.0 security change | Intended; `auth.useAPIKey.reveal` only if truly required |
| 413 on big multipart uploads | 50 MB default cap (3.90.0) | Raise `upload.requestSizeLimit` deliberately |
| GCS client uploads fail after upgrade | New `x-goog-if-generation-match` header requirement | Add it to GCS CORS allowed headers |
| Editor crashes after adding Lexical features | Direct `lexical` dependency in your package | Remove it; import via `@payloadcms/richtext-lexical/lexical` |
| "No client field found…" in version diffs | Older 3.x bug | Fixed in 3.89+; upgrade |
| MCP create/update tools crash under TS6 | 3.90.2 bug | Upgrade past 3.90.2 |
| Custom admin component errors on import | Client-only code in a server component | Mark the smallest interactive piece `'use client'` |

---

## Video Library

YouTube **search** links only — the release cadence makes fixed links dishonest.

| Search | What you'll find |
|---|---|
| [Payload CMS access control deep dive](https://www.youtube.com/results?search_query=Payload+CMS+access+control+deep+dive) | Roles, field-level, where-query access |
| [Payload CMS local API patterns](https://www.youtube.com/results?search_query=Payload+CMS+local+API+patterns) | Server-side querying done right |
| [Payload CMS hooks](https://www.youtube.com/results?search_query=Payload+CMS+hooks) | Lifecycle walkthroughs with real examples |
| [Payload CMS drafts and versions](https://www.youtube.com/results?search_query=Payload+CMS+drafts+and+versions) | Editorial workflows end to end |
| [Payload CMS migrations Postgres](https://www.youtube.com/results?search_query=Payload+CMS+migrations+Postgres) | The production migrate loop |
| [Payload CMS custom admin components](https://www.youtube.com/results?search_query=Payload+CMS+custom+admin+components) | Swapping fields, views, dashboards |
| [Payload CMS live preview](https://www.youtube.com/results?search_query=Payload+CMS+live+preview) | Server and client wiring |
| [Payload CMS jobs queue](https://www.youtube.com/results?search_query=Payload+CMS+jobs+queue) | Tasks, workflows, schedules |
| [Payload CMS MCP plugin](https://www.youtube.com/results?search_query=Payload+CMS+MCP+plugin) | Agents against your content |
| [Payload CMS upgrade guide](https://www.youtube.com/results?search_query=Payload+CMS+upgrade+guide) | Version bumps without drama |

---

## Written References & Docs

Version-match these to your installed major (`/docs/v3/...` for 3.x, `/docs/v4/...` for the beta).

| Source | URL |
|---|---|
| Local API | `https://payloadcms.com/docs/v3/local-api/overview` |
| Respecting access control in the Local API | `https://payloadcms.com/docs/v3/local-api/access-control` |
| Access control (all three scopes) | `https://payloadcms.com/docs/v3/access-control/overview` |
| Field-level access | `https://payloadcms.com/docs/v3/access-control/fields` |
| Hooks overview + context | `https://payloadcms.com/docs/v3/hooks/overview` |
| Hook context | `https://payloadcms.com/docs/v3/hooks/context` |
| Queries: depth, select, pagination | `https://payloadcms.com/docs/v3/queries/overview` |
| Versions | `https://payloadcms.com/docs/v3/versions/overview` |
| Drafts | `https://payloadcms.com/docs/v3/versions/drafts` |
| Autosave | `https://payloadcms.com/docs/v3/versions/autosave` |
| Migrations | `https://payloadcms.com/docs/v3/database/migrations` |
| Transactions | `https://payloadcms.com/docs/v3/database/transactions` |
| Indexes | `https://payloadcms.com/docs/v3/database/indexes` |
| Storage adapters | `https://payloadcms.com/docs/v3/upload/storage-adapters` |
| Custom components | `https://payloadcms.com/docs/v3/custom-components/overview` |
| UI components | `https://payloadcms.com/docs/v3/ui-components/overview` |
| Live Preview | `https://payloadcms.com/docs/v3/live-preview/overview` |
| Jobs queue / Tasks / Workflows | `https://payloadcms.com/docs/v3/jobs-queue/overview` |
| Building a plugin / Advanced plugin API | `https://payloadcms.com/docs/v3/plugins/build-your-own` |
| MCP plugin | `https://payloadcms.com/docs/v3/plugins/mcp` |
| Multi-tenant plugin | `https://payloadcms.com/docs/v3/plugins/multi-tenant` |
| TypeScript + generating types | `https://payloadcms.com/docs/v3/typescript/generating-types` |
| Performance | `https://payloadcms.com/docs/v3/performance/overview` |
| Production deployment | `https://payloadcms.com/docs/v3/production/deployment` |
| Preventing API abuse | `https://payloadcms.com/docs/v3/production/preventing-abuse` |
| 3.0 → 4.0 migration guide | `https://payloadcms.com/docs/v4/migration-guide/v4` |
| Release notes (read these) | `https://github.com/payloadcms/payload/releases` |

---

## Glossary

| Term | Meaning |
|---|---|
| **Access Operation** | Login-time execution of every access function to map admin permissions |
| **Autosave** | Draft saves on an interval; write-amplification knob |
| **`req.context`** | The sanctioned side channel into and between hooks |
| **Depth / Select / Populate** | Query shaping: population level, projection, lean population |
| **`findDistinct`** | Unique values + counts for a field — filter UIs love it |
| **`_status`** | Draft/published marker on draft-enabled documents |
| **`overrideAccess`** | Skip/enforce access on Local API operations; `true` in 3.x, `false` in 4.0 |
| **`overrideLock`** | Whether document locks are enforced (`false` = enforce) |
| **Push vs Migrate** | Dev-time schema sync vs reviewed production migrations |
| **Client uploads** | Browser-to-storage uploads that bypass your server |
| **Task / Workflow** | Typed job runnable / composition of tasks |
| **`schedulePublish`** | The job that publishes/unpublishes on a schedule (user-shape changed in 3.90.0) |
| **`readVersions`** | Access rule for version history; inherits `read` when unset |
| **MCP** | Model Context Protocol — the plugin that turns Payload into an agent tool |
| **Agent skill** | Version-matched guidance shipped inside the `payload` package (4.0 line) |

---

## FAQ & Next Steps

**What's the one thing I should fix in my codebase today?** Audit every `payload.*` call for explicit `overrideAccess`. It's the highest-leverage hour you can spend before 4.0, and it doubles as a security review.

**How do I know if my hooks are doing too much?** If a save takes longer than a page navigation, the answer is jobs. `afterChange` should queue; workers should work.

**When should I use REST instead of the Local API on the server?** Almost never. The Local API is the same operations without the HTTP hop. REST earns its place for external clients and non-Payload frontends.

**Do I need the MCP plugin to use AI with Payload?** No — but if you want agents reading and writing content through a defined interface instead of ad-hoc scripts, it's the sanctioned path. Start with read-only scopes.

**Is 4.0 going to break my app?** The breaking surface is small and documented: `overrideAccess` default, locale publish behavior, Slate removal, jobs access, version access inheritance. The migration guide and codemod exist. Run the Part 9.4 checklist and it's a routine upgrade.

**What should I read next in this series?**

- [Payload CMS — The Research Paper](22-payload-cms-research-paper.html) — the companion to this guide; start here if you skipped it.
- [Postgres as the Whole Backend](03-postgres-as-the-whole-backend.html) — the database side of the Postgres adapter in depth.
- [Prompt Injection & Agent Security](02-prompt-injection-agent-security.html) — before you hand an agent write access via MCP.
- [Next.js in 2026](13-nextjs-2026.html) — the framework your admin panel actually runs on.

---

## Verification Note

Verified against Payload's official v3 and v4 documentation sets, the release notes for 3.85–3.90.2 and the 4.0 canary line, and Payload's own blog, in September 2026. Every version-specific behavior described here (the 3.90.0 security changes, the polymorphic join restrictions, the scheduled-publish user change, the jobs access backports, the 4.0 breaking changes) was taken from those primary sources. Where a detail is version-sensitive — and in Payload, most details are — the version is named in the text. Nothing has been invented; where behavior may have moved by the time you read this, the release notes are the arbiter.

---

## Your Setup Notes

```text
PROJECT
  Payload version:                 ____________________
  Next.js version:                 ____________________
  Database adapter:                ____________________

ACCESS AUDIT (run it, then record it)
  Every payload.* call explicit?   [ ]
  Date audited:                    ____________________
  Shared access helpers live in:   ____________________

HOOKS
  Collections with afterChange:    ____________________
  Jobs queueing from hooks:        yes / no
  Recursion guard convention:      req.context.________

PREVIEW
  draft:true + overrideAccess:false + user   [ ] wired
  Live Preview:                    server / client / not yet

UPGRADE WATCHLIST
  On 3.90.1+?                      [ ]
  Slate removed from project?      [ ]
  readVersions explicit?           [ ]
  schedulePublish queue code updated?  [ ]
  4.0 codemod dry-run:             [ ]
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js app, uses opencode and AI coding agents daily, takes
notes in Markdown, and learns by doing. He is now building with Payload CMS and wants the
advanced, practitioner-level guide.

Paper: markdown_docs/23-payload-cms-mastered.md
Companion: markdown_docs/22-payload-cms-research-paper.md (the from-zero paper — keep them in sync)
Topic: Working mastery of Payload CMS — Local API discipline (overrideAccess, req threading,
select/populate/depth), access-control recipes and the Access Operation caveat, hooks without
recursion, drafts/versions/publishing semantics, production database migrations and the
polymorphic join restrictions, upload hardening, custom admin components, jobs/tasks/workflows,
MCP, and the 3.x → 4.0 upgrade checklist.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only, version-matched) → Glossary →
FAQ & Next Steps → Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure
Markdown, no HTML. Every fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words; (B) add a Part he names (a
complete multi-tenant build-out, the ecommerce plugin suite in depth, writing and publishing a
plugin, hosting Payload on Cloudflare vs Vercel vs Docker, building a custom Lexical feature);
(C) turn any Part into a step-by-step checklist for his actual project and return the exact
code diffs.

Rules: never invent Payload APIs, config keys, CLI commands, release-note claims, or version
numbers — verify each against payloadcms.com/docs (match the major version!) or the
payloadcms/payload GitHub releases. Always distinguish 3.x stable behavior from 4.0 beta
behavior. Never state security behavior without citing the release that changed it. Keep the
structure. Report path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://payloadcms.com/docs/v3/llms.txt
https://payloadcms.com/docs/v4/llms.txt
https://payloadcms.com/docs/v3/local-api/access-control
https://payloadcms.com/docs/v3/access-control/overview
https://payloadcms.com/docs/v3/hooks/context
https://payloadcms.com/docs/v3/versions/drafts
https://payloadcms.com/docs/v3/database/migrations
https://payloadcms.com/docs/v3/plugins/mcp
https://payloadcms.com/docs/v4/migration-guide/v4
https://github.com/payloadcms/payload/releases
```
