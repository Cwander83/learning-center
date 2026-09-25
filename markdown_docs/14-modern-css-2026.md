# The Complete Guide: Modern CSS You Can Ship in 2026

> `:has()` and nesting graduated to "Widely available" — delete their fallbacks. Anchor positioning and `field-sizing` are new and safe behind a guard. Here is what is Baseline, what still needs `@supports`, and how to tell the difference without guessing.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

For a decade, "can I use this CSS?" was answered by caniuse.com and a shrug. In 2026 it has an official answer: **Baseline**. A feature becomes **Newly available** when every core browser supports it, and **Widely available** 30 months later. That distinction is the whole game — it tells you when to write a fallback and when to delete one.

The practical consequence is asymmetric, and most people get it backwards. The interesting question in 2026 is not "what new CSS can I use?" It is **"what old workaround can I now delete?"** `:has()` went Widely available in June 2026. Nesting went Widely available in June 2026. If your stylesheet still carries a `@supports selector(:has(*))` guard or a PostCSS nesting plugin "just in case", that scaffolding is now dead weight.

```
   BASELINE: TWO TIERS, TWO DECISIONS

   ┌────────────────────────────────────────────────────────────┐
   │  LIMITED AVAILABILITY                                      │
   │  not in all core browsers yet                              │
   │  → don't ship it, or ship it behind a feature flag          │
   └────────────────────────────────────────────────────────────┘
                            │ every core browser supports it
                            ▼
   ┌────────────────────────────────────────────────────────────┐
   │  NEWLY AVAILABLE                                           │
   │  works everywhere today; 30-month clock is running          │
   │  → ship it, usually with a @supports guard or a base style  │
   └────────────────────────────────────────────────────────────┘
                            │ 30 months pass
                            ▼
   ┌────────────────────────────────────────────────────────────┐
   │  WIDELY AVAILABLE                                          │
   │  the browsers that lack it are outside any mainstream target│
   │  → ship it with NO fallback. Delete the guard.              │
   └────────────────────────────────────────────────────────────┘
```

The single most important idea: **"Newly available" means write a fallback; "Widely available" means delete one.** Your stylesheet should be full of base styles plus a few `@supports` layers, not full of polyfills for features that have been safe for two and a half years.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Baseline** | An official compatibility label | Replaces "search caniuse and guess" |
| **Core browser set** | Chrome, Edge, Firefox, Safari (desktop + mobile) | If all five agree, it's interoperable |
| **Newly available** | Fresh off the line | Ship it, but guard it |
| **Widely available** | Been on the shelf 30 months | Ship it raw; remove the guard |
| **Limited availability** | Not ready | Don't ship, or hide behind a flag |
| **`@supports (prop: value)`** | A runtime feature test for a declaration | The right way to layer an enhancement |
| **`@supports selector(:has(*))`** | A runtime test for a *selector* | Tests selectors, not properties |
| **Progressive enhancement** | Base style works everywhere; the enhancement adds to it | The fallback-first mindset |
| **Graceful degradation** | It works, minus the flourish | What you get when you skip the base style |
| **Interop 2026** | Browser vendors agreeing on a shared test suite | Signals where support is converging |
| **Baseline 2026** | Everything that went Newly available during 2026 | The year's safe-to-adopt set |

> **The one-sentence version:** use Baseline as a build-time lint, not a memory exercise — check the tier, write a base style, add one `@supports` layer if it's Newly available, and delete old guards once a feature goes Widely available.

---

## The 60-Second Version (TL;DR)

1. **Baseline has two tiers.** Newly available = interoperable now. Widely available = interoperable for 30 months. Check the tier before writing anything.
2. **`:has()` is Widely available** (June 2026). Delete the `@supports` guard and the JS class toggles it replaced.
3. **Nesting is Widely available** (June 2026), including the `&` selector. Drop the PostCSS nesting plugin.
4. **Anchor positioning is Newly available** (January 2026, when Firefox 147 shipped). It replaces Popper.js/Floating UI for tooltips and dropdowns — behind a guard.
5. **`field-sizing: content` is Newly available** (June 2026). It deletes auto-resizing `<textarea>` JavaScript.
6. **`contrast-color()` is Newly available** (April 2026). It picks black or white text for guaranteed WCAG AA contrast on a background.
7. **`@scope` and `:open` are Newly available** (2026). Scoped styles, and one selector for expanded `<details>`, open dialogs, and showing popovers.
8. **Scroll-driven animations still need a guard.** Chrome and Safari ship `animation-timeline`; **Firefox had not shipped it as of the September 2026 check.** It's an Interop 2026 focus area, so this is changing.
9. **`text-wrap-style: pretty` is not safe yet.** The property is Baseline, but the `pretty` value has not shipped in Firefox. Progressive enhancement only.
10. **The cheapest win is deletion.** Audit for `@supports` guards, vendor prefixes, and polyfills on features that are now Widely available. That's dead weight with a maintenance cost.

If you read nothing else, read **Part 1 (how to read Baseline)** and **Part 5 (the audit)**.

---

## Prerequisites

- A modern browser to test in — ideally one of each engine. On a Mac: Safari (WebKit) is already installed; Chrome (Blink) and Firefox (Gecko) are a download away.
- Familiarity with basic CSS and DevTools.
- Optional but useful: an editor with a Baseline linter. Chrome DevTools now shows Baseline info for CSS properties in the **Elements** panel, which makes the check a hover away.
- A stylesheet you own, so the audit in Part 5 is real work rather than a thought experiment.

> **A caution up front:** Baseline describes the *core browser set*, not every browser in the world. Embedded WebViews, kiosk browsers, and corporate-locked old Safari versions can lag. Baseline is a strong signal, not a guarantee. For a consumer site it is enough; for a hospital intranet, verify your own floor.

---

## Part 1 — How to Actually Read Baseline

### 1.1 The two tiers, precisely

Straight from the source:

- **Newly available:** the feature is supported by all of the core browsers, and is therefore interoperable.
- **Widely available:** 30 months have passed since that newly-interoperable date. The feature can be used by most sites without worrying about support.
- **Limited availability** is what a feature has *before* Newly available.

The core browser set is Chrome (desktop and Android), Edge, Firefox (desktop and Android), and Safari (macOS and iOS).

**Baseline 2026** is the shorthand for everything that became Newly available during 2026.

### 1.2 The arithmetic that decides your fallback

You don't have to remember dates — do the subtraction:

```
tier = today - (date it became Newly available)

  < 30 months   →  Newly available  →  write a base style + @supports guard
  ≥ 30 months   →  Widely available →  ship raw, delete any guard
```

Worked examples, so you can see how fast this moves:

| Feature | Newly available | 30-month mark | Status today (Sep 2026) |
|---|---|---|---|
| Size container queries | Feb 2023 | Aug 2025 | **Widely available** |
| `:has()` | Dec 2023 | Jun 2026 | **Widely available** |
| CSS nesting | Aug 2023 | Feb 2026 | **Widely available** |
| Popover | Jan 2025 | Jul 2027 | Newly available |

This is the single most useful table in the guide. Notice that popover — a feature everyone already treats as safe — is technically still Newly available until 2027.

### 1.3 Where to check

| Tool | What it gives you |
|---|---|
| **webstatus.dev** (Web Platform Status) | The authority. Feature-level Baseline status, support data, and **Baseline Alerts** — subscribe via GitHub for email/RSS/Slack notifications |
| **MDN** | Every feature page carries a `Baseline 2026 > Newly available` banner with the date |
| **Chrome DevTools → Elements** | Baseline info for CSS properties, inline while you inspect |
| **web.dev Baseline blog** | Monthly digests of what just moved tiers |

> **Set up Baseline Alerts once.** Sign in to webstatus.dev with GitHub, save a search (say, all CSS features), and subscribe. It turns "did anything I care about become safe?" from an occasional research task into a notification.

### 1.4 The one thing people get wrong

`:has()` being "Newly available since December 2023" and "Widely available since June 2026" are both true statements about the same feature on different dates. When a search result or a blog post says "Newly available," check *when* — a 2023 feature described as Newly available is a stale page, and the feature is almost certainly Widely available now.

---

## Part 2 — Widely Available: Delete the Guards

These are the features where the right action in 2026 is **removal**. If you have scaffolding for any of them, it is now dead weight.

### 2.1 `:has()` — the parent selector

Widely available since June 2026. It matches an element if it has a certain descendant or subsequent sibling.

**What it deletes:** a JavaScript `MutationObserver`, a class toggle, and the CSS that depended on that class.

```css
/* was: JS adds .has-error to the field wrapper */

/* now: pure CSS */
.field:has(input:invalid) {
  border-color: #b42318;
}

/* highlight a card that contains a checked input */
.card:has(input:checked) {
  outline: 2px solid #1d4ed8;
}

/* style a heading that is followed by a paragraph */
h2:has(+ p) {
  margin-block-end: 0.25rem;
}
```

The older technique was to add a class in JavaScript when the child's state changed, or to lean on a framework for it. That is now unnecessary.

> **Precision matters here:** `:has()` is not a "parent selector" in the sense of selecting an ancestor. It matches an element based on whether it *has* a matching descendant. The selector you write points at the parent, but the condition is about what's inside it.

If you still keep a guard for a year because of device-locked old iOS Safari, that is a defensible choice — but it is a choice, not a requirement. Widely available means the browsers lacking it are outside mainstream targets.

### 2.2 Nesting, including `&`

Nesting became Widely available in June 2026, and the `&` selector along with it. `&` explicitly anchors a child rule to its parent selector, which is what gives you correct specificity for hover, focus, and pseudo-class states.

```css
.card {
  padding: 1rem;

  & .title {
    font-weight: 700;
  }

  &:hover {
    border-color: #1d4ed8;
  }

  &:has(input:checked) {
    background: #eef2ff;
  }
}
```

**What it deletes:** a PostCSS nesting plugin you're keeping "just in case", and any build step that exists only to flatten nesting for old browsers.

### 2.3 The rest of the Widely available workhorses

These are safe with no fallback in 2026, in the current and previous major versions of every core browser:

| Feature | Notes |
|---|---|
| `:has()` | Parent-aware styling; see above |
| CSS nesting + `&` | See above |
| Size container queries | Container-relative layout; Widely available since Aug 2025 |
| `:focus-visible` | Keyboard-only focus styling |
| `@supports selector()` | Testing selectors like `:has()` — for the features that still need it |
| `color-mix()` | Blend two colors in a given space at runtime; Widely available since 2023 |
| `clamp()`, `min()`, `max()` | Fluid type and spacing |
| `subgrid` | Grid alignment across nested elements |
| `@layer` | Cascade control |
| `cap`, `counter-set`, `pow()`, `mask` | Went Widely available in June 2026 |
| Two-value `display` | `display: inline flex` instead of `inline-flex` |
| `oklch()` | Perceptually uniform color; syntax support is complete |

As one 2026 review put it: a stylesheet using `subgrid`, `:has()`, `clamp()`, and `oklch()` is safe with no fallback, because the first three have aged past the threshold and `oklch()` is newly available with complete syntax support.

---

## Part 3 — Newly Available: Ship It, But Guard It

These arrived in 2026. They work in current browsers, but the 30-month clock is running, so write a base style that works everywhere and layer the enhancement with `@supports`.

### 3.1 Anchor positioning — replaces Popper.js and Floating UI

Newly available in **January 2026**, when Firefox 147 shipped unflagged support and closed the loop. Chrome and Edge led in 2024, Safari joined in 2025.

Anchor positioning lets you declare *in CSS* that one element's position depends on another element's geometry. The canonical use is a tooltip tethered to its trigger, or a dropdown tethered to a menu item — with the browser handling the flip when there isn't room.

```css
.trigger {
  anchor-name: --tooltip-anchor;
}

.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;
  position-area: top center;
  position-try-fallbacks: flip-block;   /* flip when there's no room */
  margin: 0;                            /* reset popover defaults */
  inset: auto;                          /* reset popover defaults */
}
```

For fine control, the `anchor()` function positions an element's edge relative to an anchor's edge, and composes with `calc()`:

```css
.positionedElement {
  right: anchor(left);
  margin-right: 10px;
}

/* 10px from the anchor's logical block start */
.positionedElement {
  inset-block-end: calc(anchor(start) + 10px);
}
```

**What it deletes:** a positioning library, its bundle weight, its resize/scroll listeners, and its "no room, flip it" logic.

> **Two gotchas, both from MDN.** First, if you're positioning a **popover**, its default `margin` and `inset` styles will fight you — reset them (`margin: 0; inset: auto;`). The CSS working group is looking at removing that workaround. Second, `anchor()` only works in inset properties on absolutely or fixed positioned elements, and the `<anchor-side>` must be compatible with the inset property's axis — `top: anchor(left)` is invalid, because `left` is horizontal.

Ship it behind `@supports`:

```css
@supports (anchor-name: --x) {
  /* anchor-positioned tooltip */
}
```

### 3.2 `field-sizing: content` — auto-growing form fields

Newly available in **June 2026**.

```css
textarea {
  field-sizing: content;
  max-height: 12rem;   /* cap it or it grows forever */
}
```

With `field-sizing: content`, form controls expand and shrink to fit their content instead of holding a fixed default size.

**What it deletes:** the `scrollHeight` listener, the inline-style height reset on every keystroke, and the debounce around it that you probably got subtly wrong. That is an entire class of bug gone.

Add `max-height` (or `max-width`) or the control grows without bound.

### 3.3 `contrast-color()` — automatic accessible text color

Newly available since **April 2026**. It returns one of `white` or `black`, depending on which has the greater contrast with the input color, and commonly targets WCAG AA.

```css
.badge {
  background: var(--badge-color);
  color: contrast-color(var(--badge-color));
}
```

**What it deletes:** maintaining background/text color pairs by hand, and the manual contrast checking that goes with them. Given an arbitrary brand color — from a database, from a user's theme — you get a readable foreground for free.

> **Edge case worth knowing:** if white and black have *equal* contrast with the input, the function returns `white`. And browsers may use different, better algorithms than a naive luminance check — so don't treat the output as a spec-exact value you can rely on for pixel tests.

### 3.4 `@scope` and `:open`

**`@scope`** is Newly available in 2026. It applies styles with proximity-based specificity and explicit upper and lower bounds — a practical alternative to BEM naming or CSS Modules for component-scoped styles.

**`:open`** matches elements that are currently open: expanded `<details>`, visible dialogs, and showing popovers. It replaces `[open]` plus a separate set of popover state rules.

```css
details:open > summary {
  font-weight: 700;
}

dialog:open {
  border-color: #1d4ed8;
}
```

### 3.5 Also Newly available in 2026

| Feature | What it does |
|---|---|
| Container **style** queries (`@container style()`) | Style by a container's custom property values — variant styling without JS class toggling. Newly available May 2026 |
| `alpha()` | Computes a relative color by adjusting opacity |
| `progress()` | Returns a 0–1 ratio of one value between two others, for interpolation |
| `light-dark()` with images | Accepts `<image>` values, not just colors |
| `:active-view-transition` | Style the root while a view transition is in progress |
| `sibling-count()` / `sibling-index()` | Count and index siblings without JS |
| `shape()` | A responsive basic shape |
| `<rcap>`, `<rch>`, `<rex>`, `<ric>` | Root-relative font units — useful for vertical rhythm and CJK layouts |
| `baseline-shift` | Position an element relative to its dominant baseline |
| Custom highlights (`::highlight`) | Style arbitrary text ranges without extra DOM |
| `text-decoration-line: spelling-error` | Browser-native spell-check underlines |
| `image-rendering: crisp-edges` | Scale images without blurring |

### 3.6 Still not safe: `text-wrap-style: pretty`

The `text-wrap-style` property is Baseline, but the **`pretty` value has not shipped in Firefox yet**. `pretty` cleans up orphan words on the last line of long-form copy — a genuinely nice upgrade for article typography.

```css
/* progressive enhancement only */
p {
  text-wrap: pretty;
}
```

Because it's a declaration that browsers can simply ignore, you don't even need `@supports` — an unsupported value is dropped, and the paragraph renders normally. Ship it as an enhancement, never as something the layout depends on.

---

## Part 4 — Scroll-Driven Animations: The Honest Status

This is the feature everyone wants and the one with the murkiest support, so it gets its own part.

### 4.1 What it does

CSS scroll-driven animations link a keyframe animation to scroll position instead of time. Scrolling forward plays it forward; scrolling back plays it backwards; pausing scroll pauses the animation — as if `animation-play-state` were `pause`.

There are two kinds of timeline:

| Timeline | Based on | Start → end |
|---|---|---|
| **Scroll progress** (`scroll()`) | How far a scroll container has scrolled | Top of page 0% → bottom 100% |
| **View progress** (`view()`) | How an element passes through the viewport | Element enters 0% → element exits 100% |

The properties themselves are unchanged CSS animation; you only change *what counts as progress*.

```css
.reveal {
  animation: fade-in linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 100%;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**What it deletes:** `scroll` event listeners, `IntersectionObserver`, and JavaScript running on every frame to compute positions. The browser knows the correspondence between scroll and progress directly, so nothing has to be handed across the main thread.

> **Order matters:** the `animation` shorthand resets `animation-timeline` to its default `auto`, and cannot set it. So always declare `animation-timeline` *after* any `animation` shorthand, or your scroll timeline silently becomes a time-based one.

### 4.2 The support reality

Chromium shipped `animation-timeline: scroll()` from Chrome 115. Safari followed. **Firefox had not shipped it as of a 2026-09-16 check**, which is why scroll-driven animations are still not Baseline.

They *are* an **Interop 2026 focus area**, which is the strongest available signal that support is converging: vendors run a shared test suite and close implementation differences. Baseline status is expected once Firefox and Safari both ship full support without prefixes.

### 4.3 How to ship it today

Guard it, and give the fallback a real (simpler) animation:

```css
/* base: works everywhere — a plain time-based fade */
.reveal {
  animation: fade-in 0.6s ease both;
}

/* enhancement: tie progress to scroll */
@supports (animation-timeline: scroll()) {
  .reveal {
    animation-timeline: view();
    animation-range: entry 0% entry 100%;
  }
}
```

That structure gives every browser a working animation, and the capable ones get the scroll-linked version.

### 4.4 Scroll-*triggered* animations (the next chapter)

Don't confuse this with what's coming. **Scroll-driven** animations advance *with* scrolling. **Scroll-triggered** animations are time-based animations that *fire* when you cross a scroll offset — the `IntersectionObserver` pattern.

Chrome 145 is landing `animation-trigger` for this:

```css
animation: unclip 0.35s ease-in-out both;
animation-trigger: --t play-forwards play-backwards;

/* the trigger, backed by a view timeline */
timeline-trigger-name: --t;
timeline-trigger-source: view();
```

That's Chromium-only for now, and it's the declarative replacement for the "animate in when it enters the viewport" snippet. Watch it; don't ship it yet.

### 4.5 One more not-ready feature

**CSS Grid Lanes** — native masonry via `display: grid-lanes` — ships in Safari 26.4, but Chrome, Edge, and Firefox still keep it behind a flag. It replaces Masonry.js and the older `display: masonry` / `grid-template-rows: masonry` prototypes. Not Baseline; don't plan around it.

---

## Part 5 — The Audit: Delete What You No Longer Need

This is the highest-value hour you can spend on CSS in 2026. You are not adding features; you are removing scaffolding.

### 5.1 What to search for

```bash
# @supports guards for now-Widely-available features
rg -n "@supports.*:has\(|@supports.*selector\(:has" .
rg -n "@supports.*nesting|postcss-nesting|postcss-nested" .
rg -n "@supports.*container|@supports.*color-mix|@supports.*oklch" .

# vendor prefixes on stable features
rg -n "-webkit-(border-radius|box-shadow|transform|transition|animation)" .
rg -n "-ms-" .

# polyfills and shims
rg -n "focus-visible|clamp\(|color-mix" package.json
```

### 5.2 The decision for each hit

| You find | Verdict |
|---|---|
| `@supports` guard on a **Widely available** feature | **Delete it.** Ship the feature raw |
| `@supports` guard on a **Newly available** feature | **Keep it.** That's the correct pattern |
| Vendor prefix on a **Widely available** feature | **Delete it.** Browsers haven't needed it for years |
| Polyfill for a **Widely available** feature | **Remove the dependency** and the import |
| PostCSS plugin whose only job is flattening **nesting** | **Remove it** |
| `@supports` guard for scroll-driven animations | **Keep it.** Firefox hasn't shipped |

### 5.3 What "dead weight" actually costs

A stale `@supports` guard is not free. It duplicates every rule it wraps, so a change has to be made in two places. It lies to the next reader about what the browser support actually is. And it outlives the person who added it — which is exactly why this audit is worth doing on a schedule rather than once.

### 5.4 The three-step rewrite

The pattern for every newly available feature is the same:

```css
/* 1. base style that works everywhere */
.tooltip {
  position: absolute;
  top: 100%;
  left: 0;
}

/* 2. the enhancement, layered on top */
@supports (anchor-name: --x) {
  .tooltip {
    position: fixed;
    position-anchor: --trigger;
    top: anchor(bottom);
    left: anchor(left);
  }
}
```

Base style first, enhancement second, one `@supports` between them. No polyfill, no library, and a working result in every browser.

---

## Part 6 — Applying It Here: This Site's Own CSS

I promised the fastest payback, so here is the audit applied to the Learning Center's own stylesheet (`build/assets/base.css`), which is a good stand-in for any small design system.

### 6.1 What the theme already gets right

The site's design tokens are a single restrained palette with light and dark variants. In 2026 that maps onto modern color features well:

```css
:root {
  color-scheme: light dark;
  --paper: oklch(0.98 0.003 264);
  --ink: oklch(0.17 0.012 264);
  --accent: oklch(0.55 0.19 264);
}
```

`oklch()` is safe with no fallback — perceptually uniform, so a palette built in it keeps consistent lightness across hues, which is why "off-white with a single blue" reads cleanly.

### 6.2 Three changes worth making

**One — replace any state-class toggling with `:has()`.** The dashboard already has cards with a category, a "Read more" button, and an expanded state. Expanded state is managed in JS today. The parts that are purely visual could move to CSS:

```css
/* base.css — no JS class needed for the visual part */
.card:has(.readmore:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* a card whose checklist has unchecked items */
.card:has(input[type="checkbox"]:not(:checked)) {
  border-inline-start: 3px solid var(--accent);
}
```

**Two — let the search field size itself.** If the guide search ever becomes a `<textarea>` (or for any comment box), delete the JS:

```css
textarea {
  field-sizing: content;
  min-height: 3rem;
  max-height: 14rem;
}
```

**Three — drop the manual `prefers-color-scheme` duplication where `light-dark()` fits.** The theme already toggles via `data-theme`, so this is optional — but for the tokens that only flip on the OS setting, `light-dark()` removes a duplicated block:

```css
:root {
  color-scheme: light dark;
  --panel: light-dark(#ffffff, #14171d);
  --text:  light-dark(#0e1116, #e7eaf0);
}
```

Keep the explicit `data-theme` toggle if users need to override the OS — which this site does, so the practical win here is smaller than it looks. Honest assessment: `light-dark()` is a win for sites that *only* follow the OS setting.

### 6.3 The guard pattern for a tooltip

If the site grows a glossary tooltip (it has a Glossary section, so this is plausible), ship it base-first:

```css
.glossary-term {
  border-bottom: 1px dotted var(--hairline-strong);
}

.glossary-tip {
  position: absolute;
  top: 100%;
  left: 0;
  max-width: 18rem;
}

@supports (anchor-name: --x) {
  .glossary-term { anchor-name: --term; }
  .glossary-tip {
    position: fixed;
    position-anchor: --term;
    position-area: top center;
    position-try-fallbacks: flip-block;
    margin: 0;
    inset: auto;
  }
}
```

No library, a working fallback, and the flip handled by the browser where supported.

### 6.4 What I would *not* change here

- **No scroll-driven animations.** The guide pages have a read-progress bar, which would be a lovely fit — but Firefox hasn't shipped, and the site's whole point is reading in whatever browser you have. Keep the JS bar, or guard the CSS version carefully.
- **No Grid Lanes.** Safari-only.
- **No `text-wrap-style: pretty` dependency.** Add it as a bare enhancement if you like how it looks; never build a layout that assumes it.

> **The general lesson from this section:** on a small content site, modern CSS buys you *less JavaScript* and *fewer duplicated rules*. It rarely buys a dramatic visual change — the visual language was already fine. The win is maintenance, not looks.

---

## Cheat Sheet

```css
/* :has() — Widely available. Ship raw. */
.field:has(input:invalid) { border-color: red; }

/* nesting — Widely available. Ship raw. */
.card { & .title { font-weight: 700; } &:hover { color: blue; } }

/* anchor positioning — Newly available. Guard it. */
@supports (anchor-name: --x) {
  .tip { position-anchor: --trigger; top: anchor(bottom); }
}

/* field-sizing — Newly available. Guard it if the field must work old. */
textarea { field-sizing: content; max-height: 12rem; }

/* contrast-color() — Newly available. */
.badge { background: var(--c); color: contrast-color(var(--c)); }

/* :open — Newly available. */
details:open > summary { font-weight: 700; }

/* scroll-driven — NOT Baseline (no Firefox). Always guard. */
@supports (animation-timeline: scroll()) {
  .reveal { animation-timeline: view(); animation-range: entry 0% entry 100%; }
}
```

| Feature | Tier | Action |
|---|---|---|
| `:has()` | Widely available (Jun 2026) | Ship raw, delete guard and JS toggle |
| Nesting + `&` | Widely available (Jun 2026) | Ship raw, remove PostCSS plugin |
| Size container queries | Widely available (Aug 2025) | Ship raw |
| `color-mix()`, `clamp()`, `oklch()`, `subgrid`, `@layer` | Widely available | Ship raw |
| Popover | Newly available (Jan 2025) | Ship with a guard until ~Jul 2027 |
| Anchor positioning | Newly available (Jan 2026) | Ship with `@supports` |
| `field-sizing` | Newly available (Jun 2026) | Ship with `@supports` |
| `contrast-color()` | Newly available (Apr 2026) | Ship with `@supports` |
| `@scope`, `:open`, container style queries | Newly available (2026) | Ship with `@supports` |
| Scroll-driven animations | **Limited** in Firefox | Always guard |
| `text-wrap-style: pretty` value | **Limited** in Firefox | Bare enhancement only |
| Scroll-*triggered* (`animation-trigger`) | Chrome 145 only | Watch, don't ship |
| Grid Lanes (`display: grid-lanes`) | Safari only | Watch, don't ship |

```bash
# audit your own stylesheet
rg -n "@supports" src/ | rg ":has|nesting|container|color-mix|oklch"
rg -n "\-webkit-|\-ms-" src/
rg -n "postcss-nesting|postcss-nested|focus-visible" package.json
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `:has()` "doesn't work" on an old device | Device-locked old iOS Safari | It's Widely available but not universal; drop the guard only if your target set allows |
| Anchor-positioned tooltip in the wrong place | Popover default `margin`/`inset` | `margin: 0; inset: auto;` on the positioned element |
| `top: anchor(left)` is invalid | Axis mismatch | Use a side on the same axis, or a logical value like `start` |
| Fallback value used unexpectedly | No anchor associated | `position-anchor` (or the `anchor` HTML attribute) is still required to associate |
| `textarea` grows forever | No cap | Add `max-height` |
| Scroll animation runs on load, ignoring scroll | `animation` shorthand declared after `animation-timeline` | Declare `animation-timeline` *after* the shorthand |
| Scroll animation doesn't run at all in one browser | Firefox hasn't shipped | Keep the `@supports` guard; the base animation should still play |
| `contrast-color()` gives an unexpected value | Browser algorithm differs; ties return white | Don't assert exact output in pixel tests |
| `text-wrap: pretty` has no effect | Firefox hasn't shipped the `pretty` value | Expected; it's an enhancement |
| Guard deletion broke something | The feature was Newly, not Widely, available | Re-check the tier and the date on webstatus.dev |
| Baseline status changed under you | Features move tiers; you don't | Subscribe to Baseline Alerts |
| CSS nesting behaves oddly in a build | A PostCSS plugin is flattening it | Remove the plugin and let the browser handle nesting |

---

## Video Library

YouTube **search** links only — browser-support videos date badly.

| Search | What you'll find |
|---|---|
| [CSS :has() tutorial](https://www.youtube.com/results?search_query=CSS+has+selector+tutorial) | The parent selector in practice |
| [CSS anchor positioning tutorial](https://www.youtube.com/results?search_query=CSS+anchor+positioning+tutorial) | Tooltips and dropdowns without JS |
| [CSS Baseline explained](https://www.youtube.com/results?search_query=CSS+Baseline+explained) | How to read the tiers |
| [CSS @supports progressive enhancement](https://www.youtube.com/results?search_query=CSS+supports+progressive+enhancement) | The guard pattern |
| [CSS scroll-driven animations](https://www.youtube.com/results?search_query=CSS+scroll-driven+animations) | `animation-timeline` in depth |
| [CSS container queries](https://www.youtube.com/results?search_query=CSS+container+queries) | Size and style queries |
| [CSS nesting tutorial](https://www.youtube.com/results?search_query=CSS+nesting+tutorial) | Native nesting and `&` |
| [field-sizing CSS](https://www.youtube.com/results?search_query=field-sizing+CSS) | Auto-growing form fields |
| [oklch color CSS](https://www.youtube.com/results?search_query=oklch+color+CSS) | Modern color spaces |
| [Interop 2026](https://www.youtube.com/results?search_query=Interop+2026) | What vendors are converging on |

---

## Written References & Docs

web.dev, MDN, and webstatus.dev first — these are the authorities Baseline names.

| Source | URL |
|---|---|
| Baseline overview | `https://web.dev/baseline` |
| How to use Baseline | `https://web.dev/how-to-use-baseline` |
| Web Platform Status dashboard | `https://webstatus.dev/` |
| Baseline Alerts | `https://web.dev/blog/baseline-alerts` |
| Baseline monthly digests | `https://web.dev/blog` |
| June 2026 digest (`field-sizing`, `:has()` widely available) | `https://web.dev/blog/baseline-digest-jun-2026` |
| January 2026 digest (root font units, Navigation API) | `https://web.dev/blog/baseline-digest-jan-2026` |
| web-features (the data behind Baseline) | `https://github.com/web-platform-dx/web-features` |
| MDN — Baseline compatibility glossary | `https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility` |
| MDN — `:has()` | `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:has` |
| MDN — `anchor()` | `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/anchor` |
| MDN — using anchor positioning | `https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning/Using` |
| MDN — `field-sizing` | `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing` |
| MDN — `contrast-color()` | `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/contrast-color` |
| MDN — scroll-driven animations guide | `https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations` |
| MDN — scroll-driven timelines | `https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines` |
| MDN — nesting selector | `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Nesting_selector` |
| MDN — `@supports` | `https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@supports` |
| Chrome for Developers — scroll-triggered animations | `https://developer.chrome.com/blog/scroll-triggered-animations` |
| Interop 2026 | `https://web.dev/interop-2026/` |
| CSS anchor positioning spec | `https://drafts.csswg.org/css-anchor-position-1/` |
| CSS Values and Units Level 4 | `https://drafts.csswg.org/css-values-4/` |
| CSS Working Group drafts | `https://github.com/w3c/csswg-drafts` |

**Third-party trackers and summaries (useful, but verify against the above):**

| Source | Notes |
|---|---|
| modern-css.com | Feature-by-feature Baseline status and snippets; refreshes from web-features |
| handoff.design modern CSS guide | Good on the "what still needs a backup" question; third-party analysis |
| caniuse.com | Still useful for granular version data; Baseline is the higher-level label |

> **Verification tip:** Baseline status changes monthly. If a page and a dashboard disagree, the dashboard wins. Check `webstatus.dev` for the feature by name.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Baseline | The compatibility label: is this feature supported across core browsers? |
| Core browser set | Chrome, Edge, Firefox, Safari, desktop and mobile |
| Limited availability | Not supported in all core browsers yet |
| Newly available | Interoperable now; the 30-month clock is running |
| Widely available | Interoperable for 30 months; safe without a fallback |
| Baseline 2026 | Features that became Newly available during 2026 |
| `@supports` | An at-rule that applies styles only if the browser supports a declaration |
| `@supports selector()` | Tests support for a selector, e.g. `:has()` |
| Progressive enhancement | Base style works everywhere; the good stuff is layered on |
| Graceful degradation | Works minus the flourish |
| Dead weight | Fallbacks and prefixes for features that no longer need them |
| Interop | Vendors running a shared test suite to close implementation gaps |
| Core Web Vitals | Google's user-experience metrics (LCP, INP, CLS) |
| Anchor positioning | Tethering one element's position to another element's geometry |
| `anchor-name` / `position-anchor` | The name on the anchor / the association on the positioned element |
| `anchor()` / `position-area` | Position an edge relative to an anchor / place an element in an area around it |
| Scroll progress timeline | Progress tied to how far a container has scrolled |
| View progress timeline | Progress tied to how an element passes through the viewport |
| Scroll-*driven* vs scroll-*triggered* | Advances with scrolling vs fires on crossing an offset |
| Grid Lanes | Native masonry layout; Safari 26.4 only for now |

---

## FAQ & Next Steps

**What does "Baseline" actually promise?** That a feature is supported by the core browser set (Chrome, Edge, Firefox, Safari on desktop and mobile). Newly available means interoperable now; Widely available means it has been for 30 months. It is a compatibility signal, not a guarantee about every old browser or embedded WebView.

**Is `:has()` safe without a fallback?** Yes, in 2026. It went Widely available in June 2026. The one case that still warrants a guard is a device-locked old Safari version you have to support — a business decision, not a Baseline one.

**Do I still need Popper.js or Floating UI?** For simple tooltips and dropdowns, no — anchor positioning replaces them, behind a `@supports` guard. Keep the library if you need behaviour it provides beyond positioning.

**Can I delete my `@supports` guards?** Only for Widely available features. For Newly available ones, the guard *is* the correct pattern. The audit in Part 5 tells you which is which.

**Why do scroll-driven animations still need a guard?** Firefox hadn't shipped `animation-timeline` as of the September 2026 check. It's an Interop 2026 focus area, so expect that to change.

**What's the difference between scroll-driven and scroll-triggered?** Driven advances *with* scroll position; triggered *fires* a time-based animation when crossing an offset. The second is Chrome 145 territory.

**Is `text-wrap: pretty` safe?** The property is Baseline; the `pretty` value is not shipped in Firefox. Use it as a bare enhancement — unsupported browsers just ignore it.

**Where should I check support?** `webstatus.dev` for the tier, MDN for the detail and the exact date, and Chrome DevTools for a quick check while inspecting an element.

**What's the highest-value thing I can do this week?** Run the audit. Delete guards and prefixes for Widely available features, and remove the polyfills and PostCSS plugins whose only job has been done.

### Next steps, in order

1. **Today:** subscribe to Baseline Alerts on `webstatus.dev` for CSS features.
2. **This week:** run the audit commands in Part 5 against your stylesheet. Delete guards for `:has()`, nesting, container queries, and color functions.
3. **Next week:** convert one JS state toggle to `:has()` and delete the JS.
4. **Week 3:** take `field-sizing` for one form field and delete the auto-resize script.
5. **Week 4:** build one anchor-positioned tooltip base-first with a guard, and delete a positioning library if you have one.
6. **Month 2:** revisit scroll-driven animations — check whether Firefox has shipped, and adopt behind the guard when it's worth it.

---

## Verification Note

**Verified as of September 2026 from web.dev, MDN, and webstatus.dev:**

- **Baseline definition:** Newly available = supported by all core browsers (Chrome desktop + Android, Edge, Firefox desktop + Android, Safari macOS + iOS). Widely available = 30 months have passed since that date. Before Newly available, a feature has Limited availability. Baseline 2026 is the 2026 newly-available set (`web.dev/baseline`).
- **`:has()`:** moved to Baseline **Widely available in June 2026** (`web.dev/blog/baseline-digest-jun-2026`).
- **CSS nesting and the `&` selector:** Baseline **Widely available in June 2026**; the two-value `display` property also went Widely available (`web.dev/blog/baseline-digest-jun-2026`; `modern-css.com/changelog`).
- **Anchor positioning / `anchor()`:** Baseline **Newly available since January 2026**, when Firefox 147 shipped unflagged support (`developer.mozilla.org` anchor() page: "Since January 2026"). Chrome/Edge shipped in 2024, Safari in 2025.
- **`field-sizing`:** Baseline **Newly available in June 2026** (`web.dev/blog/baseline-digest-jun-2026`; MDN: "Since June 2026").
- **`contrast-color()`:** Baseline **Newly available since April 2026**; returns `white` or `black`; ties return white; browsers may use different algorithms (MDN).
- **`@scope`, `:open`, container style queries, `alpha()`, `progress()`, `light-dark()` with images, `sibling-count()`/`sibling-index()`, `shape()`:** Baseline Newly available during 2026 per MDN/Web Platform Status listings (`web-platform-dx` web-features explorer; `modern-css.com`).
- **Scroll-driven animations:** `animation-timeline: scroll()`/`view()` support from Chrome 115 and Safari 18/26; **Firefox had not shipped it as of a 2026-09-16 check**, so it is not Baseline. It is an **Interop 2026 focus area** (MDN scroll-driven animations guide; Chrome for Developers; third-party status summaries).
- **Scroll-triggered animations:** `animation-trigger` landing in **Chrome 145**, Chromium-only (Chrome for Developers blog, published 2025-12-12).
- **`text-wrap-style: pretty`:** the property is Baseline Newly available (2024) but the **`pretty` value has not shipped in Firefox** — progressive enhancement only (`modern-css.com/changelog`).
- **Grid Lanes (`display: grid-lanes`):** Safari 26.4 only; Chrome, Edge, and Firefox behind a flag (`modern-css.com/changelog`).
- **Chrome DevTools** shows Baseline information for CSS properties in the Elements panel (`web.dev/baseline`).
- **Baseline Alerts** on webstatus.dev: subscribe via GitHub for email/RSS/Slack notifications (`web.dev/blog/baseline-alerts`).

**Where I am relying on third-party analysis rather than a primary source:** the specific `@supports` recommendations (which features need a guard and which don't) follow from the Baseline tiers, but the tier-to-guard mapping is my synthesis, informed by community write-ups. The tier dates are primary; the guidance is judgement.

**Vendor and third-party claims, not independently verified:** `modern-css.com`'s browser-version tables, and any community article's characterisation of "safe to use." Use them to find the feature, then confirm the tier on webstatus.dev.

**Changes fast:** Baseline tier transitions happen monthly; Firefox shipping scroll-driven animations will move a whole category; experimental features (scroll-triggered animations, Grid Lanes) may ship widely at any time. Re-check webstatus.dev before depending on any status in this guide.

**Not legal or accessibility advice.** `contrast-color()` targets WCAG AA, but automated contrast checks do not replace testing with real users and assistive technology.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd work this into my own stack.**

| In my workspace | Verdict |
|---|---|
| A hand-authored CSS design system with tokens | Modern color + `:has()` + nesting are the wins; no framework needed |
| Light/dark theme toggled by the user | Keep the explicit toggle; `light-dark()` only helps OS-only theming |
| A small amount of vanilla JS on the front end | `:has()` and `field-sizing` are the two biggest JS deletions |
| A build step with PostCSS | Check whether nesting is the only reason it exists |
| No browser matrix documented | Write down your floor; Baseline assumes a mainstream one |

**Recommended setup:**

- **Check support in DevTools.** Select an element, inspect a property, and read the Baseline banner. Fastest loop there is.
- **Subscribe to Baseline Alerts.** Pick "CSS" and get notified when a tier changes. This is the whole maintenance strategy in one subscription.
- **Editor linting.** If your setup supports it, a Baseline-aware linter flags newly available features you haven't guarded.
- **`@supports` as a code review item.** One guard per enhancement, base style always present. A reviewer should be able to see the fallback.
- **A deletion habit.** When a tier moves to Widely available, that's a follow-up ticket to delete the guard — not a nice-to-have.
- **Test in two engines at minimum.** Safari + Chrome on your Mac covers WebKit and Blink. Add Firefox before shipping anything that leans on a Newly available feature, because Firefox is the usual laggard and the usual reason a feature stays Newly available.
- **What I would not do:** adopt a feature just because it's new. Baseline tells you what's *safe*, not what's *worth it*. Anchor positioning earns its keep by deleting a library; Grid Lanes would earn it by deleting a masonry shim that doesn't exist yet.

**Smoke test for the first session, in order:**

```bash
# 1. what guards do I have?
rg -n "@supports" src/

# 2. what prefixes and polyfills?
rg -n "\-webkit-|\-ms-" src/
rg -n "postcss-nesting|postcss-nested|focus-visible" package.json

# 3. check the tier for anything you find (webstatus.dev), then delete or keep
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, hand-authors CSS for a static site, uses opencode and AI coding
agents daily, and learns by doing.

Paper: markdown_docs/14-modern-css-2026.md
Topic: Modern CSS you can ship in 2026 — what Baseline says is safe, what still needs a
@supports guard, and how to audit and delete obsolete fallbacks.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (container queries in depth, `@layer` and cascade control, view
transitions on same-document navigation, colour systems in oklch, motion and
prefers-reduced-motion, CSS for print); (C) apply the audit to his real stylesheet in
build/assets/base.css — read it, list the actual guards and prefixes it contains, and rewrite
the specific rules.

Rules: never invent Baseline dates, browser versions, or spec URLs. Check the tier on
webstatus.dev and the date on MDN before asserting either. If unsure, write "search: <feature>
Baseline status". Label any third-party tracker's data as third-party. Distinguish primary
sources (web.dev, MDN, webstatus.dev) from community summaries. Keep the structure. Report
path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://web.dev/baseline
https://webstatus.dev/
https://web.dev/blog/baseline-digest-jun-2026
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/anchor
https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing
```
