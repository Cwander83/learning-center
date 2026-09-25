# The Complete Guide: Recent AI Features Worth Learning in 2026

> MCP went stateless. Skills turned prompts into files. Voice models reason while they talk. This is the year's feature set, what each one is actually for, and the install command for every one of them.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Ask "what's new in AI?" and you get a press-release list. That is useless for deciding what to learn. The useful framing is: **what changed shape?** A feature matters when it changes how you build, not when it changes a benchmark.

Four things changed shape in 2026:

1. **MCP went stateless.** The protocol that lets agents reach your tools became a plain request/response HTTP protocol. You can deploy a server behind a round-robin load balancer, no sticky sessions.
2. **Skills became files.** "Prompt engineering" turned into authoring a directory with a `SKILL.md` in it. Expertise is now a versioned artifact you commit.
3. **Voice became agentic.** Realtime models now reason and call tools mid-conversation, instead of being a speech-to-text pipe feeding a text model.
4. **Agents became an API primitive.** Both OpenAI and Vercel shipped an agent abstraction with tools, handoffs, and approvals as first-class concepts, rather than something you reassemble from a loop every time.

Everything else — the model releases, the video generators, the pricing — changes monthly and is worth a search, not a guide.

```
   HOW THE PIECES FIT TOGETHER

   ┌──────────────────────────────────────────────────────────────┐
   │  YOUR AGENT (Claude Code, opencode, a custom loop, …)        │
   └───────────────┬──────────────────────────┬───────────────────┘
                   │                          │
        ┌──────────▼──────────┐    ┌──────────▼──────────┐
        │  SKILLS             │    │  MCP SERVERS        │
        │  HOW to do a task   │    │  WHAT to reach      │
        │  files on disk      │    │  tools · resources  │
        │  SKILL.md           │    │  prompts            │
        └─────────────────────┘    └──────────┬──────────┘
                                              │
                                   ┌──────────▼──────────┐
                                   │  MCP REGISTRY       │
                                   │  find a server      │
                                   │  registry.model...  │
                                   └─────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │  VOICE — a different front door to the same tools            │
   │  Realtime API: audio in → reason → tool call → audio out     │
   └──────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────────┐
   │  LOCAL — the same models, on your own metal                  │
   │  gpt-oss · Qwen · Gemma via Ollama / llama.cpp / MLX         │
   └──────────────────────────────────────────────────────────────┘
```

The single most important idea: **Skills tell your agent *how*; MCP tells it *what it can reach*.** Most people conflate them, then build the wrong one. If the knowledge is a procedure, write a skill. If your agent needs to touch a system, build an MCP server.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **MCP** | A USB-C port for AI tools | One protocol, many tools; you don't write per-agent integrations |
| **MCP server** | A device that plugs into the port | Exposes tools, resources, and prompts to any MCP client |
| **MCP registry** | An app store of metadata | Find an existing server instead of writing one |
| **Stateless core** | The device needs no handshake | Any server instance can serve any request |
| **Skills** | An onboarding guide for a new hire | Procedural knowledge, as files on disk |
| **`SKILL.md`** | The guide's cover page + when-to-use-it | The `description` is what makes the agent pick it up |
| **Realtime API** | A phone call, not a memo | Speech in, speech out, with tools callable mid-sentence |
| **Computer use** | Handing the agent a mouse | The model drives a browser or desktop |
| **Agent abstraction** | A job description with a toolbox | Model + instructions + tools, defined once, reused |
| **Tool approval** | "Are you sure?" for the agent | Human-in-the-loop for the dangerous tool calls |
| **Local model** | Running the weights yourself | Privacy, offline, no per-token bill |
| **Interop / Baseline** | (Not this guide — see Paper 14) | Browser feature safety |

> **The one-sentence version:** learn four things — MCP's stateless model, how to author a skill, when to reach for realtime voice, and how to define an agent once — because those four change how you build, and everything else is a changelog.

---

## The 60-Second Version (TL;DR)

1. **MCP spec `2026-07-28` is stateless.** No `initialize` handshake, no `Mcp-Session-Id`. Any request can hit any instance. Deploy like a normal HTTP API now.
2. **Method and name travel in headers.** `Mcp-Method` and `Mcp-Name` let a gateway route and authorize without reading the body.
3. **The MCP registry is the discovery layer.** `registry.modelcontextprotocol.io` — a metadata catalogue, not a host.
4. **Skills are files.** A directory with `SKILL.md` (YAML frontmatter + Markdown body). Put it in `.claude/skills/` or `~/.claude/skills/` and the agent finds it.
5. **Skills vs MCP:** knowledge → skill. Capability → server. Don't build the wrong one.
6. **Voice got agentic.** New realtime models reason, call tools, and handle interruptions in-session rather than chaining STT → text → TTS.
7. **Both major agent stacks ship an `Agent` abstraction** — model, instructions, and tools defined once, then streamed into any UI.
8. **Tool execution approval is now a first-class option**, which is what makes human-in-the-loop practical instead of bespoke.
9. **Local models are a real option.** `gpt-oss-120b` runs on a 64 GB Mac at MXFP4; `gpt-oss-20b` on 24 GB.
10. **Ignore the video-model churn for now.** Sora's consumer app is gone and its API has a hard sunset; Veo is stable. This is a search, not a lesson.

If you read nothing else, read **Part 1 (MCP)** and **Part 3 (Skills)**.

---

## Prerequisites

| Requirement | Why | Check |
|---|---|---|
| Node.js 20+ | Most MCP servers and SDKs ship as npm packages | `node --version` |
| Python 3.10+ | Servers, the MCP Python SDK, local models | `python3 --version` |
| An MCP-capable client | Claude Code, opencode, Codex, Cursor, VS Code, Windsurf | See Part 1.4 |
| An Anthropic account | For Skills in Claude Code and the Skills API | `claude.ai` |
| An OpenAI API key | Only for the voice and agent parts | `platform.openai.com` |
| ~20 GB free disk | Local models are large | `df -h ~` |
| 24 GB+ unified memory *(optional)* | For the local-model part | About This Mac |

> **Pick two, not five.** This guide covers a lot. The two with the best return for a solo builder are **MCP** (because your agent gets your actual tools) and **Skills** (because your expertise becomes reusable). Voice and local models are worth a weekend each, deliberately later.

---

## Part 1 — MCP in 2026: Stateless, Routable, Cacheable

MCP (Model Context Protocol) is the standard that lets an AI client reach tools, data, and prompt templates. If you have used Linear MCP or Figma MCP, you have used it. In 2026 it changed shape substantially.

### 1.1 The headline: the protocol is now stateless

The `2026-07-28` specification — the largest revision since launch — turns MCP from a bidirectional stateful protocol into a **request/response stateless protocol**. Concretely:

- **The `initialize`/`initialized` handshake is retired.** Protocol version, client identity, and client capabilities now travel in `_meta` on **every** request.
- **The `Mcp-Session-Id` header and the protocol-level session are removed.** No sticky routing, no shared session store.
- **A new `server/discover` method** lets a client fetch capabilities up front when it wants them.

The practical effect: **any MCP request can land on any server instance.** Before, horizontal deployments needed sticky routing and a session store. Now it is an ordinary HTTP workload.

```
BEFORE (stateful)                    AFTER (stateless)
─────────────────                    ─────────────────
client ── initialize ──► server      client ── POST /mcp ──► any instance
       ◄─ session id ──                          (self-describing)
client ── request ──► SAME instance   client ── POST /mcp ──► any instance
       (sticky routing required)                  (round-robin fine)
```

### 1.2 Five changes that matter when you deploy

**Headers carry the routing information.** Streamable HTTP requests must include:

```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: search
Content-Type: application/json
```

Load balancers, gateways, and rate-limiters can route on those headers without parsing the body. Servers **reject requests where the headers and body disagree** — a cheap integrity check you get for free.

**List responses are cacheable.** `tools/list`, `prompts/list`, `resources/list`, and `resources/read` now return `ttlMs` and `cacheScope`, modelled on HTTP `Cache-Control`. Deterministic ordering plus cache hints means clients can cache a tool catalogue and keep upstream prompt caches stable across reconnects.

**Server-initiated requests use Multi Round-Trip Requests (MRTR).** This replaces the old `elicitation/create`, `sampling/createMessage`, and `roots/list` requests that needed a held-open stream. Server-initiated requests may now only be issued while the server is actively processing a client request.

**Authorization hardened.** Clients must validate the `iss` parameter on authorization responses per **RFC 9207**. Dynamic Client Registration (DCR) is formally deprecated in favour of **Client ID Metadata Documents (CIMD)**, and Enterprise-Managed Authorization (EMA) is an extension. DCR still works for backward compatibility.

**There is a real deprecation policy now** — a minimum twelve-month window, so you can plan upgrades instead of reacting to them.

> **Read the deprecation list if you have an existing server.** `Roots`, `Sampling`, and `Logging` are deprecated. Replacements: tool parameters / resource URIs / server config for Roots; direct integration with LLM provider APIs for Sampling; `stderr` (stdio) or OpenTelemetry for Logging. The legacy HTTP+SSE transport is also deprecated with a year-long offramp. They keep working for at least twelve months, but new implementations should not adopt them.

### 1.3 Extensions: Tasks, Apps, EMA

The spec now has a formal **extensions framework**, and two official extensions:

| Extension | What it does |
|---|---|
| **Tasks** | Long-running work. Moved out of the experimental core to `io.modelcontextprotocol/tasks`, with a poll-based `tasks/get` and a new `tasks/update` |
| **MCP Apps** | Servers ship interactive HTML interfaces that hosts render in a sandboxed iframe |
| **EMA** | Enterprise-Managed Authorization — now stable |

Extensions version independently of the specification, with delegated maintainers.

### 1.4 Install an MCP server

The install shape is identical everywhere: point the client at a server (a command or a URL), authenticate, verify.

**Claude Code:**

```bash
# remote server over HTTP
claude mcp add --transport http my-server https://example.com/mcp

# available across all projects, not just this one
claude mcp add --scope user --transport http my-server https://example.com/mcp

# a local stdio server
claude mcp add my-server -- npx -y @some/mcp-server

# verify what's connected
claude mcp list
```

**opencode** (`~/.config/opencode/opencode.jsonc`):

```json
{
  "mcp": {
    "my-server": {
      "type": "remote",
      "url": "https://example.com/mcp",
      "enabled": true
    }
  }
}
```

**Codex:**

```bash
codex mcp add my-server --url https://example.com/mcp
```

**VS Code** (`mcp.json`):

```json
{
  "inputs": [],
  "servers": {
    "my-server": {
      "url": "https://example.com/mcp",
      "type": "http"
    }
  }
}
```

Then verify with a question that forces a call. For any server, ask what it can do before trusting it; a useful first prompt is *"list your tools and what each one does."*

### 1.5 Find a server instead of writing one

The **official MCP Registry** at `registry.modelcontextprotocol.io` is the central metadata catalogue for publicly accessible MCP servers, backed by Anthropic, GitHub, Microsoft, and PulseMCP. It holds well over 20,000 servers as of mid-2026.

Crucially, **it is a metadata catalogue, not a host.** One record per server, described by a `server.json`: name, short description, version, and either the package it ships as or the URL it runs at.

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=weather"
```

The registry supports open-source and closed-source servers as long as the install method is public (an npm package, a public Docker image) or the server is publicly reachable. **Private servers are not supported.**

> **Practical discovery workflow:** search the registry, read the `server.json`, then verify on the vendor's own docs. The registry tells you a server exists and how it installs; it does not vouch for what the server does with your data.

### 1.6 Build a server, in outline

If nothing in the registry fits, the skeleton is small. The official SDKs — TypeScript, Python, Go, and C# — all speak `2026-07-28`, with a Ruby SDK at 1.0 and more Tier 2 languages filling in.

The shape of a tool, conceptually:

```python
# server.py — the outline, not a full implementation
from mcp.server import Server

server = Server("my-server")

@server.tool()
def search(query: str, limit: int = 10) -> list[dict]:
    """Search the internal docs. Returns matching passages."""
    return search_index(query, limit)

# Streamable HTTP transport; requests are self-describing under 2026-07-28
server.run(transport="streamable-http", port=8000)
```

Then publish it, if it is general-purpose:

```bash
# 1. choose a namespace (fixes your auth method)
#    io.github.username/your-server
# 2. write server.json with a description under 100 characters
# 3. validate it
# 4. log in and publish
# 5. confirm via the API
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.username/your-server"
```

> **Wire publishing into your release tags** so the registry record moves when the package does. A registry entry that drifts from the published version is worse than none.

---

## Part 2 — What MCP Is Not For

Before Skills, be clear about the boundary, because this is the mistake that costs people a week.

| If the thing is… | Build… | Because |
|---|---|---|
| A procedure, a checklist, a house style | **A Skill** | The agent needs to know *how*; no external system involved |
| A connection to an API, database, or file system | **An MCP server** | The agent needs to *reach* something |
| A one-off prompt you keep pasting | **A Skill** | It should be a file, versioned, reviewable |
| Reusable prompt templates the server owns | **MCP prompts** | The server knows best how to prompt for its own tools |
| A big reference document | **A Skill with a linked file** | Load the index, read the detail only when needed |

A useful test: **if unplugging the network breaks it, it is an MCP server. If it would still make sense on a plane, it is a skill.**

---

## Part 3 — Agent Skills: Expertise as Files

Skills are the other half. A skill is a reusable, filesystem-based resource that gives an agent domain expertise — workflows, context, best practices — turning a general-purpose agent into a specialist.

### 3.1 The anatomy

A skill is **a directory containing a `SKILL.md` file**, plus any supporting files. The `SKILL.md` has two parts: YAML frontmatter between `---` markers that tells the agent *when* to use it, and Markdown content with the instructions it follows.

```
.claude/skills/
└── pr-summary/
    ├── SKILL.md          ← frontmatter + instructions
    ├── template.md       ← a supporting file
    └── scripts/
        └── collect.sh
```

```yaml
---
name: pr-summary
description: Summarizes uncommitted changes and drafts a pull request description. Use when the user asks what changed, asks for a PR description, or is preparing to commit.
---

# PR summary

Write a pull-request summary from the current diff.

1. Run `git diff --stat` to see the scope.
2. Read the diff for the changed files.
3. Draft a summary with: what changed, why, and what to verify.
4. Use the template in `template.md`.

Keep the body under 200 words. Do not invent motivation that is not in the diff.
```

**The `description` is the whole mechanism.** It is what the agent reads to decide whether to load the skill. If the agent never picks it up, the description is the problem — it is missing the words a user would naturally say.

### 3.2 Where skills live

| Location | Scope | Use for |
|---|---|---|
| `~/.claude/skills/` | Personal, all projects | Your habits — commit style, review checklist |
| `.claude/skills/` | Project, current repo | Team conventions, repo-specific procedures |
| A mounted repo's `.claude/skills/` | Scanned at session start | Sharing skills through git, no upload needed |

The directory name becomes the command you can invoke directly. `pr-summary` in `.claude/skills/pr-summary/` is invocable as `/pr-summary`.

> **Personal vs project is a real decision.** Personal skills are your muscle memory and follow you between repos. Project skills are conventions that must travel with the code so a teammate's agent behaves the same as yours.

### 3.3 Install a skill

**Claude Code:** skills are just files. Create the directory and write the file:

```bash
mkdir -p ~/.claude/skills/summarize-changes
$EDITOR ~/.claude/skills/summarize-changes/SKILL.md
```

Test it two ways — let the agent invoke it, then invoke it directly:

```text
# automatic: matches the description
What did I change?

# explicit
/summarize-changes
```

There is also a `skill-creator` plugin that automates the write-and-compare loop:

```text
/plugin install skill-creator@claude-plugins-official
```

**Other agents:** the ecosystem has converged on `npx skills add` for distributing skills by repo:

```bash
npx skills add owner/repo --skill skill-name
npx skills update
```

Next.js, TypeSafe, and Figma all publish skills this way. Add `-g` to install globally rather than per-project.

### 3.4 The three failures, and their fixes

| Symptom | Cause | Fix |
|---|---|---|
| Agent never uses the skill | `description` lacks the user's natural words | Add the phrases a user would actually say; check it appears in "what skills are available?" |
| Agent uses the skill when you don't want it | Description too broad | Make it specific, or set `disable-model-invocation: true` for manual-only |
| Agent ignores the body's instructions | Body too long or vague | Keep it concise; concrete steps, not philosophy |

> **The most common mistake is writing the skill for yourself instead of for the agent.** You already know when to run your release checklist. The skill exists so the *agent* knows. Write the description as a trigger, and the body as steps.

### 3.5 Skills in the API, and in managed agents

Skills are not Claude-Code-only. The Claude API supports both pre-built and custom skills, integrated through the **code execution tool**:

- **Pre-built skills** for common document tasks: `pptx`, `xlsx`, `docx`, `pdf`.
- **Custom skills** you author and upload to a workspace, shared workspace-wide.
- Skills are specified in the `container` parameter with a `skill_id`, a `type`, and an optional `version`; up to 20 skills per request.
- The Python SDK has a `files_from_dir` helper; the CLI uploads a directory with `ant apply`.

```bash
# upload a skill directory
ant apply financial_skill

# commit claude-lock.json so the next upload versions instead of duplicating
```

```python
# use it in a request (shape only — check current docs for exact fields)
response = client.messages.create(
    model="...",
    container={"skills": [{"type": "custom", "skill_id": "skill_abc123", "version": "latest"}]},
    tools=[{"type": "code_execution"}],   # skills require code execution
    messages=[{"role": "user", "content": "Build the quarterly report."}],
)
```

In **managed agents**, skills attach through an agent's `skills` array, or load from a GitHub repository mounted on the session. A session supports up to 500 skills, counted as the deduplicated set across every agent — and mounting more skills slows the sandbox start, so attach only what the task needs.

> **A version is a full snapshot, not a delta.** When you update a skill, upload the complete file set. Files you omit are not carried over, and the `name` in the new `SKILL.md` must match the existing one.

---

## Part 4 — Voice: Realtime Models That Reason

The old voice stack was a chain: speech-to-text, then a text model, then text-to-speech. Three hops, three latencies, and the intonation was gone by the time the model saw the words.

The 2026 generation removes the chain. A single realtime model works directly with audio, maintains conversation state, and **calls tools mid-conversation**.

### 4.1 What shipped

OpenAI's May 2026 voice release introduced three models:

| Model | What it is |
|---|---|
| **GPT-Realtime-2** | A voice model with GPT-5-class reasoning — handles harder requests, calls tools, copes with corrections and interruptions |
| **GPT-Realtime-Translate** | Live translation: 70+ input languages into 13 output languages, keeping pace with the speaker |
| **GPT-Realtime-Whisper** | Streaming speech-to-text that transcribes as the speaker talks |

Key capabilities:

- **Adjustable reasoning effort**: minimal, low, medium, high, xhigh — with **low as the default**, balancing latency against deliberation.
- **Interruptions and corrections** handled inside the session, which is what makes a voice agent feel like a conversation rather than a form.

> **These are vendor descriptions and vendor pricing.** Prices move. Treat the capability shape as durable and the numbers as perishable.

### 4.2 Choose the right architecture first

The design question is *how speech connects to reasoning and tools*, and there are three answers:

| Architecture | Best for | Why |
|---|---|---|
| **Realtime API** | Speed, barge-in, natural turn-taking | One model interprets audio, decides, and speaks |
| **Voice agent pipeline** | Reusing an existing text agent | STT → your text agent → TTS, stage by stage |
| **Full-duplex with a delegated backend** | Long backend work during conversation | The voice layer keeps talking while a backend thinks |

For a new conversational app, start with the **Realtime API**. Reach for the pipeline when you already have a text agent you trust and don't want to rebuild its tool logic for a different interface.

### 4.3 Install and first call

```bash
npm install @openai/agents
```

The browser flow is: **your server creates an ephemeral client secret → the frontend creates a session → the session connects over WebRTC (browser) or WebSocket (server) → the agent handles audio turns, tools, interruptions, and handoffs.**

```ts
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const agent = new RealtimeAgent({
  name: "Assistant",
  instructions: "You are a helpful voice assistant.",
});

const session = new RealtimeSession(agent, {
  model: "gpt-realtime-2.1",
});

// ek_... is an ephemeral key minted by YOUR server, never a long-lived key
await session.connect({ apiKey: "ek_...(ephemeral key from your server)" });
```

From there you attach tools, handoffs, and guardrails to the `RealtimeAgent` the same way you would on a text agent. **Keep audio transport in the session layer and business logic in the agent definition** — that separation is what lets you test the logic without a microphone.

### 4.4 The two mistakes

**Minting the key in the browser.** The client secret must come from your server. A long-lived API key in frontend code is an incident waiting to happen. The whole point of `ek_` ephemeral keys is that they expire.

**Not evaluating voice like a system.** Voice agents fail in ways text agents don't: unwanted silence, talking over the caller, mishearing names and numbers, dropping the session. Measure them separately:

| Dimension | What to measure |
|---|---|
| **Task and tool outcomes** | Intent preserved, tools called correctly, permissions respected, final state correct — and the spoken confirmation matches the action |
| **Conversational timing** | Audible response latency, unwanted silence, overlap, yielding to interruption |
| **Speech and language** | Input recognition across accents, noise, language switches, names, numbers; output intelligibility, separately |
| **Session reliability** | Connection failures, dropped audio, timeouts, incomplete sessions |

The staged approach that works: **Crawl** (synthetic speech, single-turn, fixed context) → **Walk** (real human recordings, single-turn) → **Run** (an independent simulated caller, multi-turn, with interruptions and changing requirements).

> **Keep the caller, model config, tools, and transport fixed** when comparing changes. Otherwise you're comparing a voice-agent change to a microphone change.

### 4.5 A safety identifier worth wiring in

If your app identifies users, include a **safety identifier** on Realtime requests — a stable, privacy-preserving value like a hashed internal user ID. OpenAI recommends but does not require it. The reason to bother: it lets harmful behaviour be attributed to an individual user rather than your whole organisation.

For Realtime requests it goes in the `OpenAI-Safety-Identifier` header. With ephemeral tokens, set it on the server-side request that creates the client secret.

---

## Part 5 — Agents as an API Primitive

The remaining 2026 shift is that "an agent" became something you declare rather than something you reassemble.

### 5.1 The shape

Both major stacks landed on the same abstraction: **model + instructions + tools, defined once.**

AI SDK 6 introduced an `Agent` abstraction and a production-ready `ToolLoopAgent` that handles the whole tool-execution loop — call the model, execute requested tools, append results, repeat until done (up to 20 steps by default, `stopWhen: stepCountIs(20)`).

The reason this matters: you define the agent once and use it across your application, with type-safe UI streaming, structured outputs, and framework support, instead of rebuilding the loop in every route handler.

### 5.2 What became first-class

| Capability | Why it matters now |
|---|---|
| **Tool execution approval** | Human-in-the-loop for dangerous calls, as a built-in option rather than bespoke code |
| **MCP support (stable)** | OAuth, resources, prompts, and elicitation — the protocol work from Part 1, usable directly |
| **Strict mode for tool inputs** | More reliable argument generation |
| **`toModelOutput`** | Flexible tool outputs |
| **Reranking** | A retrieval stage in the same SDK |
| **Standard JSON Schema** | Providers agree on one schema dialect |

OpenAI's side mirrors this with the **Responses API** as the primitive — built-in tools including web search, file search, and computer use — plus an Agents SDK for single- and multi-agent orchestration, and the note that the older Assistants API had a sunset target in mid-2026.

### 5.3 Install and a first agent

```bash
npm install ai @ai-sdk/openai
```

```ts
// an agent defined once, reused anywhere
import { ToolLoopAgent } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const supportAgent = new ToolLoopAgent({
  model: openai("gpt-5"),
  instructions: "You answer support questions using the docs tool.",
  tools: {
    searchDocs: {
      description: "Search the product documentation.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => searchIndex(query),
    },
  },
});
```

> **Upgrading from AI SDK 5:** `npx @ai-sdk/codemod v6`.

### 5.4 The one design rule

**Keep the model choice, the instructions, and the tool implementations in separate places.** The agent definition should read like a job description. When you swap models for cost, or tighten a tool's schema, or move the instructions into a skill, you should not be editing the same file three times.

This is the same discipline as the earlier papers in this shelf: **policy in one reviewable place, mechanics elsewhere.** An agent whose tools and prompts and thresholds are interleaved is an agent nobody can review.

---

## Part 6 — Local Models: The Fallback That Got Good

Covered in depth in Paper 4. The 2026 update is that open-weight models caught up enough to be a default second option, not a curiosity.

### 6.1 The current standouts

| Model | Size | Minimum RAM | Practical note |
|---|---|---|---|
| **GPT-OSS 20B** | ~21B, MXFP4 | 24 GB | The comfortable default on a 24 GB Mac |
| **GPT-OSS 120B** | ~117B, MXFP4 | 96 GB | Roughly 63 GB for weights alone; ~64–65 GB peak measured with `gpt-oss-120b` on an M5 Max 128 GB |
| **Qwen / Gemma class** | 7B–31B | 8–48 GB | The everyday workhorses; a 7B at Q4_K_M fits in 8 GB |

Two numbers worth internalising: `gpt-oss-20b` at MXFP4 needs about **13.8 GB** estimated load, and fits a 24 GB machine. `gpt-oss-120b` **does not fit 64 GB comfortably** — weights alone are around 63 GB.

### 6.2 Install

```bash
# the simplest path
brew install ollama
ollama serve

# pull and run
ollama pull gpt-oss:20b
ollama run gpt-oss:20b
```

Anything OpenAI-shaped points at it unchanged:

```bash
export OPENAI_BASE_URL=http://localhost:11434/v1
```

### 6.3 The memory limit nobody tells you about

On Apple Silicon there is a GPU wired-memory limit, and a large model can be refused even when you nominally have the RAM. You can raise it deliberately:

```bash
# set a 60 GB GPU wired-memory limit
sudo sysctl iogpu.wired_limit_mb=61440
sysctl iogpu.wired_limit_mb        # verify

# reset to the default at any time
sudo sysctl iogpu.wired_limit_mb=0
```

> **Raise it on purpose, not by accident.** Pushing the wired limit up leaves less for the OS, and a machine that swaps during inference is slower than a machine running a smaller model. Also note that MLX needs a recent macOS to use newer Neural Accelerators — check before assuming a speedup.

---

## Part 7 — What to Ignore (For Now)

Honesty is more useful than completeness here. Three categories where learning the current details is a poor use of a weekend.

### 7.1 Video generation

The consumer video app landscape is churning hard. Reporting through 2026 has OpenAI's Sora consumer app shutting down in April 2026 with the API reachable only until a September 2026 sunset, while Google's Veo line has been stable with native audio and scene extension. Per-second pricing across platforms spans a wide range.

**Why to wait:** a hard API sunset means any integration you build has a forced migration date attached. If you need video generation today, build against the stable option and keep the call behind an interface so a swap is one file.

### 7.2 Computer use

The computer-use tools — models that drive a mouse and keyboard, exposed as a built-in tool — are real and improving, with published benchmark progress. They are also the highest-blast-radius thing in this guide: an agent with a browser and no approval step can do real damage.

**If you try it:** run it in a sandboxed, ephemeral environment, with no secrets readable from the filesystem, and require human confirmation for anything that writes or sends. That is the same guidance as Paper 2, and it applies doubly here.

### 7.3 Model-of-the-week benchmarks

Every leaderboard moves. A guide that names the current best model is stale before it's read. The durable knowledge is the *shape*: realtime models reason in-session, agents are declared not reassembled, skills are files, MCP is stateless. Those survive the next release.

---

## Cheat Sheet

```bash
# ─── MCP ────────────────────────────────────────────────
claude mcp add --transport http NAME https://example.com/mcp
claude mcp add --scope user --transport http NAME https://example.com/mcp
claude mcp add NAME -- npx -y @scope/mcp-server
claude mcp list
codex mcp add NAME --url https://example.com/mcp

# find a server
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=weather"

# ─── SKILLS ─────────────────────────────────────────────
mkdir -p ~/.claude/skills/my-skill      # personal
mkdir -p .claude/skills/my-skill        # project
$EDITOR .claude/skills/my-skill/SKILL.md
npx skills add owner/repo --skill name  # install a published skill
npx skills update
/plugin install skill-creator@claude-plugins-official

# ─── VOICE / AGENTS ─────────────────────────────────────
npm install @openai/agents
npm install ai @ai-sdk/openai
npx @ai-sdk/codemod v6                  # upgrade AI SDK 5 → 6

# ─── LOCAL ──────────────────────────────────────────────
brew install ollama
ollama pull gpt-oss:20b
sudo sysctl iogpu.wired_limit_mb=61440   # raise GPU wired memory (macOS)
sudo sysctl iogpu.wired_limit_mb=0       # reset
```

| Decision | Choose |
|---|---|
| Agent needs a procedure | **Skill** |
| Agent needs to reach a system | **MCP server** |
| Discover an existing server | **MCP Registry** |
| New conversational voice app | **Realtime API** |
| Reuse an existing text agent by voice | **Voice pipeline** |
| Model + tools defined once | **`Agent` / `ToolLoopAgent`** |
| Risk of a destructive tool call | **Tool execution approval** |
| Privacy, offline, no per-token bill | **Local model** |
| Video generation, today | **Stable providers only**, behind an interface |

| MCP spec change | What it means for you |
|---|---|
| Stateless core | Deploy behind a round-robin load balancer |
| `Mcp-Method` / `Mcp-Name` headers | Gateways route and authorize without reading the body |
| `initialize` removed | No handshake; capabilities travel in `_meta` |
| `Mcp-Session-Id` removed | No sticky sessions, no session store |
| `ttlMs` / `cacheScope` on lists | Cache tool catalogues |
| MRTR | Elicitation and sampling without a held-open stream |
| RFC 9207 `iss` validation | Validate the issuer before redeeming a code |
| DCR deprecated → CIMD | Plan your auth migration |
| Roots / Sampling / Logging deprecated | Migrate within 12 months; don't adopt in new work |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| MCP server works locally, fails behind a load balancer | Sticky sessions assumed | Under `2026-07-28` it's stateless; check you're on the new spec and not relying on old session behaviour |
| Server rejects a request | Headers and body disagree on method/name | Make `Mcp-Method`/`Mcp-Name` match the body exactly |
| Client can't find your server in the registry | Record not published, or private server | The registry does not support private servers; publish a `server.json` with a public install method |
| Skill never triggers | `description` lacks the user's natural phrasing | Rewrite the description as a trigger; confirm it appears in the skills list |
| Skill triggers too often | Description too broad | Narrow it, or set `disable-model-invocation: true` |
| Skill updated but old content runs | Upload was a delta, not a snapshot | Re-upload the complete file set |
| Skill in managed agent slows the session | Too many skills mounted | Attach only what the task needs (500 max, costly) |
| Realtime session works locally, key leaks in prod | Long-lived key in frontend | Mint an ephemeral `ek_` secret on your server |
| Voice agent talks over the caller | Turn detection / timing config | Evaluate timing separately; tune VAD and preambles |
| Voice agent is silent when the backend is slow | No acknowledgement strategy | Emit short acknowledgements; measure them separately from the answer |
| Local model refused despite free RAM | GPU wired-memory limit | Raise `iogpu.wired_limit_mb` deliberately |
| Local inference is slow after raising the limit | OS swapping | Lower it, or run a smaller model |
| AI SDK v5 code breaks on v6 | Breaking change | `npx @ai-sdk/codemod v6` |

---

## Video Library

YouTube **search** links only. This topic ages faster than any other in the shelf.

| Search | What you'll find |
|---|---|
| [MCP tutorial 2026](https://www.youtube.com/results?search_query=MCP+tutorial+2026) | Building and connecting MCP servers |
| [MCP stateless spec explained](https://www.youtube.com/results?search_query=MCP+stateless+spec+explained) | The 2026-07-28 changes |
| [Claude agent skills tutorial](https://www.youtube.com/results?search_query=Claude+agent+skills+tutorial) | Authoring `SKILL.md` |
| [skills vs MCP](https://www.youtube.com/results?search_query=skills+vs+MCP) | When to use which |
| [OpenAI Realtime API tutorial](https://www.youtube.com/results?search_query=OpenAI+Realtime+API+tutorial) | Voice agents end to end |
| [voice agent evaluation](https://www.youtube.com/results?search_query=voice+agent+evaluation) | Measuring latency, interruptions, task success |
| [AI SDK 6 agents](https://www.youtube.com/results?search_query=AI+SDK+6+agents) | `ToolLoopAgent` and tools |
| [tool execution approval agents](https://www.youtube.com/results?search_query=tool+execution+approval+agents) | Human-in-the-loop patterns |
| [gpt-oss local inference](https://www.youtube.com/results?search_query=gpt-oss+local+inference) | Running open-weight models |
| [Apple Silicon local LLM memory](https://www.youtube.com/results?search_query=Apple+Silicon+local+LLM+memory) | Wired limits and unified memory |

---

## Written References & Docs

Official project and vendor domains first.

| Source | URL |
|---|---|
| MCP — 2026-07-28 specification | `https://blog.modelcontextprotocol.io/posts/2026-07-28/` |
| MCP — release candidate notes | `https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/` |
| MCP — the new roadmap | `https://blog.modelcontextprotocol.io/posts/mcp-roadmap/` |
| MCP — blog index | `https://blog.modelcontextprotocol.io/` |
| MCP — registry about | `https://modelcontextprotocol.io/registry/about` |
| MCP — registry API docs | `https://registry.modelcontextprotocol.io/docs` |
| MCP — registry GitHub | `https://github.com/modelcontextprotocol/registry` |
| MCP — SDKs | `https://modelcontextprotocol.io/` |
| Claude — Agent Skills overview | `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview` |
| Claude — using Skills with the API | `https://platform.claude.com/docs/en/build-with-claude/skills-guide` |
| Claude — Skills in managed agents | `https://platform.claude.com/docs/en/managed-agents/skills` |
| Claude Code — Agent Skills | `https://code.claude.com/docs/en/skills` |
| Claude Code — skills in the Agent SDK | `https://code.claude.com/docs/en/agent-sdk/skills` |
| skill-creator plugin | `https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator` |
| OpenAI — voice models announcement | `https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/` |
| OpenAI — Realtime API getting started | `https://developers.openai.com/api/docs/guides/realtime` |
| OpenAI — voice agents guide | `https://developers.openai.com/api/docs/guides/voice-agents` |
| OpenAI — audio and voice | `https://developers.openai.com/api/docs/guides/audio` |
| OpenAI — Responses API and built-in tools | `https://openai.com/index/new-tools-for-building-agents/` |
| Vercel — AI SDK 6 | `https://vercel.com/blog/ai-sdk-6` |
| AI SDK docs | `https://ai-sdk.dev/` |
| Ollama | `https://ollama.com/` |
| llama.cpp | `https://github.com/ggml-org/llama.cpp` |
| MLX | `https://github.com/ml-explore/mlx` |
| TrustAIRLab in-the-wild jailbreaks (for guardrail testing) | `https://huggingface.co/datasets/TrustAIRLab/in-the-wild-jailbreak-prompts` |

**Third-party, for context only:**

| Source | Why |
|---|---|
| ModelFit local-compatibility dataset | Independently collated RAM/quantisation figures for local models |
| MCP registry coverage write-ups | Counting and describing what's listed |
| Video-model comparison articles | Pricing and sunset tracking; verify against vendor pages |

> **Verification tip:** MCP's spec pages, the registry, and vendor model docs are the only sources worth trusting for API shapes. Model *pricing* and *benchmarks* are vendor claims; re-read them on the vendor's own page before you rely on a number.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| MCP | Model Context Protocol; the standard for exposing tools to AI clients |
| MCP server | A process exposing tools, resources, and prompts over MCP |
| MCP client | A host application that connects to MCP servers |
| Streamable HTTP | The transport MCP uses for remote servers |
| Stateless core | No handshake, no session ID; any instance serves any request |
| `Mcp-Method` / `Mcp-Name` | Headers carrying the operation for gateway routing |
| MRTR | Multi Round-Trip Requests; server-initiated flows without a held-open stream |
| CIMD | Client ID Metadata Documents; the preferred client registration path |
| DCR | Dynamic Client Registration; deprecated in favour of CIMD |
| EMA | Enterprise-Managed Authorization; a stable MCP extension |
| Tasks | An MCP extension for long-running work |
| MCP Apps | An MCP extension for server-rendered interactive UIs |
| MCP Registry | The official metadata catalogue for public MCP servers |
| `server.json` | The registry record describing one server |
| Skill | A directory with `SKILL.md` giving an agent domain expertise |
| `SKILL.md` | The skill's frontmatter (when to use) plus instructions (what to do) |
| Skill description | The trigger text an agent reads to decide whether to load the skill |
| Pre-built skill | An Anthropic-maintained skill (`pptx`, `xlsx`, `docx`, `pdf`) |
| Realtime API | Speech-to-speech sessions with tools callable mid-conversation |
| Ephemeral key | Short-lived `ek_` credential minted server-side for a voice session |
| Safety identifier | A privacy-preserving user identifier for abuse attribution |
| Computer use | A model driving a browser or desktop via mouse and keyboard |
| `Agent` / `ToolLoopAgent` | An abstraction bundling model, instructions, and tools |
| Tool execution approval | A built-in human-in-the-loop gate for dangerous tool calls |
| Quantisation | Compressing model weights (e.g. MXFP4, Q4_K_M) to fit memory |
| MXFP4 | A 4-bit float format used by `gpt-oss` builds |
| Wired memory limit | The macOS cap on GPU-accessible unified memory |

---

## FAQ & Next Steps

**Should I learn MCP or Skills first?** Skills, if you want a win today — it's a file, and the feedback loop is immediate. MCP next, when your agent needs to reach something. They compound: skills encode the how, MCP supplies the what.

**Do Skills replace MCP?** No. They answer different questions. A skill that says "query the database like this" is useless without an MCP server that connects to the database.

**Do I need to rewrite my MCP server for the new spec?** Not immediately. The deprecation policy guarantees a twelve-month minimum window. But if you're deploying behind a load balancer, the stateless core removes real operational work — that's the reason to move.

**What actually broke in the MCP 2026-07-28 spec?** The `initialize` handshake, `Mcp-Session-Id`, and session-level state. Plus three core features deprecated: Roots, Sampling, and Logging.

**Is the MCP registry a package manager?** No. It's a metadata catalogue. It tells you a server exists and how it installs; you still install it and you still have to trust it.

**Can I use Skills outside Claude Code?** Yes — the Claude API and managed agents both support custom skills, and the broader ecosystem distributes skills via `npx skills add` for other agents.

**Is the Realtime API worth the cost?** Only if the interaction must feel immediate. If a typed conversation works, use text. Voice is a different product, not a nicer interface to the same one.

**How do I stop an agent from doing something destructive?** Tool execution approval plus sandboxing plus hard authorization checks. Approval is a guardrail, not a security boundary — treat it as one layer.

**Which local model should I run?** `gpt-oss-20b` on a 24 GB machine is the safe default. Don't attempt `gpt-oss-120b` on 64 GB; the weights alone are roughly 63 GB.

**What should I ignore entirely?** Video generation, until the platforms stop sunsetting; and computer use without a sandbox. Both are real, both are expensive to learn on a deadline.

### Next steps, in order

1. **Today:** write one personal skill for something you do weekly. Test that the agent picks it up from the description.
2. **This week:** connect one MCP server to your agent. If nothing in the registry fits your stack, write a thin one and run it locally.
3. **Next week:** audit your agent's tool calls and add approval to anything destructive.
4. **Week 3:** if you have a text agent, define it once with an `Agent`/`ToolLoopAgent` and reuse it in a second place.
5. **Week 4:** try a local model on your real data and measure whether it's good enough for one background task.
6. **Month 2:** if voice fits your product, prototype one Realtime session behind an ephemeral key, and evaluate timing separately from task success.

---

## Verification Note

**Verified as of September 2026 from project and vendor primary sources:**

- **MCP `2026-07-28` specification:** stateless protocol core; `initialize`/`initialized` retired; `Mcp-Session-Id` removed; client identity and capabilities travel in `_meta`; `server/discover` added; `Mcp-Method` and `Mcp-Name` HTTP headers required for Streamable HTTP with rejection on header/body disagreement; `ttlMs` and `cacheScope` on list and resource-read results; MRTR replacing server-initiated elicitation/sampling/roots; RFC 9207 issuer validation; DCR deprecated in favour of CIMD; formal extensions framework with Tasks (`io.modelcontextprotocol/tasks`, poll-based `tasks/get` and `tasks/update`), MCP Apps, and Enterprise-Managed Authorization; Roots, Sampling, and Logging deprecated with a minimum twelve-month window; JSON Schema 2020-12 for tool schemas (`blog.modelcontextprotocol.io/posts/2026-07-28/`, `…/2026-07-28-release-candidate/`, `…/mcp-roadmap/`).
- **MCP Tier 1 SDKs** (TypeScript, Python, Go, C#) speak `2026-07-28`; a Ruby SDK reached 1.0.0 as a Tier 2 implementation (`blog.modelcontextprotocol.io/`).
- **MCP Registry:** official metadata catalogue at `registry.modelcontextprotocol.io`, backed by Anthropic, GitHub, Microsoft, and PulseMCP; one `server.json` record per server; supports open- and closed-source servers with a public install method or public reachability; does **not** support private servers; in preview, so breaking changes or data resets may occur (`modelcontextprotocol.io/registry/about`, `registry.modelcontextprotocol.io/docs`).
- **Agent Skills:** `SKILL.md` with YAML frontmatter and Markdown body; personal (`~/.claude/skills/`) and project (`.claude/skills/`) locations; directory name becomes the invocation; `description` drives automatic invocation; `disable-model-invocation: true` for manual-only; pre-built `pptx`/`xlsx`/`docx`/`pdf` skills; Skills API uses the `container` parameter with `skill_id`/`type`/`version`, requires the code execution tool, and allows up to 20 skills per request; managed agents attach skills via the `skills` array or a mounted repo's `.claude/skills`, up to 500 per session; updates are full snapshots, not deltas (`platform.claude.com/docs`, `code.claude.com/docs`).
- **Voice models (May 2026 release):** GPT-Realtime-2 with reasoning-effort levels minimal→xhigh, default low; GPT-Realtime-Translate supporting 70+ input and 13 output languages; GPT-Realtime-Whisper streaming transcription; Realtime API safety identifiers via the `OpenAI-Safety-Identifier` header; ephemeral client secrets via `POST /v1/realtime/client_secrets`; WebRTC for browsers, WebSocket for servers (`openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api/`, `developers.openai.com/api/docs/guides/realtime`, `…/guides/voice-agents`, `…/guides/audio`).
- **AI SDK 6:** `Agent` interface with a `ToolLoopAgent` implementation defaulting to `stopWhen: stepCountIs(20)`; tool execution approval; strict mode; `toModelOutput`; stable MCP support covering OAuth, resources, prompts, and elicitation in `@ai-sdk/mcp`; reranking; standard JSON Schema; image editing; `npx @ai-sdk/codemod v6` for migration (`vercel.com/blog/ai-sdk-6`).
- **OpenAI agent tooling:** Responses API as the agent primitive, with built-in web search, file search, and computer use, plus the Agents SDK for single- and multi-agent orchestration; a stated Assistants API deprecation target in mid-2026 (`openai.com/index/new-tools-for-building-agents/`).
- **Local models:** `gpt-oss:20b` (MXFP4) around 13.8 GB estimated load, 24 GB minimum; `gpt-oss-120b` around 65.4 GB estimated load, 96 GB claimed minimum; independent measurement of `gpt-oss-120b` on an M5 Max 128 GB showing roughly 64.4 GB peak at 4K context; macOS GPU wired-memory limit adjustable via `sysctl iogpu.wired_limit_mb`; MLX requiring a recent macOS for newer Neural Accelerators (ModelFit dataset; third-party M5 Pro/Max guide).

**Vendor claims, not independently verified:** all model capability descriptions and benchmarks (including the computer-use benchmark scores quoted by OpenAI), all pricing, and all performance figures. The registry server count is a third-party count, not a vendor figure.

**Changes fast:** MCP spec versions and the deprecation clock; the registry's preview status; model names, availability, and pricing; SDK versions and package names; and the sunset dates for video APIs. Re-check each vendor's own documentation before depending on any specific identifier in this guide.

**Not security advice.** Computer use, tool-execution approval, and voice safety identifiers are guardrails, not security boundaries. If you are putting an agent near real systems, read Paper 2 in this series and treat the sandbox as the boundary.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd sequence this, given the rest of the shelf.**

| In my workspace | Verdict |
|---|---|
| opencode as the coding agent | MCP servers in `~/.config/opencode/opencode.jsonc`; skills as project files |
| Next.js + Postgres + Stripe SaaS | Write one thin MCP server for your own domain; skip generic ones |
| No skills yet | Start with a commit/review skill — it's the highest-frequency habit |
| FigJam + Linear MCP already in use | You're already an MCP user; the 2026 change is operational, not conceptual |
| 24 GB Mac | `gpt-oss:20b` is your local ceiling; don't fight it |

**Recommended setup:**

- **Skills in the repo, not in your head.** `.claude/skills/` for team conventions, `~/.claude/skills/` for your habits. Commit the project ones.
- **MCP servers, user-scoped.** `--scope user` in Claude Code so you're not reinstalling per project.
- **One thin MCP server for your own product.** The registry is full of generic servers; the valuable one is the one that exposes *your* data with *your* permissions.
- **Approval on anything destructive.** Wire tool-execution approval before you wire more tools.
- **Local model for one job only.** Bulk classification or embedding. Not your primary reasoning.
- **Voice last.** It's a different product surface, not an upgrade to an existing one.
- **What I would not do:** adopt a video model, or give an agent computer use, without a written migration/rollback plan — both have forcing functions (sunset dates, blast radius) that punish casual adoption.

**Smoke test for the first session, in order:**

```bash
# 1. what MCP servers do I have?
claude mcp list

# 2. a skill, in 60 seconds
mkdir -p ~/.claude/skills/what-changed
cat > ~/.claude/skills/what-changed/SKILL.md <<'EOF'
---
name: what-changed
description: Summarizes uncommitted changes. Use when the user asks what changed or asks for a summary before committing.
---
Run `git diff --stat`, then read the diff. Report what changed, why, and what to verify. Under 150 words.
EOF

# 3. does the agent find it?
claude   # then ask: "what did I change?"
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js + Postgres SaaS on Vercel, uses opencode and AI
coding agents daily, and learns by doing.

Paper: markdown_docs/15-recent-ai-features-2026.md
Topic: Recent AI features worth learning in 2026 — MCP's stateless spec, Agent Skills, realtime
voice, agent abstractions, and local models, each with install steps.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs (official docs only) → Glossary → FAQ & Next Steps →
Verification Note → Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (building a production MCP server, MCP authorization in depth, voice
agent evaluation harnesses, multi-agent orchestration, RAG-with-skills, fine-tuning vs
skills); (C) port the MCP example to his real product — read his repo, find the real data he
would expose, and write the actual tool definitions.

Rules: never invent spec versions, model names, package names, headers, or endpoints. Check
the MCP blog for the current spec version and the registry for server metadata. If unsure,
write "search: <name> official docs". Label every benchmark, price, and capability claim as a
vendor claim and date it. Distinguish primary sources (project blogs, vendor docs) from
third-party trackers. Note anything with a sunset date. Keep the structure. Report path,
one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://blog.modelcontextprotocol.io/posts/2026-07-28/
https://modelcontextprotocol.io/registry/about
https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
https://code.claude.com/docs/en/skills
https://developers.openai.com/api/docs/guides/realtime
https://vercel.com/blog/ai-sdk-6
https://ollama.com/
```
