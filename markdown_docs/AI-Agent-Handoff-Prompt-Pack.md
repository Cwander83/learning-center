# 🎁 AI Agent Deep-Dive Handoff Prompt Pack

> **Five ready-to-paste prompts. Each one turns any capable AI into a guide-writing machine for one agentic-coding superpower.**
>
> Built September 2026 · Companion to *The Complete Guide: AI Agents + Graphify + Obsidian*

---

## How to Use This File

1. **Pick a topic** below (1–5).
2. **Copy the entire code block** in that section — everything between the ```` ``` ```` fences is the prompt.
3. **Paste it into a fresh session** of any AI agent — Claude, ChatGPT, Gemini, Cursor, Copilot, whatever you like. Each prompt is fully self-contained; the AI needs zero prior context.
4. **Receive your guide.** The AI will produce one elaborate Markdown file in the exact house style of your Graphify guide.
5. **Optional HTML phase.** Each prompt ends with a built-in offer: after the guide, you can say "yes, build the HTML" and get the single-file interactive version (dark/light toggle, search, copy buttons, checklist).

**Tips for best results:**
- Use an AI **with web-search/fetch access** when possible — the prompts instruct the AI to verify every command, install step, and link against primary sources. Without web access it will still write the guide, but it must label unverified claims (the prompt requires this honesty).
- One topic per session. Don't stack two prompts in one chat — each is designed to use the full context budget for depth.
- Save the output as `.md` and drop it straight into your Obsidian vault; it's vault-ready.

## Why These Prompts Work (The Anatomy)

Every prompt embeds the same skeleton, so all five guides come out as siblings:

- **Role & reader** — sets expertise level and who the guide is for (you: semi-technical, learns by doing)
- **Locked house style** — Big Picture → 60-second TL;DR → Prerequisites → numbered Parts/Steps → Cheat Sheets → Troubleshooting → Video Library → References → Glossary → FAQ
- **Agent-agnostic mandate** — commands and configs for multiple tools (Claude Code, Cursor, Codex, ChatGPT, Gemini), not just one ecosystem
- **Honesty rules** — verify against primary sources, never invent URLs, label vendor benchmarks as marketing-grade, disclose costs/telemetry/risks in callouts, mark anything unverifiable
- **Topic outline** — the specific parts the guide must cover for that superpower
- **HTML phase trigger** — the optional interactive conversion, matching your Graphify experience

---
---

# 1️⃣ Custom MCP Servers — Give Your Agents New Hands

**What this guide will give you:** the complete path from "MCP consumer" to "MCP builder" — what the protocol actually is, how transports work, building your first FastMCP server, registering it in every major agent, safe tool design, and deployment. The level-up from using graph-query-mcp to writing your own graph-query-mcp.

**The handoff prompt — copy everything in the block:**

```
Act as a senior developer-tooling engineer who builds production MCP (Model Context Protocol) servers and writes documentation used by real teams. Write for a semi-technical reader who learns by doing — comfortable on a terminal, new to building MCP servers.

DELIVERABLE: One elaborate, all-inclusive how-to/reference guide as a single Markdown file. Title: "The Complete Guide: Building Custom MCP Servers for AI Agents". Beginner-friendly but thorough, plain English, second person ("you"). Long-form depth over brevity.

LOCKED HOUSE STYLE — use exactly this structure:
1. Title block with a one-line purpose statement and "Last verified: <current month year>"
2. What You're Building (The Big Picture) — include an ASCII architecture diagram (Agent/Client <-> MCP Server <-> your data/APIs) and a table mapping each concept to a plain-English analogy
3. The 60-Second Version (TL;DR) — minimal code/flow up front
4. Prerequisites — table with requirement, why, how to check/get
5. Numbered PARTS with numbered STEPS (Part 1, Step 1.1, Step 1.2…), every command in fenced code blocks
6. Command Cheat Sheets — tables
7. Troubleshooting — symptom → fix table
8. Video Library — clickable YouTube links with one-line descriptions
9. Written References & Repos — official docs and repos
10. Glossary — table of plain-English definitions
11. FAQ & Next Steps — including a suggested progression of next steps
12. Closing note on verification status and the source of truth

REQUIRED COVERAGE (build one Part per theme, roughly in this order):
- Mental model: what MCP is and why people call it "USB-C for AI agents"; clients vs servers; tools vs resources vs prompts; stdio vs HTTP/SSE/streamable transports — with a decision table for when to use which
- Installation & first server: Python 3.10+, uv or pipx, FastMCP; a complete minimal working server (one read-only tool) from zero to running
- A real end-to-end build: a small but genuinely useful server (e.g., a notes/todo store or a read-only wrapper around a local API) with full, runnable code
- Registering it in every major client: `claude mcp add`, project `.mcp.json`, Claude Desktop config (including the mcp-remote bridge for HTTP servers when needed), Cursor's mcp.json — agent-agnostic coverage, not Claude-only
- Safe tool design: read vs write tools, draft-and-confirm patterns for mutations, input validation, secrets/env handling, and a privacy/telemetry callout (what data leaves the machine)
- Debugging & testing: inspector/dev tooling, logs, smoke-test patterns
- Distribution: running locally vs hosting over HTTP, versioning, sharing as a plugin/marketplace package, update story

HONESTY RULES (non-negotiable):
- Verify every command, package name, config path, and flag against official primary sources using web search/fetch if you have it — MCP and FastMCP move fast and AI training data is often stale here
- NEVER invent URLs, repo names, flag names, or version numbers
- Where a claim can't be verified, say so explicitly and tell the reader how to check (e.g., `fastmcp --version`, official docs URL)
- Use callout boxes for: costs (if any), security risks, anything that varies by client version
- Distinguish "verified as of <date>" from "this changes fast — check the docs"

AGNOSTICISM: This is for *any* AI agent user, not just Claude. Give each client's config where it differs, and note which clients lack a given capability.

Only ask me clarifying questions if you are genuinely blocked; otherwise make sensible defaults, state them, and proceed. Deliver the complete Markdown guide in full — do not summarize or truncate.

AFTER THE GUIDE: ask me once whether I want the optional Phase 2 — conversion into a single self-contained interactive HTML file (dark/light theme toggle, sticky scroll-spy navigation, full-text search, copy buttons on code blocks, filterable cheat-sheet tables, accordion FAQ/troubleshooting, and a progress-saving checklist). Only build it if I say yes.
```

---
---

# 2️⃣ Subagents & Agent Orchestration — Running the Team

**What this guide will give you:** the formal discipline behind what you're already doing informally — mental models for agent teams, Claude Code's subagent files end-to-end, orchestration patterns (pipeline, fan-out, review loops), per-agent permission scoping, and the failure modes that waste tokens and burn repos.

**The handoff prompt — copy everything in the block:**

```
Act as a staff engineer who runs multi-agent AI coding setups in production and teaches internal workshops on agent orchestration. Write for a semi-technical reader who already uses AI coding agents daily and runs "different agents and sub-agents" informally — they want the real discipline.

DELIVERABLE: One elaborate, all-inclusive how-to/reference guide as a single Markdown file. Title: "The Complete Guide: Subagents & Agent Orchestration for AI Coding". Beginner-friendly entry ramp but expert-grade depth; plain English; second person. Long-form over brevity.

LOCKED HOUSE STYLE — same skeleton as a professional reference: Title block with "Last verified: <current month year>" → Big Picture with ASCII diagram (orchestrator → specialized workers) and analogy table → 60-Second TL;DR → Prerequisites table → numbered PARTS with numbered STEPS, all configs in fenced code blocks → Command/Config Cheat Sheets (tables) → Troubleshooting (symptom → fix table) → Video Library (clickable YouTube links, one-line descriptions) → Written References & Repos → Glossary table → FAQ & Next Steps → closing verification note.

REQUIRED COVERAGE (one Part per theme, roughly this order):
- Mental models: single agent vs orchestrator-worker vs pipeline vs router; a decision table for "when should I actually spawn a subagent vs do it inline"
- Claude Code subagents end-to-end: the .claude/agents/ directory, markdown agent files with frontmatter (name, description, tools, model), how invocation works (explicit vs automatic delegation), with at least three complete example agent files — e.g., a read-only researcher, a test-writing specialist, a skeptical code reviewer
- Permission scoping per subagent: tool allow-lists, read-only agents, why least-privilege matters when agents delegate
- Orchestration patterns with concrete prompt/config examples: sequential pipeline, parallel fan-out with fan-in merge, and a critic/review loop; how context is (and isn't) passed between agents; preventing token blowups
- The equivalent in other ecosystems: how Cursor, ChatGPT agent mode, Copilot, and CLI tools like Codex handle multi-agent or background work — note honestly where capabilities differ
- Failure modes & anti-patterns: over-delegation, context loss between hops, conflicting edits to the same files, infinite review loops — each with the fix
- A worked scenario end-to-end: e.g., "ship a small feature with a researcher → implementer → reviewer pipeline" with the actual prompts used at each hop

HONESTY RULES: Verify subagent file formats, frontmatter fields, and CLI behaviors against official docs using web search/fetch if available — this feature area evolves quickly. Never invent config keys, file paths, or capabilities; label anything version-dependent; call out clearly where tools genuinely differ (don't paper over ecosystem gaps). Use callouts for cost implications (parallel agents multiply token spend) and for any feature that exists in one client but not another.

AGNOSTICISM: Center Claude Code (most complete subagent system) but give every other major agent honest, specific coverage — not hand-waving.

Only ask clarifying questions if genuinely blocked; otherwise state your defaults and proceed. Deliver the complete Markdown guide in full.

AFTER THE GUIDE: ask me once whether I want the optional Phase 2 — conversion into a single self-contained interactive HTML file (dark/light theme toggle, sticky scroll-spy nav, full-text search, copy buttons, filterable cheat sheets, accordion FAQ/troubleshooting, progress-saving checklist). Only build it if I say yes.
```

---
---

# 3️⃣ Vector Memory & Semantic Search (RAG) — Fuzzy Recall for Agents

**What this guide will give you:** the missing half of the memory stack. Graphify gives agents *structured* memory (how things connect); this gives them *semantic* memory (what's similar) — embeddings, chunking, Chroma/pgvector, hybrid search, an MCP recall server, and the cost/privacy tradeoffs between API and local models.

**The handoff prompt — copy everything in the block:**

```
Act as an ML engineer who has shipped retrieval-augmented generation (RAG) systems for real products and writes clear internal guides. Write for a semi-technical reader who learns by doing — comfortable with Python basics and the terminal, new to embeddings and vector stores. Assume they already run a knowledge-graph tool (graph + markdown vault) and want the complementary semantic layer.

DELIVERABLE: One elaborate, all-inclusive how-to/reference guide as a single Markdown file. Title: "The Complete Guide: Vector Memory & Semantic Search (RAG) for AI Agents". Plain English, second person, beginner-friendly ramp with real depth. Long-form over brevity.

LOCKED HOUSE STYLE: Title block with "Last verified" → Big Picture with ASCII diagram (documents → chunk → embed → vector store ← agent query) and a table contrasting STRUCTURAL memory (knowledge graphs: "how are things connected?") vs SEMANTIC memory (embeddings: "what's similar?") — including when each wins → 60-Second TL;DR → Prerequisites table → numbered PARTS with numbered STEPS, all code runnable in fenced blocks → Cheat Sheets → Troubleshooting → Video Library (clickable YouTube links) → Written References & Repos → Glossary → FAQ & Next Steps → closing verification note.

REQUIRED COVERAGE (one Part per theme):
- Foundations: what embeddings are, distance/similarity intuition, why chunking strategy makes or breaks retrieval, common chunking patterns with rules of thumb
- Choose your stack (decision table + setup for each): Chroma for local-first, pgvector if you're already on Postgres; mention Qdrant and hosted options honestly with tradeoffs
- The end-to-end build: ingest a folder of markdown/docs → chunk → embed (one API option AND one fully local option, e.g., Ollama-based, so privacy-conscious readers have a path) → store → query, with complete runnable Python
- Hybrid retrieval: combining keyword (BM25) with vector search, and when hybrid beats pure vector
- Connecting to agents: expose the store as a small MCP server (search tool) and give client registration snippets for the major agents; include a no-code alternative path (e.g., Obsidian semantic-search plugins) for readers who never want to write Python
- Memory patterns for agents: episodic (session logs) vs semantic (knowledge) memory, write-back/dedup/staleness handling, and how this complements a knowledge graph rather than replacing it
- Cost & privacy callouts: embedding API pricing ballparks (clearly dated), local-model hardware realities, telemetry/data-residency notes

HONESTY RULES: Verify package names, imports, model names, and API surfaces against official docs via web search/fetch if available — embedding model lineups change fast. Never invent model names, dimensions, or pricing. Date any pricing claims. Call out clearly-marked "your mileage will vary" areas (chunk sizes, model choice).

Only ask clarifying questions if genuinely blocked; otherwise state defaults and proceed. Deliver the complete guide in full.

AFTER THE GUIDE: ask me once whether I want the optional Phase 2 — a single self-contained interactive HTML version (dark/light toggle, scroll-spy nav, full-text search, copy buttons, filterable cheat sheets, accordion FAQ/troubleshooting, progress-saving checklist). Only build it if I say yes.
```

---
---

# 4️⃣ Git Worktrees, Hooks & Parallel Agent Safety — Agents That Don't Collide

**What this guide will give you:** the craft of running several coding agents at once without merge chaos — one worktree per agent, hooks as hard guardrails, per-agent permission sandboxes, and a review pipeline that keeps a human in charge of what merges.

**The handoff prompt — copy everything in the block:**

```
Act as a principal engineer who runs fleets of parallel AI coding agents against real repositories and has strong opinions about guardrails. Write for a semi-technical reader comfortable with git basics (clone, branch, commit, merge) who runs multiple AI coding agents and has already felt the pain of agents colliding.

DELIVERABLE: One elaborate, all-inclusive how-to/reference guide as a single Markdown file. Title: "The Complete Guide: Git Worktrees, Hooks & Parallel Agent Safety". Plain English, second person. Long-form over brevity.

LOCKED HOUSE STYLE: Title block with "Last verified" → Big Picture with ASCII diagram (main repo + N worktrees, one agent each, merge gate in front of main) and analogy table (worktree = contractor's own workshop, hook = building inspector, etc.) → 60-Second TL;DR → Prerequisites → numbered PARTS with numbered STEPS, every command in fenced code blocks → Command Cheat Sheets (split: git commands / agent config commands) → Troubleshooting (symptom → fix) → Video Library (clickable YouTube) → Written References & Repos → Glossary → FAQ & Next Steps → closing verification note.

REQUIRED COVERAGE (one Part per theme):
- Why parallel agents collide: the shared-working-tree problem in concrete terms, with a horror-story example
- Git worktrees end-to-end: `git worktree add` / `list` / `remove` / `prune`, one-branch-per-agent conventions, naming schemes, tracking which agent owns which worktree
- Isolation beyond git: directory scoping, environment separation (node_modules/venv per worktree realities), and when containers or devcontainers are worth it
- Hooks as guardrails — two layers, covered separately: (a) git hooks (pre-commit: lint, typecheck, tests before anything merges) with complete working examples, and (b) agent-native hook systems (e.g., Claude Code's settings hooks that run shell commands on tool events) with concrete configs
- Permission sandboxing per agent: tool permission systems across the major agents, safe defaults, and an unflinching callout about dangerous flags (e.g., permission-bypass modes) — when they exist, why people use them, and why you shouldn't on repos you care about
- The human merge gate: review workflow for N agent branches, PR-per-agent pattern, resolving agent-vs-agent conflicts, test-gates-before-merge
- A complete worked scenario: two agents building two features in two worktrees simultaneously, with the exact commands from setup through merge

HONESTY RULES: Verify git subcommand flags and each agent's actual permission/hook mechanisms against official docs via web search/fetch if available. Never invent flags or config keys. Ecosystems differ — say exactly which agent supports which layer, and say "not supported" plainly where true. Use callouts for anything destructive (`git worktree remove --force`, bypass modes).

Only ask clarifying questions if genuinely blocked; otherwise state defaults and proceed. Deliver the complete guide in full.

AFTER THE GUIDE: ask me once whether I want the optional Phase 2 — a single self-contained interactive HTML version (dark/light toggle, scroll-spy nav, full-text search, copy buttons, filterable cheat sheets, accordion FAQ/troubleshooting, progress-saving checklist). Only build it if I say yes.
```

---
---

# 5️⃣ Spec-Driven Development & Context Engineering — Steering Your Agents

**What this guide will give you:** the steering layer — CLAUDE.md/AGENTS.md architecture across every tool, progressive disclosure so agents load only what they need, agent-executable specs as contracts, token economics, and how to keep context fresh on long projects.

**The handoff prompt — copy everything in the block:**

```
Act as an AI-engineering lead who designs context systems for teams running AI coding agents at scale, and who coined the team's phrase: "the spec is the source of truth; the prompt is just the delivery truck." Write for a semi-technical reader who uses AI agents daily and wants them to stop thrashing.

DELIVERABLE: One elaborate, all-inclusive how-to/reference guide as a single Markdown file. Title: "The Complete Guide: Spec-Driven Development & Context Engineering for AI Agents". Plain English, second person, beginner-friendly ramp with expert depth. Long-form over brevity.

LOCKED HOUSE STYLE: Title block with "Last verified" → Big Picture with ASCII diagram (spec → context files → agent → verified output) and analogy table (context file = employee handbook, spec = work order, compaction = shift handover notes) → 60-Second TL;DR → Prerequisites → numbered PARTS with numbered STEPS, every file/config in fenced blocks → Cheat Sheets → Troubleshooting → Video Library (clickable YouTube) → Written References & Repos → Glossary → FAQ & Next Steps → closing verification note.

REQUIRED COVERAGE (one Part per theme):
- Context files across ecosystems: CLAUDE.md, AGENTS.md, .cursor/rules, and equivalents — hierarchy, precedence, global vs project vs directory scoping — with copy-ready templates for each
- Progressive disclosure: keeping the main context lean; reference files and skills loaded just-in-time; concrete before/after example of a bloated context file refactored into layered docs
- Spec-driven workflow: the spec → plan → tasks pattern (in the spirit of open spec toolkits); writing acceptance criteria an agent can actually verify; a complete example spec for a small feature, then the agent prompts that execute against it
- Token economics: how to think about the context window as a budget; compaction/summarization strategies for long sessions; handoff documents between sessions and between agents (a handoff template included — fitting, since this whole guide came from one)
- Team-scale context: shared AGENTS.md conventions, docs-as-code hygiene, preventing staleness, versioning context alongside code
- Anti-patterns: monolithic omnibus prompts, stale instructions silently overriding behavior, conflicting rules across nested context files — each with detection steps and fixes
- A worked scenario: same feature built twice — once with a lazy one-shot prompt, once spec-driven — with an honest comparison of the outcomes

HONESTY RULES: Verify file names, locations, and precedence behavior for each tool against official docs via web search/fetch if available — conventions here are young and shifting. Never invent config keys or magic file names. Where practice is opinion rather than fact, label it ("widely used pattern" vs "officially supported"). Include a callout that this field's conventions move fast.

Only ask clarifying questions if genuinely blocked; otherwise state defaults and proceed. Deliver the complete guide in full.

AFTER THE GUIDE: ask me once whether I want the optional Phase 2 — a single self-contained interactive HTML version (dark/light toggle, scroll-spy nav, full-text search, copy buttons, filterable cheat sheets, accordion FAQ/troubleshooting, progress-saving checklist). Only build it if I say yes.
```

---
---

## 🔀 Suggested Order (If You Plan to Do All Five)

1. **#5 Spec-Driven & Context Engineering** — it's the steering layer for everything else, and the handoff-template section literally improves how you use the other four prompts
2. **#4 Worktrees & Hooks** — safety rails before you scale up agent count
3. **#2 Subagents & Orchestration** — now you can run the team safely
4. **#1 Custom MCP Servers** — gives the team new hands
5. **#3 Vector Memory / RAG** — completes the memory stack you started with Graphify

*(No wrong answers, though. #1 is the most fun first if you want instant payoff.)*

---

*Each prompt was built to produce a guide with the same honesty standards as your Graphify guide: verified commands, labeled uncertainty, cost/telemetry disclosures, and an optional interactive HTML phase. If a tool's docs have moved on by the time you run one, the prompt's built-in verification rules will catch it.*
