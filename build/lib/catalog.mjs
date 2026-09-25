// Hand-curated metadata for the shelf. Content still lives in markdown_docs/;
// this only adds what markdown can't reliably express (category, order) and a
// few display overrides. Anything omitted falls back to auto-derivation.
//
// ORDERING: the dashboard is newest-first. Higher `order` sorts to the top, so
// the most recently added guide is first. A file with no catalog entry (or no
// `order`) falls back to its filename prefix (e.g. `12-foo.md` -> 12), and an
// unprefixed file falls back to 999 — also the top. So dropping in a new guide
// and rebuilding puts it at the top without editing this file for position.
// Existing entries keep a `category`, so add one for each new guide.

export const GUIDES = {
  "01-ai-evals-regression-testing": { category: "AI & Agents", order: 1 },
  "02-prompt-injection-agent-security": { category: "AI & Agents", order: 2 },
  "03-postgres-as-the-whole-backend": { category: "Data & Backend", order: 3 },
  "04-local-on-device-ai-stack": { category: "AI & Agents", order: 4 },
  "05-web-platform-2026-rsc-streaming-edge-wasm": { category: "Web Platform", order: 5 },
  "06-linear-mastered": { category: "Workflow", order: 6 },
  "07-containers-dev-environments-macos": { category: "Infra & Dev Env", order: 7 },
  "08-stripe-billing-for-saas": { category: "Business & Billing", order: 8 },
  "graphify-obsidian-ai-agent-guide": { category: "AI & Agents", order: 9 },
  "linear-opencode-workflow": {
    category: "Workflow",
    order: 10,
    title: "Linear + opencode Workflow",
  },
  "11-jev-system-one-decisions": { category: "AI & Agents", order: 11 },
};

// Docs that are not reader-facing guides (meta / tooling material).
export const IGNORE = ["AI-Agent-Handoff-Prompt-Pack.md"];
