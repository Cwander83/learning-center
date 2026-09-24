# Linear + opencode — How-To Guide

The optimal workflow for using Linear and opencode together.

## Rule of thumb: where issues get born

| Situation | Do this |
|---|---|
| Stray idea, away from desk, quick capture | Create in Linear UI |
| You're in an opencode session, context is in your head | Tell opencode — it drafts title/description, sets project, priority, parent, labels |
| You just finished discussing a problem worth tracking | Tell opencode to "save this as an issue" — session knowledge becomes Linear record |

Don't double-track. If opencode creates it, that's the real one — don't also type it in the Linear UI.

## The loop (per issue)

1. **Triage** — "show my open issues" → opencode lists, summarizes, suggests priority
2. **Start** — "start CHR-8" → opencode sets status In Progress, pulls full description, checks comments
3. **Work** — opencode implements in code, runs tests
4. **Record** — opencode comments findings/decisions on the issue. This matters: comments survive session death, delegates (Cursor etc.) and future-you see them
5. **Ship** — opencode uses the Linear-generated branch name (`chriswandermail/chr-8-...`), commits, PR; flips issue Done only after verified
6. **Decompose** — big issue? opencode creates sub-issues under a parent, or milestones on a project

## Division of labor

- **Linear UI** = human judgment: triage board, estimates, cycles, dragging
- **opencode** = mechanical: status changes, comments, sub-issue creation, bulk queries, keeping issue descriptions synced with reality

## Anti-patterns

- Never let the session be the only record — anything learned goes in an issue comment
- Don't create an issue per tiny thing; Linear is the plan, the session is the work
- Don't keep a local TODO file that shadows Linear

## Setup reference

Linear MCP is configured in `~/.config/opencode/opencode.jsonc`:

```json
"linear": {
  "type": "remote",
  "url": "https://mcp.linear.app/mcp",
  "enabled": true
}
```

- Read-write endpoint: `https://mcp.linear.app/mcp`
- Read-only alternative: `https://mcp.linear.app/mcp/readonly`
- Auth: OAuth via browser on first use (or `opencode mcp auth linear`)
- Verify: run `opencode mcp list`, then ask opencode to show your Linear issues