# The Complete Guide: The Web Platform in 2026

> You already ship Next.js. This paper explains the substrate underneath it — server components, streaming, caching, runtimes, and WebAssembly — so "it compiles" becomes "I know why."

Last verified: September 2026
Series: Chris Wander · New Paper Series

---

## The Big Picture

A modern Next.js request is not one thing. It is a relay race through four or five different execution environments, each with its own rules, its own available APIs, and its own failure modes. Here is the whole path in one diagram:

```
  BROWSER                  EDGE / CDN              NODE SERVER (origin)        BROWSER (again)
 ┌──────────┐            ┌──────────────┐        ┌─────────────────────┐      ┌──────────────────┐
 │ 1. GET   │───────────▶│ 2. CDN cache │──────▶ │ 3. RSC RENDER       │─────▶│ 5. HYDRATION     │
 │ /product │            │  static shell│        │  • server comps run │      │  • React boots   │
 │ /42      │            │  hit? serve  │        │  • data fetched     │      │  • client comps  │
 └──────────┘            │  instantly   │        │  • client comps are │      │    attach events │
                         └──────────────┘        │    placeholders     │      └────────┬─────────┘
                                │                └──────────┬──────────┘               │
                                │                           │                          ▼
                                │             4. STREAMING HTML + RSC PAYLOAD   ┌──────────────┐
                                │◀──────────────────────────────────────────────│ 6. CLIENT    │
                                │   chunk 1: <head>, layout, Suspense fallback │    ISLANDS   │
                                │   chunk 2: Suspense boundary A resolves      │  onClick,    │
                                │   chunk 3: Suspense boundary B resolves      │  useState,   │
                                └──────────────────────────────────────────────│  useEffect   │
                                                                               └──────────────┘
```

Two details matter more than anything else in that picture:

1. **The static shell** — everything that renders before any async work resolves — can be served by the CDN without waking the origin at all. Layouts, navigation, Suspense fallbacks. That is why the first paint is fast.
2. **The client never receives your server component source code.** Server components are executed and their output is serialized. The browser gets HTML plus a compact "RSC payload" — a representation of the rendered tree — and a small JavaScript bundle containing only the client components.

Here is the same architecture mapped to plain-English analogies:

| Concept | Plain-English analogy |
|---|---|
| Client-side rendering (CSR) | A restaurant that hands you an empty plate and a cookbook; you assemble dinner yourself |
| Server-side rendering (SSR) | A kitchen cooks the whole meal before the waiter carries out one tray |
| Static site generation (SSG) | Meal prepped once in the morning, plated all day |
| Incremental static regeneration (ISR) | Meal prepped once, secretly re-cooked after it has been sitting a while |
| Streaming SSR | Courses arrive as they finish cooking; soup now, steak in five minutes |
| Server Components | The kitchen preps and plates everything; you only get the finished dish, never the recipe |
| Client Components | The small table-side burner the waiter brings you, for things you must do yourself |
| Suspense boundary | A placeholder card that says "reserved for dessert" so nobody rearranges the table |
| Edge runtime | A tiny satellite kitchen with a microwave — close to you, fast, very limited tools |
| Node.js runtime | The full kitchen with the industrial oven and the walk-in freezer |
| Caching layers | Pantry (per-request), fridge (persistent data), pre-poured glasses (rendered HTML), your tray (in-browser) |
| Hydration | The waiter explaining the dish so you can now interact with it |
| WebAssembly | Shipping a CNC machine in a box that any browser can open |

---

## The 60-Second Version (TL;DR)

- **RSC is a component *type*, not a rendering strategy.** "Server Component" describes *where a component executes and what ships to the browser*. SSR describes *when HTML is produced*. You can have RSC with no SSR at all, and SSR with no RSC.
- **Server Components ship zero JavaScript.** Client Components (marked `"use client"`) ship JavaScript and are the only place you get `useState`, `onClick`, `useEffect`, and DOM access.
- **The serialization boundary is the whole ballgame.** Only serializable values cross from server to client. No functions (except Server Functions), no class instances, no DOM nodes.
- **Streaming means the server sends HTML in chunks tied to `<Suspense>` boundaries**, in whatever order they resolve. The user sees the shell immediately and each hole fills in later.
- **Partial Prerendering (PPR)** is static shell + streamed dynamic holes in one response. In Next.js 16 it is the default behavior of the App Router once you enable `cacheComponents: true`. *(Fast-moving: verify current status in the Next.js docs.)*
- **Caching defaults flipped.** `fetch` is **not cached by default** in modern Next.js. Caching is opt-in, and Next.js 16 introduced `"use cache"`, `cacheLife`, and `cacheTag`. *(Fast-moving: verify the current caching model before relying on memory.)*
- **The Edge Runtime is deprecated in Next.js 16.** `export const runtime = 'edge'` now warns. The Node.js runtime is the default for everything. *(Verify in the Next.js docs.)*
- **WebAssembly is a compile target, not a language.** It beats JS for heavy deterministic compute (media, image processing, ML inference) and loses for anything DOM-heavy, because every JS↔WASM call and every string conversion costs.
- **Core Web Vitals are LCP, INP, CLS** with "good" thresholds of ≤2.5s, ≤200ms, ≤0.1, measured at the 75th percentile. *(Thresholds evolve — verify at web.dev.)*
- **Deploy target shapes your architecture.** Vercel gives you deep framework integration; Cloudflare Workers gives you cheap global compute with real limits (128 MB memory, CPU-time budgets); self-hosting gives you control and operational load.

---

## Prerequisites

Before the deep dives, make sure you can actually run the experiments in this paper.

1. **A Next.js App Router project on a current major version.** Run `npx create-next-app@latest` and check the installed version. The caching and PPR behavior described here assumes Next.js 16 or later.

   ```bash
   npx create-next-app@latest my-platform-lab --ts --app --tailwind
   cd my-platform-lab
   npx next --version
   ```

2. **Node.js 20 or later.** Bytecode caching and modern APIs assume it.

   ```bash
   node --version
   ```

3. **A browser with DevTools and the Network tab's "Timing" view.** You will inspect chunked responses. Chrome or Edge recommended.

4. **Optional but valuable: a Wasm toolchain for Part 7.** Nothing to install for reading, but if you want to follow along:

   ```bash
   rustup target add wasm32-unknown-unknown
   # or, for TypeScript-friendly Wasm:
   npm install --save-dev assemblyscript
   ```

5. **Familiarity with `fetch`, Promises, and React hooks.** This paper assumes you can read `async/await` fluently.

6. **A willingness to read documentation side-by-side.** Three areas in this paper change faster than any blog post can track: **PPR status**, **caching defaults**, and **Core Web Vitals thresholds**. Where it matters, I flag it, and you should verify in the official docs.

---

## Part 1 — The Rendering Spectrum: CSR → SSR → SSG → ISR → Streaming → RSC

The history of frontend rendering is a history of moving one expensive step to a different machine or a different moment. Every step solves the previous step's problem and introduces a new cost. Understand the costs and you will never be confused about "which rendering mode should I use" again.

### Step 1: Client-Side Rendering (CSR)

The server sends an almost-empty HTML file plus a JavaScript bundle. The browser downloads, parses, executes, fetches data, and only then paints content.

- **Problem it solved:** Rich, app-like interactivity without full page reloads. The server can be dumb.
- **Cost it introduced:** A terrible first paint. Empty screen → bundle download → data fetch → paint. Bad for LCP and for SEO, and it wastes the server you are already paying for.

### Step 2: Server-Side Rendering (SSR)

The server runs your React tree to HTML *per request* and sends fully-formed HTML. The browser paints immediately, then downloads the bundle and "hydrates" — attaching event handlers to the existing DOM.

- **Problem it solved:** First paint. Users and crawlers get real HTML.
- **Cost it introduced:** Time to First Byte now equals your slowest database query. One slow API call blocks the *entire* page. Hydration also runs in one blocking pass, which hurts INP on large pages.
- **Critical nuance:** SSR alone does not make React components run "on the server" in the RSC sense. Classic SSR runs the *same* component code on both machines; the browser still downloads all of it.

### Step 3: Static Site Generation (SSG)

Same as SSR, but the HTML is produced *at build time* and served as a file.

- **Problem it solved:** Speed and cost. A static file from a CDN is the fastest possible response, and it costs almost nothing to serve.
- **Cost it introduced:** Staleness. Content is frozen at build time. A page that depends on user data cannot be static.

### Step 4: Incremental Static Regeneration (ISR)

Static HTML that the server can rebuild in the background after a time window or an explicit invalidation.

```tsx
// Route segment config (previous caching model)
export const revalidate = 3600 // seconds
```

- **Problem it solved:** The staleness of SSG without giving up static speed.
- **Cost it introduced:** Conceptual complexity — you now have to reason about *when* a page is fresh, and about the gap where a visitor sees stale content.

### Step 5: Streaming SSR

Instead of buffering the whole document, the server sends HTML in chunks as pieces become ready, using chunked transfer encoding. React aligns chunks with `<Suspense>` boundaries.

- **Problem it solved:** The "slowest query blocks everything" problem. The shell paints instantly; slow sections stream in.
- **Cost it introduced:** Once you start streaming, **the HTTP status code is already committed**. You cannot send a 404 later. (More on this "HTTP contract" in Part 3.)

### Step 6: React Server Components (RSC)

RSC is not the next item on that ladder. It is a **different axis**. A Server Component is a component that:

- executes *only* on the server (at build time or per request),
- can be `async` and `await` data directly,
- can read from a database or filesystem,
- and **ships zero JavaScript to the browser**.

A Client Component is a component marked with `"use client"` that is bundled, downloaded, and executed in the browser, where it can use state, effects, and event handlers.

> **The sentence that unlocks interviews:** SSR answers *"when is HTML produced?"* RSC answers *"which components execute where, and what code ships to the client?"* They are composable, not sequential.

You can render Server Components with streaming SSR (the default in Next.js App Router). You can also render Server Components to static HTML at build time. The axes are independent.

**What RSC costs:** a new mental model, an honest serialization boundary, and a learning curve around composition. But it buys you: dramatically less client JavaScript, direct data access without hand-written API endpoints, and much earlier data fetching (no client-side request waterfall).

**Try it:**

1. Create `app/page.tsx` and make it `async`, `await` some data directly, and log the data.
2. Open DevTools → Network, filter to JS, and confirm your data-fetching code is nowhere in the bundle.
3. Add `"use client"` to a child component and watch a new chunk appear in the bundle.

---

## Part 2 — React Server Components Deep Dive

### The two component types

| | Server Component (default) | Client Component (`"use client"`) |
|---|---|---|
| Executes on | Server only | Server (for initial HTML) **and** browser |
| Ships JS to browser | No | Yes |
| Can be `async` / `await` | Yes | No (use `use()` on a promise instead) |
| Can use `useState`, `useEffect` | No | Yes |
| Can use event handlers (`onClick`) | No | Yes |
| Can read DB / filesystem / secrets | Yes | No |
| Can read `cookies()` / `headers()` | Yes | No |
| Re-renders on the client | N/A | Yes |

A crucial detail most people get wrong, straight from the React docs: **`"use client"` defines a boundary on the *module dependency tree*, not the render tree.** Once you mark `InspirationGenerator.tsx` as client code, everything it imports becomes client code too — even if that imported module has no directive of its own. But a component *rendered as `children`* by a Server Component can still be a Server Component, even if it appears inside a Client Component's JSX.

That is why this works:

```tsx
// app/page.tsx  — Server Component
import Expandable from './expandable' // client component

async function Notes() {
  const notes = await db.notes.getAll() // direct data access, no API route
  return (
    <div>
      {notes.map((note) => (
        <Expandable key={note.id}>
          <p>{note.text}</p> {/* server-rendered children passed into client */}
        </Expandable>
      ))}
    </div>
  )
}

export default Notes
```

```tsx
// app/expandable.tsx  — Client Component
'use client'

import { useState } from 'react'

export default function Expandable({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && children}
    </div>
  )
}
```

The `<p>` is rendered on the server. The button logic is client code. You get interactivity without dragging the whole tree into the bundle.

### There is no `"use server"` component directive

A very common interview stumble: `"use server"` does **not** mark a Server Component. Server Components are the default and need no directive. `"use server"` marks a **Server Function** (used by Server Actions) — an RPC-style callable that the client can invoke but not inspect.

### The serialization boundary

Props passed from a Server Component into a Client Component must be serializable. From the React docs, serializable values include:

- Primitives: `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, and globally-registered symbols
- `Date`, `Map`, `Set`, `TypedArray`, `ArrayBuffer`
- Plain objects and arrays containing only the above
- Promises
- **JSX elements** (this is how `children` pass through)
- **Server Functions** (`"use server"`)

Not serializable:

- Classes and class instances
- Ordinary functions (only Server Functions work)
- DOM nodes, `WeakMap`, `WeakSet`
- Objects with a null prototype
- Non-global symbols

```tsx
// ❌ Fails: you cannot hand a closure to a client component
export default async function Page() {
  const format = (n: number) => n.toFixed(2)
  return <Price value={9.5} format={format} /> // serialization error
}

// ✅ Pass data, format on the client
export default async function Page() {
  return <Price value={9.5} />
}
```

> **Gotcha:** Server Components cannot *accept* functions as props either, except through pass-through patterns. And a Server Component cannot accept arbitrary JSX as an argument to a `"use cache"` function unless it merely passes it through without introspecting it.

### Composition rules

1. **Server → Client: allowed.** A Server Component may import and render a Client Component.
2. **Client → Server: only via `children`.** A Client Component cannot import a Server Component, but it can receive one as a prop, because the parent Server Component did the importing and rendering.
3. **Context providers must be Client Components.** A Server Component cannot create context, but it can render a provider exported from a `"use client"` module.
4. **Client Components cannot be `async`.** Await on the server and pass the promise down, then unwrap with `use()`.

### Common errors and fixes

- **"Functions cannot be passed directly to Client Components"** → move the function's *result* across the boundary, or convert it to a Server Action with `"use server"`.
- **"Only plain objects can be passed"** → map your ORM/class instance into a plain object before passing.
- **`"useState is not a function" / "useEffect only works in Client Components"` errors** → add `"use client"` at the top of the file, *above* all imports, using quotes (not backticks).
- **`window is not defined`** → you are touching a browser API during server render. Move it into `useEffect` or guard with `typeof window !== 'undefined'`.
- **"You're importing a component that needs `useState`"** → the fix is almost always to extract the interactive part into its own small client component, not to mark the whole page `"use client"`.

---

## Part 3 — Streaming, Suspense, and Partial Prerendering

### How streaming actually works

The browser makes one request. The server responds with `200 OK` and starts sending HTML. React's server renderer produces chunks:

1. **Static shell** — `<head>`, layouts, navigation, and the fallback UI inside every `<Suspense>` boundary. Sent immediately.
2. **Component payload** — a serialized representation of the rendered tree, used for hydration and later client navigation.
3. **Boundary resolutions** — when an async section finishes, React streams its HTML wrapped in `<div hidden id="S:0">` plus a tiny inline `<script>` that swaps it into the placeholder `<template id="B:0">`.

Because the swap is an inline script, content appears as soon as the chunk arrives — it does **not** wait for the page bundle or for hydration. The user sees progressive reveal.

On **client-side navigation**, the browser does not receive HTML at all. It sends a request with an `rsc: 1` header and receives only the component payload, which React uses to update the tree in place.

### `loading.tsx` vs explicit `<Suspense>`

`app/dashboard/loading.tsx` is the zero-effort option: Next.js wraps the page content in a Suspense boundary using your loading component as the fallback.

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="h-4 w-full rounded bg-gray-200" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
    </div>
  )
}
```

But `loading.tsx` wraps the *entire page*. When the framework hits dynamic work, it walks up the tree looking for the nearest Suspense boundary. If the only boundary is your page-level `loading.tsx`, the whole page falls back to the full skeleton — you lose granularity. Prefer explicit boundaries close to the dynamic access:

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { Revenue } from './revenue'
import { RecentOrders } from './recent-orders'

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<Skeleton label="revenue" />}>
          <Revenue />
        </Suspense>
        <Suspense fallback={<Skeleton label="orders" />}>
          <RecentOrders />
        </Suspense>
      </div>
    </div>
  )
}
```

If `Revenue` resolves in 200 ms and `RecentOrders` in 1 s, each appears independently. Sibling boundaries do not block each other.

### The HTTP contract — the constraint everyone forgets

Once streaming begins, **headers and status codes are already sent**.

- `notFound()` firing *mid-stream* cannot produce a real 404. Next.js injects `<meta name="robots" content="noindex">` into the streamed HTML instead.
- `redirect()` mid-stream becomes a client-side redirect, not an HTTP 30x.
- Therefore: **do your existence checks and auth gates before the first Suspense boundary or first `await` that suspends.**

```tsx
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const exists = await checkSlugExists(slug) // fast check
  if (!exists) notFound() // real 404 — no boundary has suspended yet

  return (
    <Suspense fallback={<p>Loading post…</p>}>
      <PostContent slug={slug} />
    </Suspense>
  )
}
```

> **Gotcha:** Bots and crawlers are handled differently. HTML-limited crawlers get a fully-rendered, non-streamed document so metadata is present in `<head>`. This means shell code that only worked at build time can fail for a crawler if it is re-executed at request time. Keep shell dependencies available at request time.

### Partial Prerendering (PPR)

PPR is the culmination of the whole spectrum: a **static shell served from the CDN instantly**, with **dynamic holes streamed from the origin in the same HTTP response**. No client-side fetch waterfall, no layout shift, one round trip.

The mental model:

- Anything cacheable (layout, nav, product copy, marketing content) goes in the shell.
- Anything request-specific (cart, personalized recommendations, live inventory) lives behind `<Suspense>` and streams.

> **Version-dependent — verify this in the Next.js docs.** In Next.js 16, PPR became the default behavior of the App Router under the **Cache Components** feature, enabled with `cacheComponents: true` in `next.config.ts`. The old `experimental.ppr` flag and the `experimental_ppr` route export have been **removed**. On Next.js 15 and earlier, PPR was experimental with different flags. Do not trust any tutorial that does not state its version.

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

> **Gotcha:** Cache Components requires the Node.js runtime. If you have routes exporting the deprecated `runtime = 'edge'`, migrate them first.

### How to push dynamic access down

The deeper your dynamic access sits in the tree, the more remains static. This is the highest-leverage structural habit in the App Router.

```tsx
// ❌ This awaits params at layout level — the whole layout becomes dynamic
export default async function Layout({ children, params }: LayoutProps<'/shop/[slug]'>) {
  const { slug } = await params
  return <div><Sidebar /><h1>{slug}</h1>{children}</div>
}

// ✅ Pass the promise; await inside the boundary
export default function Layout({ children, params }: LayoutProps<'/shop/[slug]'>) {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<h1>Loading…</h1>}>
        {params.then(({ slug }) => <SlugHeading slug={slug} />)}
      </Suspense>
      {children}
    </div>
  )
}
```

The same pattern applies to `cookies()`, `headers()`, and `searchParams`. Start the work, pass the promise, resolve it inside a boundary.

### React 19 features you should know

- **`use(promise)`** — unwrap a promise (or context) inside a Client Component, suspending until it resolves. This is how you stream a promise from a Server Component into a Client Component.
- **Server Functions / Actions** — `"use server"` functions callable from the client.
- **`useActionState`** — manage form state around an action, including pending and error states.
- **`<Activity>`** — preserves component state during navigation by hiding rather than unmounting. Next.js 16 uses it when `cacheComponents` is enabled.

> **Verify in the React docs:** the React 19 Server Components APIs are stable, but the *bundler/framework* APIs used to implement them do not follow semver between minors. Frameworks pin specific React versions for a reason.

---

## Part 4 — The App Router: Server Actions, Route Handlers, Layouts, and Rendering

### Layouts vs pages

- `layout.tsx` wraps `page.tsx` and **persists across navigations** — it does not re-render when only the child segment changes.
- `page.tsx` is the leaf UI for a URL segment.
- `loading.tsx` wraps `page.tsx` in a Suspense boundary automatically.
- `error.tsx` is the nearest route-level error boundary.
- `template.tsx` re-mounts on navigation (rarely needed).

### Server Actions

A Server Action is a Server Function invoked through React's action mechanisms — `<form action={...}>`, `<button formAction>`, or a transition.

```ts
// app/posts/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await db.post.create({
    data: { title: String(formData.get('title')), authorId: session.user.id },
  })

  revalidatePath('/posts')
}
```

```tsx
// app/posts/new-post.tsx
import { createPost } from './actions'

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button type="submit">Publish</button>
    </form>
  )
}
```

Things worth internalizing:

1. **One response carries data and UI.** When an action calls `updateTag`, `revalidatePath`, or `refresh`, Next.js re-renders the current route server-side and returns the action's return value *plus* a fresh RSC payload in the same stream. No follow-up fetch needed.
2. **Client dispatch is sequential.** Actions run one at a time per client. Do not try to parallelize them with `Promise.all` from the client — parallelize *inside* a single action instead.
3. **Every action is an untrusted POST endpoint.** Authenticate, authorize, and validate inside the action. Rendering a form only on authenticated pages is not a security boundary.
4. **Return values are serialized to the client.** Never return raw database records.
5. **Action IDs are build-specific.** A client on an old build can hit "Failed to find Server Action" after a deploy. Surface it as a retry path.
6. **Framework protections exist but are not sufficient:** CSRF checks compare `Origin` to `Host`, bodies are capped (default 1 MB), and closure variables are encrypted. For multi-instance deployments, set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to a stable shared value.

> **Verify in the Next.js docs:** the `serverActions` config keys (`allowedOrigins`, `bodySizeLimit`) and their exact location under `experimental` have moved between majors.

### Route Handlers

`app/api/.../route.ts` is your HTTP boundary: webhooks, public APIs, non-React streaming.

```ts
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 5; i++) {
        controller.enqueue(encoder.encode(`Chunk ${i + 1}\n`))
        await new Promise((r) => setTimeout(r, 200))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

Use a Route Handler when the caller is not React (a Stripe webhook, a cron job, an external service). Use a Server Action when the caller is your own UI.

### Dynamic vs static rendering

In the App Router, rendering is a spectrum resolved per component, not a page-level switch. The triggers for dynamic work are:

- runtime APIs: `cookies()`, `headers()`, `searchParams`, dynamic `params`
- uncached data fetches
- non-deterministic values: `Date.now()`, `Math.random()`, `crypto.randomUUID()`

With Cache Components, each of these must be handled explicitly: cache it, wrap it in `<Suspense>`, or opt the route out with `connection()`. The dev overlay names the offending route and offers the fix.

### `generateStaticParams`

For dynamic segments, `generateStaticParams` tells the build which URLs to prerender.

```tsx
export async function generateStaticParams() {
  const products = await getTopProducts()
  return products.map((p) => ({ id: p.id }))
}
```

With PPR/Cache Components, unknown params are served the reusable **App Shell** instantly and upgraded in the background after the first visit. Known params get fully concrete prerendered content.

---

## Part 5 — The Caching Layers

This is the part of Next.js that has changed most, so read the version note before the details.

> **Version-dependent — verify in the Next.js docs.** Next.js 14 cached `fetch` by default. Next.js 15 flipped that: **`fetch` is not cached by default**, and GET Route Handlers lost automatic caching. Next.js 16 introduced **Cache Components** (`cacheComponents: true`), which replaces route segment configs like `dynamic`, `revalidate`, and `fetchCache` with the `"use cache"` directive and `cacheLife`. Both models coexist in the docs — one guide for Cache Components, one for the previous model.

### The classic four caches (previous model)

| Cache | Scope | What it stores | How to control |
|---|---|---|---|
| **Request Memoization** | Single render pass | Deduplicates identical `fetch` calls in one render | Automatic; `React.cache()` for non-fetch |
| **Data Cache** | Persistent, across requests and deploys | Individual `fetch` responses | `cache: 'force-cache'`, `next: { revalidate, tags }` |
| **Full Route Cache** | Persistent | Rendered HTML + RSC payload for a route | Static rendering, `revalidate`, `dynamic` |
| **Router Cache** | Client-side, in-browser | Prefetched route payloads | `router.refresh()`, `revalidatePath`/`revalidateTag`, `staleTimes` |

In the previous model:

```tsx
// Opt into caching explicitly (default is uncached)
const res = await fetch('https://api.example.com/products', {
  cache: 'force-cache',
  next: { revalidate: 3600, tags: ['products'] },
})
```

Route segment configs:

```tsx
export const dynamic = 'force-dynamic'   // render every request
export const revalidate = 3600           // default revalidation window
export const fetchCache = 'auto'         // override fetch cache defaults per segment
```

### The Cache Components model (Next.js 16)

The philosophy: **nothing is cached unless you say so, at a named boundary, with an explicit lifetime.**

```tsx
// app/lib/data.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getProducts() {
  'use cache'
  cacheLife('hours')     // time-based freshness
  cacheTag('products')   // on-demand invalidation handle
  const res = await fetch('https://api.example.com/products')
  return res.json()
}
```

Key behaviors:

- The cache key is derived from **build ID + function identity + serialized arguments and captured closure values**. `getProduct('a')` and `getProduct('b')` get separate entries automatically.
- Cached functions **cannot read runtime APIs** like `cookies()` or `headers()`. Read them outside and pass the value in.
- With the default in-memory handler, entries on **serverless do not persist across requests** — instances are ephemeral. `"use cache: remote"` uses a durable platform cache handler (network round trip, typically billed).
- Entries are **scoped to a single deployment**. A new deploy rebuilds prerenders and `"use cache"` entries do not carry over.

### Invalidation: pick the right verb

| Function | Called from | Semantics | Use when |
|---|---|---|---|
| `updateTag(tag)` | Server Actions only | Expires the tag; next read **waits** for fresh data | Read-your-own-writes (user must see their change now) |
| `revalidateTag(tag, 'max')` | Actions + Route Handlers | Marks stale; serves stale while refreshing in background | Webhooks, CMS fan-out, eventual consistency is fine |
| `revalidateTag(tag, { expire: 0 })` | Actions + Route Handlers | Blocking revalidation, no stale served | Immediate purge from a non-action context |
| `revalidatePath('/path')` | Actions + Route Handlers | Invalidates one URL path's cached output | One route affected, tagging is overkill |
| `refresh()` | Server Actions | Refetch current route payload without invalidating cache | View depends on state outside the cache |

> **Version-dependent:** In Next.js 16 the two-argument `revalidateTag(tag, profile)` signature is the supported form; the single-argument form is deprecated. In the **previous** caching model, `revalidateTag('user')` with one argument is the normal call. Verify which model your project is on.

> **Trap:** `revalidateTag` does not revalidate anything on its own — a **request** triggers the refresh. Pages using the tag revalidate as they are visited, not all at once.

### Practical rules

1. Cache at the **data** level (`getProducts`) and, where it helps, at the **UI** level (a whole blog list component).
2. Tag at the **granularity you mutate at**. `product:42` is better than `products` if you usually update one product.
3. `updateTag` for the mutation the user just performed; `revalidateTag` for everything else.
4. If you find yourself reaching for `revalidatePath` everywhere, you are probably over-invalidating — tags are the surgical tool.
5. Debug with verbose cache logging in development rather than guessing.

---

## Part 6 — Runtimes: Node.js vs Edge

### What actually runs where

Next.js historically offered two server runtimes per route: Node.js (default) and Edge. In Next.js 16, **the Edge Runtime is deprecated** — the `runtime = 'edge'` route segment export now warns and the recommended action is to remove it. The Edge Runtime still powers the `proxy` file convention (the renamed middleware layer), which runs before your page renders.

> **Version-dependent — verify in the Next.js docs.** Earlier majors encouraged per-route Edge rendering. Later majors reversed course: the framework's caching model, ISR, and native dependencies all assume Node.js. Treat any "deploy to the edge for speed" advice older than a year as suspect.

| Capability | Node.js runtime (default) | Edge runtime |
|---|---|---|
| Full Node APIs (`fs`, `node:crypto`, `node:stream`) | Yes | **No** |
| `require()` (CommonJS) | Yes | No — ESM only |
| npm native modules | Yes | No (must be pure ESM without Node APIs) |
| Web APIs (`fetch`, `Request`, `Response`, Streams, `crypto.subtle`) | Yes | Yes |
| Streaming responses | Yes (platform-dependent) | Yes |
| Incremental Static Regeneration (ISR) | Yes | **No** |
| `eval` / `new Function` | Yes | Disabled |
| `WebAssembly.compile` / `instantiate` | Yes | Disabled in the Next.js Edge runtime |
| Cache Components (`use cache`) | Yes — required | No |
| Typical cold start | Higher (larger bundles) | Lower (small isolates) |

### The `crypto` failure everyone hits

A classic symptom: your app works locally and fails on the edge with something like `crypto.createHash is not a function`. The Node `crypto` module does not exist on the Edge Runtime. You must use the Web Crypto API:

```ts
// ❌ Node-only
import { createHash } from 'node:crypto'
const digest = createHash('sha256').update(input).digest('hex')

// ✅ Works in both runtimes (Web Crypto)
const data = new TextEncoder().encode(input)
const hashBuffer = await crypto.subtle.digest('SHA-256', data)
const digest = Array.from(new Uint8Array(hashBuffer))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')
```

> **Gotcha:** Web Crypto's `subtle` API is async and does not support every legacy algorithm (for example, MD5 is generally absent). If you depend on a specific digest, verify availability for your target runtime.

### Cold starts and region placement

- **Cold starts** happen when a platform spins up a fresh execution context. Next.js on Vercel uses "fluid compute," where multiple invocations can share one instance and compiled bytecode is cached for Node.js 20+ — Vercel reports this reduces cold-start impact. *That is a vendor claim; measure it for your own traffic.*
- **Region placement** decides how far a request travels. Run your functions near your database, not near your users, if the DB round trip dominates. A function near the user that then crosses an ocean to reach Postgres is slower than a function next to Postgres.
- **Concurrency vs isolation** is a real tradeoff. Sharing instances improves cost and cold starts, and it means global state can be shared between concurrent requests. Never store per-request data in module-level variables.

### When to use each

- **Default to Node.js.** It is what the framework assumes and what your dependencies expect.
- **Use the edge layer for:** request-time routing decisions, auth redirects, A/B bucketing, geographic personalization, header rewriting — cheap work that must happen before rendering.
- **Avoid the edge for:** anything needing native modules, the filesystem, ISR, or the Cache Components caching model.

---

## Part 7 — WebAssembly in the Browser

### What WebAssembly is

WebAssembly (Wasm) is a **low-level bytecode format** designed as a compilation target — not a language you write by hand. C, C++, Rust, C#, and AssemblyScript compile to it. Browsers and Node.js load and run it at near-native speed inside a sandbox that enforces the same origin and permission rules as JavaScript.

The core concepts map 1:1 to the JavaScript API:

| Concept | What it is |
|---|---|
| **Module** | A compiled Wasm binary. Stateless; can be shared between workers. Declares imports and exports. |
| **Memory** | A resizable `ArrayBuffer` holding the linear byte array Wasm reads and writes. |
| **Table** | A resizable typed array of references (e.g. function pointers) that cannot live as raw bytes. |
| **Instance** | A module paired with its memory, table, and imported values — the runnable thing. |

Wasm is **not a JavaScript replacement**. It has no DOM access. To touch a Web API, Wasm calls out to JavaScript, which makes the call. That indirection is the single most important cost to understand.

### When Wasm beats JavaScript

Wasm wins when work is **deterministic, numeric, and compute-dense**:

- Media transcoding (FFmpeg compiled with Emscripten)
- Image processing and resizing
- Heavy math, simulation, physics, codecs
- Machine-learning inference in the browser

Wasm loses when work is **DOM-heavy, allocation-heavy, or string-heavy**, because every crossing of the JS↔WASM boundary costs, and every string has to be encoded into linear memory and decoded out.

### The JS↔WASM boundary cost

```ts
const instance = await WebAssembly.instantiateStreaming(
  fetch('/heavy.wasm'),
  { env: { log: (n: number) => console.log(n) } }
)

const { add, process_array } = instance.instance.exports

// ✅ One call with many numbers inside: cheap
process_array(ptr, length)

// ❌ A thousand tiny calls, each converting strings: expensive
for (const word of words) {
  const ptr = copyStringIntoMemory(instance, word) // allocation + encode
  check_word(ptr)                                   // another boundary cross
}
```

Rules of thumb:

1. **Batch across the boundary.** Pass arrays and buffers, not individual values.
2. **Keep strings out of hot loops.** Prefer numeric IDs and typed arrays.
3. **Use `SharedArrayBuffer` + workers for concurrency** where the platform allows it.
4. **Stream compilation.** Use `instantiateStreaming` so the module compiles while it downloads.
5. **Measure first.** If plain JS hits the performance target, Wasm adds bundle size, build complexity, and a debugging tax for nothing.

### In-browser ML: the practical cases

Two libraries dominate this space:

**`onnxruntime-web`** runs ONNX-format models in the browser. It supports multiple execution providers: `wasm` (CPU, all operators), `webgl`, `webgpu`, and `webnn`, with GPU providers currently supporting a subset of operators. Typical pipeline: pick a model, preprocess inputs into tensors, `session.run()`, postprocess outputs. The ONNX Runtime docs also publish a Next.js image-classification tutorial.

**Transformers.js** wraps ONNX Runtime with a Hugging Face-style `pipeline` API:

```ts
import { pipeline } from '@huggingface/transformers'

const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
  dtype: 'q8',            // quantized for smaller download (default for WASM)
  device: 'webgpu',       // optional GPU offload — verify browser support
})

const out = await classifier('I love building things on the web.')
```

Why in-browser inference is attractive: data never leaves the device (privacy), it works offline, it offloads cost from your servers, and latency can be far lower than a network round trip to a GPU. Why it is often wrong: models are big downloads, quantized accuracy drops, older devices stall, and the first inference includes model load time.

> **Verify in the docs:** supported tasks, quantization options, and WebGPU availability change quickly. Check `onnxruntime.ai` and the Transformers.js docs for the current model/task matrix and device support.

### Where this is heading

- **WasmGC** lets garbage-collected languages (Java, Kotlin, Dart, and more) target Wasm efficiently by sharing the host's GC instead of shipping their own.
- **The Component Model** aims to make Wasm modules composable across languages via a common interface, rather than gluing them together with hand-written JavaScript.
- **ES module integration** would let you `import` a `.wasm` module like any other module.

> **Verify current status:** these are evolving standardization efforts. Check `webassembly.org` and MDN's WebAssembly guides for what is actually shipped in browsers, versus what is proposed.

---

## Part 8 — Shipping It: Core Web Vitals, Deploy Targets, and a Worked Page

### Core Web Vitals as an engineering target

Three metrics, measured from **real user sessions** and evaluated at the **75th percentile** — meaning 75% of visits must clear the bar. All three must pass simultaneously for an overall "good" assessment.

| Metric | Measures | Good | Needs improvement | Poor |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | Loading: when the largest visible element renders | ≤ 2.5 s | 2.5 – 4.0 s | > 4.0 s |
| **INP** (Interaction to Next Paint) | Responsiveness: latency across interactions | ≤ 200 ms | 200 – 500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | Visual stability: unexpected layout movement | ≤ 0.1 | 0.1 – 0.25 | > 0.25 |

> **Thresholds evolve — verify at web.dev.** INP replaced FID as a stable Core Web Vital in March 2024. LCP and CLS thresholds have been stable for years, but the metric set goes through an experimental → pending → stable lifecycle, and Google commits to communicating changes clearly. Treat any chart older than a year as a starting point, not a source of truth.

**Next.js causes and fixes:**

| Metric | Common Next.js cause | Fix |
|---|---|---|
| **LCP** | LCP element inside a Suspense boundary | Keep hero image / main heading **outside** boundaries; use `next/image` with the `preload` prop |
| **LCP** | Hero depends on client-side data | Render it in a Server Component; never let the hero wait on `useEffect` |
| **LCP** | Slow TTFB from a blocking query at the page root | Push the query into a Suspense boundary; cache with `"use cache"` |
| **INP** | One giant client component hydrating in a blocking pass | Split hydration with multiple `<Suspense>` boundaries |
| **INP** | Heavy third-party scripts | Load them lazily; audit with DevTools performance traces |
| **CLS** | Skeleton fallback differs in size from resolved content | Match fallback dimensions exactly; reserve space with fixed/min-height containers |
| **CLS** | Fonts swapping in at a different size | Use `font-display` carefully and `size-adjust` to match metrics |

Measure in the field, not just the lab. Lighthouse can measure LCP and CLS but **cannot measure INP** (there is no user input); Total Blocking Time is a lab proxy. For real numbers, use the `web-vitals` library and send events to your analytics endpoint.

### Deploy targets decision table

| Capability | Vercel | Cloudflare Workers | Self-host (Node/Docker) |
|---|---|---|---|
| Next.js integration depth | Deepest (build, ISR, PPR, image optimization, cron, analytics) | Via OpenNext adapter — verify current support | You own the adapter |
| ISR / PPR caching | First-class | Adapter-dependent; verify | You configure cache handlers |
| Runtime model | Node.js (fluid compute, instance sharing) | V8 isolates, globally distributed | Whatever you deploy |
| Cold starts | Bytecode caching on Node 20+; vendor-reported reductions | Isolates start in single-digit ms | Depends on your infra |
| CPU limits | Duration-based (default 300 s, up to 800 s on Pro; longer in beta) — vendor figures | Free: 10 ms CPU/request; Paid: default 30 s, configurable to 5 min | Your hardware |
| Memory | Plan-dependent | **128 MB per isolate** | Your hardware |
| Bundle size | Not the primary constraint | **64 MiB uncompressed** worker, 1 s startup, 5 KB per env var | Not constrained |
| Subrequests | Platform-dependent | 50 free / 10,000 paid per invocation; 6 simultaneous open connections | Unconstrained |
| Cron | Built-in | Cron Triggers (5 free / 250 paid per account) | Your scheduler |
| Image optimization | Built-in (`next/image`) | Cloudflare Images / your code | You build it |
| Observability | Integrated logs/traces | Workers Logs, Tail Workers, Logpush | You assemble it |
| Cost at scale | Predictable but can surprise on function invocations | Cheap for I/O-bound work; CPU-bound work hits limits | Cheapest compute, highest ops burden |
| Best for | Next.js apps that want framework features | Global edge APIs, auth, routing, small services | Compliance, existing infra, cost control |

> **Vendor claims:** Vercel's fluid compute, cold-start reductions, and concurrency benefits are documented at `vercel.com/docs`. They are plausible and measurable — measure them against your own workload. Cloudflare's limits are documented at `developers.cloudflare.com/workers/platform/limits` and were current at the time of writing.

### A worked page: before and after

**Before** — a client-side product dashboard. Data fetched after mount, no caching, no streaming.

```tsx
// app/product/[id]/page.tsx  — BEFORE
'use client'

import { useEffect, useState } from 'react'

type Product = { id: string; name: string; price: number; stock: number }
type Review = { id: string; body: string; rating: number }

export default function ProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${params.id}`).then((r) => r.json()).then(setProduct)
    fetch(`/api/products/${params.id}/reviews`).then((r) => r.json()).then(setReviews)
  }, [params.id])

  async function saveStock(stock: number) {
    setSaving(true)
    await fetch(`/api/products/${params.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stock }),
    })
    setSaving(false)
    window.location.reload() // 🙈 the classic
  }

  if (!product) return <p>Loading…</p> // whole page blocked

  return (
    <div>
      <h1>{product.name}</h1>
      <p>${product.price}</p>
      <button onClick={() => saveStock(product.stock - 1)} disabled={saving}>
        Sell one
      </button>
      <section>
        {reviews.map((r) => (
          <article key={r.id}>{r.body}</article>
        ))}
      </section>
    </div>
  )
}
```

Problems: two client-side request waterfalls, an empty screen until both land, full-page reload after every mutation, and no caching — every visit refetches everything.

**After** — a Server Component shell with a streamed reviews section, a small client island for the interactive stock control, a Server Action, and a tag-based revalidation.

```ts
// app/lib/data.ts
import { cacheLife, cacheTag } from 'next/cache'

export async function getProduct(id: string) {
  'use cache'
  cacheLife('minutes')
  cacheTag('products', `product-${id}`)

  const res = await fetch(`https://api.example.com/products/${id}`)
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; name: string; price: number; stock: number }>
}

export async function getReviews(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}/reviews`)
  return res.json() as Promise<{ id: string; body: string }[]>
}
```

```ts
// app/product/[id]/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function sellOne(productId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  // Validate by re-reading from a trusted source, not by trusting the client.
  const product = await db.product.findFirst({
    where: { id: productId, ownerId: session.user.id },
  })
  if (!product || product.stock <= 0) return { ok: false, error: 'Out of stock' }

  await db.product.update({
    where: { id: product.id },
    data: { stock: product.stock - 1 },
  })

  // Read-your-own-writes: the next read waits for fresh data.
  updateTag(`product-${productId}`)
  updateTag('products')

  return { ok: true }
}
```

```tsx
// app/product/[id]/stock-control.tsx  — the client island
'use client'

import { useTransition } from 'react'
import { sellOne } from './actions'

export function StockControl({ productId, stock }: { productId: string; stock: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <div>
      <span>{stock} in stock</span>
      <button
        disabled={pending || stock <= 0}
        onClick={() => startTransition(() => { void sellOne(productId) })}
      >
        {pending ? 'Saving…' : 'Sell one'}
      </button>
    </div>
  )
}
```

```tsx
// app/product/[id]/reviews.tsx  — streams behind Suspense
import { getReviews } from '@/lib/data'

export async function Reviews({ productId }: { productId: string }) {
  const reviews = await getReviews(productId) // uncached: fresh every request
  return (
    <section>
      {reviews.map((r) => (
        <article key={r.id}>{r.body}</article>
      ))}
    </section>
  )
}
```

```tsx
// app/product/[id]/page.tsx  — AFTER
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getProduct } from '@/lib/data'
import { StockControl } from './stock-control'
import { Reviews } from './reviews'
import Image from 'next/image'

export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }] // prerender known products at build
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProduct(id) // cached — part of the static shell
  if (!product) notFound()             // real 404, before any boundary suspends

  return (
    <div>
      <h1>{product.name}</h1>                          {/* LCP element in the shell */}
      <Image src={`/products/${product.id}.jpg`} alt="" width={800} height={450} preload />
      <p>${product.price}</p>
      <StockControl productId={product.id} stock={product.stock} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={product.id} />
      </Suspense>
    </div>
  )
}

function ReviewsSkeleton() {
  return (
    <section className="space-y-2">
      <div className="h-4 w-full rounded bg-gray-200" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
    </section>
  )
}
```

What changed:

1. **No client-side waterfall.** Data is fetched during render on the server.
2. **Product data is cached** with `"use cache"`, `cacheLife('minutes')`, and tags — so it can be part of the static shell.
3. **Reviews stream** behind a Suspense boundary, with a skeleton that matches the final dimensions (CLS-safe).
4. **The only client JavaScript is the stock button.** The page around it ships none.
5. **The mutation is a Server Action** with authentication, ownership checks, validation, and `updateTag` for read-your-own-writes.
6. **The 404 is real**, because `notFound()` runs before any boundary suspends.
7. **The LCP element is in the shell**, not behind a boundary.

> **Gotcha:** `updateTag` is the right call *only* because the user must immediately see their own write. If this were a background sync from a supplier's API, you would use `revalidateTag(tag, 'max')` instead. Also note: `"use cache"` requires `cacheComponents: true` and the Node.js runtime. If your project is not on Cache Components, use the previous model's `fetch` options and `revalidateTag(tag)`.

---

## Cheat Sheets

### RSC vs Client Components

| Question | Server Component | Client Component |
|---|---|---|
| Directive | none | `"use client"` at top of file |
| Async / `await` in component | Yes | No — use `use(promise)` |
| State / effects / handlers | No | Yes |
| Ships JS to browser | No | Yes |
| Direct DB / FS access | Yes | No |
| `cookies()` / `headers()` | Yes | No |
| Can read secrets | Yes | No |
| Can render the other type | Yes | Only via `children` / props |

### Cache layers

| Layer | Scope | Persists across requests | Invalidation |
|---|---|---|---|
| Request Memoization | One render pass | No | N/A |
| Data Cache (`fetch` / `unstable_cache`) | Server | Yes | `revalidateTag`, `revalidatePath`, time |
| Full Route Cache | Server + CDN | Yes | `revalidateTag`, `revalidatePath`, time |
| Router Cache | Browser | Until navigation/TTL | `router.refresh()`, revalidation calls |
| `"use cache"` (Cache Components) | Server, per deployment | In-memory; ephemeral on serverless | `cacheLife`, `cacheTag` + `updateTag`/`revalidateTag` |
| `"use cache: remote"` | Shared durable store | Yes, until deploy | Same tag APIs |

### Runtime capabilities

| Capability | Node.js | Edge |
|---|---|---|
| `fs`, `node:crypto`, native modules | Yes | No |
| Web APIs (fetch, streams, Web Crypto) | Yes | Yes |
| ISR | Yes | No |
| Cache Components (`use cache`) | Yes | No |
| `eval` / dynamic code | Yes | Disabled |
| `WebAssembly.compile` | Yes | Disabled (Next.js Edge) |
| Typical use | Everything | Proxy-layer routing, redirects, auth gates |

### Core Web Vitals targets

| Metric | Good | Poor | Primary Next.js lever |
|---|---|---|---|
| LCP | ≤ 2.5 s | > 4.0 s | Server-render the hero; `next/image` + `preload`; keep it out of Suspense |
| INP | ≤ 200 ms | > 500 ms | Split hydration with Suspense; shrink client islands |
| CLS | ≤ 0.1 | > 0.25 | Dimension-matched skeletons; reserved space |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Hydration mismatch**: "Text content does not match server-rendered HTML" | Nondeterministic output — `Date.now()`, `Math.random()`, locale/timezone formatting, or reading `window`/`localStorage` during render | Render the value in `useEffect`, or gate the client value behind a mounted flag; pass a stable server value as a prop |
| **Hydration mismatch** with a third-party library | Library adds DOM during render | Load it with `next/dynamic` and `ssr: false`, or mount in an effect |
| **`"use client"` overuse**: huge client bundle, poor INP | Marking whole pages or layouts `"use client"`, which marks every transitive import as client code too | Push `"use client"` down to the smallest interactive leaf; pass server-rendered `children` in |
| **Stale cache**: old data after a mutation | Mutation did not invalidate, or used stale-while-revalidate when read-your-own-writes was needed | Use `updateTag(tag)` in the Server Action for immediate freshness; `revalidateTag(tag, 'max')` for background fan-out; verify tag strings match exactly (case-sensitive, ≤256 chars) |
| **Cache never hits in production** | Serverless in-memory `"use cache"` entries do not survive between instances | Cache at build time where possible, or move to `"use cache: remote"` with a durable handler |
| **RSC serialization error**: "Functions cannot be passed directly to Client Components" | Passing a callback, class instance, or unserializable object across the boundary | Pass plain data; convert callbacks to Server Actions (`"use server"`); map ORM/class instances to plain objects |
| **RSC serialization error**: "only plain objects" | Passing a `Date`-like custom class, a `URL` instance, or a null-prototype object | Rebuild as a plain object or a supported built-in |
| **Edge crypto failure**: `crypto.createHash is not a function` | Node `crypto` used in the Edge Runtime / proxy | Switch to Web Crypto (`crypto.subtle`), or move the route to the Node.js runtime |
| **Edge failure generally** in Next.js 16 | The Edge Runtime is deprecated and Cache Components requires Node.js | Remove `export const runtime = 'edge'`; keep edge work to the proxy layer |
| **404/redirect did not stick** | `notFound()` or `redirect()` ran after streaming started | Move the check before the first Suspense boundary or suspending `await` |
| **Build hangs ~50 s with a cache timeout** | A `"use cache"` scope awaited request-specific data (`cookies()`, `params`, `searchParams`) | Read runtime values outside the cached scope and pass them as arguments |
| **PPR/`use cache` errors after upgrade** | Mixed caching models — route segment configs left in while `cacheComponents` is on | Remove `dynamic`, `revalidate`, `fetchCache` exports; migrate to `cacheLife`/`cacheTag` |

---

## Video Library

No invented URLs. These are YouTube search links — pick the highest-quality result, and check the upload date against your Next.js version.

- [Next.js 16 Cache Components explained](https://www.youtube.com/results?search_query=Next.js+16+Cache+Components+use+cache+explained) — the new caching model and why defaults flipped.
- [React Server Components deep dive](https://www.youtube.com/results?search_query=React+Server+Components+deep+dive) — the serialization boundary and composition rules.
- [Next.js streaming and Suspense](https://www.youtube.com/results?search_query=Next.js+streaming+Suspense+loading+tsx) — watching chunks arrive in DevTools.
- [Partial Prerendering tutorial](https://www.youtube.com/results?search_query=Next.js+Partial+Prerendering+tutorial) — static shell plus streamed holes.
- [Server Actions in practice](https://www.youtube.com/results?search_query=Next.js+Server+Actions+tutorial+revalidateTag) — forms, mutations, and revalidation.
- [Next.js Node vs Edge runtime](https://www.youtube.com/results?search_query=Next.js+Node+vs+Edge+runtime) — what actually runs where.
- [Core Web Vitals in 2026](https://www.youtube.com/results?search_query=Core+Web+Vitals+2026+LCP+INP+CLS) — thresholds and fixes.
- [WebAssembly crash course](https://www.youtube.com/results?search_query=WebAssembly+crash+course+for+web+developers) — modules, memory, and the JS boundary.
- [Run ML models in the browser](https://www.youtube.com/results?search_query=Transformers.js+ONNX+Runtime+Web+browser+inference) — Transformers.js and onnxruntime-web.
- [Vercel vs Cloudflare Workers](https://www.youtube.com/results?search_query=Vercel+vs+Cloudflare+Workers+deployment+comparison) — tradeoffs for full-stack apps.

---

## Written References

Official documentation only. Where I am not certain of the exact URL path, I say "search" rather than guess.

- **Next.js — Caching** — `https://nextjs.org/docs/app/getting-started/caching` (Cache Components model)
- **Next.js — Caching and Revalidating (previous model)** — `https://nextjs.org/docs/app/guides/caching-without-cache-components`
- **Next.js — `use cache` directive** — `https://nextjs.org/docs/app/api-reference/directives/use-cache`
- **Next.js — `cacheComponents` config** — `https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents`
- **Next.js — `revalidateTag`** — `https://nextjs.org/docs/app/api-reference/functions/revalidateTag`
- **Next.js — `updateTag`** — `https://nextjs.org/docs/app/api-reference/functions/updateTag`
- **Next.js — Streaming guide** — `https://nextjs.org/docs/app/guides/streaming`
- **Next.js — Server Actions guide** — `https://nextjs.org/docs/app/guides/server-actions`
- **Next.js — Edge Runtime API reference** — `https://nextjs.org/docs/app/api-reference/edge`
- **Next.js — `runtime` route segment config** — `https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime`
- **Next.js — Partial Prerendering platform guide** — `https://nextjs.org/docs/app/guides/ppr-platform-guide`
- **Next.js — Migrating to Cache Components** — `https://nextjs.org/docs/app/guides/migrating-to-cache-components`
- **React — Server Components** — `https://react.dev/reference/rsc/server-components`
- **React — `'use client'`** — `https://react.dev/reference/rsc/use-client`
- **React — `use server` / Server Functions** — search: `react.dev use server`
- **React — `<Suspense>`** — search: `react.dev Suspense`
- **web.dev — Web Vitals** — `https://web.dev/articles/vitals`
- **web.dev — Defining Core Web Vitals thresholds** — `https://web.dev/articles/defining-core-web-vitals-thresholds`
- **web.dev — Optimize LCP / INP / CLS** — `https://web.dev/articles/optimize-lcp`, `.../optimize-inp`, `.../optimize-cls`
- **MDN — WebAssembly** — `https://developer.mozilla.org/en-US/docs/WebAssembly`
- **MDN — WebAssembly concepts** — `https://developer.mozilla.org/en-US/docs/WebAssembly/Guides/Concepts`
- **Cloudflare Workers — Platform limits** — `https://developers.cloudflare.com/workers/platform/limits/`
- **Cloudflare Workers — Runtime APIs** — search: `developers.cloudflare.com workers runtime-apis`
- **Vercel — Fluid compute** — `https://vercel.com/docs/fluid-compute`
- **Vercel — Incremental Static Regeneration** — search: `vercel.com docs incremental static regeneration`
- **ONNX Runtime — Web tutorials** — `https://onnxruntime.ai/docs/tutorials/web/`
- **ONNX Runtime — WebGPU execution provider** — search: `onnxruntime.ai webgpu execution provider`
- **Transformers.js** — `https://huggingface.co/docs/transformers.js`
- **webassembly.org — Features and roadmap** — `https://webassembly.org/features/`

---

## Glossary

- **App Shell** — The reusable, URL-independent static shell served for dynamic params not known at build time; upgraded in the background after the first visit.
- **Cache Components** — Next.js 16 feature (`cacheComponents: true`) enabling `"use cache"`, `cacheLife`, `cacheTag`, and PPR as the default App Router rendering behavior.
- **Client Component** — A component in a module marked `"use client"`. Bundled and executed in the browser; the only place state, effects, and event handlers live.
- **CLS (Cumulative Layout Shift)** — Visual stability metric. Good ≤ 0.1.
- **Cold start** — The latency of initializing a fresh execution context before handling a request.
- **Core Web Vitals** — LCP, INP, CLS. Measured in the field, evaluated at the 75th percentile.
- **CSR (Client-Side Rendering)** — The browser builds the UI from JavaScript after load.
- **Data Cache** — Persistent server-side cache for individual `fetch` responses (previous caching model).
- **Edge Runtime** — A restricted, Web-API-only execution environment close to users. Deprecated for Next.js routes in Next.js 16; still used by the proxy layer.
- **Full Route Cache** — Cached rendered HTML and RSC payload for a route.
- **Hydration** — React attaching to server-rendered HTML and making it interactive.
- **INP (Interaction to Next Paint)** — Responsiveness metric. Good ≤ 200 ms.
- **ISR (Incremental Static Regeneration)** — Static pages rebuilt in the background after a time window or explicit invalidation.
- **Isolate** — A lightweight, sandboxed V8 execution context (Cloudflare Workers model) that can host many requests.
- **LCP (Largest Contentful Paint)** — Loading metric; when the largest visible element renders. Good ≤ 2.5 s.
- **Partial Prerendering (PPR)** — Static shell plus streamed dynamic holes in a single HTTP response.
- **Proxy** — The Next.js file convention (formerly middleware) that runs before a page renders, on the edge layer.
- **Request Memoization** — Per-render deduplication of identical `fetch` calls.
- **RSC Payload** — The serialized component tree sent on client navigation or embedded in streamed HTML for hydration.
- **Router Cache** — Client-side cache of prefetched route payloads.
- **Server Action** — A Server Function invoked through React's action mechanisms (`<form action>`, transitions).
- **Server Component** — A component executed only on the server that ships zero JavaScript to the browser.
- **Server Function** — A function marked `"use server"` callable from the client, but not inspectable there.
- **Static shell** — Everything rendered before async work resolves: layouts, navigation, Suspense fallbacks.
- **Streaming SSR** — Sending HTML in chunks via chunked transfer encoding as parts of the tree resolve.
- **Suspense boundary** — A React boundary declaring fallback UI for async work; each boundary is an independent streaming and hydration unit.
- **TTFB (Time to First Byte)** — Time until the first response byte. A key diagnostic for LCP.
- **WebAssembly (Wasm)** — A low-level bytecode compile target for C/C++/Rust/C#/AssemblyScript, running near-native in a sandbox.
- **WasmGC** — A WebAssembly proposal enabling garbage-collected languages to target Wasm efficiently.
- **Web Crypto** — The browser-standard `crypto.subtle` API; the portable alternative to Node's `crypto` module.

---

## FAQ & Next Steps

**Is RSC the same as SSR?**
No. SSR is about *when* HTML is produced. RSC is about *which components execute where and what code ships to the browser*. Next.js uses both at once: server components are rendered on the server and their HTML is streamed, then the small client bundle hydrates.

**Do Server Components run on every request?**
Not necessarily. They can run at build time (when cached or purely deterministic) or per request (when they touch runtime APIs or uncached data). That decision is per component, and the framework validates it.

**If server components ship no JS, why is my bundle still big?**
Because of your client components, their transitive imports, and third-party libraries. Open the bundle analyzer and look for charts, editors, and UI kits that got pulled into a client module tree.

**My page got slower after enabling `"use cache"`. Why?**
Likely a cache miss on every serverless request because in-memory entries do not persist between instances, plus serialization overhead. Check the hit rate before adopting `"use cache: remote"`, which adds a network round trip that only pays off at a high hit rate.

**Should I put everything on the edge?**
No — and in Next.js 16 the per-route Edge Runtime is deprecated. Keep the edge for cheap pre-render work (redirects, routing, auth gates) via the proxy layer, and run rendering and caching on Node.js.

**When is WebAssembly worth it in a Next.js app?**
When you have a measured, compute-bound hot path — video/image processing, codecs, or in-browser ML inference — and you can pass data in batches rather than in thousands of tiny calls. Not for DOM manipulation or string-heavy loops.

**My INP is bad but Lighthouse says my score is fine. Why?**
Lighthouse cannot measure INP; it has no user input. Use Total Blocking Time as a lab proxy, and instrument the `web-vitals` library in production for real field data.

**Next steps — do these, in order:**

1. Open your largest client component and try to shrink the `"use client"` boundary by extracting a single interactive leaf.
2. Add one explicit `<Suspense>` boundary around your slowest data read, with a dimension-matched skeleton.
3. Check your project's caching model. Run a mutation, then a read, and confirm the UI reflects the change. If not, fix the invalidation verb.
4. Enable `cacheComponents: true` on a branch and see what the dev overlay flags. Read each insight before fixing it.
5. Add a `next/image` hero with `preload` and verify the LCP element is in the static shell.
6. Benchmark one image or ML operation in plain JS; then try the Wasm build. Keep whichever wins, measured.
7. Write down your deploy target's actual limits (memory, CPU, subrequests) and check whether your design respects them.

---

## Verification Note

This paper was written against the Next.js 16.x documentation line (docs version 16.3.5 at the time of writing; pages last updated between February and September 2026), React 19's Server Components and `'use client'` references, MDN's WebAssembly guides, web.dev's Web Vitals articles, Cloudflare Workers' platform limits, Vercel's fluid compute documentation, and the ONNX Runtime Web and Transformers.js documentation.

Three areas move faster than any written paper can track, and you should verify them in the live docs before relying on them:

1. **Partial Prerendering status.** PPR moved from experimental (Next.js 14–15) to the default behavior of the App Router under Cache Components in Next.js 16. The old `experimental.ppr` flag and `experimental_ppr` export were removed. Check `https://nextjs.org/docs/app/getting-started/caching` and the Cache Components config reference.
2. **Caching defaults and APIs.** `fetch` caching flipped from cached-by-default to uncached-by-default between Next.js 14 and 15, and Next.js 16 layered the `"use cache"` model on top. `revalidateTag` now takes a profile argument in the Cache Components model. Check `https://nextjs.org/docs/app/getting-started/caching` and `https://nextjs.org/docs/app/guides/caching-without-cache-components` to see which model your version uses.
3. **Core Web Vitals thresholds and metrics.** Current "good" thresholds are LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile. Metrics go through experimental → pending → stable lifecycle phases and can be retired or replaced. Check `https://web.dev/articles/vitals`.

Additionally, the **Edge Runtime deprecation** for Next.js routes is recent and consequential. If any guide tells you to set `runtime = 'edge'` per route, verify that advice against `https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime` before following it.

No API names, configuration keys, or URLs in this paper were invented. Where an exact documentation path was uncertain, the entry reads "search: `<name>`" instead of a guessed URL.

---

## Bonus — Handoff Prompt

Copy the block below into a fresh agent session to expand, deepen, or re-target this paper.

```text
You are continuing a long-form technical learning paper for a semi-technical reader
named Chris: a working web developer with a Next.js (App Router) SaaS on Vercel,
preparing for full-stack / AI-flavored developer interviews.

FILE: markdown_docs/05-web-platform-2026-rsc-streaming-edge-wasm.md
TITLE: The Complete Guide: The Web Platform in 2026
TOPIC: RSC, Streaming, Edge, and WASM

HOUSE STYLE — preserve exactly:
1.  `# The Complete Guide: The Web Platform in 2026`
2.  One-liner blockquote + `Last verified: September 2026` + `Series: Chris Wander · New Paper Series`
3.  `## The Big Picture` — fenced ASCII request diagram + analogy table
4.  `## The 60-Second Version (TL;DR)`
5.  `## Prerequisites`
6.  Numbered `## Part N — Title` sections, code in fenced blocks with language tags
7.  `## Cheat Sheets` — tables (RSC vs Client, cache layers, runtime capabilities, CWV targets)
8.  `## Troubleshooting` — symptom → cause → fix table
9.  `## Video Library` — YouTube SEARCH links only, never invented URLs
10. `## Written References` — official docs only; use "search: <name>" if unsure
11. `## Glossary`
12. `## FAQ & Next Steps`
13. `## Verification Note`
14. `## Bonus — Handoff Prompt`

HONESTY RULES (non-negotiable):
- Never invent API names, config keys, flags, version numbers, or URLs.
- Flag fast-moving areas explicitly: PPR status, caching defaults, CWV thresholds.
- Distinguish official behavior from community convention from vendor marketing.
- Use blockquote callouts for version-dependent behavior and gotchas.
- Verify claims with web tools before writing.

TASKS FOR THIS SESSION (pick what the user asks, otherwise do all):
1. Verify the current Next.js caching model, PPR status, and `runtime` config against
   https://nextjs.org/docs and correct any version-dependent statements.
2. Verify Cloudflare Workers limits against
   https://developers.cloudflare.com/workers/platform/limits/ — cite numbers explicitly.
3. Expand Part 7 (WebAssembly) with a runnable end-to-end example: compile a small Rust or
   AssemblyScript module, load it with `instantiateStreaming`, and benchmark it against the
   equivalent plain-JS implementation, including boundary-crossing cost measurements.
4. Expand Part 8 with a real Core Web Vitals measurement setup using the `web-vitals`
   library posted to an analytics Route Handler, plus a table mapping each metric to a
   Next.js-specific fix.
5. Add a new Part covering observability: structured logs, tracing, and how to tell a cold
   start from a slow query in production.
6. Re-check every URL in `## Written References` and replace any "search:" entries with a
   verified official URL, or leave "search:" if the path cannot be confirmed.
7. Add a Part on security at the RSC boundary: Server Action auth, Data Access Layers,
   return-value tainting, and what the framework does versus what you must do.

CONSTRAINTS:
- Keep the file LONG and DEEP (aim to add 1,000–2,000 words per expansion pass).
- Plain English, second person, no filler. No HTML. Pure Markdown.
- Update the `Last verified:` date and the Verification Note to match the session date.
- Reply with only: file path, one-line summary, word count.
```
