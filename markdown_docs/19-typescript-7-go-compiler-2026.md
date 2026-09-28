# The Complete Guide: TypeScript 7 and the Year the Compiler Learned Go

> On 8 July 2026 TypeScript 7 shipped the same compiler ported to Go — 8–12× faster full builds, identical type-checking, and one large caveat: there is no compiler API yet, so Vue, Svelte, Astro, MDX, and Angular tooling cannot upgrade. Here is what changed, what broke, and the side-by-side migration that keeps both compilers installed.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

For a decade the single biggest complaint about TypeScript was not the type system. It was the wait. `tsc` on a large repository took minutes, the editor's language service went to sleep during a big edit, and every CI run paid the same tax. The types were good; the throughput was the problem.

TypeScript 7 answers that complaint by rewriting the compiler and language service in Go. Microsoft calls it a **port**, not a rewrite, and that word matters: the checker was moved line by line, and the team states the type-checking logic is structurally identical to TypeScript 6.0. So this is a performance release wearing a major version number. No new type system, no new syntax, no new semantics — a different engine under the same hood.

The complication is that the port does not yet expose the compiler's programming API. Tooling that reaches into the compiler internals — which is how template type-checking works for Vue, Svelte, Astro, MDX, and Angular — cannot run on TypeScript 7. That single omission means the upgrade is not one decision but two: *the CLI* can move today, and *the ecosystem* waits for 7.1.

```
   THE 6 → 7 TRANSITION

   TypeScript 5.x ──► TypeScript 6.0  ──► TypeScript 7.0
   JS compiler         JS compiler,        Go compiler,
   status quo          FINAL JS release    same checker

                       6.0's job:           7.0's job:
                       ship NEW DEFAULTS    ADOPT those defaults
                       mark things          turn deprecations
                       deprecated           into HARD ERRORS
                       (you have a release  (the cleanup is due)
                        to clean up)

   THE SEAM
   ┌──────────────────────────────────────────────────────────┐
   │  tsc (CLI)          →  TypeScript 7 is ready, today       │
   │  programmatic API   →  not shipped; expected in 7.1       │
   │  Vue/Svelte/Astro/  →  blocked on that API; keep TS 6     │
   │  MDX/Angular                                             │
   └──────────────────────────────────────────────────────────┘

   THE BRIDGE: install both side by side
   npm install -D typescript @typescript/typescript6
   → `tsc`  = TypeScript 7        (fast CLI checks)
   → `tsc6` = TypeScript 6        (for tools that need the API)
```

The single most important idea: **TypeScript 7 changes the speed of the compiler, not the meaning of your types — and it does not ship the API the rest of the ecosystem depends on.** Upgrade the CLI and the type-check job immediately; hold your framework tooling until 7.1 lands.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Corsa** | The codename for the Go port | Distinguishes the engine from the language |
| **Native port** | Translating a book, not rewriting it | Semantics are meant to be identical |
| **JS-based compiler** | The old engine | TypeScript 6.0 is the last one |
| **`tsgo`** | The Go compiler's preview binary | Its nightlies moved to `typescript@next` at GA |
| **Compiler API** | A socket other tools plug into | The thing 7.0 lacks |
| **Volar** | The engine behind Vue/Svelte/Astro tooling | Depends on that socket |
| **`@typescript/typescript6`** | A second copy of the old compiler | Supplies `tsc6` and the TS 6 API |
| **`stableTypeOrdering`** | A flag that makes declaration emit order deterministic (default on in 7.0) | Needed for a clean 6 → 7 comparison |
| **Hard error** | A removed option that now fails the build | 6.0 deprecated it; 7.0 enforces it |
| **Side-by-side install** | Two compilers, two commands | The practical migration shape |

> **The one-sentence version:** treat TypeScript 7 as a compiler swap you can make today for command-line type-checking, and a waiting game for anything that imports the compiler programmatically — and use TypeScript 6.0 as the bridge release that shows you the cleanup before it becomes mandatory.

---

## The 60-Second Version (TL;DR)

1. **TypeScript 7.0 went GA on 8 July 2026** (beta 21 April, RC 18 June). It is the compiler and language service **ported to Go**, codename **Corsa**.
2. **Expect 8–12× faster full builds.** Microsoft's own benchmarks show roughly 10× on real projects; 7.0.2 is the current patch.
3. **The type-checking is meant to be identical to 6.0.** This is a performance release, not a language release.
4. **TypeScript 6.0 (March 2026) was the final JavaScript-based release.** There is no 6.1 — only security and regression patches.
5. **6.0 introduced the new defaults and deprecations; 7.0 adopts them and turns deprecations into hard errors.** Migrate through 6, not straight to 7.
6. **7.0 ships no public compiler API.** TypeScript 7.1 is expected to add a new (and different) API.
7. **Because of that, Vue, Svelte, Astro, MDX, and Angular template type-checking cannot use TypeScript 7 yet.** Volar and similar tools are pinned to the 6.0 API.
8. **The bridge is `@typescript/typescript6`**, a package that provides a `tsc6` binary and re-exports the TS 6 API, installable alongside 7.
9. **Removed in 7.0:** `target: es5`, `downlevelIteration`, `baseUrl`, `moduleResolution: node`/`node10`, and `module: amd`/`umd`/`systemjs`/`none`. `types` now defaults to `[]`.
10. **New flags:** experimental `--checkers` and `--builders` for parallelism, and `--singleThreaded` to turn it off for debugging.

If you read nothing else, read **Part 3 (the API gap)** and **Part 4 (the migration)**.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| TypeScript 6.0 or newer | 6.0 is the required bridge release before 7 | `npx tsc --version` |
| A clean type-check | 7 only promises parity for code that compiles cleanly on 6 | `npx tsc --noEmit` |
| `stableTypeOrdering` available | Needed for a like-for-like 6/7 comparison | part of 6.0 |
| Knowledge of whether your stack imports the compiler | Decides whether you can move today | check your plugins |
| ~30 minutes | The CLI swap is quick; the audit is the work | — |

> **One command tells you if you are blocked.** If your toolchain depends on `typescript` as a peer dependency and reads its API — `typescript-eslint`, Volar-based plugins, framework language servers — you are in the "CLI only" group. Everything else can move.

---

## Part 1 — Why Go, and What "Port" Actually Means

### 1.1 The problem the port solves

A type checker is a graph traversal over an enormous object graph. The JavaScript implementation is single-threaded, and the JIT cannot parallelise a workload like that beyond a point. Go brings two things: native machine code and **shared-memory multithreading**. The compiler can spread the check across cores rather than time-slicing one thread.

Microsoft's framing is "native port", and the reasoning matters: the port was done methodically rather than redesigned. From the RC announcement, the Go codebase "was methodically ported from our existing implementation rather than rewritten from scratch, and its type-checking logic is structurally identical to TypeScript 6.0". That is the promise that makes an upgrade safe.

### 1.2 The numbers, labelled as vendor benchmarks

These are Microsoft's published comparisons, not an independent audit:

| Project | TypeScript 6 | TypeScript 7 | Speedup |
|---|---|---|---|
| VS Code | 125.7 s | 10.6 s | 11.9× |
| Sentry | 139.8 s | 15.7 s | 8.9× |
| Bluesky | 24.3 s | 2.8 s | 8.7× |
| Playwright | 12.8 s | 1.47 s | 8.7× |
| tldraw | 11.2 s | 1.46 s | 7.7× |

The announcement's qualified claim is an **8× to 12× speedup on full builds**. Treat the direction as real and the exact ratio as project-dependent: a small project sees less, a huge one sees more, and build times include I/O the compiler does not control.

### 1.3 What it means day to day

The CLI got fast. That changes CI more than it changes your editor:

- **CI type-check steps shrink** from minutes to seconds on large repos, which changes what you can afford to run per pull request.
- **Whole-project checks become practical in pre-commit hooks**, which they never were.
- **Editor responsiveness improves** through the ported language service, but the gain depends on the client — a slow client is still slow.

> **Do not promise the same multiplier internally without measuring.** Run both compilers on your own repo (Part 5) before you tell anyone a number.

---

## Part 2 — TypeScript 6.0: The Release You Have to Take First

### 2.1 Why 6 exists at all

TypeScript 6.0 shipped in **March 2026** and is the **last release built on the JavaScript codebase**. There is no 6.1; the 6.0.x line gets rare patches for security, high-severity regressions, and 6-to-7 compatibility only.

Its purpose is deliberate: 6.0 introduces the **new defaults** and marks a set of options **deprecated**, giving you one release in which to fix things while still running the familiar implementation. TypeScript 7.0 then adopts those defaults and converts the deprecations into **hard errors**. Skipping 6 means encountering all of it at once in 7.

```
   6.0 = "these are now the defaults, and these are going away"
   7.0 = "the defaults are in force, and those things are gone"

   → Migrate to 6.0 on its own, fix the warnings, THEN go to 7.
```

### 2.2 The compatibility promise, precisely

Microsoft's qualified statement: with the `stableTypeOrdering` flag **on** and the `ignoreDeprecations` flag **unset**, *virtually anything* that compiles cleanly under TypeScript 6.0 should compile **identically** under 7.0. Both halves of that condition matter:

- `stableTypeOrdering` makes declaration emit order deterministic, which removes ordering noise from the comparison. In 7.0 it is on by default and can no longer be turned off — the flag exists so a 6.0 run can be put in the same mode for a fair comparison.
- `ignoreDeprecations` unset means you actually saw the deprecations rather than silencing them.

If you have been running with `ignoreDeprecations` for the last year, 7.0 will surface all of it at once. That is the whole reason to have taken 6.0 seriously.

### 2.3 Options that end at 7.0

| Removed in 7.0 | What to use instead |
|---|---|
| `target: es5` | A newer target; 5 is out of support |
| `downlevelIteration` | A target that does not need it |
| `moduleResolution: node` / `node10` | `nodenext` or `bundler` |
| `module: amd` / `umd` / `systemjs` / `none` | `esnext` or `preserve` |
| `baseUrl` | Path mapping without it, or relative imports |

Two more defaults changed rather than being removed: **`types` now defaults to `[]`** instead of pulling in everything under `node_modules/@types`, and **`rootDir` defaults to `./`**. The first is the one that breaks real projects — a missing `@types/node` that used to be implicit now has to be listed.

> **The one-line fix for the most common breakage:** add `"types": ["node"]` (or your real set) to `compilerOptions`. The new empty default is a correctness improvement, not a regression, but it is silent until something fails to resolve.

---

## Part 3 — The API Gap: Why Half the Ecosystem Waits

### 3.1 What is missing

TypeScript 7.0 ships **without a public compiler API**. Nothing is wrong with it: the port's priority was getting the CLI and language service right and letting 6 and 7 run side by side. Microsoft states that **TypeScript 7.1 is expected to ship a new (and different) API**.

Until then, any tool that imports the compiler programmatically cannot run on TypeScript 7. That is a specific, well-populated list:

| Blocked tooling | Why it needs the API |
|---|---|
| Vue + Volar | Type-checking inside `.vue` templates |
| Svelte | Type-checking inside `.svelte` markup |
| Astro | Type-checking `.astro` frontmatter |
| MDX | Type-checking embedded expressions |
| Angular templates | In-template type checking |
| `typescript-eslint` | Reads the compiler via a peer dependency |
| Any custom codegen or AST plugin | Works against the compiler's internals |

The RC announcement was explicit that workflows using "Vue, MDX, Astro, Svelte, and similar tools are likely unable to take advantage of TypeScript 7 yet," and the same applies to specialised in-template checking like Angular's.

### 3.2 The bridge: install both compilers

Microsoft publishes a compatibility package, `@typescript/typescript6`, that:
- provides an executable named **`tsc6`** (so it does not collide with 7's `tsc`), and
- **re-exports the TypeScript 6.0 API**, so tooling that needs the old API keeps working.

Because tools like `typescript-eslint` expect to import from `typescript` directly, Microsoft documents an **npm alias** — but the alias has a trap worth stating before you run it: it replaces `typescript` with the **6.0** package, so `tsc` resolves to TypeScript 6 too. There are two clean setups, and you pick based on whether you have API consumers.

**Setup A — no API consumers (plain `.ts`, React without template checking):** install 7 as the compiler. `tsc` is fast, and nothing needs the old API.

```bash
npm install -D typescript@^7
```

```jsonc
// package.json
{ "devDependencies": { "typescript": "^7.0.0" } }
```

**Setup B — you have an API consumer (Vue/Svelte/Astro/MDX, Angular templates, `typescript-eslint`):** install 7 *and* the 6 compatibility package, and keep the alias, accepting that `tsc` now runs 6 unless you invoke 7 explicitly.

```bash
npm install -D typescript@npm:@typescript/typescript6 @typescript/typescript6
# then run the fast compiler explicitly, without disturbing the alias:
npx -p typescript@7 tsc --noEmit
```

```jsonc
// package.json
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@^6.0.0",  // tooling imports the 6.0 API
    "@typescript/typescript6": "^6.0.0"                   // supplies the `tsc6` binary
  }
}
```

The layout in each case:

```
   SETUP A                       SETUP B
   ───────                       ───────
   tsc  → TypeScript 7           tsc  → TypeScript 6   (the alias is the default)
   tsc6 → not needed             tsc6 → TypeScript 6   (same API, explicit name)
                                 npx -p typescript@7 tsc → TypeScript 7 (the fast check)
```

Setup A needs one script; Setup B needs to be explicit about which compiler each job uses.

```jsonc
// Setup A — scripts
{ "scripts": { "check": "tsc --noEmit" } }
```

```jsonc
// Setup B — scripts
{
  "scripts": {
    "check":     "npx -p typescript@7 tsc --noEmit",
    "check:api": "tsc --noEmit",
    "lint":      "eslint ."
  }
}
```

> **The honest trade-off:** in Setup B, the alias wins points for keeping `typescript-eslint` and framework tooling working, and loses the fast CLI unless you call TypeScript 7 explicitly as shown. If you have no API consumer, skip the alias entirely and take Setup A. When TypeScript 7.1 ships its API, the alias goes away and both setups collapse into A.

> **This is a bridge, not a destination.** Framework maintainers are actively migrating, and TypeScript 7.1 is where the ecosystem is expected to land. Plan to remove the alias, not to keep it forever.

### 3.3 Nightlies moved

Before GA, most people installed the new compiler as `@typescript/native-preview`, which peaked at over 8.5 million weekly downloads. That package's last publish was 7 July 2026, one day before GA. Nightlies now resume under the **standard `typescript` package on the `next` tag**, currently in the 7.1.0-dev line:

```bash
npm install -D typescript@next
```

The Go source lived in a staging repository, `github.com/microsoft/typescript-go`, which Microsoft has since closed and archived (September 2026) as development returned to the main `microsoft/TypeScript` repository.

---

## Part 4 — The Migration Playbook

### 4.1 The order that avoids pain

```
   1. Get CI on TypeScript 6.0            (it is already the last JS release)
   2. Turn off ignoreDeprecations         (see the warnings you have been hiding)
   3. Fix the deprecated options          (Part 2.3)
   4. Confirm a clean `tsc --noEmit`      (7 promises parity, not improvement)
   5. Install TypeScript 7 as the CLI     (keep 6 available via the alias)
   6. Run both on your repo, compare      (`stableTypeOrdering` on, for both)
   7. Move CI's `check` step to tsc       (7 is fast; keep tsc6 for the tools)
   8. Wait for 7.1 before removing 6      (the API is the gate, not the CLI)
```

Steps 1–4 are the real work. Steps 5–7 are a swap.

### 4.2 A concrete before/after

```jsonc
// BEFORE — TypeScript 5.x/6.x with legacy options
{
  "compilerOptions": {
    "target": "es5",
    "module": "umd",
    "moduleResolution": "node",
    "baseUrl": "./src",
    "downlevelIteration": true,
    "ignoreDeprecations": "6.0"
  }
}
```

```jsonc
// AFTER — TypeScript 7-compatible
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],              // the new default is [], so be explicit
    "rootDir": "./src",
    "stableTypeOrdering": true,     // deterministic emit for a like-for-like diff
    "noEmit": true
  }
}
```

### 4.3 Measuring it on your own repo

Do not trust a slide. Run the comparison yourself:

```bash
# 1. the old compiler, warmed and repeated
npx -p typescript@6 tsc --noEmit --extendedDiagnostics

# 2. the new compiler, same command
npx tsc --noEmit --extendedDiagnostics

# 3. a like-for-like diff of the emitted declarations, if you emit them
#    (both commands need the 6.0 API, so reach for tsc6 or the alias target)
npx -p @typescript/typescript6 tsc --declaration --emitDeclarationOnly --outDir .tmp/ts6
npx -p typescript@7 tsc --declaration --emitDeclarationOnly --outDir .tmp/ts7
diff -r .tmp/ts6 .tmp/ts7 && echo "identical"
```

`--extendedDiagnostics` prints the check time and the file/type counts. If the two compilers report the same counts and the declarations diff clean, you have the parity the release promises. If either disagrees, you found a real difference — and an issue worth filing.

### 4.4 Parallelism controls

TypeScript 7 adds three flags for tuning the new multi-threaded behaviour:

| Flag | Purpose | Notes |
|---|---|---|
| `--checkers` | Number of parallel type-checkers | Labelled experimental |
| `--builders` | Number of parallel project builders | Labelled experimental |
| `--singleThreaded` | Disable parallelisation entirely | Useful for debugging and constrained environments |

```bash
# pin parallelism, which is what CI runners usually want
tsc --noEmit --checkers 4

# reproduce a bug deterministically
tsc --noEmit --singleThreaded
```

> **Leave the experimental flags alone unless you have a reason.** The defaults are tuned; `--singleThreaded` is the one worth remembering, because it turns a flaky parallel failure into a reproducible one.

---

## Part 5 — Side by Side: What Changed and What Did Not

| Dimension | TypeScript 6.0 | TypeScript 7.0 |
|---|---|---|
| Implementation | JavaScript (final JS release) | Go (native port, "Corsa") |
| Full-build speed | Baseline | ~8–12× faster (vendor benchmarks) |
| Type-checking semantics | The reference | Intended to be identical |
| Public compiler API | Yes | **Not yet** — expected in 7.1 |
| CLI type-checking | Works | Works, much faster |
| Template tooling (Vue/Svelte/Astro/MDX/Angular) | Works | **Not supported yet** |
| `target: es5` | Deprecated, warns | Hard error |
| `baseUrl` | Deprecated | Removed |
| `types` default | All `@types` packages | `[]` |
| `rootDir` default | Inferred | `./` |
| Parallelism flags | None | `--checkers`, `--builders`, `--singleThreaded` |
| Nightly package | `typescript@next` | `typescript@next` (7.1.0-dev) |
| Support expectation | Patches only | Active line |

**What did not change:** the type system, the syntax, the semantics of assignability, narrowing, generics, or inference. If your code compiled cleanly before, it is meant to compile cleanly now — faster. A "new TypeScript feature" in this release is a compiler feature, not a language one.

> **A useful mental check.** If a headline about TypeScript 7 is about *syntax* or *the type system*, it is not about this release. The Go port changes the engine, not the language.

---

## Part 6 — Where Node's Type Stripping Changes the Picture

There is a wrinkle worth stating plainly, because it interacts with Paper 18 in this series. **Node.js type stripping is stable and on by default**, so plenty of new code runs `.ts` files with no build step at all. In that world the compiler has a narrower job:

| Job | Who does it now |
|---|---|
| Running TypeScript in dev and prod | Node's stripper |
| **Checking** types | `tsc --noEmit` / `tsc6` |
| Template type-checking | Framework tooling (needs the TS 6 API) |
| Emitting declarations for a library | `tsc --declaration` |

That is why a fast CLI matters so much: the compiler is increasingly a **checker in CI and a declaration emitter in release**, not a build step in the middle of every run. TypeScript 7's speedup lands exactly where the remaining cost is.

> **The config that pairs with stripping:** `erasableSyntaxOnly: true`, so the compiler rejects syntax Node cannot strip (`enum`, runtime `namespace`, parameter properties, decorators) at author time rather than at runtime. See Paper 18, Part 1.

---

## Part 7 — Editor and Build Tooling: What to Do This Month

### 7.1 Decide which group you are in

| Your stack | Can you move the CLI to TS 7? | Can you move everything? |
|---|---|---|
| Plain `.ts` Node service | Yes | Yes |
| React + `.ts`/`.tsx` (no template checking) | Yes | Usually |
| `typescript-eslint` in CI | Yes for `tsc` | Keep the alias for the linter |
| Vue / Svelte / Astro / MDX | Yes for `tsc` | **No** — blocked on the API |
| Angular (template checking) | Yes for `tsc` | **No** — blocked on the API |
| A library that ships `.d.ts` | Yes | Verify the declaration diff |

### 7.2 The side-by-side setup, in full

```bash
# install 7 as the primary, 6 as the bridge
npm install -D typescript @typescript/typescript6
```

```jsonc
// package.json — three jobs, three commands
{
  "scripts": {
    "check":        "tsc --noEmit",          // TypeScript 7, fast
    "check:legacy": "tsc6 --noEmit",         // TypeScript 6, for parity checks
    "build:types":  "tsc --declaration --emitDeclarationOnly"
  }
}
```

```jsonc
// .vscode/settings.json — pin the editor's TypeScript deliberately
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

> **Editors can disagree with CI.** VS Code ships its own TypeScript. When the editor and the build report different errors, the workspace SDK setting above is usually the reason. Pin it so both read the same compiler.

### 7.3 What to tell a teammate

1. The language did not change; the engine did.
2. Your editor gets a workspace TypeScript from `node_modules`, not from VS Code.
3. `tsc` is 7 and fast; `tsc6` is 6 and stays until 7.1 ships the API.
4. If you touch a `.vue`, `.svelte`, `.astro`, or `.mdx` file, template checking is still on the old compiler.
5. Nothing about runtime behaviour should differ; if it does, that is a bug worth reporting.

---

## Cheat Sheet

```bash
# ─── VERSIONS ───────────────────────────────────────────────────────
npx tsc --version            # what the CLI resolves to (expect 7.x)
npx tsc6 --version           # the TypeScript 6 bridge binary (6.0.x)
npm install -D typescript@next          # 7.1.0-dev nightlies

# ─── INSTALL THE SIDE-BY-SIDE BRIDGE ────────────────────────────────
npm install -D typescript @typescript/typescript6

# ─── CHECK FAST ─────────────────────────────────────────────────────
tsc --noEmit                       # TypeScript 7
tsc --noEmit --extendedDiagnostics # see the check time and counts
tsc --noEmit --singleThreaded      # reproduce a parallel-only failure
tsc --noEmit --checkers 4          # pin parallelism (experimental)

# ─── COMPARE 6 VS 7 ─────────────────────────────────────────────────
npx -p typescript@6 tsc --noEmit --extendedDiagnostics
npx -p typescript@7 tsc --noEmit --extendedDiagnostics
npx -p @typescript/typescript6 tsc --declaration --emitDeclarationOnly --outDir .tmp/ts6
npx -p typescript@7 tsc --declaration --emitDeclarationOnly --outDir .tmp/ts7
diff -r .tmp/ts6 .tmp/ts7
```

```jsonc
// tsconfig.json — TypeScript 7-compatible
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "rootDir": "./src",
    "stableTypeOrdering": true,
    "noEmit": true
  }
}
```

| I need to… | Do this |
|---|---|
| Type-check fast today | `tsc --noEmit` on TypeScript 7 |
| Keep Vue/Svelte/Astro/Angular tooling working | Install `@typescript/typescript6` and keep TS 6 |
| Keep ESLint's type-aware rules working | npm alias to the TS 6 package |
| Compare 6 and 7 fairly | `stableTypeOrdering: true` on both, no `ignoreDeprecations` |
| Pin the editor's compiler | `typescript.tsdk` in `.vscode/settings.json` |
| Debug a parallel-only failure | `--singleThreaded` |
| Get TS 7.1 nightlies | `typescript@next` |
| Emit types once | `tsc --declaration --emitDeclarationOnly` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `error TS5107: Option 'target=ES5' is deprecated/removed` | Removed in 7.0 | Raise `target` to `es2022` or newer |
| `baseUrl` error | `baseUrl` is no longer supported | Move to `paths` without it, or use relative imports |
| Types that used to resolve now fail | `types` defaults to `[]` | List them explicitly: `"types": ["node", ...]` |
| Editor and CLI show different errors | Editor uses its own TypeScript | Set `typescript.tsdk` to the workspace compiler |
| Vue/Svelte/Astro template errors vanish | Template tooling cannot run on 7 | Keep `@typescript/typescript6` and use `tsc6` for those checks |
| `typescript-eslint` crashes after upgrade | It imports the compiler API via a peer dep | Alias `typescript` to `@typescript/typescript6` (Setup B), then run the fast compiler as `npx -p typescript@7 tsc` |
| Build is not 10× faster | Small project, or I/O-bound | Measure with `--extendedDiagnostics`; expect your own ratio |
| `IgnoreDeprecations` no longer silences anything | 7 removed those options | Fix them; there is nothing left to silence |
| Flaky failure only under parallelism | A thread-safety bug or a race in a plugin | Reproduce with `--singleThreaded`, then file it |
| Declaration output differs between 6 and 7 | Non-deterministic ordering or a genuine difference | Turn on `stableTypeOrdering`; if it persists, diff and file |
| `tsc6` not found | Compatibility package not installed | `npm install -D @typescript/typescript6` |
| `@typescript/native-preview` stopped updating | It was retired at GA | Use `typescript@next` |
| `node app.ts` still needs a transpiler | Node cannot strip `enum`/decorators/namespaces | Set `erasableSyntaxOnly: true` and rewrite, or keep a build step |

---

## Video Library

YouTube **search** links only — compiler releases date quickly.

| Search | What you'll find |
|---|---|
| [TypeScript 7 Go compiler](https://www.youtube.com/results?search_query=TypeScript+7+Go+compiler) | The native port explained |
| [TypeScript 7 migration](https://www.youtube.com/results?search_query=TypeScript+7+migration+guide) | Upgrading 6 → 7 in practice |
| [tsgo native preview](https://www.youtube.com/results?search_query=tsgo+typescript+native+preview) | The preview era and what replaced it |
| [TypeScript 6 new defaults](https://www.youtube.com/results?search_query=TypeScript+6+new+defaults+deprecations) | The bridge release |
| [typescript-eslint TypeScript 7](https://www.youtube.com/results?search_query=typescript-eslint+TypeScript+7) | Keeping lint working |
| [Volar TypeScript version](https://www.youtube.com/results?search_query=Volar+TypeScript+version+support) | Framework tooling and the API gap |
| [TypeScript compiler API](https://www.youtube.com/results?search_query=TypeScript+compiler+API+tutorial) | What tools actually use |
| [tsc extendedDiagnostics](https://www.youtube.com/results?search_query=tsc+extendedDiagnostics+performance) | Measuring a type-check |
| [TypeScript project references](https://www.youtube.com/results?search_query=TypeScript+project+references) | Monorepo build shape |
| [Node type stripping TypeScript](https://www.youtube.com/results?search_query=Node+type+stripping+TypeScript) | Running TS without the compiler |

---

## Written References & Docs

Microsoft's own announcements are the primary source for every version claim here.

| Source | URL |
|---|---|
| Announcing TypeScript 7.0 | `https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/` |
| Announcing TypeScript 6.0 | `https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/` |
| TypeScript blog index (RC, beta, release notes) | `https://devblogs.microsoft.com/typescript/` |
| TypeScript releases (all versions and dates) | `https://github.com/microsoft/typescript/releases` |
| TypeScript Go port (staging repo) | `https://github.com/microsoft/typescript-go` |
| `tsconfig` reference | `https://www.typescriptlang.org/tsconfig` |
| `stableTypeOrdering` | `https://www.typescriptlang.org/tsconfig/#stableTypeOrdering` |
| `@typescript/typescript6` on npm | `https://www.npmjs.com/package/@typescript/typescript6` |
| TypeScript-ESLint | `https://typescript-eslint.io/` |
| Volar (Vue language tooling) | `https://github.com/vuejs/language-tools` |
| Node.js type stripping (the runtime side) | `https://nodejs.org/api/typescript.html` |

**Third-party, for context only:**

| Source | Why |
|---|---|
| Release-analysis blog posts | Useful summaries; some repeat the benchmark table without labelling it vendor data |
| Performance write-ups | Often single-project; verify on your own repo |
| Framework migration guides | The real source for "is my stack unblocked yet" |

> **Verification tip:** the speedup numbers are Microsoft's, measured on Microsoft's chosen projects. The only number that matters for your decision is the one you measure with `--extendedDiagnostics` on your own codebase.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Corsa | The codename for the Go port of TypeScript |
| Native port | Reimplementing the same logic in a compiled language |
| `tsgo` | The binary name used during the native preview |
| Compiler API | The programmatic interface tools use to read types and emit code |
| Volar | The language-tooling engine behind Vue, Svelte, and Astro support |
| `@typescript/typescript6` | The compatibility package providing `tsc6` and the TS 6 API |
| `tsc6` | The TypeScript 6 executable from that package |
| npm alias | Installing one package under another's name |
| `stableTypeOrdering` | A flag that makes declaration emit order deterministic |
| `ignoreDeprecations` | A flag that silences deprecation errors |
| Hard error | A removed option that now fails the build |
| `--checkers` | Experimental flag for parallel type-checking count |
| `--builders` | Experimental flag for parallel project building |
| `--singleThreaded` | Disables parallelisation for debugging |
| `--extendedDiagnostics` | Prints check time and file/type counts |
| Declaration emit | Producing `.d.ts` files for consumers |
| Peer dependency | A package your tool expects your project to provide |
| `erasableSyntaxOnly` | A flag that rejects TS syntax Node cannot strip |

---

## FAQ & Next Steps

**Is TypeScript 7 a new language?** No. It is the same compiler, ported to Go. The type system, syntax, and semantics are intended to be identical to 6.0.

**Can I use it today?** The CLI, yes. Anything that imports the compiler programmatically, no — not until the API ships, expected in 7.1.

**Why do Vue, Svelte, Astro, MDX, and Angular not work?** Their template type-checking runs through the compiler's API, which 7.0 does not expose. The CLI is fine; the tooling is blocked.

**What is `tsc6`?** The TypeScript 6 executable from `@typescript/typescript6`, installable alongside 7 so tools that need the old API keep working.

**How do I keep `typescript-eslint` working?** Use Setup B: alias `typescript` to the TS 6 package (`npm install -D typescript@npm:@typescript/typescript6 @typescript/typescript6`), then call the fast compiler explicitly with `npx -p typescript@7 tsc`. The alias also makes plain `tsc` run 6, which is the trade-off.

**Will I really see 10×?** Possibly, on a large project, for a full build. Measure with `--extendedDiagnostics`; small projects and I/O-bound builds see less.

**Why is TypeScript 6 important if 7 is the goal?** 6.0 is where the new defaults and deprecations were introduced, while you could still run the old engine. 7.0 makes them mandatory. Going through 6 turns one big breakage into two manageable ones.

**What changed silently that could break me?** `types` now defaults to `[]`, so implicit `@types` no longer load, and `rootDir` defaults to `./`. Both are easy to fix and easy to miss.

**Should I delete `@typescript/native-preview`?** Yes — it was retired at GA. Nightlies are `typescript@next` now.

**Does this change how I run TypeScript?** Not by itself. If you also run Node 24+, type stripping handles execution and the compiler becomes primarily a checker in CI.

**Where do I check whether my framework is unblocked?** The framework's own language-tools repository, then `microsoft/TypeScript` releases for 7.1. Not a blog post.

### Next steps, in order

1. **Today:** confirm your version and whether your stack imports the compiler (`npx tsc --version`; check your plugins).
2. **This week:** get to TypeScript 6.0, remove `ignoreDeprecations`, and fix what surfaces.
3. **Next week:** fix the removed options (Part 2.3) and restore `types` explicitly.
4. **Week 3:** measure 6 vs 7 on your repo with `--extendedDiagnostics` and a declaration diff.
5. **Week 4:** install the side-by-side bridge, move CI's check step to `tsc`, and pin the editor SDK.
6. **Month 2:** check for TypeScript 7.1 and the framework language-tool releases, then retire the bridge.

---

## Verification Note

**Verified as of September 2026 from Microsoft's own announcements and the TypeScript repository:**

- **TypeScript 7.0 GA on 8 July 2026**; beta 21 April 2026, RC 18 June 2026. It is a native port of the compiler and language service to Go, codename **Corsa**; the release announcement describes speedups "between 8x and 12x on full builds" and quotes roughly 10× in other places (`devblogs.microsoft.com/typescript/announcing-typescript-7-0/`).
- **Benchmark table** (VS Code 125.7 s → 10.6 s, Sentry 139.8 s → 15.7 s, Bluesky 24.3 s → 2.8 s, Playwright 12.8 s → 1.47 s, tldraw 11.2 s → 1.46 s) is **Microsoft's published comparison**, not an independent audit.
- **TypeScript 7.0 ships without a public compiler API.** Microsoft states 7.1 is expected to ship "a new (and different) API", and that until then it prioritised running 6 and 7 side by side (`announcing-typescript-7-0`).
- **`@typescript/typescript6`** provides a `tsc6` executable and re-exports the TypeScript 6.0 API; the recommended install for tools with a `typescript` peer dependency is the npm alias `npm install -D typescript@npm:@typescript/typescript6` (`announcing-typescript-7-0`).
- **TypeScript 6.0** shipped in March 2026 and is the final JavaScript-codebase release; there is no 6.1, with only patches for security, high-severity regressions, and 6-to-7 compatibility (TypeScript release reporting; `github.com/microsoft/typescript/releases`).
- **Compatibility statement:** with `stableTypeOrdering` on and `ignoreDeprecations` unset, "virtually anything" that compiles cleanly under 6.0 should compile identically under 7.0; `stableTypeOrdering` is on by default in 7.0 and cannot be disabled (`announcing-typescript-7-0`).
- **Removed or changed options in 7.0:** `target: es5`, `downlevelIteration`, `moduleResolution: node`/`node10`, `module: amd`/`umd`/`systemjs`/`none`, and `baseUrl`; `types` defaults to `[]`; `rootDir` defaults to `./` (release-analysis reports citing the 6.0/7.0 announcements).
- **New flags:** experimental `--checkers` and `--builders`, plus `--singleThreaded` (`announcing-typescript-7-0`).
- **Nightlies** moved from `@typescript/native-preview` (last publish 7 July 2026) to the standard `typescript` package on the `next` tag, in the 7.1.0-dev line (`announcing-typescript-7-0`).
- **Blocked tooling:** workflows using Vue, MDX, Astro, Svelte, and similar tools, plus specialised in-template checking such as Angular's, are stated to be unable to take advantage of TypeScript 7 yet (`announcing-typescript-7-0`).
- **TypeScript 6.0 beta included Temporal type definitions** (Igalia, on the Temporal Stage 4 announcement).

**Where I am relying on third-party analysis rather than a primary source:** the exact patch-release dates and the current version number (7.0.2) come from the GitHub releases listing and release-analysis posts, which are not always perfectly aligned on the publication date. The migration playbook, the side-by-side layout, and the "which group are you in" table are my synthesis of the documented constraints, not Microsoft's guidance verbatim.

**Vendor claims, not independently verified:** every benchmark figure, including the 8–12× range and the five per-project numbers. All are Microsoft's, measured on projects Microsoft chose. Your ratio will differ; measure it.

**Changes fast:** TypeScript 7.1 and its new API are the gate on most of the ecosystem, and framework language tooling is migrating towards it. Re-check `microsoft/TypeScript` releases and the relevant framework's language-tools repository before assuming a stack is unblocked.

**Not a compatibility guarantee.** The 6-to-7 parity statement is qualified by Microsoft with the `stableTypeOrdering` and `ignoreDeprecations` conditions. Verify on your own code with the Part 4.3 commands rather than trusting the general claim.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd fold this into my own stack.**

| In my workspace | Verdict |
|---|---|
| Plain `.ts` Node service | CLI to TypeScript 7 today; no blocker |
| `typescript` in devDependencies | Upgrade to 7; add `@typescript/typescript6` as the bridge |
| `typescript-eslint` in CI | Use Setup B: alias `typescript` to the TS 6 package, and run the fast check as `npx -p typescript@7 tsc` |
| VS Code's bundled TypeScript | Pin the workspace SDK so editor and CI agree |
| Any `.vue` / `.svelte` / `.astro` / `.mdx` | Template checking stays on TS 6 until 7.1 |
| `target: es5` in an old tsconfig | Fix before 7, or the build fails immediately |
| Node 24+ running `.ts` directly | Keep `tsc --noEmit`; the runtime does not check |
| A library that ships `.d.ts` | Diff declarations between 6 and 7 before publishing |

**Recommended setup:**

- **Two compilers, on purpose.** `tsc` for the fast check, `tsc6` for the tools that need the API. Remove the bridge when 7.1 lands.
- **`stableTypeOrdering: true`** while you are comparing, so ordering noise does not look like a real difference.
- **`types` listed explicitly.** The new `[]` default is a correctness win and a silent breakage if you forget it.
- **`--extendedDiagnostics` in your notes.** Paste the before/after into the PR that upgrades, so the speedup is evidence rather than folklore.
- **One CI step, one compiler.** Decide which binary the `check` step runs and make the editor match.
- **What I would not do:** upgrade a framework project to TypeScript 7 and expect template checking to work, or keep `@typescript/native-preview` pinned after GA. Both waste an afternoon.

**Smoke test for the first session, in order:**

```bash
# 1. where am I?
npx tsc --version

# 2. is my stack blocked? (does anything consume the compiler API?)
node -e "const p=require('./package.json');const d={...p.dependencies,...p.devDependencies};console.log(['typescript-eslint','vue','svelte','astro','@angular/compiler-cli','@mdx-js/mdx'].filter(k=>d[k]).join('\n')||'no known API consumers')"

# 3. measure before you switch
npx tsc --noEmit --extendedDiagnostics | tail -20
npx -p typescript@6 tsc --noEmit --extendedDiagnostics | tail -20
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a TypeScript app, uses opencode and AI coding agents daily, and
learns by doing.

Paper: markdown_docs/19-typescript-7-go-compiler-2026.md
Topic: TypeScript 7 and the year the compiler learned Go — the native port, the 6.0 bridge
release, the missing compiler API, and a side-by-side migration that keeps both compilers
installed.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (a monorepo project-references setup under TS 7; authoring a
typescript-eslint plugin against the pinned 6.0 API; emitting and verifying .d.ts for a
published library; comparing tsc and tsgo in CI with a performance budget); (C) run the
migration against his real tsconfig.json — read it, list every removed option, and produce the
rewritten file plus the install commands.

Rules: never invent a version number, a release date, a flag name, or a benchmark figure. Check
the TypeScript blog and the microsoft/TypeScript releases before asserting either. Label every
speedup as a Microsoft benchmark, not an independent measurement. Distinguish primary sources
(Microsoft announcements, the TypeScript repo) from community summaries. Say plainly that the
compiler API is not yet public and that template tooling is blocked. Keep the structure. Report
path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
https://github.com/microsoft/typescript/releases
https://github.com/microsoft/typescript-go
https://www.typescriptlang.org/tsconfig
https://www.npmjs.com/package/@typescript/typescript6
```
