# The Complete Guide: AI Agents + Graphify + Obsidian

> **A practical, step-by-step reference for building a persistent knowledge graph that your AI agent can query — and that you can see, explore, and edit in Obsidian.**
>
> Last verified: September 2026 · Level: Beginner-friendly · Time to full setup: ~30 minutes

---

## Table of Contents

1. [What You're Building (The Big Picture)](#what-youre-building-the-big-picture)
2. [The 60-Second Version (TL;DR)](#the-60-second-version-tldr)
3. [Prerequisites](#prerequisites)
4. [Part 1 — Install Graphify](#part-1--install-graphify)
5. [Part 2 — Build Your First Knowledge Graph](#part-2--build-your-first-knowledge-graph)
6. [Part 3 — Understand the Output](#part-3--understand-the-output)
7. [Part 4 — Set Up Obsidian](#part-4--set-up-obsidian)
8. [Part 5 — Connect Obsidian to the Graph](#part-5--connect-obsidian-to-the-graph)
9. [Part 6 — Connect Your AI Agent to the Graph](#part-6--connect-your-ai-agent-to-the-graph)
10. [Part 7 — Let Your AI Agent Read/Write Obsidian Directly](#part-7--let-your-ai-agent-readwrite-obsidian-directly)
11. [Part 8 — Keep Everything Fresh (Automation)](#part-8--keep-everything-fresh-automation)
12. [Part 9 — Everyday Workflows & Recipes](#part-9--everyday-workflows--recipes)
13. [Command Cheat Sheets](#command-cheat-sheets)
14. [Troubleshooting](#troubleshooting)
15. [Video Library (Clickable YouTube References)](#video-library-clickable-youtube-references)
16. [Written References & Repos](#written-references--repos)
17. [Glossary](#glossary)
18. [FAQ & Next Steps](#faq--next-steps)

---

## What You're Building (The Big Picture)

Three tools, three jobs. Each one does one thing well, and they snap together like this:

```
┌─────────────────────┐        ┌─────────────────────┐        ┌─────────────────────┐
│                      │        │                      │        │                      │
│    YOUR FILES        │  ──►   │      GRAPHIFY        │  ──►   │      OBSIDIAN        │
│  code · notes ·      │ builds │  Knowledge Graph     │ shows  │  You see, explore,   │
│  papers · images     │        │  (graph.json)        │        │  and edit the graph  │
│                      │        │                      │        │                      │
└─────────────────────┘        └──────────┬───────────┘        └──────────▲───────────┘
                                          │                               │
                                          │        ┌─────────────────┐    │
                                          │        │                  │    │
                                          └───────►│   AI AGENT       │────┘
                                   queries graph   │ (Claude Code /   │ reads & writes
                                   via MCP/skill   │  Cursor / etc.)  │ your vault
                                                   │                  │
                                                   └─────────────────┘
```

| Tool | Its Job | Analogy |
|---|---|---|
| **Graphify** | Reads your files and builds a structured **knowledge graph** — nodes (concepts, functions, people) and edges (relationships). | The librarian who reads everything and builds the card catalog. |
| **Obsidian** | A markdown note app that becomes the **visual layer** — the graph gets exported as interconnected notes you can browse, link, and edit. | The map room — you walk the shelf and see how everything connects. |
| **AI Agent** (Claude Code, Cursor, etc.) | **Queries** the graph instead of re-reading all your files, and can **act** in your vault (create notes, append findings) via MCP. | The research assistant who checks the catalog before burning energy reading every book. |

**Why bother?** Without a graph, an AI agent treats every question like a linear scan — grep tells it *where* something is. A knowledge graph tells it *why* something connects. Graphify benchmarks show **~71.5× fewer tokens per query** on a mixed corpus (code + papers + images) compared to the agent reading raw files. The graph also persists across sessions, and every edge is honestly tagged `EXTRACTED`, `INFERRED`, or `AMBIGUOUS` — so the agent (and you) always know what's fact vs. educated guess.

---

## The 60-Second Version (TL;DR)

For those who just want the whole recipe up front:

```bash
# 1. Install (requires Claude Code + Python 3.10+)
pip install graphifyy && graphify install

# 2. Open Claude Code in the folder you care about, then:
/graphify .

# 3. Open the output in Obsidian
#    Obsidian → "Open folder as vault" → <yourfolder>/graphify-out/obsidian/

# 4. (Optional power move) Serve the graph to your agent over MCP
/graphify ./ --mcp
```

That's the spine of it. Everything below is the careful, explained version with options, plugins, and automation.

---

## Prerequisites

Check these off before you start — four items, all quick to get:

| Requirement | Why | How to Check / Get It |
|---|---|---|
| **Claude Code** (or another supported agent) | Graphify is installed *as a skill inside* the agent. | [claude.ai/code](https://claude.ai/code) — Graphify also works with Codex, OpenCode, Cursor, Gemini CLI, Copilot CLI, Aider, and Trae. |
| **Python 3.10+** | Graphify runs on Python. | Run `python3 --version` in a terminal. |
| **pip or pipx** | To install the package. | Comes with Python. On macOS/Linux, `pipx` is often smoother. |
| **Obsidian** | The visualization layer. | [obsidian.md](https://obsidian.md) — free for personal use. |

> **Note on the package name:** On PyPI, the package is temporarily called **`graphifyy`** (double "y") while the `graphify` name is being reclaimed. The CLI command and the skill command are still just `graphify` / `/graphify`. Don't let the spelling trip you up.

---

## Part 1 — Install Graphify

### Step 1.1 — Install the package

Pick the line that fits your system:

```bash
# Standard install (works for most people)
pip install graphifyy && graphify install
```

```bash
# macOS — if pip fails with "externally-managed-environment"
pipx install graphifyy && graphify install
```

```bash
# Windows — if 'graphify' is not recognized afterwards, add the Python
# Scripts folder to your PATH, or just use pipx (handles PATH for you):
pipx install graphifyy && graphify install
```

**What did that do?**
- `pip install graphifyy` — installs the graph-building engine (NetworkX + tree-sitter + graspologic + Claude extraction) locally. No server, no database, no Neo4j required.
- `graphify install` — registers the `/graphify` **skill** into your AI agent (e.g., Claude Code's skills folder) so the slash command works everywhere.

### Step 1.2 — Verify the install

```bash
graphify --help
```

If you see the help text with flags like `--update`, `--watch`, `--mcp`, you're good.

### Step 1.3 — Manual install (fallback, curl method)

If the pip route gives you trouble, you can install the skill file by hand:

```bash
mkdir -p ~/.claude/skills/graphify
curl -fsSL https://raw.githubusercontent.com/safishamsi/graphify/v1/skills/graphify/skill.md \
  > ~/.claude/skills/graphify/SKILL.md
```

Then add this block to your global `~/.claude/CLAUDE.md` so the agent knows when to trigger it:

```markdown
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.
```

---

## Part 2 — Build Your First Knowledge Graph

### Step 2.1 — Decide what goes in

Graphify is **fully multimodal**. It digests any mix of the following and connects them into one graph:

| Input type | Extensions | How it's extracted |
|---|---|---|
| Code | `.py .ts .js .go .rs .java .c .cpp .rb .cs .kt .scala .php` | AST parsing via tree-sitter + a call-graph pass |
| Docs | `.md .txt .rst` | Concept + relationship extraction via the LLM |
| Papers | `.pdf` | Citation mining + concept extraction |
| Images | `.png .jpg .webp .gif` | Vision analysis (screenshots, diagrams, whiteboards — even non-English) |

> **The Karpathy pattern:** The tool was designed around Andrej Karpathy's habit of keeping a `/raw` folder where he drops papers, tweets, screenshots, and notes. One folder for everything interesting, one command to make sense of it. Creating your own `raw/` drop-folder is a great way to start.

### Step 2.2 — Build it

Open Claude Code **in the directory you want to graph** (or point at one), and run:

```
/graphify .
```

That's it. Graphify will scan the files, extract nodes and edges, cluster them into communities, and write its output into a new `graphify-out/` folder. When it finishes, it prints a **token benchmark** showing how many fewer tokens queries cost now.

> **💰 Know before you build:** the *extraction* step uses the Claude API, so a first build on a big corpus spends real tokens (docs, PDFs, and images especially — code is mostly parsed cheaply via tree-sitter). Two mitigations: start with a **small test folder** to gauge quality and cost, and rely on `--update` afterward — incremental runs only re-process changed files, and code rebuilds in `--watch` mode are AST-only (no LLM at all). Queries *from* the graph are where you save; the build is the one-time-ish investment.

> **About that 71.5× number:** it's Graphify's own benchmark on their worked example corpus (52 mixed files). It's directionally honest — savings scale with corpus size — but treat it as marketing-grade, not a guarantee. Your numbers will depend on what you feed it.

### Step 2.3 — Use the right mode for the job

```
/graphify ./raw                  # graph a specific folder (e.g., your raw drop-zone)
/graphify ./raw --mode deep     # more aggressive INFERRED edge extraction (richer, slower)
/graphify ./raw --update        # only re-process files that changed, merge into the graph
```

The `--update` flag matters most as you iterate: a SHA256 cache lives in `graphify-out/cache/`, so re-runs skip unchanged files. Builds get cheaper over time.

### Step 2.4 — Feed it from the outside

You don't have to have files locally. You can pull sources straight in:

```
/graphify add https://arxiv.org/abs/1706.03762     # fetch + save a paper, update graph
/graphify add https://x.com/karpathy/status/...    # fetch + save a tweet, update graph
```

---

## Part 3 — Understand the Output

Every build produces the same folder structure. Know what each piece is for:

```
graphify-out/
├── graph.html       # Interactive graph in your browser — click nodes, search,
│                    # filter by community. Zero setup, just double-click it.
├── obsidian/        # A ready-made Obsidian vault (open this folder in Obsidian)
├── wiki/            # Wikipedia-style articles per community (with --wiki)
├── GRAPH_REPORT.md  # The headline analysis — read this first
├── graph.json       # The persistent graph itself. Query weeks later, no re-read.
└── cache/           # SHA256 cache — re-runs only process changed files
```

**Read `GRAPH_REPORT.md` first.** It gives you three things:

1. **God nodes** — the highest-degree concepts everything routes through. In a codebase this might be your core class; in research notes, the central theory.
2. **Surprising connections** — edges ranked by a composite score. Cross-type edges (code ↔ paper) rank above same-type ones, and each comes with a plain-English *why*.
3. **Suggested questions** — 4–5 questions the graph is uniquely positioned to answer. Great starting prompts for your agent.

**The honesty system.** Every edge is tagged:

| Tag | Meaning |
|---|---|
| `EXTRACTED` | Directly found in a file (a call, a citation, an explicit mention) |
| `INFERRED` | Reasoned out by the model — likely true, not guaranteed |
| `AMBIGUOUS` | Signals conflicted — surfaced deliberately rather than hidden |

When your agent answers from the graph, it can cite which tag each claim rests on. That's a meaningful hallucination guardrail.

---

## Part 4 — Set Up Obsidian

### Step 4.1 — Install Obsidian

Download from [obsidian.md](https://obsidian.md). Install, launch, skip any vault creation for now — Graphify will hand you a vault in the next section.

### Step 4.2 — Learn the three core features this stack uses

These are **built into Obsidian** — no plugins needed:

| Feature | What it does | How to open it |
|---|---|---|
| **Graph view** | Renders your whole vault as an interactive node network. Color by cluster, filter by tag, zoom into neighborhoods. | Ribbon icon, or `Ctrl/Cmd + G` |
| **Backlinks / Outgoing links** | Sidebar panels showing every note that links to (and from) the current one — this is how you *walk* the graph by hand. | Right sidebar |
| **Canvas** | An infinite board for laying out notes spatially. Graphify's export includes a Canvas layout of the graph communities. | Ribbon icon → "Create new canvas" |

### Step 4.3 — Community plugins (the ones actually worth installing)

Obsidian's community plugins are off by default. To enable them: `Settings → Community plugins → Turn on community plugins`. Then browse and install:

| Plugin | Priority | Why you want it for this stack |
|---|---|---|
| **Dataview** | ⭐ Essential | Graphify's Obsidian export ships notes with YAML frontmatter (type, community, etc.). Dataview turns that frontmatter into live queryable tables — e.g., "show me every INFERRED edge" or "list all nodes in community 3". |
| **Local REST API with MCP** | ⭐ Essential (for Part 7) | Lets your AI agent read, write, and search your vault directly from *inside* Obsidian. This is the bridge that makes the loop fully two-way. Details in Part 7. |
| **Templater** | Recommended | Auto-format new notes the agent creates so they match your frontmatter conventions. |
| **Excalidraw** | Optional | Hand-sketch diagrams that Graphify can later read as images and fold into the graph. Nice feedback loop. |
| **Smart Connections** | Optional | AI-powered semantic search *inside* Obsidian. Redundant with the graph for some workflows, but handy for quick fuzzy "what did I write about X?" lookups. |

> **Rule of thumb:** You strictly need **zero** plugins to view the graph (Graph view + Canvas are core). Add **Dataview** and **Local REST API with MCP** the moment you want queries and agent write-access.

---

## Part 5 — Connect Obsidian to the Graph

This is the moment the abstract graph becomes something you can *walk around in*. Every build already creates `graphify-out/obsidian/` — a folder formatted as an Obsidian vault: one markdown note per graph node, `[[wikilinks]]` for every edge, YAML frontmatter, Dataview-ready queries, and a Canvas layout.

### Step 5.1 — Pick your integration pattern

There are four patterns. Pick one **before** you open anything:

| Pattern | How it works | Best for |
|---|---|---|
| **Standalone vault** | Open `graphify-out/obsidian/` as its own separate vault. Graph notes never touch your personal notes. | First-timers. Safest, zero risk. |
| **Quarantine dump** ⭐ | Copy `graphify-out/obsidian/` into your main vault as a single subfolder (e.g., `Graph/`). All graph notes live in one deletable folder. | The recommended starting point once you want everything in one vault. |
| **Selective harvest** | Have the AI agent cherry-pick only the relevant nodes into your existing folders. | Large graphs where most nodes don't matter to you. |
| **Redistribution** | The agent re-files graph nodes into your existing folder taxonomy (PARA, etc.), merging with your notes. | Advanced; after you trust the graph quality. |

### Step 5.2 — Open it (Standalone pattern)

1. Launch Obsidian → **"Open folder as vault"**
2. Select `<your project>/graphify-out/obsidian/`
3. Trust the author when prompted (enables Dataview queries if bundled)
4. Press `Ctrl/Cmd + G` → you're looking at your knowledge graph, live

### Step 5.3 — Merge it (Quarantine pattern)

```bash
# Copy the exported vault into your main vault as one folder
cp -r /path/to/project/graphify-out/obsidian /path/to/your-main-vault/Graph
```

Then in your main vault, open **Graph view** and filter by `path:Graph` to see just the imported network, or open the Graph folder's Canvas for the community map.

**Why quarantine first?** Every node becomes a real markdown note. If the extraction disappointed you, you delete one folder and you're clean. Promote individual notes into your permanent folders only after they've earned it.

> **⚠️ The one real gotcha of this pattern:** the export is a **snapshot**, and re-importing is destructive. If you edit, annotate, or re-link notes inside the `Graph/` folder and then re-copy a fresh export over it later, **your edits are overwritten**. Rule of thumb: treat notes inside the quarantine folder as read-only reference. Notes you care about → promote them *out* of `Graph/` into your permanent folders first, then refresh the export freely. (Some Graphify versions include migration/update workflows like `vault-promote` with merge semantics — check `graphify --help` and the README for what your version supports before hand-rolling this.)

### Step 5.4 — What to look at first

1. The **Canvas file** — Graphify lays out communities spatially. Start here for the bird's-eye view.
2. The **god-node notes** — they have the most links; open one and browse its **Backlinks** panel to walk the graph.
3. Run a **Dataview query** (once the plugin is on) like:

   ````
   ```dataview
   TABLE community, edge_type
   FROM "Graph"
   WHERE edge_type = "INFERRED"
   ```
   ````

   *(Illustrative — the exact frontmatter fields depend on your Graphify version. Open any exported note and look at its `---` frontmatter block to see the real field names, then adjust the query to match.)*

---

## Part 6 — Connect Your AI Agent to the Graph

There are **three levels** of agent-graph connection. Go as deep as you need.

### Level 1 — The skill (already done)

You already have this: `/graphify query`, `/graphify path`, `/graphify explain` run inside Claude Code. The skill reads `graph.json` and answers without re-scanning your files.

```
/graphify query "what connects the auth module to the retry logic?"
/graphify path "DigestAuth" "Response"
/graphify explain "SwinTransformer"
```

### Level 2 — CLAUDE.md awareness (30 seconds, big payoff)

Tell the agent the graph exists so it reaches for it **by default** instead of grepping. Add to your project's `CLAUDE.md`:

```markdown
## Knowledge Graph

This project has a pre-built knowledge graph at `graphify-out/graph.json`
(report: `graphify-out/GRAPH_REPORT.md`, vault: `graphify-out/obsidian/`).

Before grep-reading source files to answer structural or "what connects X to Y"
questions, query the graph first via the graphify skill. Edge tags EXTRACTED /
INFERRED / AMBIGUOUS indicate confidence — cite them in answers.
```

This one block changes agent behavior permanently: graph-first, files-second.

### Level 3 — MCP server (the agent gets its own query tools)

**MCP (Model Context Protocol)** is the standard way to give an AI agent a set of callable tools. Here it means: the agent can call `query_graph`, `find_path`, etc. as structured tools, getting answers in milliseconds without loading any files into its context.

#### Option A — Graphify's built-in server

```
/graphify ./ --mcp
```

or directly:

```bash
python -m graphify.serve graphify-out/graph.json
```

This exposes tools like `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, and `shortest_path` over MCP stdio. To register it with Claude Code as a persistent server instead of running it ad-hoc:

```bash
claude mcp add graphify -- python -m graphify.serve /absolute/path/to/graphify-out/graph.json
```

Then restart Claude Code and confirm with `claude mcp list`. (Same registration pattern works for other MCP-capable agents via their config files.)

#### Option B — The dedicated query server (graph-query-mcp)

A community companion purpose-built for graphify graphs in Obsidian vaults. The differences that matter: it **loads the graph once at startup** (answers in <50ms), never spills the graph into context, and supports **two scopes** — e.g., a personal vault graph and a team vault graph queried by name.

Install it as a Claude Code plugin — open Claude Code and paste:

```
/plugin marketplace add adelaidasofia/graph-query-mcp
/plugin install graph-query-mcp@graph-query-mcp
```

> **🔌 Telemetry disclosure (worth knowing before installing):** per its own README, this plugin sends a **single anonymous install ping** (plugin name + version only — no user data, paths, or content) to the maintainer's domain the first time it loads on a machine. To opt out entirely, set the environment variable `MYCELIUM_NO_PING=1` before launching Claude Code. Graphify itself sends nothing of the sort; this is specific to this third-party companion.

Then point it at your graph via environment variables:

| Env var | Points to |
|---|---|
| `GRAPH_JSON_PATH` | Your primary graph: `.../Meta/graphify-out/graph.json` |
| `SECONDARY_GRAPH_JSON_PATH` | Optional second graph (e.g., team vault) |

Legacy/manual registration in `.mcp.json` looks like:

```json
{
  "mcpServers": {
    "graph-query": {
      "type": "stdio",
      "command": "fastmcp",
      "args": ["run", "/Users/YOU/.claude/graph-query-mcp/server.py"],
      "env": {
        "GRAPH_JSON_PATH": "/path/to/your/vault/graphify-out/graph.json"
      }
    }
  }
}
```

Restart the agent, then `claude mcp list` should show it connected.

**The tools your agent gets via graph-query-mcp:**

| Tool | What it answers |
|---|---|
| `search_nodes(query)` | "Find nodes named roughly like this" (fuzzy) |
| `get_neighbors(node, max_hops)` | "What's connected to X, within N hops?" |
| `find_path(source, target)` | "How do A and B relate?" — shortest path |
| `get_top_nodes(n)` | "What are the god nodes?" |
| `query_subgraph(concepts)` | "Show me the neighborhood around these ideas" |
| `get_node_info(node)` | Full metadata + top neighbors for one node |
| `get_community_members(node)` | "What else is in X's cluster?" |

Now instead of *"grep the codebase and guess,"* your agent calls `find_path("LoginFlow", "StripeWebhook")` and gets the actual chain of relationships, with tags.

---

## Part 7 — Let Your AI Agent Read/Write Obsidian Directly

Part 6 let the agent *query the graph*. This part lets it *act in your vault*: create notes from findings, append session summaries, file new sources. The bridge is the **Local REST API with MCP** community plugin (by Adam Coddington), which runs an MCP server *inside Obsidian itself*.

### Step 7.1 — Install the plugin

1. Obsidian → `Settings → Community plugins → Browse`
2. Search **"Local REST API"** → Install → Enable
3. Open the plugin's settings and **copy your API key**

The server runs at `https://127.0.0.1:27124/mcp/` — entirely local, nothing leaves your machine, and it only ever touches the currently open vault.

### Step 7.2 — Connect Claude Code

```bash
claude mcp add --transport http obsidian https://127.0.0.1:27124/mcp/ \
  --header "Authorization: Bearer YOUR-API-KEY-HERE"
```

(Cursor and other MCP-capable tools use the same URL + header pattern in their MCP config files.)

### Step 7.3 — What the agent can now do

The plugin exposes tools including `vault_read`, `vault_write`, `vault_append`, `vault_patch` (surgical edits by heading/frontmatter), `vault_delete`, `search_query`, `command_execute` (trigger any Obsidian command!), and more.

That completes the full loop:

```
You drop a paper in raw/  →  /graphify ./raw --update  →  graph refreshes
        →  agent answers from the graph (MCP query)
        →  agent writes its summary back into a vault note (MCP write)
        →  you see it in Obsidian, linked into the graph
```

---

## Part 8 — Keep Everything Fresh (Automation)

A stale graph is a lying graph. Three automation layers, mix and match:

| Mechanism | Command | Behavior |
|---|---|---|
| **Manual incremental** | `/graphify ./raw --update` | Re-processes only files whose SHA256 changed; merges into the existing graph. Your everyday refresh. |
| **Watch mode** | `/graphify ./raw --watch` | Background terminal process. Code saves trigger an instant AST-only rebuild (no LLM cost); doc/image changes notify you to run `--update`. Great when multiple agents are writing code in parallel. |
| **Git hook** | `graphify hook install` | Installs a post-commit hook that rebuilds the graph on every commit. No background process, editor-agnostic, coexists with existing hooks. |

**Suggested cadence:**
- Solo note/research vault → `--update` whenever you add a batch of sources.
- Active codebase → `graphify hook install` once, forget about it.
- Multi-agent coding sessions → `--watch` in a spare terminal tab.

If you imported the graph into Obsidian (Part 5), remember that the **vault export is a snapshot** — re-copy the `obsidian/` folder after big updates (or delete the old `Graph/` folder and re-import) to bring Obsidian current. And mind the warning in Part 5: re-importing **overwrites any edits you made inside the graph folder** — promote notes you care about out of the quarantine folder before refreshing.

---

## Part 9 — Everyday Workflows & Recipes

### Recipe A — Research second brain

1. Drop papers/articles/screenshots into `raw/` as you encounter them
2. `/graphify ./raw --update`
3. Open the vault in Obsidian; check the Canvas for new clusters
4. Ask the agent: *"What in my graph relates to X?"* → it calls `search_nodes` + `get_neighbors`
5. Have the agent write a synthesis note into your vault (`vault_write`) with `[[links]]` to the source nodes

### Recipe B — Codebase onboarding

1. `/graphify .` on an unfamiliar repo
2. Read `GRAPH_REPORT.md` god nodes → those are the files to read first
3. `/graphify explain "PaymentProcessor"` — the agent's answer cites EXTRACTED vs INFERRED edges
4. `find_path("UIComponent", "DatabaseLayer")` when you need the real dependency chain

### Recipe C — Meeting/idea capture

1. Take rough notes in Obsidian as normal
2. Weekly: `/graphify . --update` on the vault folder
3. Review the report's **surprising connections** — cross-project links you didn't notice
4. Promote the good ones out of the quarantine folder into permanent notes

### Recipe D — The wiki for agents *(optional extras)*

```
/graphify ./raw --wiki
```

Generates Wikipedia-style markdown articles per community and god node, with an `index.md` entry point. Point any agent (even ones without MCP) at `index.md` and it can navigate your knowledge base by reading files instead of parsing JSON.

**Other export formats for other tools:**

```
/graphify ./raw --svg        # graph.svg for docs/presentations
/graphify ./raw --graphml    # for Gephi / yEd power analysis
/graphify ./raw --neo4j      # generates cypher.txt if you want a real graph DB
```

---

## Command Cheat Sheets

### Graphify (run inside Claude Code unless noted)

| Command | Does |
|---|---|
| `/graphify` | Build a graph of the current directory |
| `/graphify ./raw` | Build from a specific folder |
| `/graphify ./raw --mode deep` | Aggressive INFERRED edge extraction |
| `/graphify ./raw --update` | Incremental rebuild (changed files only) |
| `/graphify add <url>` | Fetch a paper/tweet, save, update graph |
| `/graphify query "..."` | Ask a natural-language question of the graph |
| `/graphify path "A" "B"` | Shortest relationship path between two nodes |
| `/graphify explain "X"` | Explain a node with edge-tag citations |
| `/graphify ./raw --watch` | Auto-sync on file changes |
| `/graphify ./raw --wiki` | Build agent-crawlable wiki articles |
| `/graphify ./raw --mcp` | Serve the graph over MCP stdio |
| `/graphify ./raw --svg` / `--graphml` / `--neo4j` | Alternate export formats |
| `graphify install` (terminal) | Register the skill with your agent |
| `graphify hook install` (terminal) | Auto-rebuild on every git commit |
| `python -m graphify.serve graphify-out/graph.json` (terminal) | MCP server, direct invocation |

### Obsidian essentials

| Action | How |
|---|---|
| Graph view | `Ctrl/Cmd + G` |
| Local graph (current note only) | Command Palette → "Open local graph" |
| Command palette | `Ctrl/Cmd + P` |
| Quick switcher (jump to note) | `Ctrl/Cmd + O` |
| New canvas | Ribbon → "Create new canvas" |
| Follow a `[[link]]` | `Ctrl/Cmd + Click` |
| Filter graph view to a folder | In Graph view search: `path:Graph` |
| Show backlinks pane | Right sidebar toggle |

### Agent connection (terminal)

| Command | Does |
|---|---|
| `claude mcp list` | Verify MCP servers are connected |
| `claude mcp add --transport http obsidian https://127.0.0.1:27124/mcp/ --header "Authorization: Bearer KEY"` | Connect Claude Code to Obsidian's built-in MCP |
| `/plugin marketplace add adelaidasofia/graph-query-mcp` + `/plugin install graph-query-mcp@graph-query-mcp` | Install the dedicated graph-query MCP plugin |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `graphify: command not found` on Windows | Add `%APPDATA%\Python\Python3xx\Scripts` to PATH (replace `3xx`, e.g. `313`), or reinstall with `pipx install graphifyy` |
| `externally-managed-environment` on macOS | Use `pipx install graphifyy` instead of `pip` |
| `/graphify` does nothing in Claude Code | Run `graphify install` again; check `~/.claude/skills/graphify/SKILL.md` exists (curl fallback in Step 1.3) |
| Install confusion: `graphify` vs `graphifyy` | The **PyPI package** is temporarily `graphifyy`; the **command** and **skill** are `graphify`. Normal and intentional. |
| Graph seems stale after edits | Run `/graphify <folder> --update`. The SHA256 cache means unchanged files are skipped, so it's fast. |
| Obsidian vault copy outdated | The `obsidian/` export is a snapshot — re-copy it (or delete + re-import the quarantine folder) after major updates |
| Agent still greps instead of using the graph | Add/strengthen the CLAUDE.md block from Part 6, Level 2; MCP (Level 3) makes graph-first the path of least resistance |
| MCP server won't connect | `claude mcp list` to inspect; check `GRAPH_JSON_PATH` points to a real `graph.json`; restart the agent after config edits |
| Obsidian MCP: connection refused | The vault must be **open** in Obsidian — the plugin's server only runs while Obsidian runs, on that vault |
| Obsidian MCP: certificate warnings | The plugin uses a self-signed cert on 27124; either trust it or use the HTTP fallback on port 27123 |
| Extraction quality complaints | Honest answer: check the edge tags. INFERRED-heavy areas benefit from `--mode deep` re-runs or from adding a plain-language note that states the relationship explicitly |

---

## Video Library (Clickable YouTube References)

> *Links and titles verified September 2026 via search. Skim before relying — this tool evolves fast and older videos may show outdated install commands. When a video conflicts with this guide, the [official repo README](https://github.com/safishamsi/graphify) wins.*

**Graphify + AI agents:**

1. 🎥 [Graphify: Turn Your Codebase into a Queryable Knowledge Graph for Claude Code](https://www.youtube.com/watch?v=AkP7-uBB7hc) — official install → build → query walkthrough, with the token-savings demo
2. 🎥 [Graphify + Obsidian: Build an AI Second Brain That Never Forgets (Real Setup)](https://www.youtube.com/watch?v=rtutpoT4SYg) — the full vault export + Canvas visualization workflow from this guide, on screen
3. 🎥 [Graphify + Claude Code = The Ultimate Second Brain](https://www.youtube.com/watch?v=H-uVd08niDU) — the three-pass extraction system explained (tree-sitter / vision / LLM)
4. 🎥 [Build a Knowledge Graph in 60s (Graphify Tutorial)](https://www.youtube.com/watch?v=Ji4Koip_iOk) — rapid-fire setup short, good for a first taste

**Obsidian skills this guide leans on:**

5. 🎥 [How To Use The Obsidian Dataview Plugin (2026 Guide)](https://www.youtube.com/watch?v=qjx3IU9PAdk) — everything you need for the frontmatter queries in Part 8
6. 🎥 [How to Graph View in Obsidian (Step by Step)](https://www.youtube.com/watch?v=J7GXtmTwGIk) — filters, groups, colors: making the graph view actually readable
7. 🎥 [Using Canvas in Obsidian](https://www.youtube.com/watch?v=hwfk5CS_Zhw) — 58-second Canvas orientation

---

## Written References & Repos

**Core projects:**
- 📦 [safishamsi/graphify](https://github.com/safishamsi/graphify) — the official Graphify repo (install docs, worked examples, architecture)
- 🔌 [adelaidasofia/graph-query-mcp](https://github.com/adelaidasofia/graph-query-mcp) — the dedicated MCP query server for graphify graphs
- 🧩 [Local REST API with MCP — Obsidian plugin page](https://community.obsidian.md/plugins/obsidian-local-rest-api) — the Obsidian-side bridge

**Deep-dive articles:**
- 📄 [Claude Code Knowledge Graph Setup (Graphify + Obsidian) — Charlie Automates](https://charlieautomates.com/blog/claude-code-knowledge-graph-graphify-obsidian/)
- 📄 [The Claude Code Knowledge Graph Stack — Modern Creator](https://moderncreator.app/2026-06-08-chase-ai-the-claude-code-knowledge-graph-stack)
- 📄 [Build an AI Second Brain with Graphify, Obsidian, and Claude — Stork.AI](https://www.stork.ai/blog/the-ai-brain-that-never-forgets)
- 📄 [How to Use Graphify to Build a Queryable Knowledge Graph for Your AI Agent — MindStudio](https://www.mindstudio.ai/blog/graphify-knowledge-graph-ai-agent)
- 📄 [How to Connect Obsidian to AI Agents (MCP Setup) — Tony Reviews Things](https://www.tonyreviewsthings.com/how-to-connect-obsidian-to-ai-agents/)
- 📄 [Obsidian: The Complete Guide to Building a Powerful AI Knowledge Base in 9 Steps — Data Science Dojo](https://datasciencedojo.com/blog/obsidian-ai-knowledge-base/)

---

## Glossary

| Term | Plain-English meaning |
|---|---|
| **Knowledge graph** | A network of *nodes* (things: concepts, functions, papers) and *edges* (relationships between them), so structure is data — not something you re-derive by reading. |
| **Node / Edge** | A dot / a line between dots. In Graphify, edges carry a type and an honesty tag. |
| **EXTRACTED / INFERRED / AMBIGUOUS** | Graphify's confidence tags: found in a file / reasoned by the model / conflicting evidence. |
| **God node** | The highest-degree node(s) — the concepts everything else connects through. |
| **Community** | An auto-detected cluster of tightly connected nodes (via Leiden clustering). Roughly = a topic or subsystem. |
| **Skill** | A packaged workflow file your AI agent invokes via slash command. `/graphify` is a skill. |
| **MCP (Model Context Protocol)** | A standard for giving AI agents callable tools (servers) — here, graph queries and vault operations. |
| **Vault** | An Obsidian "workspace" = one folder of markdown notes. |
| **Wikilink** | Obsidian's `[[double-bracket]]` link. Graphify exports edges as wikilinks so graph = notes. |
| **Frontmatter** | YAML metadata at the top of a note (`---` block). Dataview queries against it. |
| **Quarantine dump** | Importing the whole graph export as one deletable vault subfolder until trust is earned. |

---

## FAQ & Next Steps

**Does Graphify need Neo4j or any server/database?**
No. It's NetworkX in-process, runs entirely locally, outputs plain files. Neo4j export (`--neo4j`) exists if you *want* one later.

**Does it only work with Claude Code?**
Claude Code is the primary target, but the skill format also works with Codex, OpenCode, Cursor, Gemini CLI, Copilot CLI, Aider, and Trae.

**Is my data sent anywhere?**
Extraction uses the Claude API (that's how concepts get pulled from docs/images); the graph, cache, and vault all live on your machine. The Obsidian MCP bridge is localhost-only.

**How big can a corpus get before this stops helping?**
It goes the other way: token savings scale with corpus size (worked examples go from ~1× on 6 files to 71.5× on 52). Small corpora benefit structurally; big ones benefit structurally *and* financially.

**Can I have two vaults' graphs queryable at once?**
Yes — `graph-query-mcp` supports a primary + secondary scope (e.g., personal and team) via `GRAPH_JSON_PATH` and `SECONDARY_GRAPH_JSON_PATH`.

**How do I undo all of this? (Uninstall / cleanup)**
The stack is designed to be removable in layers. Delete the `graphify-out/` folder (and any imported `Graph/` folder in your vault) to drop the graph and its notes. Remove the skill with `rm -rf ~/.claude/skills/graphify` and the package with `pip uninstall graphifyy` (or `pipx uninstall graphifyy`). Remove MCP registrations with `claude mcp remove <name>` (and `/plugin uninstall` for graph-query-mcp). In Obsidian, disable/remove community plugins from `Settings → Community plugins`. Your original source files are never modified by any of this — Graphify only reads them.

**Suggested next steps, in order:**
1. ✅ Get through Part 2 (first graph built)
2. ✅ Part 5 with the **quarantine dump** pattern
3. ✅ Part 6, **Level 2** (CLAUDE.md block) — best effort-to-payoff ratio in this guide
4. Automation (Part 8): pick `--update` *or* the git hook
5. Graduate to MCP (Part 6, Level 3) and the Obsidian bridge (Part 7) once the loop feels natural
6. Consider folding the graph into a larger vault structure (PARA / Ideaverse ACE profile support exists via the vault adapter)

---

*Guide ends. Everything above was verified against the official Graphify repository and linked sources as of September 2026 — but this space moves fast, so when in doubt, the [official repo README](https://github.com/safishamsi/graphify) is the source of truth.*
