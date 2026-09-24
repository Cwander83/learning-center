# The Complete Guide: Linear, Mastered

> **Linear is not a task list — it's an opinionated model of how work flows.** Learn the model and the tool disappears into muscle memory.

**Last verified: September 2026**
**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Most people use Linear like a faster Jira: create issue, move issue, close issue. That works, and it wastes the product. Linear's real value is that it has *opinions* — about what an issue is, what a cycle is for, and where a human's judgment belongs — and the tool is designed so that following those opinions is faster than fighting them.

The trick to learning Linear is realizing it is a small **object graph**, not a set of pages. Every screen is a view onto the same few objects.

```text
WORKSPACE (chriswander)
│
├── TEAM ────────────── Chriswander (key: CHR)      ← statuses, cycles, estimates live here
│   ├── CYCLE ───────── timeboxed iteration (2 weeks by default)
│   ├── ISSUE ──────── CHR-7 "audit fix"            ← the atom of work
│   │   ├── sub-issue  (Issue with a parent)
│   │   ├── relations  (blocks / blockedBy / relatedTo / duplicateOf)
│   │   ├── labels, assignee, delegate, estimate, priority
│   │   └── attachments, comments, documents
│   └── VIEWS ───────── saved filters (yours + the team's)
│
├── PROJECT ─────────── P-CHR-4 "Agent Command Center"
│   ├── MILESTONE ───── dated checkpoint inside a project
│   ├── DOCUMENT ────── brief, spec, notes
│   └── issues from one or more teams
│
└── INITIATIVE ───────── I-123: a group of projects (the company-level layer)
    └── projects
```

Three things follow from that picture, and they are the whole game:

1. **Statuses, cycles, and estimates are team-scoped.** Your team's workflow is defined once, in the team, not per project.
2. **Projects group issues; initiatives group projects.** If everything is an issue, you have no roadmap. If everything is a project, you have no work.
3. **Views are queries, not folders.** An issue can appear in many views; that's correct, not duplication.

| Linear concept | Plain-English analogy |
|---|---|
| Workspace | The building |
| Team | The department — and the department's rulebook (statuses) |
| Issue | A single work order |
| Sub-issue | A checklist line inside the work order |
| Project | A job with a finish line |
| Milestone | A dated checkpoint on that job |
| Initiative | A company goal spanning several jobs |
| Cycle | A two-week sprint window the whole department shares |
| View | A saved question you keep asking ("what's mine and not done?") |
| Document | The brief stapled to the job |
| Label | A sticky tag — cheap, reusable, easy to overuse |
| Delegate | An agent you've handed the work order to |
| Relation | A wire between two work orders (blocks, related, duplicate) |

> **Why this beats Jira for a solo dev:** Jira is configured *by* you, so it costs you a week before it helps. Linear is already configured, so it costs you an hour of learning its opinions. For one person, that trade is almost always correct.

---

## The 60-Second Version (TL;DR)

1. **One team** is enough until you have two genuinely different workflows. Yours is `Chriswander` (key `CHR`).
2. **Write small issues** in the imperative ("Add nav links to all pages"), with acceptance criteria in the description.
3. **Put multi-step efforts in a Project**, not in an issue with a long description.
4. **Turn on cycles** and pull only what you'll finish into the current one.
5. **Use Triage** for anything that arrives from outside your own head.
6. **Learn five shortcuts** and stop using the mouse: create, command menu, search, assign-to-me, close.
7. **Wire GitHub** so branch and PR state update issues automatically.
8. **Let an MCP-connected agent do the mechanical work** — status changes, comments, sub-issue creation — and keep triage and roadmap decisions in the UI, where human judgment lives.

---

## Prerequisites

| Requirement | Why | How to check / get |
|---|---|---|
| A Linear account | Everything here is Linear-specific | `https://linear.app` |
| A team with a key | Statuses and cycles are team-scoped | Linear → Settings → Teams |
| GitHub connected | Auto-links branches and PRs to issues | Linear → Settings → Integrations → GitHub |
| macOS terminal comfort | For the API, webhooks, and the CLI-style workflows in Parts 9–10 | Terminal.app or Ghostty |
| `brew` (optional) | Some helper tooling installs cleanly | `brew --version` |
| An MCP-capable agent (optional) | Part 9 automates Linear from an agent | Your agent's MCP config, e.g. `https://mcp.linear.app/mcp` |
| A browser where you're already logged in | The API key page is behind auth | `https://linear.app/settings/account/security` |

> **macOS note:** Linear is a web app; there is no native Mac client to install. Everything in this paper is keyboard and browser. On macOS the modifier key in every shortcut is `⌘` (Command); the command menu is the single most valuable thing you will learn.

---

## Part 1 — The Data Model, Precisely

Getting this right in week one prevents a year of messy data.

**Workspace** — the top-level tenant. Yours is `chriswander` (`https://linear.app/chriswander`). It holds users, teams, projects, initiatives, and workspace-level labels.

**Team** — where work actually lives. A team owns its **statuses**, its **cycle cadence**, its **estimate scale**, and its **issue identifier prefix**. You have one team: `Chriswander`, key `CHR`, so issues are `CHR-1`, `CHR-2`, and so on. Teams are the unit of permission and of workflow, not of org chart.

**Issue** — the atom. An issue has: identifier, title, description (Markdown), status, assignee, delegate, priority, estimate, labels, project, cycle, parent (for sub-issues), relations, due date, attachments, comments, and a generated git branch name.

**Sub-issue** — an issue with a `parentId`. Not a separate object type. Use them for genuine decomposition, not for formatting a description.

**Project** — a container with a start and target date, a lead, a status, and its own description. Projects group issues **across teams**, which is why they can represent work bigger than one team.

**Milestone** — a dated checkpoint *inside* a project. Milestones are how you turn a project into a sequence rather than a bag.

**Initiative** — a group of projects representing a company-level goal. This is the layer above projects; skip it until you have more than one project worth grouping.

**Cycle** — a timeboxed iteration for a team. You currently have **none configured**. Cycles are Linear's most opinionated feature and the one most likely to change your behavior for the better.

**Statuses** — per-team, customizable, and typed. Linear groups them into status *types* (`backlog`, `unstarted`, `started`, `completed`, `canceled`, `duplicate`), and the type is what powers automation. Your team defines exactly these:

| Status | Type | What it means |
|---|---|---|
| Backlog | `backlog` | Not committed. The idea parking lot. |
| Todo | `unstarted` | Committed, not begun. |
| In Progress | `started` | Actively being worked. |
| In Review | `started` | Work done, awaiting verification. |
| Done | `completed` | Verified and closed. |
| Canceled | `canceled` | Deliberately not doing it. |
| Duplicate | `duplicate` | Merged into another issue. |

Linear ships this default set, and it is a good set. The classic mistake is adding statuses ("QA", "Blocked", "Deployed"). **Blocked is a relation, not a status** — use `blockedBy`. That way the block is visible on both issues and clears itself when the blocker closes.

**Labels** — cheap, workspace- or team-scoped tags. Yours are `Bug`, `Feature`, `Improvement`. Three labels is a healthy number. Labels are for *kind of work*, never for status, priority, or project — those have first-class fields.

### Step 1.1 — Audit what you actually have

You can ask any MCP-connected agent, or use the UI, to enumerate your objects. As of September 2026 your workspace contains:

| Object | Current state |
|---|---|
| Teams | 1 — `Chriswander` (`CHR`) |
| Projects | 3 — Agent Command Center, vite-portfolio, Workout Tracker |
| Statuses | 7 — the Linear defaults, unmodified |
| Labels | 3 — Bug, Feature, Improvement |
| Cycles | none configured |
| Milestones | none |
| Documents | none |
| Templates | none |
| Initiatives | none |

That is a clean, uncluttered workspace — which is good — but it is also missing the scaffolding (cycles, templates, documents) that makes Linear worth using over a text file. Parts 2, 5, and 6 fix that.

### Step 1.2 — Decide the team boundary now

One team is correct for you. Add a second team only when the two would have **different statuses or a different cycle cadence** — for example, a client-services team whose work is billed hourly, separate from product work. Do not create a team per project. Projects already do that job.

---

## Part 2 — The Linear Method: Working the Way Linear Intends

Linear has published a philosophy, and its UI is built to reward it. The load-bearing ideas:

**Small issues beat big ones.** If an issue needs a meeting to estimate, it's a project. Your `CHR-7 "audit fix"` is a *good* issue: it has a code-review table with severities, a plan-gap status table, and three recommended next steps. It is scoped, verifiable, and it was completed in about an hour of state churn.

**Write issues as outcomes, not activities.** "Improve performance" is an activity. "Homepage LCP under 2.5s on mobile" is an outcome an agent can verify. This matters enormously once agents execute your issues (Part 9).

**Triage is a place, not a vibe.** Anything you didn't decide to do — a bug you noticed, a request, an agent's finding — lands in Triage first, and you consciously accept or decline it. Without triage, your backlog becomes an anxiety list.

**Cycles create pressure; projects create direction.** Cycles are timeboxes. They answer "what am I doing *this* fortnight?" Projects answer "where is this going?" You need both, and you currently have neither cycles nor milestones.

**The backlog is not a to-do list.** It is an inventory of uncommitted possibilities. If something has been in Backlog for six months and nobody has pulled it, that is information: delete it.

### Step 2.1 — Set up a two-week cycle

Linear → Team settings → Cycles → enable with a 2-week cadence. Then adopt one rule:

> **The pull rule:** at the start of a cycle, move into it only the issues you genuinely intend to finish, and set their status to `Todo`. Everything else stays in Backlog. Unfinished work at cycle end does not silently roll forward — you look at it and decide.

### Step 2.2 — Adopt a definition of done

Pick a small, literal checklist and put it in a team template (Part 6). For your code work, a reasonable one:

1. Acceptance criteria in the description are met.
2. Tests pass locally.
3. A PR exists and is linked to the issue.
4. A human read the diff.

Then `Done` means *verified*, not *typed*. This is the single highest-value habit in Linear, because it is what makes the status field trustworthy enough to automate against.

---

## Part 3 — Views and Filters: Asking Better Questions

A view is a saved query. Linear gives you built-ins and lets you save your own. The mental model:

- **My Issues** — everything assigned to you, across teams. Your default landing spot.
- **Team views** — shared, scoped to a team. The team's shared reality.
- **Custom views** — a saved filter, optionally shared. Your personal cockpit.
- **Board vs list vs timeline** — three renderings of the same query. Switch freely; the query is the thing.

**Filters** support `and` / `or` / `not` groups. The four filters that do 90% of the work:

| Filter | Useful values | Why |
|---|---|---|
| Status | `Todo`, `In Progress`, `In Review` | Hides Backlog noise and finished work |
| Cycle | current | Scopes you to the timebox |
| Priority | `Urgent`, `High` | The emergency lane |
| Label | `Bug` | Bug triage, separate from feature flow |

### Build these three views today

1. **"Now"** — assignee is me, status in (Todo, In Progress, In Review), cycle is current. This is the only view you need open most days.
2. **"Waiting on me"** — status is In Review, assignee is me. Reviews are the work that hides.
3. **"Bugs"** — label is Bug, status is not (Done, Canceled). Your defect inventory.

### Step 3.1 — Group and sort deliberately

Group by **Status** for a board, by **Project** for a planning session, by **Assignee** to see load. Sort by **Priority** when triaging, by **Updated** when hunting for stale work. Change grouping per session; the saved view keeps your default.

> **Anti-pattern:** one giant view called "All issues" that you scroll. It trains you to browse instead of decide. Keep `Backlog` as a *separate* view you open on purpose.

---

## Part 4 — Keyboard-First Operation

Linear is one of the few web apps where the mouse is genuinely optional. This is not trivia: speed makes the difference between capturing a thought and losing it.

**The one that matters most is the command menu.** Open it with `⌘K` and you can create an issue, jump to any issue/project/view, change status, and search everything — from one box, without knowing where anything lives.

**Press `?` inside Linear** to bring up the authoritative, always-current shortcut list. That is the honest answer to "what are all the shortcuts" — this paper will not enumerate keys that may change. Learn these four behaviors instead:

1. **Open the command menu before reaching for the sidebar.** `⌘K`, type, Enter.
2. **Create in place.** There is a create-issue shortcut that works from any screen; find it via `?` and use it the moment a thought arrives.
3. **Navigate by chord.** Linear has multi-key navigation sequences (press a key, then another) rather than dozens of modifiers. `?` lists them; pick the three destinations you actually visit (My Issues, current cycle, Backlog).
4. **Close and change status without a dialog.** Bulk-select issues in a list and change status in one action; this is where a keyboard workflow compounds.

### Step 4.1 — A 10-minute speed drill

1. Open the command menu. Jump to `CHR-7` by typing "audit". Close it. Repeat until it's reflex.
2. Create a throwaway issue without touching the sidebar. Delete it.
3. Open the shortcut sheet with `?`. Pick two navigation chords and memorize them today.
4. Filter My Issues to `In Progress`. Change one issue's status by keyboard only.

Do that drill once and you will be faster than most Linear users within a day.

---

## Part 5 — Projects, Milestones, Initiatives, and Releases

### Projects

A project has a name, a lead, a status, optional start/target dates with a resolution (day, month, quarter), teams, members, labels, and — importantly — its **own description**. Your existing projects illustrate two different uses:

| Project | State | Reading |
|---|---|---|
| Agent Command Center | In Progress, started 2026-09-04 | A real, active effort with issues and PRs |
| vite-portfolio | In Progress, started 2026-08-23 | Active; two issues already Done |
| Workout Tracker | Backlog, has a real summary | Idea, captured well, not committed |

That is exactly right: a project can sit in Backlog. The summary on Workout Tracker ("add sessions and each exercise per day… history log… sets and reps") is a model capture. Copy that habit.

**When something is a project vs an issue vs a milestone:**

| Situation | Use |
|---|---|
| One verifiable change | Issue |
| Several issues toward one outcome | Project |
| A dated checkpoint on the way | Milestone |
| Two or more projects serving one goal | Initiative |

### Milestones

A project with no milestones is a bag. Add two or three: `Schema landed`, `Preflight working`, `Phase 1 accepted`. Now the project has a shape and a date on each segment.

### Initiatives

The layer above projects. For a solo developer, an initiative is useful mainly as a *narrative*: "Get to first paying customer" containing the audit-SaaS project and the landing-page project. Add one when you have two or more projects that share a finish line.

### Releases and release pipelines

Linear has grown into release management: pipelines, stages, releases, versions, and release notes, with a "production" pipeline concept. This is genuinely useful once you ship software to real users — you can attach issues to a release and generate notes from what landed. It is overkill before your first release. Note that it exists, and revisit it when you ship v1.

### Step 5.1 — Give your active project a spine

For `Agent Command Center`, which is your most active project:

1. Add two milestones with target dates.
2. Move its open issues under the right milestone.
3. Write a project description with the *outcome* in one sentence and a link to the spec document.

---

## Part 6 — Docs, Issue Writing, and Templates

### Documents

Linear has native documents, attachable to a project, an initiative, a cycle, or a team. You have **none**. That is the gap that hurts most, because right now the reasoning behind a project lives in your head or in a chat session that will die.

Create one document per active project: `Agent Command Center — Design Notes`. Put the *why*, the constraints, and the decisions in it. Issues then only need to say *what*, because the *why* has a home.

> **This is the antidote to session death.** An agent session is not a record. An issue comment and a project document are. If a decision was made in a chat, it must be written back or it did not happen.

### Writing an issue an agent can execute

Because you delegate to agents, your issue format matters more than it does for a human-only team. A template that works:

```markdown
## Outcome
One sentence. What is true when this is done?

## Acceptance criteria
- [ ] Specific, checkable statement
- [ ] Another one
- [ ] Tests pass; `npm run typecheck` clean

## Constraints
- Do not change public API surface.
- Stay within `app/api/agents/**`.

## Definition of done
PR linked to this issue, reviewed by a human, merged.
```

Every line above is verifiable by a machine or a person. That is the test.

### Templates

You have **none defined**. Templates are how you enforce the format without thinking about it. Create two:

| Template | Type | Purpose |
|---|---|---|
| Engineering task | Issue | The format above, with the DoD checklist pre-filled |
| Bug report | Issue | Repro steps, expected, actual, environment, severity |

Then `Bug` label plus bug template means every defect arrives with a reproduction.

### Step 6.1 — Move your best issue into a template

Your `CHR-7` description is already excellent: a severity table, a plan-gap table, and numbered next steps. That structure *is* a template. Turn it into the `Code review findings` issue template so the next audit produces the same clarity without you re-inventing the format.

---

## Part 7 — GitHub Integration and the Branch Workflow

Linear generates a canonical branch name for every issue. Yours look like this:

```text
CHR-7  →  chriswandermail/chr-7-audit-fix
CHR-5  →  chriswandermail/chr-5-navigation
CHR-6  →  chriswandermail/chr-6-mobile-design-and-build-of-work-section
```

Use the generated name verbatim. Once GitHub is connected, Linear reads the issue ID in the branch or PR title and links them automatically; magic words in the PR description move the issue's status for you. That is the whole trick: **you never update the issue by hand after opening a PR.**

### Step 7.1 — The loop, per issue

1. **Triage** — accept the issue out of Triage into Todo.
2. **Start** — move to In Progress. Note the generated branch name.
3. **Branch** — `git checkout -b chriswandermail/chr-<n>-<slug>`.
4. **Work** — commit normally.
5. **PR** — open the PR with the issue ID in the title; include a closing keyword in the body if the PR fully resolves it.
6. **Review** — Linear moves it to In Review. This is a real state: your `CHR-7` history shows In Progress → In Review → Done, twice, which is exactly the disciplined pattern.
7. **Ship** — merge; the issue closes. Only then does the status say Done, and it *means* it.

Your `CHR-7` issue already carries three PR attachments (PR #2, #3, #4 in `Cwander83/agent-command-center`). That linkage is Linear working as designed — and it is why the issue, not the chat log, is the source of truth.

> **Branch tip on macOS:** the name is long. Double-click the branch name in Linear to copy, then `git checkout -b "$(pbpaste)"`. Faster than retyping and it guarantees an exact match for auto-linking.

---

## Part 8 — Automation: Rules, SLAs, Delegation

Three automation layers exist, in increasing order of power:

**1. Triage rules and workflow automation (no code).** In team settings you can define rules: auto-assign to a user or a delegate, auto-close stale issues, set labels by keyword, and so on. This is where you remove recurring decisions. Start with exactly one rule: anything labeled `Bug` with priority Urgent gets assigned to you.

**2. SLAs and due dates.** Issues carry due dates, and Linear has SLA fields (`slaStartedAt`, medium/high-risk, breach timestamps) with day-counting modes (`all` or `onlyBusinessDays`). For a solo dev, SLAs are mainly a forcing function for client work. Skip until you have a client who cares.

**3. Delegation to agents.** Issues have both an `assignee` (a human) and a `delegate` (an agent). Your workspace already uses this: `CHR-5`, `CHR-6`, and `CHR-7` are all **delegated to Cursor** while assigned to you. This is Linear's own agent concept, and it is the bridge to Part 9.

### Step 8.1 — One rule, one delegate

1. Add a triage rule that routes `Bug` + Urgent to you.
2. Decide the delegation policy: work you want an agent to *attempt* gets a delegate; accountability stays with the assignee. Never leave an issue with neither.

> **Blunt warning:** a delegate is a queue, not a guarantee. In your own history, `CHR-7` bounced In Progress → In Review → In Progress → In Review before Done, and it accumulated two "fix the audit findings" PRs plus a follow-up gap PR. That is normal — and it is exactly why the human merge gate and the definition of done in Part 2 are load-bearing.

---

## Part 9 — Linear for AI Agents: MCP, API, Webhooks

This is where Linear goes from tracker to **control plane**.

### The MCP server

Linear ships a Model Context Protocol server, so an agent can read and write your workspace directly. Your setup points at the remote endpoint:

```json
"linear": {
  "type": "remote",
  "url": "https://mcp.linear.app/mcp",
  "enabled": true
}
```

- Read-write endpoint: `https://mcp.linear.app/mcp`
- Read-only alternative: `https://mcp.linear.app/mcp/readonly`
- Auth: OAuth in the browser on first use (or `opencode mcp auth linear`)
- Verify: `opencode mcp list`, then ask the agent to show your Linear issues

**Use the read-only endpoint for research agents and the read-write endpoint only for agents you trust to mutate.** That is least privilege applied to a SaaS integration, and it costs nothing to adopt.

### What the MCP surface actually exposes

This matters because it tells you what to delegate. The server covers, among others:

| Capability | Tools (representative) |
|---|---|
| Read issues/projects/teams | `list_issues`, `get_issue`, `list_projects`, `get_project`, `list_teams` |
| Create/update issues | `save_issue` — status, assignee, delegate, cycle, milestone, labels, priority, relations |
| Relations | `blocks`, `blockedBy`, `relatedTo`, `duplicateOf` (and their removal counterparts) |
| Partial edits | `patch` operations (`replace`, `insert_before`, `insert_after`, `append`, `replace_range`) so an agent edits a description without resending it |
| Documents | `save_document`, `list_documents` — attach to project, issue, initiative, cycle, or team |
| Comments | `save_comment`, `list_comments` — including inline comments anchored to description text |
| Planning objects | `save_project`, `list_milestones`, `list_cycles`, templates |
| Releases | `list_releases`, `list_release_pipelines`, `list_release_notes` |
| Attachments | `prepare_attachment_upload` → PUT → `create_attachment_from_upload` |
| Agent metadata | `list_agent_skills`, `list_diffs` (linked PRs and review state) |

Two details worth internalizing:

- **`save_issue` replaces labels, not merges them.** Pass `addLabels`/`removeLabels` for incremental changes; omit the field to leave labels untouched. An agent that sends the wrong one will silently strip your labels.
- **`patch` is the safe edit path.** It applies operations atomically and fails the whole save if any anchor doesn't match exactly once — which is precisely the property you want when an agent edits a description a human also edits.

### The division of labor

This is the rule that keeps the system honest:

| Human (Linear UI) | Agent (MCP / API) |
|---|---|
| Triage: accept or decline | Status changes |
| Estimates and priorities | Writing comments with findings |
| Roadmap and milestones | Creating sub-issues from a plan |
| Merging PRs | Bulk queries across issues |
| Judging "is this done?" | Drafting issue descriptions |

The mechanical work is cheap to automate and expensive to do by hand. The judgment is the opposite. Keep the boundary there.

### The anti-patterns

- **Never let a session be the only record.** Anything learned goes in an issue comment.
- **Don't create an issue per tiny thing.** Linear is the plan; the session is the work.
- **Don't shadow Linear with a local TODO file.** Two sources of truth means zero.

### GraphQL API and webhooks

Beyond MCP, Linear exposes a GraphQL API and webhooks. Reach for these when you need something MCP doesn't cover:

- **GraphQL** — custom queries and mutations from your own code (a dashboard, a script, a bot).
- **Webhooks** — Linear calls your endpoint on events, so your own system can react (e.g., when an issue moves to In Review, run your eval suite from Paper 1).

Keep a personal API key in an environment variable, never in a repo:

```bash
# ~/.zshrc  — macOS
export LINEAR_API_KEY="lin_api_..."
```

Then a query is a plain HTTPS call:

```bash
curl -s https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { name } }"}'
```

> **Verify every field name against the current schema before trusting it.** Linear's API evolves; the schema in the developer docs is the source of truth, and any field name in this paper should be re-checked there. Never paste an API key into a chat or commit it.

---

## Part 10 — Plans, Limits, and When Not to Use Linear

**Plans (verify on the pricing page — these change):** Linear has a free tier and paid per-user tiers, with the paid tiers gating things like certain admin controls, integrations, and team features. For a single developer the free tier is generous enough to run everything in this paper. Do not pay until a limit actually bites you.

**Limits that matter more than price:**

| Limit | Practical impact |
|---|---|
| API complexity/rate limits | A chatty agent loop can hit them; batch your queries |
| Attachment size | Large files are not the point; link to them instead |
| Team scoping of statuses | You cannot mix workflows in one team |
| Free-tier history/analytics | Reporting depth may be gated |

**When Linear is the wrong tool:**

- **Personal errands and chores.** A notes app or reminders is better; don't pollute your engineering workspace.
- **Heavy non-engineering workflows** (legal, HR) that need custom fields and forms — Linear is opinionated toward software.
- **Spreadsheet-shaped work.** If you want a grid of numbers, use a spreadsheet.
- **A team that refuses to keep statuses honest.** Linear's value is derived from the status field; if nobody updates it, you have paid for a worse text file.

---

## Keyboard & Command Cheat Sheet

> **Authoritative key:** press `?` inside Linear. The list below is behavior, not a keybinding table, precisely because keybindings change.

| I want to… | Do this |
|---|---|
| Find or do anything | Open the **command menu** (`⌘K`) and type |
| See all shortcuts | Press `?` |
| Create an issue from anywhere | Create-issue action (confirm current key via `?`) |
| Capture a thought fast | Command menu → create issue; refine later in Triage |
| See my work | **My Issues** view |
| Change status without a dialog | Select in a list → change status as a bulk action |
| See only the committed work | Filter: cycle = current, status in Todo/In Progress/In Review |
| Find stale work | Sort by Updated, oldest first |
| Open an issue's branch | Copy the generated branch name from the issue |

| Object | Create from | Key fields |
|---|---|---|
| Issue | Anywhere, team required | title, team, status, priority, assignee/delegate |
| Sub-issue | Parent issue | `parentId` |
| Project | Team or workspace | name, lead, teams, start/target date |
| Milestone | Inside a project | name, target date |
| Initiative | Workspace | name, projects |
| Document | Project/team/cycle | title, content |
| View | Any issue list | filters, grouping, sharing |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "My issue didn't close when I merged" | No issue ID in branch/PR title, or GitHub not connected | Use the generated branch name; check the GitHub integration |
| Issue shows Done but work isn't shipped | Status treated as "typed" not "verified" | Enforce the definition of done; use In Review as a real gate |
| Backlog is a graveyard | No triage discipline; everything accepted | Triage first; delete anything untouched for months |
| Can't find anything | Relying on folders/browsing | Use `⌘K` and save views instead |
| Agent stripped all labels | `save_issue` replaces labels by default | Use `addLabels`/`removeLabels` for incremental edits |
| Agent edit failed mid-way | A `patch` anchor didn't match exactly once | Re-read the description and retry with fresh anchors; patches are atomic by design |
| MCP write refused | Using the read-only endpoint | Switch the server URL to `https://mcp.linear.app/mcp` for the mutating agent |
| Two systems disagree | A local TODO file shadows Linear | Delete the local file; Linear is the record |
| Statuses feel wrong | Workflow doesn't match the default set | Resist adding statuses — model "blocked" as a relation, not a status |
| Cycle plan collapses | Pulling too much into the cycle | Pull less; treat unfinished items as a signal, not a failure |
| Same label everywhere | Labels used for status/priority | Move those to first-class fields; keep labels for kind of work |

---

## Video Library

> These are **YouTube search links**, not specific videos — always valid, and you pick the current best result. No invented URLs.

| Search link | What to look for, and why |
|---|---|
| [Linear app full tutorial](https://www.youtube.com/results?search_query=Linear+app+full+tutorial) | A complete walkthrough of the UI; watch for the object model appearing in every screen |
| [Linear method explained](https://www.youtube.com/results?search_query=Linear+method+explained) | The philosophy behind cycles, triage, and small issues |
| [Linear keyboard shortcuts](https://www.youtube.com/results?search_query=Linear+keyboard+shortcuts) | Speed drills; compare their chords to your `?` sheet |
| [Linear cycles tutorial](https://www.youtube.com/results?search_query=Linear+cycles+tutorial) | How cycles actually change behavior week to week |
| [Linear projects and milestones](https://www.youtube.com/results?search_query=Linear+projects+and+milestones) | Turning a bag of issues into a plan with checkpoints |
| [Linear GitHub integration](https://www.youtube.com/results?search_query=Linear+GitHub+integration) | Branch and PR auto-linking in practice |
| [Linear MCP server](https://www.youtube.com/results?search_query=Linear+MCP+server) | Connecting an agent to Linear; watch what it can and can't do |
| [Linear vs Jira](https://www.youtube.com/results?search_query=Linear+vs+Jira+2026) | Honest tradeoffs if you're deciding for a team |
| [Linear for solo developers](https://www.youtube.com/results?search_query=Linear+for+solo+developers) | One-person workflows that don't over-configure |
| [Linear API GraphQL tutorial](https://www.youtube.com/results?search_query=Linear+API+GraphQL+tutorial) | Calling the API from your own code |

---

## Written References & Docs

Official Linear sources only. If a link moves, navigate from `linear.app` itself — never trust a mirror.

| Source | URL |
|---|---|
| Linear docs | `https://linear.app/docs` |
| The Linear Method | `https://linear.app/method` |
| Linear developers (API) | `https://linear.app/developers` |
| Linear GraphQL reference | `https://linear.app/developers/graphql` |
| Linear changelog | `https://linear.app/changelog` |
| Linear pricing | `https://linear.app/pricing` |
| Linear MCP endpoint | `https://mcp.linear.app/mcp` (read-only: `https://mcp.linear.app/mcp/readonly`) |
| Linear security / API keys | `https://linear.app/settings/account/security` |

> **Verification tip:** Linear ships fast — releases, agent delegation, and triage intelligence are all recent. If this paper and the changelog disagree, the changelog wins.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| Workspace | The top-level Linear account holding all teams and projects |
| Team | The unit that owns statuses, cycles, and issue identifiers |
| Issue | A single unit of work |
| Sub-issue | An issue nested under a parent issue |
| Project | A container of issues with a start, target, and status |
| Milestone | A dated checkpoint inside a project |
| Initiative | A group of projects serving one goal |
| Cycle | A timeboxed iteration for a team |
| Triage | The inbox for work you have not yet accepted |
| Status type | The category behind a status (backlog/unstarted/started/completed/canceled/duplicate) that powers automation |
| Relation | A typed link between issues: blocks, blockedBy, relatedTo, duplicateOf |
| Delegate | An agent assigned to attempt an issue, distinct from the human assignee |
| View | A saved query over issues |
| Document | A native Linear doc attachable to a project, team, cycle, or initiative |
| Template | A pre-filled issue/project/document shape applied on create |
| Release pipeline | A configured path (stages/versions) that releases flow through |
| Magic word | Text like a closing keyword in a PR that moves an issue's status |
| `gitBranchName` | The branch name Linear generates for an issue |

---

## FAQ & Next Steps

**Do I need more than one team?** Almost certainly not. Add a team only when the workflow (statuses or cadence) genuinely differs.

**Cycles for a solo dev — worth it?** Yes, with discipline. Two weeks, a small pull list, and an honest review at the end. It converts "I have a lot to do" into "I committed to four things."

**Should I put everything in Linear?** No. Engineering work yes; groceries no. A tool that contains everything loses its signal.

**Should I let agents write to Linear?** Read-only for research agents; read-write for agents whose work you review. Keep the audit trail.

**Is the free tier enough?** For one developer, usually yes. Check the pricing page rather than trusting a summary.

**What's the highest-leverage thing I'm missing?** Two things: **documents** (your reasoning has no home) and **cycles** (you have no timebox). Both are ten-minute setups.

### Next steps, in order

1. **Today:** turn on cycles (2 weeks) and create the three views from Part 3.
2. **This week:** create one project document per active project; write the *why* down.
3. **This week:** add two templates (engineering task, bug report) with your definition of done.
4. **Next week:** give `Agent Command Center` two milestones with target dates.
5. **Next week:** add one triage rule and settle the delegate policy.
6. **Month 2:** revisit releases when you ship v1, and wire one webhook (In Review → run your evals).

---

## Verification Note

**Verified against primary sources in September 2026:**

- Workspace, team, project, status, label, and issue data read directly from the live `chriswander` workspace via the Linear MCP server (see Part 1.1 and the Setup Notes table).
- MCP tool surface enumerated from the live server: `save_issue` label-replacement semantics and `patch` atomicity are documented behaviors of the tool schema, not guesses.
- Linear documents, release pipelines/releases, agent delegation, triage intelligence, and SLA fields all exist as first-class objects in the current API/MCP surface.
- `gitBranchName` values (`chriswandermail/chr-<n>-<slug>`) are the actual generated names from your workspace.

**Changes fast — verify before relying on it:** pricing, the exact MCP tool list, release-management features, keyboard shortcuts (always check `?`), GraphQL field names, and rate limits. This paper deliberately avoids enumerating keybindings for that reason.

**Deliberately generic:** the Linear Method's specifics are described in behavior terms; read `linear.app/method` for the canonical text rather than trusting a summary.

---

## Bonus — Handoff Prompt

Copy this into any AI agent to extend this paper into a deeper, workspace-specific guide.

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He builds a
Next.js + Postgres SaaS, uses AI coding agents daily (opencode + MCP), runs an Obsidian vault, and
works on a MacBook Pro (Apple M5 Pro, 24 GB RAM) in VS Code.

Paper: markdown_docs/06-linear-mastered.md
Topic: Linear, Mastered — the operating system for his work.

Match the house style exactly: title "# The Complete Guide: <Topic>"; blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big Picture
(ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered "## Part N — Title"
sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH links only) → Written
References & Docs (official Linear sources only) → Glossary → FAQ & Next Steps → Verification Note
→ Bonus — Handoff Prompt → Your Setup Notes. Pure Markdown, no HTML. Every fence language-tagged.
Second person, no filler.

Do whichever Chris asks:
(A) Expand one Part by 1,200+ words with a concrete worked example.
(B) Add a Part on a topic he names — e.g. reporting/analytics, Linear for client work, migrating
    from Jira, or building a custom dashboard on the GraphQL API.
(C) Audit his live Linear workspace with the Linear MCP server (read-only is fine), then produce a
    step-by-step cleanup plan: objects to create, statuses to rename, views to save, templates to
    define. Use his real team key (CHR) and real project names.

Rules: never invent URLs, shortcuts, GraphQL fields, CLI flags, or prices. If unsure write
"search: <term> Linear docs" and state how to verify. Date pricing claims. Use blockquote callouts
for cost and "this changes fast." Keep the structure. Report path, one-line summary, word count.

Anchors (verified September 2026) — reuse and re-verify:
https://linear.app/docs
https://linear.app/method
https://linear.app/developers
https://linear.app/developers/graphql
https://linear.app/changelog
https://linear.app/pricing
https://mcp.linear.app/mcp   (read-only: https://mcp.linear.app/mcp/readonly)
```

---

## Your Setup Notes (Mac · VS Code · opencode)

**Your actual workspace, and what to change first.**

| Found in your workspace | Verdict |
|---|---|
| 1 team (`Chriswander`, key `CHR`) | Correct. Do not add a second. |
| 3 projects, one Backlog with a real summary | Good capture hygiene. |
| 7 default statuses, unmodified | Good. Resist adding any. |
| 3 labels (Bug, Feature, Improvement) | Healthy. Don't grow it. |
| **No cycles** | **Fix this — biggest behavioral win.** |
| **No documents** | **Fix this — your reasoning has no home.** |
| **No templates** | Fix this — you already write good issues; automate the shape. |
| No milestones | Add two to `Agent Command Center`. |
| Agent delegation already in use (`Cursor`) | Keep it; your `CHR-7` history shows why human review matters. |

**Recommended stack for this paper's workflows on your machine:**

- **Editor:** stay on **VS Code** — it is the right call here, because the Dev Containers story (Paper 7) and the Linear/Git integration both live there. If you ever want a lighter native editor, **Zed** is the credible macOS alternative, but you'd give up some extension depth. **Cursor** is a VS Code fork and keeps compatibility; useful if you want agent features inside the editor, at the cost of a second AI toolchain to manage.
- **Terminal:** Ghostty or iTerm2; enable **shell integration** so you get command status markers and easy cwd jumps.
- **Clipboard trick:** `git checkout -b "$(pbpaste)"` after copying Linear's branch name — exact match, every time.
- **API key:** export `LINEAR_API_KEY` in `~/.zshrc`, never in a repo. Rotate it if it ever touches a chat.
- **MCP:** keep `https://mcp.linear.app/mcp` for your trusted build agent and switch research agents to `https://mcp.linear.app/mcp/readonly`.
