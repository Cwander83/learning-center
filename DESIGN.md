---
name: Learning Center
description: Near-neutral ink on paper with a single reference blue — a follow-along field manual you annotate as you work.
colors:
  reference-blue: "#1d4ed8"
  ink: "#0e1116"
  paper: "#f7f8fa"
  sheet: "#ffffff"
  wash: "#eef1f5"
  graphite: "#5b6472"
  hairline: "#e3e7ee"
  hairline-strong: "#d3d9e3"
  blue-wash: "#eef2ff"
  code-field: "#f2f4f7"
  code-ink: "#1b2430"
  verified: "#0f7a4f"
  reference-blue-dark: "#4d8dff"
  ink-dark: "#e7eaf0"
  paper-dark: "#0b0d11"
  sheet-dark: "#14171d"
  wash-dark: "#1b1f27"
  graphite-dark: "#9aa4b2"
  hairline-dark: "#252a34"
  hairline-strong-dark: "#333a47"
  blue-wash-dark: "#17233b"
  code-field-dark: "#11141a"
  code-ink-dark: "#dde3ec"
  verified-dark: "#4ade80"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 32px)"
    fontWeight: 750
    lineHeight: 1.18
    letterSpacing: "-0.6px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "21.5px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.2px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.7
  callout:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.65
  ui:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "5px"
  sm: "7px"
  md: "10px"
  pill: "999px"
spacing:
  "2xs": "6px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.reference-blue}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 13px"
  pill:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  pill-active:
    backgroundColor: "{colors.reference-blue}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "17px 19px"
  search-input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "11px 15px 11px 39px"
  checklist-item:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
---

# Design System: Learning Center

## Overview

**Creative North Star: "The Annotated Field Manual"**

This is a field manual, not a magazine. Its surfaces read as ink on ruled paper: an off-white ground, near-black text, and thin rules that organize without weight. The reader is here to work — to copy a command, tick a step, and come back months later — so the system spends its boldness on legibility and spends nothing at all on decoration.

There is exactly one color with a point of view: **Reference Blue**. Everything else is a near-neutral ink value stepped between paper and graphite. The blue marks what is live — the link, the primary action, the checked pill, the reading-progress rule — and because it is rare, its appearance is itself information. Depth is not simulated with shadow or blur; it comes from a single step of panel tone plus 1px hairlines, so the page stays flat and the rules stay crisp.

The manual is annotated in the margin: a sticky contents rail, a reading-progress line under the topbar, and checklist items that remember their state. These are the only places the interface speaks above a whisper. Content outlives chrome — the guide is the artifact, and the interface must never compete with the reading.

**Key Characteristics:**
- Two inks and one accent blue; no second hue anywhere in the system.
- Flat by default: depth from panel tones and 1px hairlines, never shadows or blur.
- Light and dark themes are first-class and share every token name.
- Browser surfaces (selection, caret, scrollbars, focus ring, tabular numerals) are themed from the palette.
- One radius family: 7px controls, 10px containers, full pill for filters.
- Motion is limited to state transitions and the reading-progress rule.

## Colors

The palette is a near-neutral ink range with a single functional blue; it never carries a second accent.

### Primary
- **Reference Blue** (#1d4ed8): The only accent. Used for links, the primary action, the selected filter pill, the reading-progress rule, focus rings, caret, and text selection. It marks interactive or current state and nothing else. In dark theme it lifts to a lighter, brighter step (#4d8dff) so it holds contrast on a near-black ground.

### Neutral
- **Ink** (#0e1116): Primary text, headings, and the foreground of neutral controls. In dark theme the text role is carried by a light step (#e7eaf0).
- **Paper** (#f7f8fa): The page ground. Dark theme ground is near-black (#0b0d11).
- **Sheet** (#ffffff): Raised surfaces — cards, inputs, pills, code buttons — sitting one tone above the ground. Dark theme uses (#14171d).
- **Wash** (#eef1f5): Secondary fills and hover grounds for neutral controls; also the alternating row tint in tables. Dark theme uses (#1b1f27).
- **Graphite** (#5b6472): Secondary and meta text — descriptions, counts, timestamps, and the inactive filter pill. Never used for body copy against an accent surface.
- **Hairline** (#e3e7ee): The default 1px border and divider.
- **Hairline Strong** (#d3d9e3): The emphasized 1px border — card hover, the `h2` rule, and empty-state dashes.
- **Blue Wash** (#eef2ff): The accent's own faint ground — callouts, selected nav rows, secondary-button hover. It is a tint of the accent, never a separate hue.
- **Code Field** (#f2f4f7) / **Code Ink** (#1b2430): The recessed ground and foreground for inline code and fenced blocks.
- **Verified Green** (#0f7a4f): Success only — a copied code block. It appears at most once per screen and never as a decorative accent.

### Named Rules
**The One Accent Rule.** Reference Blue covers well under 10% of any screen. Its rarity is what makes it legible as a signal; a second accent hue would spend that signal for decoration.

**The Hairline Rule.** Separation is a 1px line, never a heavier border, a fill, or a shadow. When a boundary needs more emphasis, move from Hairline to Hairline Strong — do not thicken it.

**The Verified Rule.** Green is reserved for confirmed success (a completed copy). It never marks a category, a badge, or a call to action.

## Typography

**Display Font:** system sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
**Body Font:** the same system sans
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for code only

**Character:** One workhorse UI face carries every non-code role, weighted rather than styled to build hierarchy — 750 for a page title, 650 for a card title, 400 for prose. The system stack is a deliberate choice for a manual: it renders instantly, needs no webfont fetch, and looks native in the reader's own OS. Monospace is used only for code, commands, and file paths — never as a costume for "technical".

### Hierarchy
- **Display** (750, `clamp(26px, 3.4vw, 32px)`, 1.18, -0.6px): Page and dashboard titles. Steps down to ~26px on narrow viewports.
- **Headline** (700, 21.5px, 1.3, -0.3px): Section headings (`h2`), carrying a 1px Hairline Strong underline that spans the heading text only.
- **Title** (650, 17px, 1.35, -0.2px): Guide-card titles and `h3` sub-headings.
- **Body** (400, 16.5px, 1.7): All prose. Measure is held to roughly 65–75 characters; the dashboard hero is capped near 68ch.
- **Callout** (400, 15.5px, 1.65): The guide lede callout and blockquotes — body prose given one step of prominence.
- **UI** (400, 14.5px, 1.6): Dashboard lede, search field, and the sort control. Controls and their adjacent copy share this one step so the toolbar reads as a single band.
- **Label** (700, 11px, 0.06em, uppercase): Category badges and sidebar group heads. Never a kicker above a heading — it labels a value, not a title.

### Named Rules
**The 68-Character Rule.** Running prose never exceeds a comfortable measure (65–75ch). A manual is read linearly; a full-width paragraph has to be re-found on every line.

**The One UI Step Rule.** All toolbar controls and their adjacent copy sit at one size (14.5px). A control that is a different size from the field beside it breaks the band.

**The No-Kicker Rule.** Labels sit on values (a category tag, a count), never above a heading as an eyebrow. Headings carry their own weight.

## Layout

Two surfaces, two spatial models. The **dashboard** is a single centered column capped at 1020px with 24px gutters. The **guide page** is a two-region layout: a 272px sticky contents rail pinned below the topbar (`top: 57px`, full remaining viewport height, 1px Hairline divider) beside a fluid reading column capped at 1240px overall. Reading-column padding is generous (34px top, 44px sides, 150px bottom) because the column is meant to be read, not scanned.

Spacing rhythm is a tight 4px-derived scale (6 / 8 / 12 / 16 / 24 / 48). Related content groups tightly; distinct groups separate generously, and a heading always has more space above it than below. Cards in the dashboard list are 10px apart — close enough to read as one shelf.

Responsive behavior is compositional, not scaled. Below **960px** the guide rail un-pins and becomes a full-width header strip above the reading column, which then takes the full width with 22px padding. Below **720px** dashboard cards stack (category and title above, full-width action below) and the display size steps down. Both breaks reflow the structure rather than shrinking it.

## Elevation & Depth

This system is **flat**. There are no shadows anywhere — not on cards, inputs, buttons, the topbar, or overlays. Depth is conveyed by exactly two devices: a one-step tonal shift (Sheet on Paper, Wash on Sheet) and 1px hairlines. The topbar is a solid panel with a 1px bottom hairline, pinned rather than floated, so it reads as part of the sheet.

### Named Rules
**The Flat-By-Default Rule.** A surface is flat at rest and flat under interaction. State is shown with border color and color, never by lifting an element off the page. If a component seems to need a shadow, it needs a hairline or a tone instead.

## Shapes

One radius family, no exceptions: **5px** for inline code (`--r-xs`), **7px** for controls and small surfaces (`--r-sm`), **10px** for containers (`--r-md` — cards, callouts, code blocks, empty states), and **999px** for filter pills, the only fully rounded form in the system. Borders are always 1px and always a hairline token. There is no clipping, no notched or cut corner, no mixed-square silhouette; the geometry stays rectangular and quiet so the code blocks and tables inside it read cleanly.

## Components

### Buttons
- **Shape:** 7px radius, 1px-free face for the primary, 1px hairline for secondaries.
- **Primary:** Reference Blue ground, Sheet text, 10px × 18px padding, 600 weight at 13.5px. One per view — the "Open" action on a card.
- **Hover / Focus:** Brightness shifts ~6% on hover (a filter, not a ground swap); focus is the shared 2px Reference Blue ring at 2px offset. No lift, no glow.
- **Secondary:** Wash ground, Ink text, 1px hairline, 7px × 13px padding — the theme toggle and the guide page's "Home" link. Hover moves the border to Reference Blue and the ground to Blue Wash.

### Chips
- **Style:** Full pill (999px), Sheet ground, Graphite text, 1px hairline at 12.5px / 600, with a lighter-weight count appended.
- **State:** Hover raises the border and text to Reference Blue. Selected inverts to a Reference Blue ground with Sheet text. Pills are the only way to filter — there is no parallel category control.

### Cards / Containers
- **Corner Style:** 10px radius.
- **Background:** Sheet at rest, in both themes.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline at rest, moving to Hairline Strong on hover — the card's only hover signal.
- **Internal Padding:** 17px × 19px for guide cards; 11px × 14px for checklist items; 14px × 18px for callouts. The whole card is a click target, with the title turning Reference Blue on hover.

### Inputs / Fields
- **Style:** Sheet ground, 1px Hairline, 7px radius, 11px × 15px padding. The search field reserves 39px of left padding for an inline SVG magnifier drawn as a masked shape tinted Graphite.
- **Focus:** the 1px border moves to Reference Blue with the outline suppressed in favor of a visible border shift; the shared focus ring applies to keyboard focus.
- **Error / Disabled:** no field in the product validates, so `disabled` (pager arrows at ~40% opacity) is the only non-default state.

### Navigation
- **Topbar:** a solid Sheet panel with a 1px Hairline bottom border, pinned to the top. On the guide page it carries the Home link, the guide title, the theme toggle, and a 2px reading-progress rule that scales from the left in Reference Blue. On the dashboard it carries the brand lockup (name over a one-line description) and the theme toggle.
- **Contents rail:** sticky, grouped under uppercase Label heads, with 7px-radius rows. Sub-items indent and step down to 12.5px. Hover tints the row Wash and lifts text to Ink; the active section takes a 2px Reference Blue left edge, Blue Wash ground, and 600 weight. The rail becomes a horizontal strip above the article below 960px.

### Checklist Item (signature)
The product's signature component. A rendered `- [ ]` item becomes a Sheet card with a 1px hairline, a native checkbox tinted with `accent-color: var(--accent)`, and its label text re-wrapped beside it. Completed state flips the ground to Wash and strikes and mutes the label. State persists per guide in `localStorage`, so the manual remembers where the reader stopped.

### Code Block (signature)
A recessed Code Field panel with a 1px hairline, 10px radius, horizontal scroll, and a floating copy button (Sheet ground, 1px hairline, 7px radius) in the top-right. The button swaps to a check glyph and Verified Green for ~1.4s on success, then returns. Inline code shares the Code Field / Code Ink pair at 5px radius.

## Do's and Don'ts

### Do:
- **Do** use Reference Blue only for live, interactive, or current state; keep it under ~10% of any screen (The One Accent Rule).
- **Do** build separation from 1px hairlines and one-step tone shifts, moving Hairline → Hairline Strong for emphasis (The Hairline Rule).
- **Do** pull every value from the tokens in `build/assets/base.css`; a page file adds only its own surface rules and never re-declares a shared token.
- **Do** theme the browser surfaces from the palette — selection, caret, scrollbars, focus ring, and tabular numerals are part of the design.
- **Do** hold prose to 65–75ch and let the reading column own its generous padding.
- **Do** author icons as inline SVG at 16px with a consistent 2px round stroke.
- **Do** keep light and dark themes symmetrical: every token has a dark counterpart that holds contrast.

### Don't:
- **Don't** add `box-shadow`, `backdrop-filter`, or blur — depth is hairlines and panel tones (The Flat-By-Default Rule).
- **Don't** introduce a second accent hue; Blue Wash is a tint of Reference Blue, not a new color (The One Accent Rule).
- **Don't** use green outside confirmed success (The Verified Rule).
- **Don't** use emoji or an icon font; icons are authored SVG.
- **Don't** add entrance animation or stagger; motion is state transitions and the reading-progress rule only, all disabled under `prefers-reduced-motion`.
- **Don't** place a kicker or eyebrow above a heading (The No-Kicker Rule).
- **Don't** gray out secondary text on an accent-colored surface; tint it from the surface's own hue or use the foreground.
- **Don't** hand-edit generated output — `index.html`, `guides/`, and `assets/` are rebuilt on every build.
