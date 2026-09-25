# The Complete Guide: Chrome Extensions Worth Re-Adding in 2026

> Chrome just finished killing Manifest V2 — the Web Store purge landed in August. Here is what actually survived, what a sane loadout looks like, how to audit a new one before you trust it, and how to set up the two you'll actually use daily.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

The question "which Chrome extensions should I re-add?" has a precondition most lists skip: **the extension platform just went through its biggest change in a decade, and the dust settled in 2026.** Manifest V2 is gone. That matters because a lot of the extensions people remember fondly — and a lot of the "best extensions" lists you'll find — quietly stopped working a year ago.

So this guide has two halves. First, **what's true now**: which extensions survived the MV3 transition, and how the platform changed under them. Second, **the loadout and the discipline**: a small set that each earn their place, a pre-install audit you can run in two minutes, and a setup pass on the two that reward actually learning them.

```
   THE TWO FAILURE MODES OF A BROWSER EXTENSION SETUP

   1. TOO MANY                         2. TOO TRUSTING
   ┌──────────────────────┐            ┌──────────────────────┐
   │ 23 extensions        │            │ installed on vibes   │
   │ 4 do the same thing  │            │ never re-checked     │
   │ never used 11 of them│            │ no idea what it reads│
   │ toolbar is a junk    │            │ ownership changed?   │
   │ drawer               │            │ who knows            │
   └──────────────────────┘            └──────────────────────┘
        ↓                                    ↓
   slow, noisy, unreadable            your browsing data is
                                      someone's business model

   THE FIX, BOTH WAYS: A SMALL CURATED SET, EACH AUDITED ONCE
```

The single most important idea: **the reliable safety test is a mismatch test.** Compare what an extension asks for against what it says it does. If a screenshot tool wants to "read and change all your data on all websites," the mismatch *is* the answer. You do not need to be a security researcher to run that check.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Manifest V3** | The current plugin standard | V2 extensions no longer run at all |
| **Service worker** | A background assistant who only shows up when needed | Replaced the always-on background page |
| **`declarativeNetRequest`** | Handing Chrome a rulebook instead of a wiretap | Replaced blocking `webRequest`; better privacy, less power |
| **Host permission** | Which sites the extension can read | The `<all_urls>` grant is the big red flag |
| **`permissions` vs `optional_permissions`** | Ask up front vs ask when needed | Optional is the respectful design |
| **Content script** | Code injected into the page you're viewing | See which sites it runs on before installing |
| **CRX file** | The extension as a readable ZIP | You can inspect the source without installing |
| **Single purpose** | One job, clearly stated | Chrome's policy requires it, and it's your audit yardstick |
| **Trader status** | Whether the publisher is a verified business | A trust signal on the store listing |
| **Ownership change** | The extension changed hands | The most underrated red flag |
| **Web clipper** | A page-shaped net for your notes vault | Turns the web into Markdown you own |

> **The one-sentence version:** the MV2 purge left a smaller, more trustworthy extension landscape — so pick six to eight that each do one job, run the mismatch test before you install, and set up the two you'll use daily properly.

---

## The 60-Second Version (TL;DR)

1. **Manifest V2 is dead.** No MV2 extension has run on stable Chrome since Chrome 138 (July 2025). Chrome 151 (28 July 2026) removed the last developer flags, and on **31 August 2026 Google removed all remaining MV2 listings from the Web Store**.
2. **If an extension still works in your Chrome today, it is already MV3.** Nothing changes for it. If one you relied on broke in 2024–2025, it was MV2-only and its replacement is what you want.
3. **Aim for 6–8 extensions; 12 is a hard ceiling.** Give each one job and stop.
4. **Run the mismatch test before installing.** Permissions requested vs what it claims to do. Read the install prompt instead of clicking through it.
5. **The big red flag is `<all_urls>`.** "Read and change all your data on all websites" for an extension whose job doesn't need it.
6. **MV3 killed remote code.** Everything now ships inside the package and is subject to store review — that's a real security improvement.
7. **`declarativeNetRequest` replaced blocking `webRequest`.** A content blocker is now a rulebook, not an interceptor. This is the change that ended full uBlock Origin on Chrome.
8. **You can read any extension's source without installing it.** Grab the ID from the store URL, unpack it in a CRX viewer, read `manifest.json` first.
9. **Re-audit on updates, not just at install.** A permission bump or an ownership change is the moment to look again.
10. **Two are worth actually learning:** React DevTools (if you ship React) and a web clipper (if you take notes). Everything else is install-and-forget.

If you read nothing else, read **Part 3 (the audit)** and **Part 4 (the loadout)**.

---

## Prerequisites

- Chrome up to date. Several behaviours here depend on recent versions.
- Five minutes for the audit, once, per extension.
- A note-taking target, if you want the clipper half of this guide to land: Obsidian, Notion, or plain Markdown files.

> **Before you start:** open `chrome://extensions/` and look at what you have. The most useful thing you'll do today is probably delete something.

---

## Part 1 — What Actually Changed: Manifest V3, Settled

### 1.1 The timeline, because it explains the confusion

| Date | What happened |
|---|---|
| Chrome 88+ | MV3 supported |
| Chrome 138 (July 2025) | MV2 framework disabled on the stable channel — MV2 extensions stop running |
| Chrome 151 (28 July 2026) | Last developer flags removed from Chromium; no mechanism to run MV2 anywhere on stable |
| **31 August 2026** | **All remaining MV2 extensions removed from the Chrome Web Store** |

Extensions already installed before the cut-over may still linger in a profile and no longer receive updates — and they cannot be reinstalled once delisted.

> **The practical filter:** if it works in your Chrome right now, it's MV3. If it broke a year ago, it was MV2 and it is not coming back. Install the successor rather than hunting for a workaround.

### 1.2 The four changes that reshaped the ecosystem

MV3 was not a version bump. It rewrote four parts of the model, and each one broke a category of extension behaviour.

| Capability | Manifest V2 | Manifest V3 | Consequence |
|---|---|---|---|
| **Background execution** | Persistent background page, always running | Ephemeral service worker Chrome can terminate | Extensions must survive being shut down; some state patterns broke |
| **Network blocking** | Blocking `webRequest`, runtime interception | `declarativeNetRequest` — static rules Chrome evaluates | Blockers became rule-sets; the change that ended full uBlock Origin on Chrome |
| **Request/response inspection** | Full read and modify in real time | URL-pattern matching; no response-body modification | Some ad-tech and debugging extensions lost capability |
| **Remote-hosted code** | Allowed: fetch and run external JS | **Banned** — all code ships in the package | A genuine security win; store review now covers everything that executes |
| **Host permissions** | Broad, granted at install | More granular, more user-controllable | Better user control; more prompts |

The one to internalise is the remote-code ban. Under MV2, an extension could fetch and execute JavaScript from a server after you installed it — which meant the code that ran was not necessarily the code that was reviewed. Under MV3, **what was reviewed is what runs.** That is the reason the MV2 purge is, on balance, a good thing for you.

### 1.3 What Chrome recommends developers do (it's your audit checklist too)

Chrome's own privacy guidance is unusually direct, and it doubles as the criteria you should hold extensions to:

- **Only the APIs an extension depends on should be listed**; consider less invasive options.
- **Don't "future proof" access.** Extensions should not request permissions they don't currently need but might use later.
- **Make non-essential features optional** via `optional_permissions`, so users can choose.
- **The less data an extension can access, the less it can leak** if compromised.
- **Extension storage is not encrypted.** Sensitive data shouldn't live client-side.
- **Respect incognito.** Incognito promises no tracks; an extension that saves history shouldn't save incognito history.

> **Use that as your yardstick.** When an extension's permission list contains things the guidance says it shouldn't need, that's not you being paranoid. That's the vendor's own platform guidance being ignored.

---

## Part 2 — What Survived, and What to Re-Add

The MV2 transition split the field. Broadly: anything that needed to *intercept and modify network traffic at runtime* took the hardest hit; anything that *inspects* or *injects a UI* sailed through.

### 2.1 The categories that came through fine

| Category | Why it survived |
|---|---|
| Framework DevTools (React, Vue, Apollo, Redux) | They read from the page's JS context; no network interception |
| Accessibility scanners (axe) | They read the rendered DOM |
| Tech-stack fingerprinters (Wappalyzer) | They read page metadata and headers already exposed |
| JSON formatters | They re-render a response body they're given |
| GitHub enhancement tools (Refined GitHub) | They inject UI into a page you're already on |
| Web clippers | They read the current page and write to a local API or a vendor API |
| React/Vue/Redux DevTools | Same as above |

### 2.2 The categories that got worse or died

| Category | What happened |
|---|---|
| Full content blockers | The blocking `webRequest` path is gone; `declarativeNetRequest` is less powerful by design |
| Response-body inspection tools | No response-body modification under MV3 |
| Anything relying on remote config/code | Remote code is banned outright |
| Long-lived background monitors | Service workers can be terminated at any time |

This is why some "best extensions" lists still recommend dead tools. If an extension's whole value proposition was intercepting network traffic in real time, verify it exists before you install it.

---

## Part 3 — The Audit: Two Minutes, Every Time

This is the part that earns the guide. Run it before installing anything new, and re-run it on updates.

### 3.1 The mismatch test (the one that matters)

**Line up the permission list against the one-sentence description of what the extension does.** The gap is where hidden behaviour lives.

- A screenshot tool asking to read and change data on **all** websites → mismatch.
- A colour picker with `<all_urls>` → mismatch.
- A DevTools panel scoped to localhost → fine.
- A GitHub enhancer with host access to `github.com` only → proportionate.

You are not looking for a specific permission. You are looking for **a permission the stated job does not need.**

### 3.2 The seven-point check

Run these in order. Most bad extensions fail at the first or second.

| # | Check | How |
|---|---|---|
| 1 | **Permissions match the stated function** | Read the install prompt, don't click past it |
| 2 | **Host access is no broader than the job needs** | `<all_urls>` for a single-site tool is the classic red flag |
| 3 | **It's Manifest V3, not abandoned V2** | It works today ⇒ it's MV3 |
| 4 | **Source reads clean** | Unpack the CRX and read `manifest.json`, then grep the JS |
| 5 | **No recent unexplained ownership change or permission bump** | Check the store listing's update history |
| 6 | **Reviews look organic** | Freshly clustered five-star reviews are astroturfing |
| 7 | **The developer has a verifiable public identity** | A real company, a real repo, a "Trader" listing |

### 3.3 How to read the source without installing

A packaged extension is a CRX file, which is a ZIP holding the manifest and every line of source. You can read it before installing anything.

1. **Grab the extension ID** — the long string in the Web Store URL, right after `/detail/name/`.
2. **Open it in a viewer** — a CRX viewer (CRXcavator, CRXPlorer, or Rob Wu's open-source crxviewer) fetches and unpacks it in the browser. Offline, download the CRX and `unzip` it.
3. **Read `manifest.json` first.** `permissions`, `host_permissions`, `content_scripts` and their match patterns, and the background service worker. This is the ground truth the marketing copy sits on top of.
4. **Grep the JavaScript for two patterns:**

```bash
# find every outbound request
rg -n "fetch\(|XMLHttpRequest" .

# then check the destinations
rg -n "https?://[a-z0-9.-]+" . | sort -u
```

A legitimate tool talks to its own API or the service it integrates. Requests to unfamiliar domains, **especially next to code that reads `document.body` or scrapes page text**, is the exfiltration pattern worth walking away from.

### 3.4 What a clean manifest looks like

```json
{
  "manifest_version": 3,
  "name": "Example DevTool",
  "version": "1.2.0",
  "description": "Formats JSON responses in a readable tree.",
  "permissions": ["storage"],
  "optional_permissions": ["clipboardWrite"],
  "host_permissions": [],
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "service-worker.js" }
}
```

Read it and notice: **`permissions` is short, `optional_permissions` exists, and `host_permissions` is empty** because the tool works on a response the user hands it rather than on every page you visit.

Compare that to what a suspicious listing looks like:

```json
{
  "manifest_version": 3,
  "permissions": ["tabs", "history", "cookies", "webRequest", "scripting"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["inject.js"] }]
}
```

That combination — full browsing history, cookies, script injection, and every site — on a tool that claims to do one small thing, is not a tool. It is a data collection operation with a UI.

> **Nuance worth having:** some legitimate extensions genuinely need broad access. A password manager needs to fill forms on any site you visit. The question is never "is this permission bad?" — it's "does *this specific job* require it, and is the vendor's explanation consistent with the request?"

### 3.5 Automating the recurring part

You can build the static half into a review step: compare the packaged manifest against a reviewed permission baseline, and fail when a new permission appears. That's the pattern QA teams use, and for a solo developer a simpler version works — **before you accept an extension update, look at what changed.** Chrome shows permission changes on the update, and a version bump that adds a permission is the moment to re-read the manifest.

---

## Part 4 — The Loadout

Six to eight extensions, one job each. Here's a defensible set, grouped by what it buys you.

### 4.1 Debugging

| Extension | Job | Notes |
|---|---|---|
| **React Developer Tools** | Inspect React component trees, props, state, hooks | Maintained by the React team; published under `extensions@fb.com`; version 8.0.0 as of September 2026; open source at `github.com/facebook/react` |
| **Vue DevTools** | Same, for Vue 3 | Only if you ship Vue |
| **Redux DevTools** | Time-travel state debugging | Only if you use Redux |
| **Apollo Client DevTools** | Inspect the GraphQL cache | Only if you ship GraphQL |

### 4.2 Inspection

| Extension | Job | Notes |
|---|---|---|
| **axe DevTools** | Automated WCAG scanning | Deque Systems; free tier scans page-by-page using axe-core; covers WCAG 2.0/2.1/2.2 at A/AA/AAA, plus Section 508 and EN 301 549; version 4.137.0 as of September 2026 |
| **Wappalyzer** | Identify the tech stack of any site | Useful for competitive research and for spotting a library you're behind on |
| **JSON Viewer** | Read API responses as a tree | The single most-installed inspection tool for a reason |
| **A responsive viewer** | See multiple viewports side by side | Better than resizing the window by hand |
| **ColorZilla** | Eyedrop any colour on a page | Pairs with a token system |

### 4.3 GitHub and productivity

| Extension | Job | Notes |
|---|---|---|
| **Refined GitHub** | Fixes and adds hundreds of small GitHub behaviours | High value if you live in GitHub |
| **Octotree / Gitako** | A file tree for GitHub repositories | Gitako is the free alternative |

### 4.4 The honest note on AI-assistant extensions

An AI side-panel extension is the category most likely to want `<all_urls>` — because to "help with what you're reading," it must read what you're reading. That is a legitimate reason for the permission and still a real decision about your browsing data.

**If you use one:** prefer one from a vendor you already have a relationship with, scope what you can, and understand that "summarise this page" and "read every page" are the same permission.

### 4.5 What I would leave out

- **Anything you installed for one article.** If you haven't opened it in a month, it's cargo.
- **A second tool in a category you already have.** Two JSON viewers is one JSON viewer plus noise.
- **Extensions that only exist to work around a site you rarely visit.** Bookmark the workaround instead.
- **Anything whose job is "make the web faster" from inside the browser.** The MV3 constraints make most of them a rule-book you could get more cheaply.

---

## Part 5 — Setting Up the Two That Reward It

Most extensions you install and forget. Two repay actual learning.

### 5.1 React DevTools, properly

It adds two panels to Chrome DevTools: **Components** and **Profiler**. The components panel shows the rendered tree; selecting a component lets you inspect and edit its props and state on the right. Selecting an element in the ordinary **Elements** panel and switching to the React tab auto-selects it in the React tree. The Profiler records render timing.

The workflow that makes it worth having:

1. **Find the re-render first, then fix it.** Open **Profiler**, hit record, interact, stop. Look for the component that rendered far more than the interaction deserved. The fix is usually a moved state boundary or a stabilised prop — and you can *see* which before you guess at memoisation.
2. **Use the breadcrumbs to find the owner.** When a component behaves unexpectedly, the breadcrumbs tell you which parent created it. That's faster than grepping for the component name.
3. **Edit props and state live.** Test a hypothesis about a state value without waiting for a hot reload.
4. **In 2026 it also helps with server components.** Recent versions expose server component boundaries and indicate which components the React Compiler optimised — directly relevant if you took the Next.js upgrade in Paper 13.

> **Pair it with the React Compiler.** If you enabled `reactCompiler: true`, the Profiler tells you whether renders actually dropped. "I turned on automatic memoisation" and "renders went down" are different claims, and only the second one is evidence.

### 5.2 A web clipper, properly

This is the extension that turns browsing into notes. The three credible options do different things, so pick by the *destination*, not the feature list.

| Clipper | Best for | Where notes go | Trade-off |
|---|---|---|---|
| **Obsidian Web Clipper** | Highlights as files you own | Local Markdown in your vault | You maintain templates, tags, and plugins |
| **Notion Web Clipper** | A clip that becomes an editable, shareable page | A Notion page or database | You still file every clip; it won't take the note for you |
| **Evernote Web Clipper** | The fullest capture UI — markup, screenshots, full page | An Evernote notebook | Search, not chat; strong capture, weaker recall |

Given the shelf this guide lives on — Markdown source files in a git repo — **Obsidian Web Clipper is the natural fit**, and it's the one whose value is *control*: templates, YAML frontmatter, and files on disk rather than in a service.

The setup that makes it worth it:

1. **Make one template with frontmatter.** The point of clipping into Markdown is that each note carries structured metadata you can query later.

```markdown
---
title: "{{title}}"
url: "{{url}}"
clipped: 2026-09-24
tags: [clipped]
---

{{content}}
```

2. **Clip the selection, not the page.** A full page of navigation and cookie banners is not a note. Highlight the argument and clip that. `Alt+H`-style highlight shortcuts exist in several clippers precisely because this is the right default.
3. **Have a destination convention.** One folder (`clips/`) or one tag, decided in advance. A clipper with no destination convention produces an inbox you'll never process.
4. **Return to it.** Highlights are meant to be re-visible when you revisit the page. That only helps if you revisit pages — which is a reading habit, not an extension feature.

> **The failure mode of every clipper is the same:** you clip twenty articles, never reopen them, and now have a folder of unsorted fragments. If you're not going to process them, clip less and read more.

### 5.3 Keyboard-first, for whichever you choose

The extensions that stick are the ones with a shortcut. Chrome's extension shortcuts live at `chrome://extensions/shortcuts`. Set one for your clipper, and one for the DevTools panel you use most. A tool you must click is a tool you'll stop using.

---

## Part 6 — Maintenance: The Routine

A loadout drifts. Four habits keep it honest.

1. **Quarterly, look at `chrome://extensions/`.** For each entry: did I use it this quarter? If no, remove. Unused extensions still hold permissions.
2. **Re-audit on update.** A version bump that adds a permission or changes the publisher is the signal to re-read the manifest.
3. **Watch for ownership changes.** An extension that changes hands can change purpose. This is the most underrated red flag and the hardest to notice.
4. **Keep the count under twelve.** The hard ceiling is about attention, not performance. At some point you stop knowing what's running.

> **A useful default:** when an extension asks for a new permission, decline the update until you've read what changed. Chrome makes this visible; most people accept it reflexively.

---

## Cheat Sheet

```text
# where things live
chrome://extensions/            manage, enable, remove
chrome://extensions/shortcuts  keyboard bindings
chrome://extensions/?id=<id>    one extension's detail page

# the audit, in order
1. permissions match stated function?
2. host access proportionate?          ← <all_urls> is the red flag
3. Manifest V3?
4. source reads clean?
5. no recent ownership change / permission bump?
6. reviews organic?
7. developer has a real identity?
```

```bash
# read an extension's source without installing it
# 1. copy the ID from the store URL: /detail/<name>/<THIS_PART>
# 2. paste it into a CRX viewer, or download the .crx and:
unzip -o extension.crx -d extension_src

# 3. read the ground truth first
cat extension_src/manifest.json

# 4. find outbound requests, then check destinations
cd extension_src && rg -n "fetch\(|XMLHttpRequest" .
rg -n "https?://[a-z0-9.-]+" . | sort -u
```

| Verdict | When |
|---|---|
| Install | Permissions proportionate, MV3, clear publisher, used weekly |
| Install with care | Broad access that the job genuinely requires (a password manager, an AI panel) |
| Skip | `<all_urls>` with no justification, or an unexplained permission bump |
| Remove | Not used this quarter, or superseded by a second tool in the same category |

| Extension (examples) | Category | Chrome Web Store ID |
|---|---|---|
| React Developer Tools | Debugging | `fmkadmapgofadopljbjfkapdkoienihi` |
| axe DevTools | Accessibility | `lhdoppojpmngadmnindnejefpokejbdd` |
| Obsidian Web Clipper | Clipping | `cnjifjpddelmedmihgijeibhnjfabmlf` |
| CleanClip (Obsidian + Notion) | Clipping | `bjeojcigcghldgefibjlamipibnfalha` |
| Kliplet (multi-target) | Clipping | `japclepfabgfnmfbekominhnfjghenlm` |

> **Verify IDs on the store before installing.** An extension ID is stable once published, but a listing can be renamed or re-published. Always confirm on `chromewebstore.google.com` rather than trusting an ID from any article, including this one.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| An extension stopped working a year ago | It was Manifest V2 | Install the MV3 successor; V2 cannot run on stable Chrome |
| Can't find it in the Web Store anymore | MV2 listings were removed on 31 August 2026 | Look for a successor; it will not be reinstalled |
| Extension asks for a new permission after update | Version bump added capability | Read the manifest diff before accepting |
| A content blocker is weaker than it used to be | `declarativeNetRequest` replaced blocking `webRequest` | Expected under MV3; rule-books are less capable than interception |
| Toolbar is crowded | More than 8–12 extensions | Remove; check usage over the last quarter |
| A clipper saves junk | Clipping the full page | Clip selections instead; set a destination convention |
| Clips pile up unread | No processing habit | Clip less, read more; the clipper is not the problem |
| DevTools panel is missing | Extension disabled, or the page predates injection | Reload the page; check `chrome://extensions/` |
| Suspicious behaviour after an update | Ownership change or permission bump | Uninstall, then re-audit before reinstalling |

---

## Video Library

YouTube **search** links only — extension listings and versions change constantly.

| Search | What you'll find |
|---|---|
| [Chrome extensions for developers 2026](https://www.youtube.com/results?search_query=Chrome+extensions+for+developers+2026) | Current loadouts |
| [Manifest V3 explained](https://www.youtube.com/results?search_query=Manifest+V3+explained) | The platform change |
| [Chrome extension security audit](https://www.youtube.com/results?search_query=Chrome+extension+security+audit) | Reading a manifest |
| [React DevTools profiler tutorial](https://www.youtube.com/results?search_query=React+DevTools+profiler+tutorial) | Finding re-renders |
| [axe DevTools accessibility scan](https://www.youtube.com/results?search_query=axe+DevTools+accessibility+scan) | Running and interpreting a scan |
| [Obsidian web clipper tutorial](https://www.youtube.com/results?search_query=Obsidian+web+clipper+tutorial) | Templates and highlights |
| [Notion web clipper tutorial](https://www.youtube.com/results?search_query=Notion+web+clipper+tutorial) | Clipping into databases |
| [Chrome DevTools tips](https://www.youtube.com/results?search_query=Chrome+DevTools+tips+2026) | Panels worth learning |
| [browser extension permissions privacy](https://www.youtube.com/results?search_query=browser+extension+permissions+privacy) | What permissions actually grant |

---

## Written References & Docs

Chrome for Developers first — it is the authority on the platform and on privacy expectations.

| Source | URL |
|---|---|
| Chrome — Manifest V3 overview | `https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3` |
| Chrome — migrate to Manifest V3 | `https://developer.chrome.com/docs/extensions/develop/migrate` |
| Chrome — what's new in extensions | `https://developer.chrome.com/docs/extensions/whats-new` |
| Chrome — protect user privacy | `https://developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy` |
| Chrome — extension security guidance | `https://developer.chrome.com/docs/extensions/develop/security-privacy` |
| Chrome Web Store | `https://chromewebstore.google.com/` |
| Deque — axe DevTools extension | `https://www.deque.com/axe/devtools/extension/` |
| React DevTools source | `https://github.com/facebook/react/tree/main/packages/react-devtools-extensions` |
| Obsidian Web Clipper source | `https://github.com/obsidianmd/obsidian-clipper` |
| Obsidian — Web Clipper | `https://obsidian.md` |
| Notion — Web Clipper help | `https://www.notion.com/help/web-clipper` |
| crxviewer (open source) | `https://github.com/Rob--W/crxviewer` |
| MV3 migration guide (Google) | `https://developer.chrome.com/docs/extensions/develop/migrate` |

**Third-party, for context only — verify versions and IDs on the store first:**

| Source | Why |
|---|---|
| Extension security checklists (community) | The seven-point audit framing |
| QA privacy-audit methodology write-ups | A repeatable evidence trail for extension reviews |
| "Best extensions" round-ups | Discovery only; they mix live and dead tools |

> **Verification tip:** never install from an ID in an article. Search the name on `chromewebstore.google.com`, confirm the publisher, and read the permission prompt. Version numbers age within weeks; the audit method does not.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Manifest | The `manifest.json` describing an extension's permissions and entry points |
| Manifest V3 | The current extension platform; V2 no longer runs |
| Service worker | MV3's background context; Chrome may terminate it |
| `declarativeNetRequest` | The MV3 API for blocking/modifying requests via static rules |
| `webRequest` (blocking) | The deprecated MV2 API for real-time request interception |
| Host permission | Which sites an extension can access |
| `<all_urls>` | The permission to read and change data on every site |
| `optional_permissions` | Permissions requested only when a feature is used |
| Content script | Code an extension injects into a page |
| CRX | The packaged extension; a ZIP you can read |
| Single purpose | The requirement that an extension do one clearly stated thing |
| Remote code | Code fetched at runtime; banned under MV3 |
| Traders | Publishers verified as businesses on the store |
| Exfiltration pattern | Reading page content and posting it to an unfamiliar domain |
| Ownership change | An extension changing hands; a re-audit trigger |
| Web clipper | An extension that saves page content into a notes destination |
| Frontmatter | YAML metadata at the top of a Markdown file |

---

## FAQ & Next Steps

**Did my extensions break in 2026?** Only if they were Manifest V2. Nothing changed for MV3 extensions. The August 2026 event was a Web Store cleanup, not a runtime change.

**Is MV3 bad for users?** It has a real cost for content blockers, because `declarativeNetRequest` is less powerful than blocking `webRequest` by design. But it removed remotely hosted code, which means the code that runs is the code that was reviewed. Net, it is better for most people and worse for one category.

**What's the single fastest safety check?** The mismatch test. Read the install prompt. A permission the stated job doesn't need is the signal.

**How many extensions is too many?** Eight is a good target, twelve a hard ceiling. The limit is attention, not performance.

**Can I inspect an extension before installing?** Yes. It's a ZIP. Unpack it, read `manifest.json`, grep the JavaScript for outbound requests.

**Which clipper should I use?** Pick by destination. Obsidian if you want Markdown files you own; Notion if the clip should become an editable, shareable page; Evernote if you want the fullest capture UI.

**Is React DevTools worth learning?** If you ship React, it's the one extension where the learning pays back weekly. Profiler-first re-render hunting is the habit.

**What about AI side-panel extensions?** They're legitimate and they usually need broad access, because reading the page is the feature. Treat the permission as a real decision, not a footnote.

**When should I remove something?** If you haven't used it this quarter. Unused extensions still hold permissions.

### Next steps, in order

1. **Today:** open `chrome://extensions/` and remove anything you haven't used in a month.
2. **This week:** audit what's left with the seven-point check. Remove anything that fails.
3. **Next week:** install at most three from Part 4 — one debug, one inspect, one productivity.
4. **Week 3:** set up your clipper with a template and a destination convention. Clip one selection, not one page.
5. **Week 4:** learn the Profiler if you ship React. Find one real re-render.
6. **Quarterly:** repeat step 1 and re-audit on updates.

---

## Verification Note

**Verified as of September 2026 from Chrome for Developers and store listings:**

- **Manifest V3 platform changes:** service workers replace persistent background pages; remote-hosted code is banned; blocking `webRequest` deprecated in favour of `declarativeNetRequest`; host permissions made more granular; `optional_permissions` and `optional_host_permissions` supported; `storage.local` quota increased to approximately 10 MB; offscreen documents available; `chrome.alarms` minimum granularity reduced to 30 seconds in Chrome 120 (`developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3`, `…/whats-new`).
- **Manifest V2 timeline:** MV2 no longer runs on stable Chrome since Chrome 138 (July 2025); Chrome 151 (28 July 2026) removed the last developer flags; **all remaining MV2 extensions removed from the Chrome Web Store on 31 August 2026** (Chrome's support timeline as reported by third-party trackers; the store-removal date is consistent across sources).
- **Privacy expectations Chrome states for developers:** only request needed APIs, avoid future-proofing access, make non-essential features optional, treat extension storage as unencrypted, respect incognito (`developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy`).
- **axe DevTools:** Deque Systems; free tier runs page-by-page automated testing on axe-core; covers WCAG 2.0/2.1/2.2 at A/AA/AAA plus Section 508 and EN 301 549; version 4.137.0, updated 23 September 2026 (`chromewebstore.google.com`, `deque.com/axe/devtools/extension/`).
- **React Developer Tools:** adds Components and Profiler panels; maintained and published by the React team; requires page React-tree access and does **not** transmit data remotely; open source at `github.com/facebook/react`; version 8.0.0, updated 11 September 2026 (`chromewebstore.google.com`).
- **Obsidian Web Clipper:** official Obsidian extension; saves and highlights pages into a vault as Markdown; open source at `github.com/obsidianmd/obsidian-clipper`; version 1.7.1, updated 22 July 2026.
- **Notion Web Clipper:** browser extension for Chrome and Safari; clips into a workspace page or database (`notion.com/help/web-clipper`).

**Third-party claims, not independently verified:** the extension round-up lists that informed Part 4's categories; user-count figures; the specific audit-checklist phrasing; and the MV2 tracking dates. Where a version number appears above, it came from the store listing, which is the closest thing to primary for an extension's current release.

**Changes fast:** every extension version in this guide; store listings, publishers, and ownership; and the set of MV3 successors. Re-check on the store before installing. The audit method in Part 3 is the durable part; the loadout is a snapshot.

**Not security advice.** The seven-point check reduces risk; it does not eliminate it. An extension you grant page access to can read what you read. If you handle regulated data in a browser, treat extensions as part of your threat model rather than a productivity footnote.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd run a browser for this kind of work.**

| In my workspace | Verdict |
|---|---|
| Chrome for development and research | Keep it lean; a crowded toolbar is a slow brain |
| A static site and a Next.js app | React DevTools + axe DevTools + a JSON viewer cover most of it |
| Markdown notes in a repo | Obsidian Web Clipper, templates with frontmatter |
| opencode doing the coding | The browser is for inspecting what it built, not for coding |
| No extension audit habit | Do it once; then it's a quarterly five-minute chore |

**Recommended setup:**

- **A profile split.** A development profile with your tools, and a clean profile for anything sensitive — banking, admin consoles, email. Extensions are per-profile, which makes this free.
- **Eight extensions, one job each.** React DevTools, axe DevTools, a JSON viewer, a responsive viewer, Wappalyzer, Refined GitHub, one clipper, and your password manager. That's the set.
- **`chrome://extensions/shortcuts` is the difference between installing and using.** Bind your clipper and one DebugTool panel.
- **Set the clipper's destination before you clip anything.** One folder, one tag. Otherwise you build an unread inbox.
- **What I would not do:** install an extension to solve a problem you can solve with a DevTools panel you already have; keep an extension you can't remember opening; or accept a permission bump without reading it.

**Smoke test for the first session, in order:**

```text
1. chrome://extensions/            → remove anything unused in a month
2. audit each survivor (7 checks)  → remove the failures
3. install at most three           → one debug, one inspect, one productive
4. chrome://extensions/shortcuts   → bind two
5. clip one selection              → confirm it lands where you meant
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js app, uses opencode and AI coding agents daily, takes
notes in Markdown, and learns by doing.

Paper: markdown_docs/16-chrome-extensions-2026.md
Topic: Chrome extensions worth re-adding in 2026 — what survived the Manifest V2 purge, a small
audited loadout, and setup for the two that reward learning.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words; (B) add a Part on a topic he names
(a second browser profile strategy, Firefox extensions and where it differs, building your own
MV3 extension, DevTools panels you should learn instead of installing extensions, extension
testing in CI); (C) audit his actual installed extensions if he lists them, applying the
seven-point check and returning a verdict per extension.

Rules: never invent extension IDs, version numbers, store URLs, or publishers. Never present
a round-up list as authoritative — verify each extension on chromewebstore.google.com and note
its current version. Label third-party audits and checklists as third-party. Distinguish
Chrome's own documentation from community advice. Keep the structure. Report path, one-line
summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
https://developer.chrome.com/docs/extensions/develop/security-privacy/user-privacy
https://developer.chrome.com/docs/extensions/whats-new
https://chromewebstore.google.com/
https://www.deque.com/axe/devtools/extension/
https://github.com/obsidianmd/obsidian-clipper
```
