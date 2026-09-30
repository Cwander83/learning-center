# The Complete Guide: Zed, the Editor That Made Me Stop Missing VS Code

> Zed is not "VS Code, slightly faster." It is an editor built like a video game instead of a web page — and that single decision changes how it feels, how it handles AI, and why the switch sticks.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

The thing to understand about Zed before anything else: it shares no plumbing with VS Code. VS Code is a web app in a Chromium window — your keystroke goes through a DOM, a layout engine, and a JavaScript runtime before anything appears. Zed threw all of that out and wrote its own UI framework, **GPUI**, in Rust. Every frame is drawn by the GPU, the way a game engine draws a scene.

```text
        ELECTRON EDITOR (VS Code, Cursor, Windsurf)          ZED
        ┌───────────────────────────────┐                   ┌───────────────────────────────┐
        │  your code                    │                   │  your code                    │
        │  ─────────────────────────    │                   │  ─────────────────────────    │
        │  HTML + CSS + DOM             │                   │  GPUI  (custom, in Rust)      │
        │  layout engine                │                   │  typed scene primitives       │
        │  JavaScript runtime           │                   │        ↓                      │
        │  Chromium compositor          │                   │  shaders → Metal / DX / Vulkan│
        │  ─────────────────────────    │                   │  ─────────────────────────    │
        │  OS window                    │                   │  OS window                    │
        └───────────────────────────────┘                   └───────────────────────────────┘
           ~1.3 s cold start                                    ~0.5 s cold start
           ~25 ms keystroke latency                             ~2 ms keystroke latency
           gigabytes of RAM                                     low hundreds of MB
           AI output renders through a DOM                      AI output streams straight to GPU
```

That last row is not a footnote. It is the reason AI-assisted editing *feels* different in Zed: when a model streams tokens into a panel, there is no browser layer between the model and the pixels.

Four ideas carry the rest of this guide:

1. **Native and Rust, not Electron.** Faster startup, lower memory, keystroke latency measured in single-digit milliseconds.
2. **Tree-sitter at the core.** Incremental parsing means syntax highlighting, navigation, and syntax-aware selection stay fast on huge files.
3. **Everything is a multibuffer.** Search results, diagnostics, and references are not lists — they are editable buffers that open multiple files at once.
4. **AI is three separate systems, not one button.** Zed Agent, External Agents (via ACP), and Terminal Threads are distinct paths with distinct billing. Section 4 is the one to read twice.

| Term | Plain-English meaning |
|---|---|
| GPUI | Zed's own GPU-accelerated UI framework, written in Rust |
| Tree-sitter | Incremental parser that powers syntax, selection, and navigation |
| Multibuffer | One editable buffer containing excerpts from many files |
| LSP | Language Server Protocol — how the editor gets completions, diagnostics, refactors |
| ACP | Agent Client Protocol — how third-party AI agents plug into Zed |
| External Agent | An AI agent (Claude, Codex, OpenCode…) running inside Zed over ACP |
| Terminal Thread | A CLI/TUI agent (like `claude`) run in a Zed terminal, organized as a thread |
| Edit prediction | Zed's inline "next edit" suggestion, accepted with Tab |
| DeltaDB | Zed's upcoming CRDT-based, character-level history layer (interoperates with git) |

> **The one-sentence version:** Zed is a Rust/GPU editor that keeps your hands fast and treats AI agents as pluggable citizens through an open protocol — which is exactly why your Claude subscription and your local Ollama models can both live inside it.

---

## The 60-Second Version (TL;DR)

1. **Install and import.** Let Zed import your VS Code settings on first run; if you skipped it, run `zed: import vs code settings` from the command palette.
2. **Learn one shortcut.** `Cmd+Shift+P` (command palette) is the API to the entire editor. If you forget any binding, search for it there.
3. **Live in multibuffers.** `Cmd+Shift+F` for project search, `Shift+F12` for references, `F2` to rename — all open editable multibuffers, not read-only lists.
4. **Pick your AI path on purpose.** Zed Agent (hosted models), an External Agent via ACP, or a Terminal Thread — see Part 4. They have separate logins and separate billing.
5. **At work, use Claude Agent.** Install it from the ACP Registry, open a thread, run `/login`, and authenticate with your Claude Team account. Do **not** set `ANTHROPIC_API_KEY` unless you want API-rate billing.
6. **At home, add Ollama as a local model provider** and OpenCode as an External Agent. Both are a few lines of settings, or a couple of clicks in Agent Settings.
7. **Set `format_on_save`, `autosave`, a theme, and inlay hints once**, then forget about configuration. Zed's defaults are close to right.
8. **Keep a terminal around anyway.** Zed is young in a few specific places (Section 9 is honest about which).

---

## Prerequisites

| Requirement | Why | How to check / get |
|---|---|---|
| macOS 12+, Linux, or Windows 10+ | Zed runs natively on all three | `brew install --cask zed` (macOS) |
| The `zed` CLI | Open files from your terminal with `zed .` | Command palette → `cli: install cli binary` |
| A git repo | Most features assume one | `git status` |
| Your AI plan or key | Only for the AI parts | Claude Team seat, Ollama running, or an API key |
| Ollama (optional, home) | Local models and local edit prediction | `brew install ollama`, then `ollama serve` |
| opencode (optional, home) | External Agent inside Zed | Install opencode; Zed installs the ACP adapter from the registry |

> **Version floor:** the AI sections assume a recent Zed (1.x, post-1.0). If a menu you expect is missing, update Zed first — it ships roughly weekly.

---

## Part 1 — Why Zed Feels Different

**It is native, and it means it.** Zed 1.0 landed on April 29, 2026 after five years of work and roughly a million lines of Rust. There is no Electron, no Chromium, no Node runtime between your keystroke and the screen. The editor composites its own frames: the CPU describes the scene as a flat list of typed primitives each frame, and the GPU draws the whole thing in parallel through shaders. On Apple Silicon and modern Linux GPUs it targets up to 120 frames per second.

**The performance gap is not subtle.** Independent 2026 benchmarks put Zed at roughly 0.4–0.6 s cold start against VS Code's ~1.3 s, about 2 ms keystroke latency against ~25 ms, and resident memory in the low hundreds of megabytes against multi-gigabyte footprints on large repos. People running nine concurrent projects with full language-server support report under a gigabyte of RAM. Your hardware and repo size will move these numbers, but the order of magnitude holds.

**Tree-sitter everywhere.** Zed embeds Tree-sitter, an incremental parser. It does not re-parse an entire file on each keystroke — it updates the region around the change. That is why syntax highlighting, structural navigation, and syntax-aware selection stay responsive in files that make other editors hitch.

**Real-time collaboration is inherited, not bolted on.** Zed's founders built Teletype at Atom; Zed's multiplayer editing descends from that work and predates the AI features by years. Multiple people can edit the same project simultaneously with live cursors, selections, and edits, plus voice chat — no plugin, no third-party account. Press `Ctrl+Shift+C` for the Collaboration Panel.

**AI streams at GPU speed.** Because there is no web layer, agent output, edit-prediction ghost text, and inline assistant rewrites appear essentially as fast as the model produces them. It sounds like a small thing until you go back to a Chromium-based editor and watch a panel repaint.

**It is open source.** Zed is primarily GPLv3, with Apache-2.0 components (including GPUI), and the editor's own server-side collaboration pieces under AGPL. If "no black box" matters to you, it matters here.

**You can turn AI off entirely.** `{ "disable_ai": true }` removes the Threads Sidebar, Agent Panel, Edit Prediction, and Inline Assistant. An editor that lets you have the editor without the AI is rarer than it should be.

---

## Part 2 — First Fifteen Minutes: Onboarding and Imports

If you already know an IDE, the setup is short.

**1. Import your VS Code settings.** During first-run onboarding you can import from VS Code. If you already skipped it (hi), open the command palette (`Cmd+Shift+P`) and run:

```text
zed: import vs code settings
```

Zed imports core editor behavior — tabs, status bar, preview tabs, save behavior, and other settings it maps 1:1. It does **not** import extensions or keybindings. Themes are the usual casualty: your VS Code theme is an extension, so it does not come across. Install a Zed-native theme from the Extension Gallery (`Ctrl+Shift+X`) instead.

A few of the mappings, so nothing surprises you:

| VS Code setting | Zed setting |
|---|---|
| `workbench.editor.showTabs` | `tab_bar.show` |
| `workbench.editor.enablePreview` | `preview_tabs.enabled` |
| `workbench.editor.limit.value` | `max_tabs` |
| `workbench.statusBar.visible` | `status_bar.show` |

**2. Choose a keymap.** If you picked the VS Code keymap during onboarding, most muscle memory carries over — `Cmd+P`, `Cmd+Shift+P`, `Cmd+Shift+F`, `Cmd+B`, `F2`, `Opt+Z` all behave as expected. Zed also supports chords (`Cmd+K Cmd+C`), like VS Code does.

**3. Know where the two config files live.** Everything about your setup is in two JSON files, and you should open them from the command palette rather than hunting paths:

| File | Open it with | Path (macOS) |
|---|---|---|
| Settings | `zed: open settings file` | `~/.config/zed/settings.json` (also referenced as `~/.zed/settings.json`) |
| Keymap | `zed: open keymap file` | `~/.config/zed/keymap.json` |
| Project settings | `zed: open project settings file` | `<project>/.zed/settings.json` |

Prefer the Settings Editor (`Cmd+,`) and the Keymap Editor (`Ctrl+K Ctrl+S`) for the ninety percent case: both are UI over the same files, and anything you change there is written back to JSON. Use the raw file for advanced settings that have no UI.

**4. Install the CLI.** One command in the palette — `cli: install cli binary` — and then:

```bash
zed .                    # open the current folder
zed file.txt             # open a file
zed project/ file.txt    # open a folder and a file
```

That is the whole onboarding. The rest of this guide is about what you get after it.

---

## Part 3 — The Features You Didn't Know You Wanted

### Multibuffers: the actual killer feature

A multibuffer is a single editable buffer containing excerpts from many files. Search results are a multibuffer. "Find all references" is a multibuffer. Diagnostics are a multibuffer. Staged and unstaged changes are multibuffers.

This changes a workflow you have done ten thousand times. In most editors you search, click a result, edit, go back, click the next result, edit. In Zed you get **every match as an editable excerpt at once**, and you can put multiple cursors across all of them and refactor in one pass. Edits write through to the original files, and `Cmd+S` saves every modified file at once.

The concrete example that sells it: rename a function, review the affected files in a multibuffer, add multiple cursors, fix the call sites in bulk, and watch diagnostics update live. It is the difference between a search *result* and a search *surface*.

### Everything is reachable from the palette, and everything has a name

If a shortcut slips your mind, search the palette by description — Zed's actions have readable names. `editor: find all references`, `git: view staged changes`, `workspace: new center terminal`, `editor: toggle soft wrap`. You do not need to memorize actions, only the palette.

Two actions worth binding immediately, because they are the "why isn't this everywhere" pair:

- `editor: toggle all diff hunks` — collapse or expand every diff hunk in a file.
- `workspace: toggle editor zoom` — maximize the active pane without disturbing your docks.

### Panels that are worth opening

| Panel | Shortcut | What it gives you |
|---|---|---|
| Project | `Ctrl+Shift+E` | File tree with git status and diagnostics at a glance |
| Outline | `Ctrl+Shift+B` | Persistent symbol tree for the current file — excellent inside multibuffers |
| Git | open via `git panel: toggle` | Stage, commit, branch, and view diffs natively; dedicated staged/unstaged views |
| Debugger | bottom dock by default | A real debugger, integrated into the panel system rather than a side window |
| Terminal | `` Ctrl+` `` | Bottom dock by default; can also open as a **center pane** tab |
| Collaboration | `Ctrl+Shift+C` | Channels, contacts, private calls, voice |

The Outline Panel is the sleeper. In a multibuffer of 40 search results, it becomes a navigable map of those results by symbol.

### Tasks: your build and test commands, one keypress away

Drop a `.zed/tasks.json` in a project and every command becomes a palette action and a bindable key:

```json
[
  { "label": "dev", "command": "npm run dev" },
  { "label": "test", "command": "npm test" },
  { "label": "test current file", "command": "npx vitest run $ZED_FILE" },
  { "label": "build", "command": "npm run build" }
]
```

Bind your favorites with a `reveal_target` so long-running servers land where you want them:

```json
[
  {
    "context": "Workspace",
    "bindings": {
      "alt-t": ["task::Spawn", { "task_name": "test", "reveal_target": "center" }],
      "alt-d": ["task::Spawn", { "task_name": "dev", "reveal_target": "dock" }]
    }
  }
]
```

Tasks also support hooks — tasks that run automatically at known points — with the usual `cwd`, `env`, `reveal`, and `hide` fields.

### Modal editing, if that is your thing

`vim_mode: true` gives real Vim emulation, including language-server navigation (`g d` definition, `g A` references, `c d` rename, `g .` code actions). Zed also ships a **Helix mode**, built on top of the Vim layer, if you prefer Helix-style selections. Both are emulation layers inside a normal editor, so nothing else about Zed changes.

### Remote development and dev containers

`Alt+Ctrl+Shift+O` opens the Remote Projects dialog. Zed runs its UI, Tree-sitter parsing, and model calls locally while the source, language servers, tasks, and terminals run on the remote box over SSH. You can configure port forwarding in settings; AI features keep working in remote sessions. Extensions you install locally propagate to the remote server, which is how language servers keep working there.

---

## Part 4 — AI in Zed Is Three Separate Systems

This is the part that confuses people coming from VS Code, so it gets its own section. Zed does not have "an AI feature." It has three, and they do not share authentication or billing.

```text
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  1. ZED AGENT                          (first-party, in the Agent Panel)   │
   │     Models come from Zed's LLM Providers:                                  │
   │       • Zed-hosted models (Zed Pro)   • your own API keys                  │
   │       • an existing subscription      • a gateway (OpenRouter, Bedrock…)   │
   │       • a LOCAL model (Ollama, LM Studio, llama.cpp)                       │
   │     Billing/logins: Zed or the provider. One panel, one default model.     │
   ├────────────────────────────────────────────────────────────────────────────┤
   │  2. EXTERNAL AGENTS                    (third-party, over ACP)             │
   │     Claude Agent · Codex · OpenCode · Copilot · Cursor · Pi · Gemini CLI   │
   │     Install from the ACP Registry, then start a thread with that agent.    │
   │     Billing/logins: OWNED BY THE AGENT. Zed does not hold the key.         │
   ├────────────────────────────────────────────────────────────────────────────┤
   │  3. TERMINAL THREADS                   (a CLI/TUI in a Zed terminal)       │
   │     e.g. `claude` running natively, organized as a thread in the sidebar.  │
   │     Billing/logins: the CLI's own. Zed Agent settings do NOT apply.        │
   └────────────────────────────────────────────────────────────────────────────┘
```

The practical rule:

| Your tool is… | Use |
|---|---|
| integrated with Zed through ACP | **External Agents** |
| a CLI or TUI | **Terminal Threads** |
| a model you call directly (API key, local, gateway) | **Zed Agent / LLM Providers** |

Two facts worth internalizing:

- **An API key configured for Zed Agent does not configure an External Agent.** They are separate worlds. Configuring Anthropic for Zed Agent will not log Claude Agent in.
- **Whatever the External Agent or Terminal Thread owns, it owns.** Auth, model selection, subscriptions, tool config, skills, instruction files, and MCP servers all live with that agent, not with Zed.

To reach the settings: `agent: open settings` drops you straight into the AI page, which separates **LLM Providers**, **External Agents**, and **MCP Servers**. To install agents, `zed: acp registry` opens the registry, or use Agent Settings → External Agents → `Add Agent` → `Install from Registry`.

Zed also supports **parallel agents**: multiple agent threads running in the same window, each with its own thread, each editing through the multibuffer review system rather than blind diff-application. That is the feature that makes the "three systems" design pay off.

---

## Part 5 — At Work: Your Claude Team Subscription

Here is the setup you actually want, and the trap that costs people money.

### The short version

Claude Team and Enterprise seats include Claude Code, and Claude Code is what backs **Claude Agent** in Zed. So the path is:

1. Command palette → `zed: acp registry`, or `agent: open settings` → **External Agents** → `Add Agent` → **Install from Registry** → **Claude Agent**.
2. Start a Claude Agent thread from the Agent Panel (`Ctrl+N`, or the `+` button) or from the Threads Sidebar.
3. In that thread, run `/login` and authenticate with **the same Claude account you use for the team**, choosing the subscription route (not an API key).

Claude Agent owns its own auth and billing. `CLAUDE.md` and other Claude-native config files may be read by the agent directly, so your existing project instructions carry over.

### The trap: the environment variable

**If `ANTHROPIC_API_KEY` is set in your environment, Claude Code will use that key instead of your subscription** — and your usage gets billed at API rates rather than drawing from the seat's included usage. This is the single most common way people accidentally turn a fixed-cost subscription into a metered bill.

Check before you log in:

```bash
# If this prints anything, your subscription will be bypassed.
printenv ANTHROPIC_API_KEY
```

If you want subscription-backed behavior, make sure it is unset (or explicitly unset it for the process). If you *want* API billing, leave it — but know that is the choice you made.

### Which Claude path, exactly?

Zed gives you two ways to use your subscription, and they are genuinely different:

| | Claude Agent (ACP) | Claude Code (Terminal Thread) |
|---|---|---|
| Where it lives | Threads Sidebar / Agent Panel | A terminal thread in Zed |
| Rendering | Native Zed agent UI, multibuffer review of edits | The real Claude Code TUI |
| Auth | `/login` in the thread | Claude Code's own login |
| Best for | Reviewing and evolving agentic code inside Zed | Keeping the exact CLI experience you already have |
| Billing | Owned by Claude | Owned by Claude |

Both draw on the same Claude subscription limits, and your usage is shared with your Claude chat usage. Start with **Claude Agent** — it is the more Zed-native experience, and the multibuffer edit review is the reason to be here rather than in a terminal app.

### A nicety: notifications when Claude finishes

Set Claude Code's notification channel to the terminal bell so Zed can tell you when the agent finishes or pauses for permission:

```json
{
  "preferredNotifChannel": "terminal_bell"
}
```

You can also do this from inside Claude Code with `/config` → **Local Notifications** → **Terminal Bell**. If you run Claude Code inside tmux, add this to `~/.tmux.conf` or the bell will not escape the multiplexer:

```text
set -g allow-passthrough on
```

### One caveat to verify

Anthropic's current documentation says Claude Code is included with **every Team plan seat**, and with every seat on new and self-serve Enterprise plans. Some older Team contracts and legacy seat types split this differently, and some third-party write-ups still describe the older structure. If `/login` succeeds but code work is refused, check your seat type with your workspace admin before assuming the setup is wrong.

---

## Part 6 — At Home: Ollama, Local Models, and OpenCode

Your home setup is the opposite end of the spectrum: models that run on your machine, and an agent harness you already use.

### Ollama as a local model provider (Zed Agent)

`agent: open settings` → **LLM Providers** → add a provider. For Ollama you point Zed at the local server. If you prefer the settings file, the provider lives under `language_models`:

```json
{
  "language_models": {
    "openai_compatible": {
      "ollama": {
        "api_url": "http://localhost:11434/v1",
        "available_models": [
          {
            "name": "qwen2.5-coder:7b",
            "display_name": "Qwen 2.5 Coder 7B (local)",
            "max_tokens": 32768
          }
        ]
      }
    }
  }
}
```

Because Ollama exposes an OpenAI-compatible endpoint, `openai_compatible` is the general escape hatch for **any** local or self-hosted server: llama.cpp, vLLM, LM Studio, LocalAI. If it speaks the OpenAI API, Zed will talk to it. Provider keys you add through Zed's UI are stored in the system keychain, not in `settings.json`.

### Local edit prediction

Edit prediction — the ghost-text "next edit" that you accept with Tab — can also run locally, which is the privacy-preserving option:

```json
{
  "edit_predictions": {
    "provider": "ollama",
    "ollama": {
      "api_url": "http://localhost:11434",
      "model": "qwen2.5-coder:7b-base",
      "prompt_format": "infer",
      "max_output_tokens": 512
    }
  }
}
```

The `*-base` models are the ones built for completion rather than chat; a chat-tuned model makes a poor predictor. The same pattern works against any OpenAI-completion-compatible server via `provider: "open_ai_compatible_api"`.

> **What this buys you:** a coding assistant where nothing leaves the machine. Slower and less capable than a frontier model, and completely yours.

### OpenCode as an External Agent

OpenCode is in the curated ACP Registry. The flow is the same three steps as Claude:

1. `zed: acp registry` (or Agent Settings → External Agents → Add Agent).
2. Install **OpenCode**.
3. Start an OpenCode thread from the Agent Panel or Threads Sidebar.

OpenCode owns its own auth, model selection, and subscription behavior — including OpenCode Zen / Go models if you use those. To use OpenCode's models inside Zed's own Agent Panel instead, configure OpenCode API access as an LLM Provider; that is a different thing from running OpenCode as the agent.

If you are developing your own ACP-compatible agent, or running one that is not in the registry, add it manually:

```json
{
  "agent_servers": {
    "my-agent": {
      "type": "custom",
      "command": "node",
      "args": ["~/projects/agent/index.js", "--acp"],
      "env": {}
    }
  }
}
```

### The home setup, in one picture

| Want | Path | Who pays / who authenticates |
|---|---|---|
| Local chat + agent | Ollama → LLM Provider → Zed Agent | Nobody. It is your GPU. |
| Local inline suggestions | Ollama → `edit_predictions` | Nobody. |
| Your existing opencode harness | OpenCode → ACP Registry → External Agent | OpenCode (its own keys/subscription) |
| Frontier model, metered | Provider API key | You, per token |
| Frontier model, flat | Zed Pro hosted models | Zed ($5/mo credit included) |

---

## Part 7 — Setting Up Zed Like You Mean It

The defaults are good. These are the changes that actually pay off.

### `settings.json` worth having

```json
{
  "theme": { "mode": "system", "dark": "One Dark", "light": "GitHub Light" },
  "format_on_save": "on",
  "soft_wrap": "preferred_line_length",
  "preferred_line_length": 100,
  "autosave": { "after_delay": { "milliseconds": 1000 } },
  "inlay_hints": { "enabled": true },
  "toolbar": { "breadcrumbs": true, "quick_actions": true },
  "terminal": { "dock": "bottom", "font_size": 14 },
  "telemetry": { "diagnostics": false, "metrics": false }
}
```

Two cautions:

- **Check `format_on_save` before your first commit in a shared repo.** Turning it on inside a project with a different formatter will reformat an entire file when you meant to change one line. That is what `<project>/.zed/settings.json` is for.
- **Markdown and trailing whitespace.** Trailing spaces mean line breaks in Markdown; if you write docs in Zed, disable removal for that language:

```json
{
  "languages": {
    "Markdown": { "remove_trailing_whitespace_on_save": false }
  }
}
```

### Keymap examples worth stealing

```json
[
  {
    "context": "Workspace",
    "bindings": {
      "alt-t": ["task::Spawn", { "task_name": "test", "reveal_target": "center" }],
      "ctrl-k ctrl-z": "workspace::ToggleEditorZoom",
      "alt-d": "editor::ToggleAllDiffHunks"
    }
  }
]
```

If you use Vim mode and want the standard system bindings back (`Ctrl+F` search, `Ctrl+V` paste, `Ctrl+C` copy) — which Vim mode overrides — Zed documents a ready-made override block; it is the first thing to add.

### Project settings, agent rules, and skills

- `.zed/settings.json` per project for formatter, language server, and indentation — the things that are about the project, not about you.
- **`AGENTS.md`** gives agents project-wide instructions; Zed supports a global one for user-wide instructions. Open the project one with `agent: open project AGENTS.md rules`.
- **Skills** let you package reusable agent behaviors. The `skill` tool's permissions are configurable by path, so you can auto-allow a trusted skill while confirming others.
- **MCP servers** live under `context_servers` in settings, local or remote:

```json
{
  "context_servers": {
    "my-server": { "command": "some-command", "args": ["arg-1"] },
    "remote": { "url": "https://example.com/mcp", "headers": { "Authorization": "Bearer <token>" } }
  }
}
```

- **Agent profiles** control which tools an agent may use. A read-only "Ask" profile is a genuinely useful safety rail:

```json
{
  "agent": {
    "profiles": {
      "ask": {
        "name": "Ask",
        "tools": { "read_file": true, "grep": true, "terminal": false, "edit_file": false }
      }
    }
  }
}
```

---

## Part 8 — Collaboration and Remote Work

**Collaboration.** Zed's multiplayer is built into the core, not an extension. Open the Collaboration Panel (`Ctrl+Shift+C`), create a channel, and invite people; or use Contacts for ad-hoc private calls. You see each other's cursors, selections, and edits in real time, and voice chat is included. There is no separate tool or third-party login involved.

**Remote development.** `Alt+Ctrl+Shift+O` opens Remote Projects. Zed downloads and starts a headless server on the remote host, runs the UI locally, and keeps AI features working in the session. Port forwarding is a settings entry — locally hitting `localhost:8080` can be forwarded to the remote's port 80, which is how you preview a dev server from a remote box.

**The three settings files, and which to use.** In remote development there are three: your local settings (UI concerns — fonts, themes), the remote server's settings (language-server paths, proxy), and project settings (indentation, formatter). Project settings are read by both sides; each side's main settings file is invisible to the other. Get this wrong and you will spend an afternoon wondering why a formatter is missing on one side.

---

## Part 9 — The Honest Rough Edges

Zed is genuinely great and also genuinely younger than VS Code. Here is where that shows:

| Rough edge | What it means in practice |
|---|---|
| Per-project LSP configuration is fiddlier than it should be | Complex polyglot repos may surface noisy default diagnostics until you configure them |
| The extension language is Rust, not TypeScript | Extension authoring is a higher bar; fewer third-party extensions exist |
| The diff and merge UI is still maturing | Character-level resolution does not yet always match VS Code's |
| Debugger language support is uneven | Strong for some languages, thinner for others |
| Very large directories are still slow to open | Open specific projects, not `/` or `~` |
| 120 FPS is an upper bound, not a floor | Older hardware and some Windows configs land well below it |
| Some integrations are new enough to be unstable | Weekly releases fix things fast, but expect occasional sharp edges |

None of these are foundational, and the weekly release cadence is closing them visibly. But if your workflow depends on one of them today, keep the other editor installed — nobody said switching had to be all-or-nothing.

---

## Cheat Sheet

```text
─── THE PALETTE (learn this one) ────────────────────────────────────────────
Cmd+Shift+P            command palette — every action in Zed
Cmd+,                  settings editor
Ctrl+K Ctrl+S          keymap editor

─── NAVIGATION ──────────────────────────────────────────────────────────────
Cmd+P                  find files
Cmd+Shift+F            search in project            (opens a multibuffer)
Cmd+T                  find symbol in project
Cmd+Shift+O            find symbol in current file
F12                    go to definition
Shift+F12              find all references          (opens a multibuffer)
F2                     rename symbol
pane: go back          navigate back / forward — bind these to taste

─── WORKSPACE ───────────────────────────────────────────────────────────────
Cmd+B                  toggle left dock
Cmd+J                  toggle bottom dock
Ctrl+`                 toggle terminal panel
Ctrl+Shift+E           project panel
Ctrl+Shift+B           outline panel
Ctrl+Shift+C           collaboration panel
Ctrl+K Ctrl+T          theme selector
Ctrl+Shift+X           extensions

─── AI ──────────────────────────────────────────────────────────────────────
agent: open settings          AI settings (LLM Providers / External Agents / MCP)
zed: acp registry             install External Agents
Ctrl+N                        new agent thread
agent: add selection to thread  send selection as context
alt-ctrl-shift-o              remote projects dialog
```

```json
// ─── LOCAL MODEL (Zed Agent) ─────────────────────────────────────────────
{ "language_models": { "openai_compatible": { "ollama": {
  "api_url": "http://localhost:11434/v1",
  "available_models": [{ "name": "qwen2.5-coder:7b", "max_tokens": 32768 }] } } } }

// ─── LOCAL EDIT PREDICTION ───────────────────────────────────────────────
{ "edit_predictions": { "provider": "ollama", "ollama": {
  "api_url": "http://localhost:11434",
  "model": "qwen2.5-coder:7b-base",
  "prompt_format": "infer",
  "max_output_tokens": 512 } } }

// ─── CUSTOM ACP AGENT ────────────────────────────────────────────────────
{ "agent_servers": { "my-agent": {
  "type": "custom", "command": "node",
  "args": ["~/projects/agent/index.js", "--acp"], "env": {} } } }

// ─── SETTINGS THAT MATTER ────────────────────────────────────────────────
{ "format_on_save": "on",
  "autosave": { "after_delay": { "milliseconds": 1000 } },
  "inlay_hints": { "enabled": true },
  "disable_ai": false }
```

| I want to… | Do this |
|---|---|
| Get my VS Code behavior back | `zed: import vs code settings` |
| Refactor across many files | Search → multibuffer → multi-cursor → edit all at once |
| Run my dev server | `.zed/tasks.json` → bind `task::Spawn` |
| Use my Claude Team seat | Install Claude Agent → new thread → `/login` |
| Keep AI off the network | Ollama provider + Ollama edit prediction |
| Use my opencode setup | Install OpenCode from the ACP Registry |
| Stop surprise formatting | Leave `format_on_save` off in shared repos |
| Kill all AI | `"disable_ai": true` |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Claude Agent asks me to pay per token despite a Team seat | `ANTHROPIC_API_KEY` is set in your environment | `unset ANTHROPIC_API_KEY`, then `/login` in the agent thread |
| Claude Agent will not authenticate at all | Never ran the agent's own login | Start a Claude Agent thread and run `/login` |
| My Anthropic key in Zed Agent did not log Claude Agent in | These are separate systems | Configure the External Agent's own auth |
| Ollama provider shows no models | Ollama not running, or wrong `api_url` | `ollama serve`, then use `http://localhost:11434/v1` |
| Local edit predictions are gibberish | Chat-tuned model used for completion | Use a `*-base` coder model; keep `prompt_format: "infer"` |
| AI panel is missing entirely | AI disabled | Remove `"disable_ai": true` |
| No notification when Claude finishes | Bell not reaching Zed | Set `preferredNotifChannel: "terminal_bell"`; add tmux passthrough |
| Zed cannot SSH to a remote host | Missing or unusual SSH config | Verify plain `ssh host` works first; check supported SSH options |
| A whole file reformatted on one-line change | `format_on_save` on in a differently-formatted repo | Disable per project via `.zed/settings.json` |
| Trailing spaces keep vanishing in Markdown | Whitespace removal on save | Set `remove_trailing_whitespace_on_save: false` for Markdown |
| A keybind does nothing | Context does not match | Use `dev: open key context view` to see active contexts |
| VS Code theme did not import | Themes are extensions in VS Code | Install a Zed theme from the Extension Gallery |
| Terminal has no `zed` command | CLI not installed | Palette → `cli: install cli binary` |
| Remote session loses AI | Expected in old remote mode | Use current SSH remoting (v0.157+); AI works there |
| Very large folder opens slowly | Known limitation | Open the specific project, not the whole home directory |

---

## Video Library

YouTube **search** links only — Zed moves too fast for fixed video links to stay honest.

| Search | What you'll find |
|---|---|
| [Zed editor tutorial 2026](https://www.youtube.com/results?search_query=Zed+editor+tutorial+2026) | Full beginner walkthroughs |
| [Zed editor vs VS Code performance](https://www.youtube.com/results?search_query=Zed+editor+vs+VS+Code+performance) | Side-by-side speed comparisons |
| [Zed editor multibuffer](https://www.youtube.com/results?search_query=Zed+editor+multibuffer) | The feature that changes refactors |
| [Zed editor AI agent panel setup](https://www.youtube.com/results?search_query=Zed+editor+AI+agent+panel+setup) | Configuring agents and providers |
| [Zed Claude Agent ACP setup](https://www.youtube.com/results?search_query=Zed+Claude+Agent+ACP+setup) | Subscription-backed Claude in Zed |
| [Zed Ollama local model](https://www.youtube.com/results?search_query=Zed+Ollama+local+model) | Local models in the editor |
| [Zed editor vim mode](https://www.youtube.com/results?search_query=Zed+editor+vim+mode) | Modal editing setup |
| [Zed editor remote development SSH](https://www.youtube.com/results?search_query=Zed+editor+remote+development+SSH) | Remoting and port forwarding |
| [Zed editor keybindings customize](https://www.youtube.com/results?search_query=Zed+editor+keybindings+customize) | Building your keymap |
| [Zed editor tasks.json](https://www.youtube.com/results?search_query=Zed+editor+tasks.json) | Build and test tasks |

---

## Written References & Docs

Zed's own documentation is the source that keeps up with the weekly releases. Start there.

| Source | URL |
|---|---|
| Zed documentation home | `https://zed.dev/docs/` |
| Getting started | `https://zed.dev/docs/getting-started` |
| AI quick start | `https://zed.dev/docs/ai/quick-start` |
| Agent panel | `https://zed.dev/docs/ai/agent-panel` |
| External agents (ACP) | `https://zed.dev/docs/ai/external-agents` |
| Terminal threads | `https://zed.dev/docs/ai/terminal-threads` |
| Use an existing subscription | `https://zed.dev/docs/ai/use-an-existing-subscription` |
| Use a local model | `https://zed.dev/docs/ai/use-a-local-model` |
| Edit prediction | `https://zed.dev/docs/ai/edit-prediction` |
| MCP servers | `https://zed.dev/docs/ai/mcp` |
| Agent profiles | `https://zed.dev/docs/ai/agent-profiles` |
| Multibuffers | `https://zed.dev/docs/multibuffers` |
| Finding and navigating | `https://zed.dev/docs/finding-navigating` |
| Tasks | `https://zed.dev/docs/tasks` |
| Key bindings | `https://zed.dev/docs/key-bindings` |
| Migrating from VS Code | `https://zed.dev/docs/migrate/vs-code` |
| Remote development | `https://zed.dev/docs/remote-development` |
| Collaboration | `https://zed.dev/docs/collaboration` |
| All actions (the full command list) | `https://zed.dev/docs/all-actions` |
| Releases (stable) | `https://zed.dev/releases/stable` |
| Agent Client Protocol | `https://agentclientprotocol.com/` |
| Claude Code with Team/Enterprise plans | `https://support.claude.com/en/articles/11845131` |
| opencode | `https://opencode.ai/docs/` |

---

## Glossary

| Term | Meaning |
|---|---|
| **ACP** | Agent Client Protocol — the open contract that lets third-party agents run inside Zed |
| **Agent Panel** | Zed's first-party AI surface for prompts, context, and edit review |
| **DeltaDB** | Zed's upcoming CRDT-based, character-level history layer, interoperable with git |
| **Edit prediction** | Inline ghost-text suggestion of your next edit, accepted with Tab |
| **External Agent** | A third-party AI agent integrated through ACP (Claude Agent, Codex, OpenCode…) |
| **GPUI** | Zed's GPU-accelerated UI framework, written in Rust |
| **Inline Assistant** | Prompt-driven, selection-based AI transforms inside the editor |
| **LSP** | Language Server Protocol — completions, diagnostics, refactors, navigation |
| **Multibuffer** | One editable buffer of excerpts from many files |
| **Parallel agents** | Multiple agent threads running concurrently in one window |
| **Terminal Thread** | A CLI/TUI agent run in a Zed terminal, organized as a thread |
| **Tree-sitter** | Incremental parser powering syntax, selection, and navigation |
| **Zed Agent** | Zed's first-party agent, backed by configured LLM providers |

---

## FAQ & Next Steps

**Is Zed actually faster, or is that marketing?** The order of magnitude is real and independently measured: roughly 2 ms versus ~25 ms keystroke latency, and low hundreds of MB versus multiple GB of RAM. The exact numbers depend on your machine and repo.

**Do I have to give up VS Code?** No. Install both. Zed reads your VS Code settings on import, and keeping the old editor for one rough edge costs nothing.

**Where do my API keys live?** Keys you add through Zed's UI are stored in the system keychain, not in `settings.json`. Keys used by External Agents live with those agents.

**Can I use Claude and local models at the same time?** Yes, and this is the best part of the design: Claude Agent as an External Agent thread, Ollama as a Zed Agent provider for local work. Different threads, different bills, one window.

**Does my Claude Team seat cover this, or will I get an API bill?** It covers it *if* you authenticate the agent with your subscription and leave `ANTHROPIC_API_KEY` unset. Check that variable first.

**What is the one feature I should try first?** Multibuffer search: `Cmd+Shift+F`, type a symbol name, then edit every match in one buffer with multiple cursors. It explains why people switch.

**What should I read next in this series?**

- [Local on-device AI stack](04-local-on-device-ai-stack.html) — the models you would point Ollama at here.
- [Linear + opencode workflow](linear-opencode-workflow.html) — the opencode harness you are wiring into Zed.
- [Containers & dev environments on macOS](07-containers-dev-environments-macos.html) — sandboxing the agents you run in the editor.
- [Prompt injection & agent security](02-prompt-injection-agent-security.html) — before you let an agent edit your repo.

---

## Verification Note

Verified against Zed's official documentation, the ACP Registry flow, and Anthropic's own support documentation in September 2026. Zed ships roughly weekly, so treat menu labels and setting names as the stable parts and exact version numbers as moving. Subscription and billing details for Claude were taken from Anthropic's support articles; if a login succeeds but work is refused, confirm your seat type with your workspace admin. No extension IDs, version numbers, or third-party publisher claims have been invented for this guide.

---

## Your Setup Notes

Use this space to record what you actually chose, so six months from now the answer is written down.

```text
Zed version:                       ____________________
Keymap chosen:                     ____________________

WORK (Claude Team seat)
  Path:  Claude Agent (ACP)   /   Claude Code terminal thread
  Verified: `printenv ANTHROPIC_API_KEY` → empty?   [ ]

HOME (local + agents)
  Ollama endpoint:                 http://localhost:11434
  Chat model:                      ____________________
  Edit-prediction model:           ____________________
  OpenCode installed from registry?  [ ]

SETTINGS CHANGED
  format_on_save:                  on / off / per-project
  autosave:                        ____________________
  theme:                           ____________________

FIRST THING I LEARNED TO LOVE
  ____________________________________________________
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js app, uses opencode and AI coding agents daily, takes
notes in Markdown, and learns by doing. He has just switched to Zed and has imported his VS Code
settings. At work he has a Claude Team subscription; at home he runs Llama (Ollama) and opencode.

Paper: markdown_docs/21-zed-editor-guide.md
Topic: Using Zed — why it feels different (Rust/GPUI, multibuffers, tree-sitter), onboarding and
VS Code import, the three separate AI systems (Zed Agent / External Agents via ACP / Terminal
Threads), using a Claude Team subscription through Claude Agent, and wiring in Ollama and OpenCode
locally.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words; (B) add a Part on a topic he names
(the debugger, writing a Zed extension in Rust, DeltaDB and character-level history, sandboxing
External Agents with containers, a VS Code keybinding-to-Zed mapping appendix); (C) interview him
about his actual daily workflow and return a concrete settings.json + keymap.json + tasks.json
tailored to it.

Rules: never invent Zed actions, keybindings, setting names, model IDs, or menu paths — verify
each against zed.dev/docs or the ACP Registry. Never state a subscription or billing fact without
citing Anthropic's or Zed's own documentation. Distinguish first-party documentation from
community advice. Keep the structure. Report path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://zed.dev/docs/ai/quick-start
https://zed.dev/docs/ai/external-agents
https://zed.dev/docs/ai/terminal-threads
https://zed.dev/docs/ai/use-an-existing-subscription
https://zed.dev/docs/ai/edit-prediction
https://zed.dev/docs/multibuffers
https://zed.dev/docs/key-bindings
https://zed.dev/docs/tasks
https://zed.dev/docs/migrate/vs-code
https://zed.dev/docs/remote-development
https://agentclientprotocol.com/
https://support.claude.com/en/articles/11845131
https://opencode.ai/docs/
```
