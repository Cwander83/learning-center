# The Complete Guide: The Node.js Built-In Toolchain (24 & 26)

> `ts-node`, `dotenv`, `nodemon`, and `jest` are now four dependencies you can delete. Node ships type stripping, an env loader, watch mode, a test runner, SQLite, and a permission sandbox in the standard binary. Here is what each one does, how to migrate, and where the built-in still loses to the tool it replaces.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

For most of its life, a new Node.js project started with the same five-install ritual: a TypeScript runner, an env loader, a file watcher, a test framework, and a database driver. Every one of those existed because the runtime did not ship it. That stopped being true somewhere between Node 22 and Node 26, and most teams have not noticed.

The change is not a single feature. It is that **the runtime now ships the batteries**, and the batteries are good enough that the third-party package is the one that needs a justification. `node --test` has coverage, mocking, snapshots, and parallelism. `node --experimental-strip-types` — now just the default — runs `.ts` files with no build step. `node --env-file` is stable. `node --watch` restarts on change. `node:sqlite` is a release candidate inside the standard library.

```
   THE FIVE-INSTALL RITUAL, BEFORE AND AFTER

   BEFORE (Node 18)              AFTER (Node 24 / 26)
   ────────────────              ────────────────────
   ts-node / tsx            →    node app.ts          (type stripping, stable)
   dotenv                   →    node --env-file=.env (.env flags, stable)
   nodemon                  →    node --watch         (built in, stable)
   jest / vitest            →    node --test          (runner + coverage + mocks)
   better-sqlite3           →    node:sqlite          (RC, no native build)
   cross-env / npm scripts  →    node --run build     (runs package.json scripts)
   ────────────────              ────────────────────
   5 deps + 3 config files      1 runtime, 0 build steps

   WHAT YOU STILL NEED
   tsc --noEmit      type CHECKING (stripping is not checking)
   a bundler         for the browser, not the server
   a linter          formatting/quality, unrelated to all of the above
```

The single most important idea: **type stripping runs your TypeScript, it does not check it.** Node erases the annotations and executes the JavaScript underneath. Your types are a build-time contract, and `tsc --noEmit` is still the thing that enforces it. If you take one sentence from this guide, take that one.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Type stripping** | Erasing pencil notes before photocopying | Fast to run, but nothing verified the notes |
| **`tsc --noEmit`** | A proofreader who never edits the file | The only thing that checks your types now |
| **`--env-file`** | A `.env` reader in the engine | Deletes `dotenv` in greenfield code |
| **`--env-file-if-exists`** | The same, but forgiving | The right flag for production, where no `.env` exists |
| **`node --watch`** | The file watcher nobody installs | Deletes `nodemon` |
| **`node --test`** | A test framework in the binary | Deletes a test-runner dependency tree |
| **`node:sqlite`** | SQLite compiled into the runtime | No native addon, no `node-gyp` |
| **`--permission`** | A seatbelt for the process | Limits files, network, children, workers |
| **`require(esm)`** | CJS and ESM finally shaking hands | Removes the migration blocker |
| **`node --run`** | npm scripts without npm | Faster, deterministic script running |
| **`node:bench`** | A benchmark runner, same shape as the tester | Measure before you optimise |

> **The one-sentence version:** audit your `package.json` for the packages Node now replaces, delete the ones that only wrap a built-in, and keep `tsc` because stripping runs TypeScript without ever checking it.

---

## The 60-Second Version (TL;DR)

1. **Node.js 24 is Active LTS** (codename Krypton, 30-month support window). **Node.js 26 is Current**, released 5 May 2026, entering LTS in October 2026.
2. **Type stripping is stable** (v24.12.0 / v25.2.0) and on by default since v23.6.0. `node app.ts` just works — for erasable syntax.
3. **It does not type-check.** `tsc --noEmit` in CI is still mandatory; the runtime will happily run a type error.
4. **Four syntax families still need transformation**, not stripping: `enum`, `namespace` with runtime code, parameter properties, and decorators. They error at parse time.
5. **`--env-file` is stable** since v24.10.0 / v22.21.0. Use `--env-file-if-exists` in production so a missing file is not fatal. No `${VAR}` interpolation.
6. **`node --watch` is stable** and deletes `nodemon`. **`node --run`** runs `package.json` scripts without npm.
7. **`node --test` is production-quality**: `describe`/`it`, mocks, snapshots, coverage, sharding, and randomized order (v26.1.0).
8. **`node:sqlite` is a release candidate** (stability 1.2) with a fully synchronous `DatabaseSync` API. No native addon, no `node-gyp`.
9. **The Permission Model is stable** (v23.5.0 / v22.13.0). `--permission` plus `--allow-fs-read`, `--allow-net`, `--allow-child-process`, `--allow-worker`.
10. **Node is moving to one release per year** from the 27.x line: 27.0.0 Current in April 2027, LTS in October 2027.

If you read nothing else, read **Part 1 (type stripping)** and **Part 3 (the test runner)**.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| Node.js 24 LTS or 26 Current | Everything here needs one of them | `node --version` |
| A project with a `package.json` | So the audit in Part 0 is real | `ls package.json` |
| One existing test file | To port to `node:test` and feel the difference | any test file |
| ~10 minutes | The whole migration is small | — |

> **Pick your target deliberately.** Node 24 LTS is the boring, supportable choice. Node 26 Current gets you `Temporal` by default and the newest V8, at the cost of a shorter support window until October 2026. If you have CI on 20 or 18, upgrading to 24 is the single highest-value change in this guide.

---

## Part 0 — The Audit: What Can You Delete?

Before anything else, read your own `package.json` and sort every dependency into three buckets: **replaced by the runtime**, **still necessary**, or **unclear**.

```bash
# what am I currently carrying?
node -e "const p=require('./package.json'); console.log(Object.keys({...p.dependencies,...p.devDependencies}).sort().join('\n'))"
```

| You have | Verdict on Node 24+ | Replace with |
|---|---|---|
| `ts-node`, `tsx`, `ts-node-dev` | **Delete** for erasable TS | `node app.ts` (keep `tsc --noEmit`) |
| `dotenv` | **Delete** in greenfield | `node --env-file=.env` |
| `nodemon`, `node-dev` | **Delete** | `node --watch` |
| `jest`, `mocha`, `vitest` | **Consider deleting** | `node --test` |
| `better-sqlite3`, `sqlite3` | **Consider deleting** | `node:sqlite` |
| `cross-env` | **Delete** | `node --env-file` plus `node --run` |
| `tsc` | **Keep** | type checking only |
| a bundler (esbuild, Vite) | **Keep** | Node cannot bundle for the browser |
| an ORM (Prisma, Drizzle) | **Keep** | `node:sqlite` is a driver, not an ORM |
| `supertest`, `@playwright/test` | **Keep** | `node:test` runs your tests, not HTTP fixtures |

> **The rule for the "consider" rows:** delete the dependency only if you are not using the 20% of it that the built-in lacks. Jest's snapshot ergonomics, Vitest's browser mode, and any ORM's migrations are reasons to keep the package, not reasons the built-in failed.

---

## Part 1 — Type Stripping: Run TypeScript Without a Build

### 1.1 What it does

Node replaces TypeScript syntax with whitespace and executes the result. No source maps, no build directory, no transpiler in the middle.

```bash
# before: a runner, a config, a cache directory, a watch flag from a different tool
npx tsx watch src/server.ts

# after
node --watch src/server.ts
```

Type stripping became **stable in v24.12.0 and v25.2.0**, and it has been **enabled by default since v23.6.0 / v22.18.0**. There is no flag to add. `--no-strip-types` disables it.

### 1.2 The trade you are making

| | Type stripping | `tsc` / `tsx` |
|---|---|---|
| Runs `.ts` immediately | **Yes** | After a build or a transform |
| Type checking | **No** | Yes |
| `enum`, `namespace` (runtime), parameter properties | **No** | Yes |
| Decorators | **No** | With the right config |
| JSX | **No** | With the right config |
| Source maps needed | **No** | Usually |
| Respects `tsconfig.json` paths | **No** | Yes |

Node **ignores `tsconfig.json` entirely.** Path aliases, `target` downlevelling, and anything else that depends on compiler settings are unsupported by design. It also refuses to process TypeScript files under `node_modules`, deliberately, to discourage publishing TS-only packages.

### 1.3 The tsconfig that works with it

Use `erasableSyntaxOnly` so the compiler rejects the syntax Node cannot strip, and `verbatimModuleSyntax` so `import type` is explicit.

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

`rewriteRelativeImportExtensions` lets you write `./util.ts` in source and have the compiler emit `./util.js` for tools that need it. `verbatimModuleSyntax` forces you to mark type-only imports, which is exactly what a stripper needs.

### 1.4 The four things that still need a build

If you use any of these, you need a real transpiler for that file:

| Feature | Why stripping fails |
|---|---|
| `enum` | Generating the reverse-mapping object is code *generation* |
| `namespace` with runtime code | Same — it emits a closure and an object |
| Parameter properties (`constructor(private x)`) | The `this.x = x` assignment is generated |
| Decorators | They wrap and replace, which is generated code |

`erasableSyntaxOnly: true` makes the compiler flag all four at author time rather than leaving you to discover them at `node app.ts` time.

> **The honest verdict:** type stripping is excellent for scripts, CLIs, small services, and internal tools — the places where `ts-node` used to live. It is not a full replacement for a TypeScript build when you use enums, decorators, or namespace-based DI.

---

## Part 2 — Env, Watch, and Scripts

### 2.1 `--env-file` is stable

```bash
# development
node --env-file=.env src/server.ts

# multiple files, later ones win
node --env-file=.env --env-file=.env.local src/server.ts

# production: do not crash when .env is absent
node --env-file-if-exists=.env src/server.ts
```

`--env-file` was added in v20.6.0 and **became stable in v24.10.0 / v22.21.0**. `--env-file-if-exists` was added in v22.9.0 and is stable alongside it. `process.loadEnvFile()` does the same from code — and it still throws on a missing file.

**Two limits to know.** There is **no `${VAR}` interpolation** inside the file, and the file format does not expand variables. If you rely on `dotenv`'s expansion or its `dotenv-expand` extension, that is a reason to keep the package.

> **Precedence rule:** if a variable exists in both the real environment and the file, the **environment wins**. That is what makes `--env-file=.env` safe in a container where the platform injects real secrets.

### 2.2 `--watch` and `--run`

```bash
node --watch src/server.ts        # restart on change
node --run build                  # run the "build" script from package.json
node --run                       # (v26.9.0+) list available scripts and exit non-zero
node --run test -- --verbose      # arguments after -- are appended
```

`--run` was added in v22.0.0 and is stable. It traverses up to find a `package.json`, prepends `./node_modules/.bin` for every ancestor so monorepo binaries resolve, and runs in the `package.json`'s directory. It sets `NODE_RUN_SCRIPT_NAME` and `NODE_RUN_PACKAGE_JSON_PATH` for the script.

### 2.3 A `package.json` with the ritual deleted

```json
{
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.ts",
    "start": "node --env-file-if-exists=.env src/server.ts",
    "test": "node --test",
    "test:cov": "node --test --experimental-test-coverage --test-coverage-lines=85",
    "check": "tsc --noEmit",
    "ci": "node --run check && node --run test"
  },
  "devDependencies": {
    "typescript": "^5.9.0"
  }
}
```

One dev dependency. It is `tsc`, and it is there to check what the runtime refuses to.

---

## Part 3 — The Test Runner That Replaced the Framework

### 3.1 The shape

`node:test` is stable and the API will look familiar. Assertions come from `node:assert`, not from the runner.

```js
// src/math.test.ts
import { test, describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { sum, divide } from "./math.ts";

describe("sum", () => {
  it("adds numbers", () => {
    assert.equal(sum(2, 3), 5);
  });

  it("rejects a non-number", () => {
    // a table of cases, no framework needed
    for (const bad of [null, "2", {}]) {
      assert.throws(() => sum(bad, 1), TypeError);
    }
  });
});

test("divide throws on zero", () => {
  assert.throws(() => divide(1, 0), /divide by zero/);
});
```

```bash
node --test                      # discovers *.test.*, test-*, test/**/*, etc.
node --test "src/**/*.test.ts"   # explicit globs
node --test --test-name-pattern="divide"   # filter by name
```

By default it discovers `**/*.test.{js,mjs,cjs}`, `**/*-test.*`, `**/*_test.*`, `**/test-*.*`, `**/test.*`, and `**/test/**/*.*`.

### 3.2 What actually ships

| Capability | Flag or API | Status |
|---|---|---|
| Suites and hooks | `describe`, `it`, `beforeEach`, `after` | Stable |
| Assertions | `node:assert` / `node:assert/strict` | Stable |
| Function and object mocks | top-level `mock` from `node:test` | Stable |
| Module mocking | `--experimental-test-module-mocks` | Early development |
| Coverage with thresholds | `--experimental-test-coverage`, `--test-coverage-lines` | Experimental (flag-gated) |
| LCOV output | `--test-reporter=lcov` | Stable |
| Snapshots | `--test-update-snapshots`, `t.assert.snapshot` | Stable |
| Watch mode | `--test --watch` | Stable |
| Randomised order | `--test-randomize`, `--test-random-seed=<n>` | Added v26.1.0 |
| Sharding | `shard` option | Stable |
| Tag filtering | `--test-tag-filter` | Stable |
| Benchmark runner | `--experimental-bench` / `node:bench` | Experimental, v26.9.0 |

```bash
# the CI command people actually want
node --test --experimental-test-coverage --test-coverage-lines=85 --test-reporter=lcov
```

### 3.3 Mocking, briefly

```js
import { test, mock } from "node:test";
import assert from "node:assert/strict";

test("sends a request", async (t) => {
  const spy = t.mock.fn(() => ({ ok: true }));
  const result = spy("payload");

  assert.equal(result.ok, true);
  assert.equal(spy.mock.callCount(), 1);
  assert.deepEqual(spy.mock.calls[0].arguments, ["payload"]);
});
```

`t.mock` is scoped to the test, so mocks are torn down automatically. Module mocking is behind `--experimental-test-module-mocks` and needs `--allow-worker` if you are also running the permission model.

### 3.4 The honest comparison

| | `node:test` | Jest / Vitest |
|---|---|---|
| Install size | 0 | A dependency tree |
| Watchers, coverage, mocks | Built in | Built in, more mature |
| Snapshot ergonomics | Basic | Richer |
| Browser / DOM environment | None | Vitest, Jest jsdom |
| Framework integrations | Minimal | Extensive (React, Vue, etc.) |
| Speed | Very good | Comparable or better with caching |

**Use `node:test` for server-side code, libraries, and CLIs.** Keep a framework when you test components, need a DOM, or lean on an integration the built-in does not offer. This is a genuine fork in the road, not a "built-in always wins" claim.

> **One gotcha worth repeating from the docs:** `Date` and timer mocks share a single simulated clock. Advancing the mocked time also advances the mocked date. That surprises people who mock only `setTimeout`.

---

## Part 4 — `node:sqlite`: A Database in the Standard Library

### 4.1 What it is

`node:sqlite` exposes a **synchronous** API, matching how SQLite is meant to be used.

```js
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("app.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id    INTEGER PRIMARY KEY,
    body  TEXT NOT NULL
  ) STRICT
`);

const insert = db.prepare("INSERT INTO notes (body) VALUES (?)");
insert.run("first note");

const rows = db.prepare("SELECT id, body FROM notes ORDER BY id").all();
console.log(rows); // [ { id: 1, body: 'first note' } ]
```

`DatabaseSync` is the connection; `StatementSync` is a prepared statement with `.run()`, `.get()`, `.all()`, and `.iterate()`.

### 4.2 Its status, stated plainly

**Stability 1.2 — Release candidate**, reached in Node.js v25.7.0. It stopped being flag-gated in v23.4.0 but remained experimental. RC means the API is close to frozen, not that it is finished.

| Question | Answer |
|---|---|
| Is it production-ready? | It is an RC — usable, with a small chance of API change |
| Does it need a native build? | No. It is compiled into the runtime |
| Sync or async? | Synchronous |
| Does it replace an ORM? | No — it is a driver, not a query builder |
| Does the permission model cover it? | Not fully; the docs say the permission model does not guarantee it blocks `node:sqlite` |
| In-memory support | Yes: `new DatabaseSync(":memory:")` |
| Backups | `DatabaseSync.prototype.backup()` wraps SQLite's backup API |

### 4.3 Where it wins and where it loses

**Wins:** scripts, CLIs, tests, local caching, embedded storage, anything where you currently shell out to the `sqlite3` binary or ship `better-sqlite3`. Zero install friction. It also avoids the `node-gyp` class of CI failure entirely.

**Loses:** you still want an ORM for migrations, relations, and typed queries; you still want a server database for concurrency; and the sync API blocks the event loop, so it is wrong for a hot path under load.

> **The migration is trivial and reversible.** The `@photostructure/sqlite` package is API-compatible with `node:sqlite` and works on older Node, so you can adopt the API now and swap the import later, or vice versa.

---

## Part 5 — The Permission Model: A Process With a Seatbelt

### 5.1 Stable, and worth turning on

The Permission Model is **stable since v23.5.0 / v22.13.0**. When enabled, the process cannot touch the filesystem, network, child processes, workers, WASI, or native addons unless you allow it.

```bash
node --permission \
  --allow-fs-read=/app \
  --allow-fs-read=/app/data \
  --allow-fs-write=/app/data \
  --allow-net \
  src/server.ts
```

| Flag | Restricts | Stability |
|---|---|---|
| `--permission` | Turns the model on (deny by default) | Stable |
| `--allow-fs-read=<paths>` | Filesystem reads | Stable |
| `--allow-fs-write=<paths>` | Filesystem writes | Stable |
| `--allow-child-process` | `child_process` | Stable |
| `--allow-worker` | `worker_threads` | Stable |
| `--allow-addons` | Native addons | Stable |
| `--allow-wasi` | WASI | Stable |
| `--allow-net` | Network | Added v25.0.0, active development |

Path arguments accept `*`, relative paths, absolute paths, and wildcards. Multiple `--allow-fs-read` flags accumulate. The entry point is implicitly readable (since v24.2.0 / v22.17.0).

### 5.2 What it is not

The docs are explicit: this is a **restriction mechanism, not a sandbox**. It does not contain a determined attacker — the `node:sqlite` caveat is the honest example of a hole in the model. Treat it as defense in depth, alongside containers and OS-level isolation, never as the boundary itself.

> **Where it pays off immediately:** scripts that parse untrusted input, CI jobs that run third-party tooling, and any code that loads a plugin. `--allow-fs-read=* --allow-net` is a five-minute change that turns "any file on the box" into "these files on the box".

---

## Part 6 — ESM, CJS, and the Friction That Finally Ended

### 6.1 `require(esm)` is stable

CommonJS can synchronously `require()` an ES module. This landed stable in v24 (marked stable in v24.15.0) and was backported to v20.19.0 and v22.12.0. The one exception: a module graph containing **top-level `await`** cannot be required — that still needs `import()`.

```js
// commonjs/legacy.cjs
const { thing } = require("./modern.mjs"); // works
```

### 6.2 What to use in new code

```json
{ "type": "module" }
```

In ESM you get `top-level await`, and you replace the old globals:

| Old | New (ESM) |
|---|---|
| `__dirname` | `import.meta.dirname` |
| `__filename` | `import.meta.filename` |
| `require.resolve("x")` | `import.meta.resolve("x")` |
| `require("./data.json")` | `import data from "./data.json" with { type: "json" }` |

### 6.3 The deprecations to plan for

Node 26 removed a batch of long-deprecated APIs. Check your dependency tree before upgrading:

- `http.Server.prototype.writeHeader()` — removed; use `writeHead()`.
- The legacy `_stream_wrap`, `_stream_readable`, `_stream_writable`, `_stream_duplex`, `_stream_transform`, `_stream_passthrough` modules — removed.
- The `--experimental-transform-types` flag — removed (type stripping is stable).
- `module.register()` — runtime-deprecated (DEP0205); use the loader hooks replacement.
- **`NODE_MODULE_VERSION` is now 147** in Node 26, so prebuilt native addons must be rebuilt.

> **The one line that saves an upgrade:** `npm rebuild` (or delete `node_modules` and reinstall) after moving to Node 26. ABI changes in V8 are the usual cause of "works locally, crashes in CI".

---

## Part 7 — Release Cadence: One Major Per Year

Node.js is simplifying its schedule. Starting with the **27.x line**, it moves from two majors a year to one:

| Date | Event |
|---|---|
| October 2026 | Node.js 27 **Alpha** phase begins |
| April 2027 | Node.js **27.0.0** becomes Current |
| October 2027 | Node.js 27 enters **LTS** |

Node.js 26 is the last release under the old odd/even two-per-year rules. Practically: fewer upgrade cycles per year, a longer tail on each one, and less churn in your native-addon rebuilds. Plan for one big upgrade a year rather than two small ones.

---

## Cheat Sheet

```bash
# ─── RUN ────────────────────────────────────────────────────────────
node app.ts                          # type stripping, stable, default on
node --watch src/server.ts           # replaces nodemon
node --env-file=.env src/server.ts   # stable since 24.10.0 / 22.21.0
node --env-file-if-exists=.env app.ts # production-safe
node --run build                     # package.json scripts without npm
node --run                           # list scripts (v26.9.0+)
node --run test -- --verbose         # pass args after --

# ─── CHECK / TEST ───────────────────────────────────────────────────
tsc --noEmit                         # the type check stripping never does
node --test                          # discovery + suites + hooks
node --test --watch                  # re-run on change
node --test --test-name-pattern="foo"
node --test --experimental-test-coverage --test-coverage-lines=85
node --test --test-randomize --test-random-seed=12345
node --test --experimental-test-module-mocks
node --test --experimental-bench      # node:bench (experimental)

# ─── PERMISSIONS ────────────────────────────────────────────────────
node --permission --allow-fs-read=/app --allow-fs-write=/app/data --allow-net app.ts
node --permission --allow-fs-read=* --allow-net app.ts   # looser, still bounded

# ─── TYPESCRIPT CONFIG THAT MATCHES THE RUNTIME ─────────────────────
```

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

| I need to… | Use |
|---|---|
| Run a `.ts` file | `node file.ts` |
| Check types | `tsc --noEmit` |
| Restart on change | `node --watch` |
| Load `.env` | `node --env-file=.env` |
| Load `.env` if present | `node --env-file-if-exists=.env` |
| Run an npm script | `node --run <script>` |
| Write a test | `node --test` + `node:assert/strict` |
| Mock a function | `t.mock.fn()` from `node:test` |
| Mock a module | `--experimental-test-module-mocks` |
| Measure coverage | `--experimental-test-coverage` |
| Store data locally | `node:sqlite` |
| Sandbox a process | `--permission` + `--allow-*` |
| `require` an ESM module | Works (no top-level `await`) |
| Find the current directory in ESM | `import.meta.dirname` |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | An `enum`, runtime `namespace`, parameter property, or decorator | Set `erasableSyntaxOnly: true` and rewrite, or add a transform step |
| Path alias `@/x` fails at runtime | Node ignores `tsconfig.json` | Use relative imports or `imports` in `package.json` |
| Types wrong but code ran | Stripping does not check | Run `tsc --noEmit` in CI |
| `Cannot find module './x.js'` in TS source | Extension mismatch | Use `rewriteRelativeImportExtensions` and import `./x.ts` |
| `.env` missing crashes the process | `--env-file` throws by design | Use `--env-file-if-exists` in production |
| `${VAR}` in `.env` is literal | No interpolation in the native loader | Keep `dotenv` + `dotenv-expand`, or avoid interpolation |
| Test file not discovered | Not matching the default patterns | Rename to `*.test.ts`, or pass an explicit glob |
| Mocking a module errors | Module mocks are flag-gated | Add `--experimental-test-module-mocks` (and `--allow-worker` under `--permission`) |
| Coverage flag unrecognised | Older Node | Upgrade to 24+, or use a coverage tool |
| Advancing a mocked timer moved the date | `Date` and timers share one clock | Mock one, or account for both |
| `node:sqlite` missing | Node < 22.5 | Upgrade; the module is built in from v22.5.0 |
| Native addon crashes after upgrade | `NODE_MODULE_VERSION` changed to 147 | `npm rebuild`, or delete `node_modules` and reinstall |
| `ERR_ACCESS_DENIED` under `--permission` | A needed path or capability is not allowed | Add the narrowest `--allow-*` flag that unblocks it |
| `node --run` cannot find a binary | Script lives in an ancestor `node_modules/.bin` | `--run` prepends ancestors automatically; check the script name |
| `import defer` syntax error | Stage 3, not shipped in your runtime | Do not use it in library code yet |

---

## Video Library

YouTube **search** links only — runtime versions move fast.

| Search | What you'll find |
|---|---|
| [Node.js type stripping](https://www.youtube.com/results?search_query=Node.js+type+stripping+TypeScript) | Running TS without a build |
| [node --test tutorial](https://www.youtube.com/results?search_query=node+test+runner+tutorial) | The built-in test runner |
| [node:sqlite Node.js](https://www.youtube.com/results?search_query=node+sqlite+Node.js) | Built-in SQLite in practice |
| [Node.js permission model](https://www.youtube.com/results?search_query=Node.js+permission+model+allow-fs-read) | Sandboxing a process |
| [require esm Node.js](https://www.youtube.com/results?search_query=require+esm+Node.js) | CommonJS and ESM together |
| [node --env-file](https://www.youtube.com/results?search_query=node+env-file+dotenv) | Replacing `dotenv` |
| [Node.js 24 LTS what's new](https://www.youtube.com/results?search_query=Node.js+24+LTS+what%27s+new) | The LTS feature set |
| [Node.js 26 release](https://www.youtube.com/results?search_query=Node.js+26+release+what%27s+new) | Temporal, V8 14.6, removals |
| [tsc --noEmit CI](https://www.youtube.com/results?search_query=tsc+noEmit+CI+type+check) | Type checking without emitting |
| [Node.js test coverage](https://www.youtube.com/results?search_query=Node.js+test+runner+coverage) | Thresholds and reporters |

---

## Written References & Docs

The Node.js API docs are the primary source; everything else is commentary.

| Source | URL |
|---|---|
| Node.js TypeScript (type stripping) | `https://nodejs.org/api/typescript.html` |
| Node.js CLI options (`--env-file`, `--run`, `--permission`, `--test`) | `https://nodejs.org/api/cli.html` |
| `node:test` — the test runner | `https://nodejs.org/api/test.html` |
| Collecting code coverage | `https://nodejs.org/learn/test-runner/collecting-code-coverage` |
| Run scripts from the command line | `https://nodejs.org/learn/command-line/run-nodejs-scripts-from-the-command-line` |
| `node:sqlite` | `https://nodejs.org/api/sqlite.html` |
| Permission Model | `https://nodejs.org/api/permissions.html` |
| Node.js 26.0.0 release notes | `https://nodejs.org/en/blog/release/v26.0.0` |
| Node.js 24.15.0 (LTS) release notes | `https://nodejs.org/en/blog/release/v24.15.0` |
| Node.js releases and schedule | `https://nodejs.org/en/about/previous-releases` |
| Node.js Interactive 2026 recap (release cadence) | `https://nodejs.org/en/blog/events/nodejs-interactive-2026` |
| TypeScript `tsconfig` reference | `https://www.typescriptlang.org/tsconfig` |
| TypeScript `erasableSyntaxOnly` | `https://www.typescriptlang.org/tsconfig/#erasableSyntaxOnly` |
| `@photostructure/sqlite` (API-compatible fallback) | `https://www.npmjs.com/package/@photostructure/sqlite` |

**Third-party, for context only:**

| Source | Why |
|---|---|
| Runtime comparison articles | Useful for orientation; vendor-flavoured, verify on Node's own docs |
| Migration blog posts | Good for tips; version claims often drift |
| `dotenv` / `nodemon` READMEs | Still correct for the behaviour the built-ins lack |

> **Verification tip:** version-tagged "Added in" and "History" tables in the Node.js API docs are the cleanest per-version record in the ecosystem. When a blog and that table disagree, the table is right.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Type stripping | Erasing TypeScript syntax and running the JavaScript underneath |
| `erasableSyntaxOnly` | A tsconfig flag that rejects syntax Node cannot strip |
| `tsc --noEmit` | Type checking with no JavaScript output |
| `--env-file` | The native `.env` loader |
| `--env-file-if-exists` | The same loader, non-fatal when the file is missing |
| `node --watch` | The built-in restart-on-change watcher |
| `node --run` | Run a `package.json` script without npm |
| `node:test` | The built-in test runner |
| `node:assert` | The built-in assertion library the runner uses |
| `t.mock` | A test-scoped mock factory |
| Sharding | Splitting tests across processes or machines |
| Randomised order | Running tests in a shuffled order to expose coupling |
| `node:sqlite` | The built-in synchronous SQLite driver |
| `DatabaseSync` | A single synchronous SQLite connection |
| Stability 1.2 | Node's "release candidate" stability level |
| Permission Model | `--permission` plus `--allow-*` process restrictions |
| `require(esm)` | Synchronous ESM loading from CommonJS |
| `import.meta.dirname` | The ESM replacement for `__dirname` |
| `NODE_MODULE_VERSION` | The native-addon ABI number; 147 in Node 26 |
| `node:bench` | The experimental built-in benchmark runner |

---

## FAQ & Next Steps

**Does Node still need `ts-node` or `tsx`?** Only if you use `enum`, runtime `namespace`, parameter properties, or decorators — or if you rely on `tsconfig.json` path aliases. For erasable TypeScript, `node app.ts` is enough.

**Does type stripping check my types?** No. It erases annotations. `tsc --noEmit` is still required, in CI and in pre-commit.

**Can I delete `dotenv`?** In greenfield code, yes — `--env-file` is stable and `--env-file-if-exists` is production-safe. If you depend on variable interpolation inside the file, keep `dotenv` plus `dotenv-expand`.

**Is `node:sqlite` production-ready?** It is a release candidate (stability 1.2), not finished. Use it for scripts, CLIs, and tests now; be deliberate about it as a primary datastore.

**Can I replace Jest entirely?** For server-side code and libraries, often yes. Keep a framework if you test components, need a DOM, or rely on an integration the built-in does not have.

**Is the Permission Model a sandbox?** No. Node documents it as a restriction mechanism, and it explicitly does not guarantee coverage of every route to a resource. Pair it with containers.

**Why did native addons break after I upgraded?** `NODE_MODULE_VERSION` changed (147 in Node 26). Run `npm rebuild` or reinstall `node_modules`.

**Which Node should I run in production?** Node 24 LTS for the long window; Node 26 once it enters LTS in October 2026. If you are on 18 or 20, moving to 24 is the priority.

**What is changing about the release schedule?** From the 27.x line, one major per year: 27.0.0 Current in April 2027, LTS in October 2027. Node 26 is the last two-per-year release.

**Where do I verify a version claim?** The Node.js API docs' "Added in" / "History" tables, then the release notes for the major you target.

### Next steps, in order

1. **Today:** audit `package.json` with the Part 0 table and delete anything that only wraps a built-in.
2. **This week:** switch `npm run dev` to `node --watch --env-file=.env` and add `tsc --noEmit` to CI.
3. **Next week:** port one test file to `node --test` and turn on coverage with a threshold.
4. **Week 3:** set `erasableSyntaxOnly: true` and fix whatever it flags.
5. **Week 4:** try `node:sqlite` in a script that currently shells out to `sqlite3`.
6. **Month 2:** wrap one untrusted-input script in `--permission` with the narrowest allow-list that works.

---

## Verification Note

**Verified as of September 2026 from Node.js primary sources:**

- **Type stripping** is stable (v25.2.0 / v24.12.0), enabled by default since v23.6.0 / v22.18.0; `--no-strip-types` disables it; Node ignores `tsconfig.json`; it refuses to process TypeScript under `node_modules`; recommended tsconfig includes `noEmit`, `target: esnext`, `module: nodenext`, `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`, and `verbatimModuleSyntax`; unsupported features include `enum`, runtime `namespace`, parameter properties, and (by implication of code generation) decorators and JSX (`nodejs.org/api/typescript.html`).
- **`--env-file`** added v20.6.0, no longer experimental as of **v24.10.0 / v22.21.0**; **`--env-file-if-exists`** added v22.9.0, non-experimental in the same releases; no variable interpolation; environment values take precedence over file values (`nodejs.org/api/cli.html`).
- **`--run`** added v22.0.0; v22.3.0 added `NODE_RUN_SCRIPT_NAME` / `NODE_RUN_PACKAGE_JSON_PATH` and ancestor `node_modules/.bin` traversal; **v26.9.0** added listing scripts when no command is given (`nodejs.org/api/cli.html`).
- **`node:test`** is stable (runner stable since v20.0.0); supports suites, hooks, mocks, snapshots, coverage with thresholds, LCOV reporters, sharding, and tag filtering; **randomised order and `--test-random-seed` added in v26.1.0**; module mocking requires `--experimental-test-module-mocks` and `--allow-worker` under the Permission Model (`nodejs.org/api/test.html`, `nodejs.org/learn/test-runner/collecting-code-coverage`).
- **`node:bench` / `--experimental-bench`** were added in **v26.9.0**, stability 1 — Experimental (`nodejs.org/api/cli.html`).
- **`node:sqlite`** is **stability 1.2 — Release candidate**; the API documentation attributes the RC status to **v25.7.0**, and the v24.15.0 release notes also carry a "sqlite: mark as release candidate" commit, so the exact major that first reached RC is best confirmed against the version you run. It is no longer behind `--experimental-sqlite` since v23.4.0; synchronous `DatabaseSync` / `StatementSync` API; in-memory and backup support; the Permission Model does not guarantee it blocks `node:sqlite` (`nodejs.org/api/sqlite.html`, `nodejs.org/api/permissions.html`).
- **Permission Model** is **stable since v23.5.0 / v22.13.0**; `--allow-net` was added in **v25.0.0** with stability 1.1 — Active development; entrypoints are implicitly readable since v24.2.0 / v22.17.0 (`nodejs.org/api/permissions.html`, `nodejs.org/api/cli.html`).
- **`require(esm)`** was marked stable in v24.15.0 and backported to v20.19.0 / v22.12.0; a graph containing top-level `await` cannot be `require`d (`nodejs.org/en/blog/release/v24.15.0`).
- **Node.js 26.0.0** was released 2026-05-05: V8 14.6, Undici 8.0, Temporal enabled by default, `http.Server.prototype.writeHeader()` and the legacy `_stream_*` modules removed, `--experimental-transform-types` removed, `module.register()` runtime-deprecated, `NODE_MODULE_VERSION` 147 (`nodejs.org/en/blog/release/v26.0.0`).
- **Release cadence:** from the 27.x line, one major per year — alpha October 2026, 27.0.0 Current April 2027, LTS October 2027 (`nodejs.org/en/blog/events/nodejs-interactive-2026`).

**Where I am relying on third-party analysis rather than a primary source:** the "delete this dependency" verdicts, the Jest/Vitest comparison table, and the adoption order are my synthesis. The `@photostructure/sqlite` compatibility claim is the package's own. Community runtime comparison articles informed the framing but not a single version number above.

**Vendor and third-party claims, not independently verified:** the `@photostructure/sqlite` API-compatibility statement, and any community benchmark implying `node:test` speed relative to a framework.

**Changes fast:** `node:sqlite` and the Permission Model are still moving; the release cadence change takes effect with the 27.x line; deprecations reach end-of-life on Node's own clock. Re-check the Node.js API docs and the target major's release notes before depending on any flag or stability number here.

**Not security advice.** The Permission Model is documented by Node as a restriction mechanism, not a sandbox. Pair it with OS- or container-level isolation and treat it as one layer.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd fold this into my own stack.**

| In my workspace | Verdict |
|---|---|
| `ts-node` / `tsx` in devDependencies | Delete for erasable TS; keep for enums/decorators |
| `dotenv` | Delete in greenfield; `--env-file` is stable |
| `nodemon` | Delete; `node --watch` |
| Jest or Vitest | Trial `node --test` on one server-side package before committing |
| `sqlite3` / `better-sqlite3` in a script | Move to `node:sqlite` |
| `tsc` | Keep — it is the only type check left |
| A bundler | Keep — Node does not bundle for the browser |
| Long-running agent scripts | Wrap in `--permission` with narrow allow-lists |

**Recommended setup:**

- **Pin the LTS.** Node 24 in production, Node 26 for local experimentation until it is LTS.
- **`tsc --noEmit` in CI and pre-commit.** Stripping will run a type error; only the compiler catches it.
- **`erasableSyntaxOnly: true`** from day one, so you never discover a runtime-stripping failure at deploy.
- **`node --test` for server work, a framework for UI.** Two tools, two jobs, no guilt.
- **`node:sqlite` behind a thin repository module.** The API may still shift before it leaves RC.
- **`--permission` on anything that touches untrusted input.** Narrow allow-list, then widen only when something breaks.
- **What I would not do:** delete a test framework before you have ported a single suite across, or adopt `node:sqlite` as a primary datastore while it is still a release candidate.

**Smoke test for the first session, in order:**

```bash
# 1. what am I on, and does it strip types?
node --version
printf 'const n: number = 1;\nconsole.log(n + 1);\n' > /tmp/t.ts && node /tmp/t.ts

# 2. does the env loader work?
printf 'GREETING=hello\n' > /tmp/.env && node --env-file=/tmp/.env -e "console.log(process.env.GREETING)"

# 3. do the runner and SQLite exist?
node --test --test-name-pattern=__none__ 2>&1 | head -1
node -e "const {DatabaseSync}=require('node:sqlite'); new DatabaseSync(':memory:'); console.log('sqlite ok')"
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Node/Next.js app, uses opencode and AI coding agents daily,
and learns by doing.

Paper: markdown_docs/18-nodejs-builtin-toolchain-2026.md
Topic: The Node.js built-in toolchain in Node 24 and 26 — type stripping, the env loader,
watch mode, the test runner, node:sqlite, the Permission Model, and require(esm), each with
the dependency it lets you delete.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (porting a real Jest suite to node:test; a production `--permission`
configuration; `node:sqlite` as a repository layer with migrations; a monorepo `node --run`
setup; migrating a CommonJS service to ESM with require(esm) as the bridge); (C) run the audit
against his real package.json — read it, list the dependencies Node now replaces, and rewrite
the scripts block.

Rules: never invent a flag, a version, a stability level, or an API name. Check "Added in" and
"History" in the Node.js API docs and the target major's release notes before asserting either.
If unsure, write "search: <flag> Node.js docs". Label third-party compatibility data as
third-party. Distinguish primary sources (Node.js docs, release notes) from community
summaries. Note anything still experimental or release-candidate. Keep the structure. Report
path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://nodejs.org/api/typescript.html
https://nodejs.org/api/cli.html
https://nodejs.org/api/test.html
https://nodejs.org/api/sqlite.html
https://nodejs.org/api/permissions.html
https://nodejs.org/en/blog/release/v26.0.0
```
