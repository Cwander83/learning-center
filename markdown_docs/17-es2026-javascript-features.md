# The Complete Guide: ES2026 and the New JavaScript You Can Actually Use

> Seven features landed in the ES2026 spec on 30 June 2026, and two of the biggest — `Temporal` and `using` — were deliberately held back for ES2027 even though engines already ship them. Here is what each new function does, what it replaces, and how to tell "in the spec" from "in the browser".

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

JavaScript ships on a yearly train. Every June, TC39's finished proposals get published as one new edition of ECMA-262, and every engine (V8, JavaScriptCore, SpiderMonkey) has usually shipped them months before the paperwork caught up. That gap is the single most confusing thing about "new JavaScript": a feature can be **done**, **shipped**, **in the spec**, or **not in the spec yet**, and those are four different facts.

In 2026 the gap got wide enough to trip people up. `Temporal` — the replacement for `Date` — reached Stage 4 in March 2026 and runs by default in Node 26 and Firefox. `using` runs in Chrome, Node, and Deno. Both are **finished**, and both are **not in ES2026**. They are slated for ES2027. Meanwhile the seven features that *are* ES2026 read like a maintenance release: precise math, sane binary encoding, a real `Map` upsert. That contrast is the story of this year's language update.

```
   HOW A JAVASCRIPT FEATURE SHIPS

   Proposal ──► Stage 1 ──► Stage 2 ──► Stage 2.7 ──► Stage 3 ──► Stage 4
   idea        shape       design      test-ready     browsers    finished
                reviewed    settled     (impl can     can start   2 impls +
                                        start)        building    tests pass
                                                          │
                                                          ▼
                              merged into the living spec immediately
                                                          │
                              ┌───────────────────────────┴────────────┐
                              ▼                                        ▼
                   ENGINES SHIP IT                         SNAPSHOT IS PUBLISHED
                   Chrome / Node / Firefox / Safari        the "ES20XX" edition
                   often 6–18 months EARLIER               the following June
                                                          (ES2026 = 17th edition,
                                                           ratified 30 June 2026)

   THE TRAP: "shipped" and "in ES2026" are not the same date.
   Temporal + using = shipped, but published in ES2027.
```

The rule to internalise: **check the edition for the spec text, and check your runtime for the behaviour.** If those two disagree, your runtime is ahead, and that is normal.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **TC39** | The committee that designs JavaScript | Their stage list is the roadmap; nothing else is |
| **Stage 4** | "Feature complete, two independent engines agree" | Merged into the spec draft immediately |
| **ECMA-262 edition** | The printed annual snapshot | ES2026 = the 17th edition, ratified 30 June 2026 |
| **`Temporal`** | A new date library, built into the language | Replaces `Date`; immutable and time-zone aware |
| **`using`** | `try/finally` that runs itself | Deterministic cleanup for files, connections, locks |
| **`Array.fromAsync`** | `Array.from`, but for async sources | Collect an async generator without a loop |
| **`Error.isError`** | A reliable "is this an Error?" test | The only check that works across iframes/realms |
| **`Math.sumPrecise`** | Addition that does not drift | Sums floats without accumulated rounding error |
| **`Uint8Array.fromBase64`** | Base64 without `atob` or a Buffer shim | Binary encoding in the standard library |
| **`Iterator.concat`** | Lazily join several iterables | No intermediate arrays, no custom generator |
| **`JSON.parse` source access** | "Show me the original digits" | Big integers survive a JSON round-trip |
| **`Map.getOrInsert`** | `get`-or-set in one call | The upsert idiom, finally built in |

> **The one-sentence version:** adopt the seven ES2026 features now (they are small, safe, and mostly backfill), learn `Temporal` and `using` now (they are the real prizes and are already running), and treat everything at Stage 3 as a watchlist rather than a dependency.

---

## The 60-Second Version (TL;DR)

1. **ES2026 is the 17th edition of ECMA-262**, ratified by Ecma International on **30 June 2026**. It contains exactly **seven** features, all API additions, no new syntax.
2. **`Array.fromAsync`** collects an async iterable into an array, with an optional mapping function.
3. **`Error.isError`** is the cross-realm-safe way to ask "is this an error?" — `instanceof Error` is not.
4. **`Math.sumPrecise`** sums an iterable of numbers without floating-point drift.
5. **`Uint8Array` gained `fromBase64`, `toBase64`, `fromHex`, `toHex`** — no more `Buffer` shims or `atob` dance.
6. **`Iterator.concat`** lazily sequences several iterables into one.
7. **`JSON.parse`'s reviver now gets a third argument, `context.source`**, the raw text of each value — so you can recover integers that JavaScript would otherwise round. `JSON.rawJSON()` fixes the stringify side.
8. **`Map` and `WeakMap` gained `getOrInsert` and `getOrInsertComputed`** (the "Upsert" proposal).
9. **The two headliners are ES2027, not ES2026:** `Temporal` (a full date/time API) and `using` (deterministic resource cleanup). Both are Stage 4 and shipped in engines today.
10. **Everything else is Stage 3 or lower.** Decorators, `import defer`, iterator extras, and a dictionary-shaped `Promise.all` are close; pattern matching is early; Records & Tuples is dead.

If you read nothing else, read **Part 1 (how to read the year)** and **Part 3 (`Temporal`)**.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| Node.js 26 (Current) | The newest features land with each V8 bump; Node 24 has only part of the seven | `node --version` |
| A current browser | Chrome 146 / Firefox 139+ / Safari 26 for the newest engine features | `chrome://version` |
| A test file you own | So the per-feature "does my runtime have it?" script is real work | any repo |
| Optional: a polyfill budget | `Temporal` still needs one on older Safari | see Part 7 |

> **Pin one version in your head.** Everything in this guide is written against **Node.js 26** (Current, released May 2026; LTS from October 2026) and evergreen Chrome/Firefox/Safari. If you are on Node 18, half of this is already two years old and the other half is unavailable. Upgrade first.

---

## Part 1 — How to Read the Year Without Getting Confused

### 1.1 The four states of a feature

Every JavaScript feature passes through four states, and blog posts collapse them into one, which is why the reporting is a mess:

| State | What it means | How to confirm |
|---|---|---|
| **Proposed** | A stage number exists | tc39/proposals table |
| **Shipped** | At least one engine runs it, often behind a flag | MDN compatibility table, `caniuse` |
| **Specified** | The edition has been ratified | The ES2026 feature list |
| **Universal** | Every core browser, no flag | Baseline (see Paper 14) |

A feature is only safe to ship dependency-free when it is **universal**, not when it is specified. Baseline is the label for that, and it is the same two-year clock the CSS paper describes.

### 1.2 The 2026 surprise: shipped ≠ specified

Two big features are Stage 4 and shipped but **not** in ES2026:

- **`Temporal`** — reached Stage 4 in March 2026 and is published in **ES2027**.
- **Explicit Resource Management (`using`)** — Stage 4, published in **ES2027**.

The TC39 finished-proposals table is explicit about this: both carry an **Expected Publication Year of 2027**, alongside `Atomics.pause` and Joint Iteration. They reached Stage 4 *after* the ES2026 cutoff.

```
   SAME YEAR, DIFFERENT PAPERWORK

   Stage 4 reached:        Mar 2026        Mar 2026       2026
   Feature:                Temporal        using          the seven
   Published in:           ES2027          ES2027         ES2026
   Runs today in Node 26:  yes             yes            yes

   → "Temporal is in ES2026" is WRONG, even though you can use it.
   → "using isn't available yet" is WRONG, even though it's ES2027.
```

### 1.3 Where to check, and what wins

| Tool | What it gives you |
|---|---|
| **tc39/proposals** (GitHub) | The authoritative stage table: `README.md` for live proposals, `finished-proposals.md` for Stage 4 and its publication year |
| **MDN** | Per-feature pages with a compatibility table and a status banner |
| **Node.js API docs** | Version-tagged "Added in" and "History" tables — the cleanest per-version record there is |
| **V8 / SpiderMonkey / WebKit blogs** | What an engine actually shipped, and in which version |
| **caniuse / Baseline (webstatus.dev)** | The universal-or-not question |

> **Conflict resolution rule:** the TC39 finished-proposals table wins on *what is in which edition*; the runtime's own documentation wins on *what my code will do today*. A blog post wins on neither.

### 1.4 The honest caveat

The exact feature list of any edition is settled by the Ecma General Assembly, and the ratification happened on 30 June 2026. If a source published before that date lists "seven features", it was describing the candidate, not the ratified text. Everything in Part 2 is drawn from the ratified list in TC39's `finished-proposals.md`.

---

## Part 2 — The Seven ES2026 Features, One by One

These are all API additions with no new syntax, so there is nothing to parse and nothing to break. Each subsection gives the before/after.

### 2.1 `Array.fromAsync` — collect an async generator

The async sibling of `Array.from`. It awaits promises and pulls an async iterable into a real array.

```js
// Before: a manual loop
const collected = [];
for await (const item of asyncSource()) {
  collected.push(item);
}

// After
const items = await Array.fromAsync(asyncSource());

// With a mapping function, same shape as Array.from
const doubled = await Array.fromAsync(new Set([1, 2, 3]), (n) => n * 2);
// [2, 4, 6]
```

It accepts async iterables, sync iterables that yield promises, and array-like objects. It is **not** a replacement for streaming: it holds the whole result in memory, so use it for bounded collections.

### 2.2 `Error.isError` — the only cross-realm test that works

`value instanceof Error` is unreliable the moment more than one JavaScript realm is in play: an error thrown inside an `<iframe>` is not an instance of your `Error`, because the constructor is a different object.

```js
// Broken across realms
iframeError instanceof Error; // false, even though it IS an Error

// Correct
Error.isError(iframeError);   // true
Error.isError(new Error("x")); // true
Error.isError({ name: "Error" }); // false
```

`Error.isError` checks the internal error brand, so it also returns `true` for `DOMException` and other spec-defined error types. Use it in any code that inspects unknown `catch` values.

### 2.3 `Math.sumPrecise` — addition without the drift

Summing a list of floats accumulates rounding error. `0.1 + 0.2` is famously not `0.3`, and the error compounds.

```js
[0.1, 0.2, 0.3].reduce((a, b) => a + b, 0); // 0.6000000000000001
Math.sumPrecise([0.1, 0.2, 0.3]);           // 0.6
```

It takes any iterable of numbers and returns a correctly-rounded sum. It is slower than a naive `reduce`, so use it where the accuracy matters — money-adjacent maths, statistics, test assertions — not in a hot loop.

> **It is not a decimal type.** `Math.sumPrecise` fixes *summation*, not *representation*. For exact currency arithmetic you still want integer cents or a decimal library.

### 2.4 `Uint8Array` base64 and hex — the standard library caught up

Base64 in JavaScript used to mean `btoa`/`atob` (which only handle binary strings), a `Buffer` shim, or a dependency.

```js
const bytes = new Uint8Array([104, 105]); // "hi"

bytes.toBase64();              // "aGk="
bytes.toHex();                 // "6869"
Uint8Array.fromBase64("aGk="); // Uint8Array(2) [104, 105]
Uint8Array.fromHex("6869");    // Uint8Array(2) [104, 105]
```

The `from*` methods accept options for non-standard alphabets and for how to handle a trailing partial chunk. The common case is the plain call above.

**What it deletes:** `btoa`/`atob` wrappers, `Buffer.from(x, 'base64')` in code that is otherwise browser-portable, and the base64 package in your dependency tree.

### 2.5 `Iterator.concat` — lazy sequencing

Joining iterables used to mean spreading them into arrays (materialising everything) or writing a generator.

```js
// Before: materialises intermediate arrays
const all = [...a, ...b];

// Or a hand-written generator
function* concat(...sources) {
  for (const source of sources) yield* source;
}

// After: lazy, no boilerplate
for (const value of Iterator.concat([1, 2], new Set([3, 4]), gen())) {
  console.log(value);
}
```

`Iterator.concat` is a static method on `Iterator` and returns a lazy iterator, so nothing is read until you iterate. It sequences *iterables*, not iterators — a consumed iterator will not replay.

### 2.6 `JSON.parse` source access and `JSON.rawJSON`

The quiet gem of ES2026. JSON has arbitrary-precision numbers; JavaScript numbers do not. Round-tripping a large integer ID through `JSON.parse` silently corrupts it:

```js
JSON.parse('{"id": 9007199254740993}').id; // 9007199254740992  ← rounded
```

ES2026 gives the reviver a third argument whose `source` field is the **raw text** of the value being revived:

```js
const parsed = JSON.parse('{"id": 9007199254740993}', (key, value, context) => {
  if (key === "id" && typeof value === "number") {
    return BigInt(context.source); // 9007199254740993n
  }
  return value;
});
```

On the stringify side, `JSON.rawJSON()` builds a value whose digits are emitted verbatim, and `JSON.isRawJSON()` tests for it:

```js
const raw = JSON.rawJSON("9007199254740993");
JSON.stringify({ id: raw }); // {"id":9007199254740993}
```

Together these make big integer IDs safe through a full JSON round-trip. If you have ever stored a Snowflake ID or a 64-bit key and watched the last digits change, this is the fix.

### 2.7 `Map.getOrInsert` — the upsert you kept writing by hand

Grouping and memoising with a `Map` always needed the same three lines:

```js
// Before
let bucket = groups.get(key);
if (bucket === undefined) {
  bucket = [];
  groups.set(key, bucket);
}
bucket.push(value);
```

ES2026 adds the method:

```js
// After — value form
const user = cache.getOrInsert(userId, { visits: 0 });

// After — computed form, the factory only runs on a miss
const user2 = cache.getOrInsertComputed(userId, (key) => fetchUser(key));
```

Both exist on `Map` and `WeakMap`. Use `getOrInsert` when the default is cheap and reusable; use `getOrInsertComputed` when constructing the default is expensive, because the factory is only invoked when the key is absent.

> **Watch the name.** The proposal is called **Upsert** in TC39's tables; the shipped methods are `getOrInsert` / `getOrInsertComputed`. Searching for "map emplace" (an older name) leads to stale pages.

---

## Part 3 — `Temporal`: The Real Headline (ES2027, Here Now)

`Temporal` is the first genuine replacement for `Date` in JavaScript's history, and it has been in progress for roughly nine years. It reached Stage 4 in **March 2026** and is published in **ES2027**. Firefox shipped it in v139, Chrome and Edge in v144, and **Node.js 26 enables it by default** (V8 14.6).

### 3.1 Why `Date` was the problem

`Date` is mutable, month-indexed from zero, silently coerces to the machine's local time zone, and has no concept of a calendar date without a time. Every one of those is a bug generator:

```js
new Date(2026, 0, 1); // 1 January 2026 — because January is 0
```

`Temporal` fixes this by refusing to be one type. It gives you a family of types, each with one job.

| Type | Represents | Use for |
|---|---|---|
| `Temporal.Instant` | An exact point on the timeline | Log timestamps, epoch maths |
| `Temporal.ZonedDateTime` | An instant + a time zone + a calendar | Meetings, anything a user sees in "their" time |
| `Temporal.PlainDateTime` | A wall-clock date and time, no zone | UI values before they are committed |
| `Temporal.PlainDate` | A calendar date | Birthdays, due dates, billing periods |
| `Temporal.PlainTime` | A clock time | Opening hours, alarms |
| `Temporal.PlainYearMonth` | A year and month | Statements, monthly reports |
| `Temporal.PlainMonthDay` | A month and day, no year | Anniversaries, recurring holidays |
| `Temporal.Duration` | A length of time | "Three days and four hours" |

The design rule: **`Plain` types have no time zone; `ZonedDateTime` has one; `Instant` is the raw timeline.** Pick the narrowest type that is true.

### 3.2 The moves you will make every day

```js
// Now, in a named zone, DST-safe
const now = Temporal.Now.zonedDateTimeISO("America/New_York");
now.toString(); // "2026-09-28T09:00:00-04:00[America/New_York]"

// Arithmetic that respects the calendar and DST
const due = now.add({ days: 14 }).with({ hour: 17, minute: 0 });
```

```js
// Calendar dates stay calendar dates
const start = Temporal.PlainDate.from("2026-01-01");
const end = Temporal.PlainDate.from("2026-09-28");
end.since(start, { largestUnit: "months" }).toString(); // "P8M27D"

// A plain date never shifts because of a time zone
start.add({ months: 1 }).toString(); // "2026-02-01"
```

```js
// Conversions are explicit, never implicit
const instant = Temporal.Now.instant();
const inTokyo = instant.toZonedDateTimeISO("Asia/Tokyo");
inTokyo.toPlainDate().toString(); // the local calendar date in Tokyo
```

### 3.3 Polyfills, while you wait for Safari

Firefox, Chromium-based browsers, and Node 26 ship `Temporal` natively. Safari's support has been partial, so for broad reach use a polyfill:

```bash
npm install @js-temporal/polyfill
```

```js
// import once, at the top of your entry point
import "@js-temporal/polyfill";
```

There is also `temporal-polyfill`, a smaller alternative. Both are production-grade; the reference implementation from the proposal champions is `@js-temporal/polyfill`.

> **Do not feature-detect by touching `Temporal.Now` in a hot path.** Import the polyfill at the entry point, or gate the whole `Temporal` import behind a dynamic `import()` so you only pay for it where it is missing.

---

## Part 4 — `using`: Deterministic Cleanup (Also ES2027, Also Here)

Explicit Resource Management adds two keywords, `using` and `await using`, plus a small set of helper types. It is the JavaScript version of a scope-bound `finally`.

### 4.1 The pattern it replaces

```js
// Before: the cleanup is easy to forget on an early return or throw
const file = await open(path);
try {
  await process(file);
} finally {
  await file.close();
}
```

### 4.2 The pattern it enables

```js
class Tracer {
  #label;
  constructor(label) { this.#label = label; }
  [Symbol.dispose]() {
    console.log(`released: ${this.#label}`);
  }
}

{
  using t = new Tracer("db-handle");
  // ... work
} // "released: db-handle" — runs here, even if the block throws
```

For asynchronous cleanup, add `await`:

```js
{
  await using conn = await openConnection();
  // dispose awaits [Symbol.asyncDispose]() at block exit
}
```

### 4.3 The helper types

| Type | Purpose |
|---|---|
| `Symbol.dispose` / `Symbol.asyncDispose` | The well-known symbol a disposable object implements |
| `DisposableStack` | Collect several disposables and release them in reverse order |
| `AsyncDisposableStack` | The async equivalent |
| `SuppressedError` | Wraps a cleanup error when the body also threw, so neither is lost |

```js
{
  using stack = new DisposableStack();
  stack.use(openFile("a.txt"));
  stack.use(openFile("b.txt"));
} // both files closed, newest first
```

### 4.4 Where it already runs

Chrome, Node.js, and Deno ship `using` today; Babel and TypeScript support the syntax. It is Stage 4 and slated for **ES2027**, so treat it as "available in modern engines, not yet universal". It is safe inside a build step you control, and it is a poor choice for a library that must run on the oldest browser you support without transpilation.

---

## Part 5 — The Stage 3 Watchlist

These are designed and ready for engines to implement, but not finished. Do not build a product on them; do read them, because several will land within a year.

| Proposal | What it does | Note |
|---|---|---|
| **Deferring Module Evaluation** (`import defer`) | Fetch and link a module now, evaluate it on first use | Already shipping behind flags; MDN lists it as experimental |
| **Source Phase Imports** (`import source`) | Import a module's *source* and instantiate it later | Pairs with the deferred-evaluation story |
| **Import Text** | `import text from "./file.txt"` as a string | Removes a bundler-specific trick |
| **Iterator Includes** | `Iterator.prototype.includes` | `Array.prototype.includes`, but lazy |
| **Iterator Join** | Concatenate an iterator's values into a string | Complements `Iterator.concat` |
| **Iterator Chunking** | Split a long iterator into fixed-size chunks | Batch processing without manual buffering |
| **Await Dictionary** | `Promise.allKeyed` / `Promise.allSettledKeyed` | The "named `Promise.all`" everyone writes by hand |
| **Error Stack Accessor** | Turn `error.stack` into a proper accessor | Better stack handling for libraries |
| **RegExp Buffer Boundaries** | `\A`, `\z`, `\Z` anchors | Anchors that are not line-relative |
| **Decorators** | Standard class decorators, no transpiler | Stage 2.7 as of the May 2026 meeting; TypeScript and Babel already implement the shape |
| **Dynamic Code Brand Checks** | Flexible brand checks before dynamic code loading | Security-adjacent; used by trusted-types work |

> **The Stage 2.7 oddity.** TC39 added an intermediate stage, **2.7**, for proposals that are essentially designed but need implementation testing before Stage 3. Decorators and Decorator Metadata sat there in 2026. Seeing "2.7" means "close, not promised".

---

## Part 6 — What Is Not Coming (Despite What You Read)

Being clear about the dead options saves you a weekend of research.

### 6.1 Records & Tuples is withdrawn

The `#[1, 2]` tuple and `#{ x: 1 }` record syntax — deeply immutable, compared by value — was **withdrawn at the April 2025 plenary** after years at Stage 2. The follow-up is **Composites**, a much smaller Stage 1 proposal that gives value-based equality using ordinary frozen, interned objects rather than new primitives. It has shipped nowhere. For production today, the answer is a plain array plus a convention, or TypeScript's tuple type as a compile-time contract.

### 6.2 Pattern matching is early

The `match` expression proposal sits at **Stage 1**. It may land, but not before ES2027 at the earliest, and not in a form you should design around.

### 6.3 The pipeline operator is still stuck

`|>` has been "nearly there" for years. The disagreement is over `%` placeholders versus topic-style binding, and it has not resolved. Do not wait for it; a named local variable is fine.

### 6.4 `import attributes` is ES2025, not ES2026

You will see guides list `import x from "./data.json" with { type: "json" }` as a 2026 feature. It is not. Import Attributes and JSON Modules reached Stage 4 in October 2024 and are published in **2025**. Same for the new `Set` methods, iterator helpers, and `Promise.try`. They are modern, and they are last year's news.

---

## Part 7 — Adopting It: What Runs Where

### 7.1 Per-feature support, plainly

| Feature | Edition | Node | Browsers | Safe without a polyfill? |
|---|---|---|---|---|
| `Array.fromAsync` | ES2026 | 22+ | Chrome 121+, Firefox 115+, Safari 16.4+ | Yes for current targets |
| `Error.isError` | ES2026 | 24+ | Chrome 134+, Firefox 138+, Safari 18.4+ | Check your target |
| `Math.sumPrecise` | ES2026 | **not yet** | Chrome 147+, Firefox 137+, Safari 26.2+ | Newest engine-only; polyfill in Node |
| `Uint8Array` base64/hex | ES2026 | 25+ | Chrome 140+, Firefox 133+, Safari 18.2+ | Check your target |
| `Iterator.concat` | ES2026 | 26 (V8 14.6) | Chrome 146+, Firefox 147+, Safari 26.4+ | Newest; feature-detect |
| `JSON.parse` source / `rawJSON` | ES2026 | 21+ | Chrome 114+, Firefox 135+, Safari 18.4+ | Widely landed already |
| `Map.getOrInsert` | ES2026 | 26 (V8 14.6) | Chrome 145+, Firefox 144+, Safari 26.2+ | Newest of the seven |
| `Temporal` | ES2027 | 26 (default) | Firefox 139+, Chrome 144+, Safari partial | Polyfill for full reach |
| `using` / `await using` | ES2027 | 24+ | Chrome 134+, Firefox 141+, Safari preview | Transpiler or modern-only |

> **Treat the browser columns as a starting point, not gospel.** Compatibility tables move every few weeks, and several of the engine versions above landed within the last few releases. The authoritative check is MDN's compatibility table for the specific feature plus your own `node --version` — which is exactly what the script in 7.2 does. The table above is a September 2026 snapshot.

> **One entry deserves a warning.** `Math.sumPrecise` had **not shipped in Node as of this check** — it depends on a V8 version newer than the one in Node 26. In Node, do the summation in a helper or use a small library until V8 catches up; the browser columns are the ones that have it.

### 7.2 A sixty-second feature-detection script

Run this on whatever runtime you actually deploy to. It tells you the truth in one pass.

```js
// check.mjs — run: node check.mjs
const checks = {
  "Array.fromAsync": () => typeof Array.fromAsync === "function",
  "Error.isError": () => typeof Error.isError === "function",
  "Math.sumPrecise": () => typeof Math.sumPrecise === "function",
  "Uint8Array.fromBase64": () => typeof Uint8Array.fromBase64 === "function",
  "Iterator.concat": () => typeof Iterator.concat === "function",
  "JSON.rawJSON": () => typeof JSON.rawJSON === "function",
  "Map.getOrInsert": () => typeof Map.prototype.getOrInsert === "function",
  Temporal: () => typeof globalThis.Temporal === "object",
  "using (syntax)": () => true, // syntax: you know at build time, not runtime
};

for (const [name, test] of Object.entries(checks)) {
  console.log(test() ? "✓" : "✗", name);
}
```

The `using` line is honest about a real distinction: a syntax feature cannot be probed at runtime. If your parser accepts it, it exists; if not, you get a parse error, and that is a transpiler or target-version decision, not a feature check.

### 7.3 The adoption order that costs the least

1. **Today:** swap `instanceof Error` for `Error.isError` and any base64 helper for `Uint8Array.fromBase64`.
2. **This week:** add `Math.sumPrecise` to test helpers and money-adjacent sums, and `getOrInsertComputed` to your cache maps.
3. **Next:** fix any big-integer JSON round-trip with `context.source` and `JSON.rawJSON`.
4. **Then:** pilot `Temporal` in one module behind the polyfill, converting a `Date` that has caused an off-by-one.
5. **Later:** adopt `using` in a service you control, where the runtime is not in question.

---

## Cheat Sheet

```js
// ─── ES2026: the seven ──────────────────────────────────────────────
await Array.fromAsync(asyncSource());                 // async → array
await Array.fromAsync(new Set([1, 2]), (n) => n * 2); // with a map fn
Error.isError(value);                                 // cross-realm safe
Math.sumPrecise([0.1, 0.2, 0.3]);                     // 0.6, no drift
bytes.toBase64(); bytes.toHex();
Uint8Array.fromBase64("aGk="); Uint8Array.fromHex("6869");
Iterator.concat(a, b, c);                             // lazy sequence
JSON.parse(text, (k, v, ctx) => ctx.source);          // raw digits
JSON.stringify({ id: JSON.rawJSON("9007199254740993") });
map.getOrInsert(key, fallback);
map.getOrInsertComputed(key, (k) => compute(k));
```

```js
// ─── ES2027, shipping now ───────────────────────────────────────────
const now = Temporal.Now.zonedDateTimeISO("America/New_York");
now.add({ days: 14 }).with({ hour: 17 });
Temporal.PlainDate.from("2026-09-28").since("2026-01-01", { largestUnit: "months" });

class Handle { [Symbol.dispose]() { /* release */ } }
{
  using h = new Handle();   // disposed at block exit
}
{
  await using c = await openConnection(); // await [Symbol.asyncDispose]()
}
```

| I want to… | Use |
|---|---|
| Collect an async generator | `Array.fromAsync` |
| Reliably test for an error | `Error.isError` |
| Sum floats accurately | `Math.sumPrecise` |
| Encode/decode base64 or hex | `Uint8Array.fromBase64` / `toHex` |
| Join iterables lazily | `Iterator.concat` |
| Keep a 64-bit ID intact through JSON | `context.source` + `JSON.rawJSON` |
| Get-or-set in a `Map` | `getOrInsert` / `getOrInsertComputed` |
| Handle dates and time zones | `Temporal.ZonedDateTime` |
| Clean up a resource deterministically | `using` / `await using` |
| Check the edition a feature is in | TC39 `finished-proposals.md` |
| Check whether you can use it today | MDN table + `node --version` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Math.sumPrecise is not a function` | It had not shipped in Node as of this check; newer engines only | Use a summation helper or a small library in Node; verify with the Part 7 script |
| `Error.isError` missing | Same — feature is recent | Upgrade, or keep `instanceof` only within one realm |
| A big integer ID still changes | Code path never used the reviver | Add `context.source` handling, or parse with a decimal library |
| `TypeError: Iterator.concat is not a function` | Node 26-era feature on an older runtime | Upgrade, or keep the hand-written generator |
| `getOrInsert is not a function` | Newest of the seven; Chrome 145+/Node 26 | Feature-detect and fall back to `get`/`set` |
| `Temporal is not defined` | Safari, or Node < 26 without the polyfill | `npm i @js-temporal/polyfill` and import it at the entry point |
| Polyfill loaded twice, huge bundle | Static import plus a dynamic `import()` | Pick one path; gate the dynamic import on `!globalThis.Temporal` |
| `SyntaxError` on `using` | Parser predates the syntax, or a target too old | Raise the target, or transpile |
| "Temporal is in ES2026" per a blog | Blog conflated "Stage 4" with "this edition" | Trust `finished-proposals.md`; Temporal is ES2027 |
| New `Set`/iterator methods listed as ES2026 | They are ES2025 | Harmless, but do not plan around an incorrect year |
| `Uint8Array.fromBase64` throws on an odd string | Invalid or truncated base64 | Use the options argument, or validate before decoding |
| `JSON.rawJSON` output is rejected | Raw string is not valid JSON for the position | Pass a valid JSON literal (digits, `true`, `null`), not an arbitrary string |

---

## Video Library

YouTube **search** links only — version-specific videos date badly.

| Search | What you'll find |
|---|---|
| [ECMAScript 2026 new features](https://www.youtube.com/results?search_query=ECMAScript+2026+new+features) | Walkthroughs of the seven |
| [Temporal API tutorial](https://www.youtube.com/results?search_query=Temporal+API+tutorial) | Replacing `Date` end to end |
| [JavaScript using statement](https://www.youtube.com/results?search_query=JavaScript+using+statement+explicit+resource+management) | Resource management in practice |
| [Array.fromAsync explained](https://www.youtube.com/results?search_query=Array.fromAsync+explained) | Async collection without loops |
| [Math.sumPrecise floating point](https://www.youtube.com/results?search_query=Math.sumPrecise+floating+point+JavaScript) | Why summation drifts |
| [Uint8Array base64 hex](https://www.youtube.com/results?search_query=Uint8Array+base64+hex+JavaScript) | Binary encoding in the stdlib |
| [JSON.parse source text access](https://www.youtube.com/results?search_query=JSON.parse+source+text+access+JavaScript) | Big integers through JSON |
| [Map getOrInsert upsert](https://www.youtube.com/results?search_query=Map+getOrInsert+upsert+JavaScript) | The upsert idiom |
| [TC39 stages explained](https://www.youtube.com/results?search_query=TC39+stages+explained) | Reading the roadmap |
| [import defer JavaScript](https://www.youtube.com/results?search_query=import+defer+JavaScript) | Deferred module evaluation |

---

## Written References & Docs

Primary sources first: TC39 for the spec, the runtime's own docs for behaviour.

| Source | URL |
|---|---|
| TC39 proposals — live stage table | `https://github.com/tc39/proposals` |
| TC39 — finished proposals and publication years | `https://github.com/tc39/proposals/blob/main/finished-proposals.md` |
| TC39 — current candidates (Stage 3) | `https://tc39.es/` |
| ECMAScript language spec (living draft) | `https://tc39.es/ecma262/` |
| MDN — `Temporal` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal` |
| MDN — `Array.fromAsync` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fromAsync` |
| MDN — `Error.isError` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError` |
| MDN — `Math.sumPrecise` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sumPrecise` |
| MDN — `Uint8Array.fromBase64` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64` |
| MDN — `Iterator.concat` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/concat` |
| MDN — `JSON.rawJSON` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/rawJSON` |
| MDN — `Map.prototype.getOrInsert` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/getOrInsert` |
| MDN — `import defer` | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/defer` |
| MDN — using declarations | `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/using` |
| Node.js 26 release notes | `https://nodejs.org/en/blog/release/v26.0.0` |
| `@js-temporal/polyfill` | `https://github.com/js-temporal/temporal-polyfill` |
| Igalia — Temporal reaches Stage 4 | `https://www.igalia.com/2026/03/13/Temporal-Reaches-Stage-4.html` |
| Composites proposal | `https://tc39.es/proposal-composites/` |

**Third-party, for context only:**

| Source | Why |
|---|---|
| Compatibility trackers (caniuse, MDN tables) | Convenient, but re-check per feature and date |
| "What's new in ES20XX" blog roundups | Good index; frequently wrong about the edition year |
| Runtime comparison articles | Vendor-flavoured; verify on the runtime's own docs |

> **Verification tip:** the edition a feature belongs to comes from `finished-proposals.md`. The behaviour you will get today comes from the runtime's docs. When a blog post and those disagree, the blog is wrong.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| TC39 | The committee that designs the JavaScript language |
| Stage 4 | Finished: two implementations and a passing test suite |
| ECMA-262 | The standard that defines JavaScript |
| ES2026 | The 17th edition, ratified 30 June 2026 |
| Candidate | The draft list of features for an edition, before ratification |
| `Array.fromAsync` | Build an array from an async iterable |
| `Error.isError` | Cross-realm-safe error check |
| `Math.sumPrecise` | Correctly-rounded summation of an iterable |
| `Iterator.concat` | Lazily sequence several iterables |
| `JSON.rawJSON` | Emit a JSON literal verbatim during stringify |
| `getOrInsert` | Return a `Map` value, inserting a default if absent |
| `Temporal` | The modern date/time API (ES2027) |
| `ZonedDateTime` | An instant plus a time zone and calendar |
| `PlainDate` | A calendar date with no time or zone |
| `using` | A declaration that disposes its value at scope exit |
| `Symbol.dispose` | The symbol a disposable object implements |
| `SuppressedError` | Wraps a cleanup error when the body also threw |
| Upsert | The TC39 name for the `getOrInsert` proposal |
| Polyfill | A library that adds a missing feature at runtime |
| Transpile | Rewrite newer syntax for older targets at build time |
| Composites | The Stage 1 successor to the withdrawn Records & Tuples |

---

## FAQ & Next Steps

**Is `Temporal` part of ES2026?** No. It reached Stage 4 in March 2026 but is published in **ES2027**. It runs today in Node 26, Firefox, and Chromium-based browsers, so "available" and "in ES2026" are both true statements about different things.

**Is `using` available?** Yes, in Chrome, Node.js, and Deno; the spec publication is ES2027. Use it where you control the runtime; transpile where you do not.

**Why are these API-only additions and not syntax?** TC39 deliberately kept ES2026 conservative after a decade of large releases. No new syntax means no parser changes and no compatibility risk from the additions themselves.

**Do I still need a base64 library?** In browsers and Node 25+, no — `Uint8Array.fromBase64`/`toBase64` and the hex pair replace the common cases. Keep a library only for non-standard alphabets, streaming, or Node 24 and older.

**`Error.isError` versus `instanceof Error` — which should I use?** `Error.isError` everywhere you inspect an unknown value, especially in a catch block. `instanceof` is fine only when you are certain there is a single realm.

**Does `Math.sumPrecise` fix `0.1 + 0.2`?** It fixes *summing* a list. The single addition `0.1 + 0.2` is a representation issue and is unchanged. For money, use integer cents or a decimal library.

**What is the safest way to try these?** Run the feature-detection script in Part 7 against your deployed runtime, then adopt in the order in 7.3. Nothing here requires a build change except `using`.

**Which one will I actually notice?** `Temporal` and `Map.getOrInsert`. The first because it deletes a class of time-zone bugs; the second because you write it by hand at least once a week.

**Where do I check a stage?** `https://github.com/tc39/proposals` — `README.md` for live work, `finished-proposals.md` for what shipped and in which edition.

### Next steps, in order

1. **Today:** run the Part 7 detection script on your runtime and note the gaps.
2. **This week:** replace `instanceof Error` with `Error.isError` and base64 helpers with `Uint8Array.fromBase64`.
3. **Next week:** add `getOrInsertComputed` to your caching layer and `Math.sumPrecise` to test helpers.
4. **Week 3:** fix one big-integer JSON round-trip with `context.source` and `JSON.rawJSON`.
5. **Week 4:** convert one `Date`-heavy module to `Temporal` behind the polyfill.
6. **Month 2:** read the Stage 3 watchlist and pick one feature to track, not adopt.

---

## Verification Note

**Verified as of September 2026 from TC39 and runtime primary sources:**

- **ES2026 is the 17th edition of ECMA-262**, ratified by Ecma International on 30 June 2026, containing exactly seven features, all API additions with no new syntax (TC39 `finished-proposals.md`; Ecma approval reporting).
- **The seven:** `Array.fromAsync`, `Error.isError`, `Math.sumPrecise`, `Uint8Array` base64/hex (`fromBase64`, `toBase64`, `fromHex`, `toHex`), `Iterator.concat` (Iterator Sequencing), `JSON.parse` source text access with `JSON.rawJSON`/`JSON.isRawJSON`, and `Map`/`WeakMap` `getOrInsert`/`getOrInsertComputed` (the Upsert proposal) — each carrying an Expected Publication Year of 2026 in `finished-proposals.md`.
- **`Temporal` reached Stage 4 in March 2026 and is published in ES2027**, not ES2026; its Expected Publication Year in `finished-proposals.md` is 2027. Firefox v139, Chrome v144, Edge v144 announced support; Node.js 26 enables Temporal by default (Node.js 26.0.0 release notes, 2026-05-05, V8 14.6).
- **Explicit Resource Management (`using` / `await using`) is Stage 4 and published in ES2027** (`finished-proposals.md`), shipping in Chrome, Node.js, Deno, with Babel and TypeScript support.
- **Also in ES2027 per `finished-proposals.md`:** `Atomics.pause` and Joint Iteration.
- **Stage 3 in 2026** includes Deferring Module Evaluation (`import defer`), Source Phase Imports (`import source`), Import Text, Iterator Includes, Iterator Join, Iterator Chunking, Await Dictionary (`Promise.allKeyed`), Error Stack Accessor, RegExp Buffer Boundaries, and Dynamic Code Brand Checks (TC39 proposals table; tc39.es current candidates).
- **Decorators** were presented for Stage 2.7 at the May 2026 plenary and are not in any edition; TypeScript 5.0+ and Babel implement the Stage 3 shape (proposals.fyi; TC39 May 2026 agenda).
- **Records & Tuples was withdrawn in April 2025** and replaced in scope by the **Composites** Stage 1 proposal; it has shipped nowhere (TC39 record-tuple withdrawal issue; `tc39.es/proposal-composites`).
- **Import Attributes and JSON Modules are ES2025, not ES2026** (`finished-proposals.md` shows an Expected Publication Year of 2025), as are the new `Set` methods, iterator helpers, `Promise.try`, and `RegExp.escape`.
- **Node.js type stripping** is stable (v24.12.0 / v25.2.0), enabled by default since v23.6.0 / v22.18.0, ignores `tsconfig.json`, and does not support syntax requiring code generation (Node.js TypeScript documentation).

**Where I am relying on third-party analysis rather than a primary source:** the per-feature Node and browser version columns in Part 7 are compiled from MDN compatibility tables and release reporting, not from a per-feature vendor announcement. MDN's tables are themselves aggregated, so treat those columns as a starting point and confirm the specific feature on MDN for your target before depending on a version. In particular, `Math.sumPrecise` had not shipped in Node as of this check — it needs a V8 version newer than Node 26 carries — so do not treat it as available server-side yet. The "adoption order" and "what to delete" recommendations are my synthesis, not spec text.

**Vendor and third-party claims, not independently verified:** the exact browser version at which each engine shipped a feature, and any claim about which engine was first. Engine blogs and MDN tables move; re-check before asserting a version.

**Changes fast:** stage numbers advance at roughly two-month intervals, engines ship between them, and Safari's `Temporal` status has been partial and moving. Re-check MDN and `node --version` before depending on any status in this guide.

**Not legal or financial advice.** `Math.sumPrecise` improves summation but is not a decimal type; do not treat it as sufficient for regulated monetary arithmetic.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd fold this into my own stack.**

| In my workspace | Verdict |
|---|---|
| A Node 24/26 backend | Take the whole ES2026 set now; they are additive and safe |
| Any cache or grouping `Map` | `getOrInsertComputed` removes the boilerplate today |
| Database IDs as strings in JSON | Add `context.source`; this is a real correctness fix, not a nicety |
| Existing `Date` usage | Convert one module to `Temporal` first, behind the polyfill |
| A service I deploy myself | `using` is available; use it for file handles and DB connections |
| A library meant to run anywhere | Stay on ES2025 features plus polyfills; skip `using` syntax |
| A build pipeline | Nothing changes for the seven; `using` needs a target bump |

**Recommended setup:**

- **Feature-detect on the real runtime.** The Part 7 script takes a minute and settles every argument about "is it available".
- **Keep the TC39 page pinned.** `finished-proposals.md` is the single source of truth for the edition question.
- **One polyfill, imported once.** `@js-temporal/polyfill` at the entry point, or gated behind a dynamic import. Never both.
- **Let the editor do the type work.** A TypeScript `lib` of `ES2024`/`ES2025` will flag the new globals; raise it when you adopt.
- **Prefer the narrowest `Temporal` type.** `PlainDate` for dates, `ZonedDateTime` only when a zone genuinely matters.
- **What I would not do:** wait for pattern matching or Records & Tuples, or transpile `using` into a library that must run everywhere. Neither earns the cost yet.

**Smoke test for the first session, in order:**

```bash
# 1. what runtime am I actually on?
node --version

# 2. what does it have? (paste the Part 7 script into check.mjs)
node check.mjs

# 3. try the two headline features directly
node --input-type=module -e "console.log(Temporal.Now.instant().toString())"
node --input-type=module -e "const m=new Map(); console.log(m.getOrInsert('a',1))"
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, runs Node.js and modern browsers, uses opencode and AI coding
agents daily, and learns by doing.

Paper: markdown_docs/17-es2026-javascript-features.md
Topic: ES2026 and the new JavaScript you can actually use — the seven ratified features, and
the two headline features (Temporal, using) that are ES2027 but shipping now.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (Temporal in depth: calendars, durations, DST edge cases; migrating a
real Date-heavy module; a polyfill strategy that does not bloat the bundle; error handling with
SuppressedError); (C) run the feature-detection script against his real runtime and rewrite the
specific call sites he can change today.

Rules: never invent an edition year, stage number, browser version, or spec URL. Check the
edition in TC39's finished-proposals.md and the behaviour in MDN or the runtime's own docs
before asserting either. If unsure, write "search: <feature> MDN". Label third-party
compatibility data as third-party. Distinguish primary sources (TC39, MDN, Node.js docs) from
community summaries. Keep the structure. Report path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://github.com/tc39/proposals/blob/main/finished-proposals.md
https://tc39.es/
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal
https://nodejs.org/en/blog/release/v26.0.0
https://github.com/js-temporal/temporal-polyfill
```
