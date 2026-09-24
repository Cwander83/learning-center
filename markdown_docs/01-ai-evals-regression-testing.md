# The Complete Guide: AI Evals & Regression Testing for LLM Apps

> **How do you know your LLM app got *worse*?** This paper turns "the output felt worse today" into a number you can gate a deploy on.

**Last verified: September 2026**
**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Your tests make CI red when a route 500s, because the output is *decidable*: same input, same answer. LLM output isn't. Same prompt, different text every call; rarely one right answer. Worst of all: a prompt "improvement" can raise quality on the cases you stared at while quietly destroying cases you never looked at — a **silent regression**. Product broken, nothing red, no ticket filed.

> **Framing:** "Evals" is scoring LLM/agent output against criteria you define, on a fixed input set, so version A can be compared to B — a *measurement* discipline, not a product feature.

**Three things people conflate:** **tracing / observability** answers *"what happened?"* (facts, not judgments); **evals** answer *"how good was it, consistently?"* (scores across a dataset); **guardrails** answer *"should this be blocked?"* (a runtime allow/block/redact decision). Tracing without evals is a security camera with no definition of "burglary." Evals without tracing can't explain *why* a score dropped.

### The loop

```text
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐
│ DATASET  │──▶│   RUN    │──▶│  SCORE   │──▶│ COMPARE   │──▶│   GATE   │
│ fixed    │   │ app on   │   │ code +   │   │ vs        │   │ pass or  │
│ cases    │   │ each     │   │ judge    │   │ BASELINE  │   │ fail the │
│ (+labels)│   │ case     │   │ scorers  │   │ (prod)    │   │ build    │
└──────────┘   └──────────┘   └──────────┘   └───────────┘   └────┬─────┘
     ▲                                                             │
     │                   ┌──────────────────────┐                  │
     │                   │  PRODUCTION TRAFFIC  │                  │
     │                   │  sampled + scored    │                  │
     │                   └──────────┬───────────┘                  │
     │                              │                              │
     └──────────────────────────────┴──────────────────────────────┘
              failures become new dataset cases (the feedback loop)
```

Offline catches regressions you know about; online catches the ones you don't; online failures become tomorrow's dataset rows.

| Concept | Plain-English analogy |
|---|---|
| Eval | A unit test for output with no single correct answer |
| Golden set / dataset | A frozen photo album of inputs you always re-shoot |
| Deterministic scorer | A metal detector — beeps or doesn't, every time |
| LLM-as-judge | A substitute teacher — smart, fast, biased, needs calibration |
| Baseline | Yesterday's report card, so today's scores mean something |
| CI gate | The bouncer at the door of production |
| Trace | The receipt: everything that happened on one visit |
| Guardrail | The smoke alarm — acts in the moment, not after |

---

## The 60-Second Version (TL;DR)

1. Collect **5–10 real cases** — a few you're proud of, a few that failed in production.
2. Write **deterministic checks first**: valid JSON/HTML? required sections? score in range? Free, never flake.
3. Add **one LLM-as-judge** for the subjective criterion (1–5 with written rationale).
4. Record the **baseline**: run the current production prompt, save the scores.
5. Make **one change**. Re-run. Compare per case and per metric.
6. **Gate CI** on the aggregate not dropping below baseline minus a tolerance you chose.
7. Later: sample **5–10% of live traffic**, score it online, paste failures back into the dataset.

---

## Prerequisites

| Requirement | Why | How to check / get |
|---|---|---|
| Node.js ≥ 22 | promptfoo and most JS eval CLIs need a modern Node | `node --version` |
| Python 3.10+ | DeepEval, Ragas, Phoenix SDKs are Python-first | `python3 --version` |
| An API key for a judge model | The judge is a model call | `echo $OPENAI_API_KEY` |
| Your app callable in code | Evals run your *task*, not a re-implementation | A function or HTTP endpoint callable from a script |
| App outputs live somewhere | Traces are the raw material for datasets | Existing logs, or add tracing (Part 5) |
| Version control | Baseline discipline needs "what changed" | `git log` |

> **Assumption:** if your LLM logic only exists inside a React component, extract the model call into a reusable function first.

---

## Part 1 — Why Evals: The Silent Regression Problem

Three sources of change, none visible as a code diff: **you** change a prompt/model/retrieval setting; **the vendor** changes something (deprecation, silent version bump, changed defaults — release notes are the only warning, and sometimes there is none); **the world** changes. Only a fixed dataset with recorded scores defends against all three.

```text
TRACING (facts)      : input, retrieved docs, tool calls, output, latency, cost
EVALS (judgments)    : scores/labels on those facts, aggregated
GUARDRAILS (actions) : block/allow/redact decisions at request time
```

**Step 1.1 — Name the dimensions you care about.** Don't evaluate "quality." Evaluate what a user would notice: **structural validity**, **numeric correctness**, **grounding**, **actionability**, **tone**, **cost & latency**. Each dimension gets *the cheapest method that measures it reliably* (Part 3). That mapping is your eval strategy.

**Step 1.2 — Define "worse" before you can detect it.** Examples: aggregate pass rate drops >3 points vs baseline; any P0 segment drops >1 point on the 1–5 judge scale; structural validity falls below 100%. A 4.1 → 4.0 move shouldn't paralyze you.

---

## Part 2 — Golden Sets: Build From Your Own Real Outputs

The most common mistake is building 500 synthetic cases before writing one scorer. You'll spend a weekend imagining edge cases and learn less than from 8 real ones.

> **Verified practice (Braintrust docs, Sept 2026):** "Begin with 5–10 representative examples that cover your core use cases. A small, well-chosen dataset is more useful than a large dataset of easy cases." Expand "guided by actual failures from production — not by synthetic construction of edge cases you imagine might exist."

**Step 2.1 — Build the first dataset by hand.** `evals/datasets/audit-reports.jsonl`:

```jsonl
{"input": {"company": "Acme Corp"}, "expected": {"has_sections": ["summary","pricing","features","risks"]}, "metadata": {"topic": "pricing", "tier": "enterprise", "source": "manual"}}
{"input": {"company": "Globex"}, "expected": {"has_sections": ["summary","pricing","features","risks"]}, "metadata": {"topic": "features", "tier": "self-serve", "source": "prod-failure-2026-07"}}
```

- **Metadata on every case** (`topic`, `tier`, `intent`, `source`) so you can later find *which segment* regressed. Aggregates hide problems.
- **Mark the source**: `manual`, `prod-failure-<date>`, `synthetic`.
- **Keep `expected` minimal** — decidable facts (required sections, range) only.
- **One case = one realistic input.**

**Step 2.2 — Pull in production failures.** Capture the exact failing input from your trace; add the wrong output as a `notes` field (never as `expected`); add the missing decidable facts; tag `prod-failure-<date>`.

> **This changes fast:** Langfuse promotes traces into datasets, Braintrust "promotes traces from logs," promptfoo points at CSV/JSONL. The practice is stable; the button names are not.

**Step 2.3 — Grow from failures, not imagination.** Add a case when production fails, when an experiment yields an output you can't explain, or when a new segment appears.

**Step 2.4 — Freeze a version.** Hash the dataset and record **four coordinates** with every kept result: dataset hash, prompt version, model ID, scorer version. Without them, "we used to score 4.2" is folklore.

---

## Part 3 — Deterministic Scorers First, Judge Second

**If a check is decidable, do it in code.** Code scorers are free, millisecond-fast, identical every run. LLM judges are slow, cost money, and disagree with themselves.

> **Verified (Langfuse docs, Sept 2026):** "a free deterministic screen runs on everything, the judge runs on what the screen flags plus a sample of the rest, and humans review where the judge is uncertain or the stakes are high."

```python
# evals/scorers/structure.py
from bs4 import BeautifulSoup

def structural_validity(output: str) -> dict:
    required = ["summary", "pricing", "features", "risks"]
    soup = BeautifulSoup(output, "html.parser")
    found = {s.get("data-section") for s in soup.select("[data-section]")}
    missing = [s for s in required if s not in found]
    return {"score": 1.0 if not missing else 0.0, "reason": f"missing: {missing}"}

def numeric_score_in_range(output: str) -> dict:
    node = BeautifulSoup(output, "html.parser").select_one("[data-score]")
    if node is None:
        return {"score": 0.0, "reason": "no [data-score] element"}
    value = float(node["data-score"])          # wrap in try/except in real code
    return {"score": 1.0 if 0 <= value <= 100 else 0.0, "reason": f"score={value}"}
```

| Check type | Catches | Typical syntax |
|---|---|---|
| Schema validation | Malformed structure | JSON Schema / Pydantic / Zod |
| Exact match | Classification, labels, enums | `equals` |
| Contains / regex | Required/forbidden phrases, IDs | `contains`, `regex` |
| Numeric range | Scores, prices, counts out of bounds | custom code |
| Cost / latency | Runaway verbiage, slow or expensive runs | `cost`, `latency` |
| Tool correctness | Wrong tool or args (agents) | trajectory assertions |
| HTML/SQL/XML validity | Structurally broken artifacts | `is-html`, `is-sql`, `is-xml` |

> **Verify names:** promptfoo's list (verified Sept 2026) includes `equals`, `contains`, `regex`, `is-json`, `is-html`, `javascript`, `python`, `cost`, `latency`, plus `trajectory:tool-used`, `trajectory:tool-sequence`, `trajectory:step-count`. Your tool will differ in spelling.

**The pre-screen cost pattern.** Run free code checks on every sampled case; score 0 and flag failures without a judge call; send only the passes (plus a ~20% sample) to the judge.

> **Cost note (vendor figure, Sept 2026):** Langfuse documents a typical evaluation costing **$0.01–$0.10 per assessment**, with three levers — sampling rate, targeting observations rather than whole traces, and cheaper judge models for simpler criteria. Ballpark, not a quote.

---

## Part 4 — LLM-as-Judge: Bias, Calibration, Baseline Discipline

A judge gives a model the input, your output, and a rubric, and asks for a score plus reasoning. promptfoo's `llm-rubric` returns (verified Sept 2026):

```json
{ "reason": "Analysis of the rubric and the output", "score": 0.5, "pass": true }
```

**Biases you must design around:** **verbosity bias** (longer answers score higher regardless of correctness — Braintrust: judges "favor longer, more formal, or more confident-sounding outputs regardless of accuracy"); **self-preference** (a judge prefers its own model family); **confidence/format bias**; **non-determinism** (a 0.02 change is not signal); **position bias** (randomize order). Test for it explicitly: compare a correct short answer against a wrong but verbose one.

**Calibration loop.** Pick one failure mode. If a stored output or state can settle it, write code and stop. Otherwise label 10–20 cases with the score *you* would give, write the judge prompt (context, one precise criterion, a few labeled examples, reasoning before verdict), run the judge against those labels, and iterate until agreement is stable. **Watch class balance:** if the failure you care about occurs in 10% of cases, a judge that always answers *pass* still agrees with you 90% of the time. Measure **TPR and TNR**, not raw accuracy.

> **Verified numbers (Langfuse docs, Sept 2026):** strong judges "reach 80–90% agreement with human reviewers on many criteria, which is comparable to agreement between two humans."

| Scale | Use when | Notes |
|---|---|---|
| Boolean | Criterion is genuinely binary | Easiest to calibrate; start here |
| Categorical | You want *which kind* of outcome | e.g. `complete` / `partial` / `wrong` |
| 1–5 numeric | Degree matters | Flakier; anchor every number |

Anchor every number: `5 = complete, grounded, actionable`; `3 = usable but a section is empty`; `1 = unusable or fabricated`.

**Compare to baseline; never trust an absolute score.** A judge score of 4.1 means nothing on its own — only relative to the same judge, rubric, dataset, model, and prompt measured yesterday. Braintrust (verified Sept 2026): run a baseline **before** changes; compare against **the version actually in production**; **update the baseline** whenever prompt, model, or scorer changes; for differences under 5 points, compare **averages over multiple trials**. **One change per experiment** — several simultaneous changes mean you can attribute nothing.

---

## Part 5 — Offline vs Online: Closing the Loop

| | Offline (dataset runs) | Online (production scoring) |
|---|---|---|
| When | Before shipping; in CI | Continuously on live traffic |
| Data | Curated dataset, often with expected outputs | Real inputs, no ground truth |
| Catches | Regressions from prompt/model/tool changes | Drift, novel inputs, real tool failures |
| Cost | Bounded by dataset size | Controlled by sampling rate |

> **Verified (Langfuse, Sept 2026):** "Offline evaluation runs your application against a fixed dataset... Online evaluation scores live production traffic, sampled to control cost... A complete strategy needs both, connected by datasets that grow from production failures."

**The cadence that closes the loop:** sample 5–10% of production → score it online → review weekly → triage each failure → add 1–3 cases per failure mode → run the offline experiment → update the baseline → gate CI → ship → monitor.

**Reference-free judging for production.** No `expected` online, so use **rubric judges** ("does the output address the goal and stay grounded in retrieved context?"), **property checks** (valid format, required tool called, step budget respected), and **human annotation** on a small sample.

> **Verified (Langfuse, Sept 2026):** judge at observation level, not whole-trace — "They complete in seconds (vs minutes for trace-level)." Trace-level judge evaluators are legacy as of July 2026.

**Sampling math:** at $0.02/assessment, sampling 5% of 10,000 daily runs ≈ $10/day (~$300/month); 10% ≈ $600/month. Langfuse: "Sampling 5 to 10 percent of traffic is usually enough to see quality trends without paying to judge everything." Sample deterministically per user/run ID.

> **This changes fast:** sampling UX, cost per assessment, and the default judge model move month to month. Date every number; verify pricing on the vendor page, never a blog post.

---

## Part 6 — The Tooling Landscape

Two composable layers: a **fast CI gate** (CLI, runs a dataset, exits non-zero on regression) and a **dataset/dashboard layer** (stores datasets, tracks experiments, scores production).

| Tool | Shape | What you use it for |
|---|---|---|
| **promptfoo** | Open-source CLI/library, YAML assertions | CI gate. `llm-rubric` (returns `{reason, score, pass}`, supports `threshold`), `g-eval`, deterministic checks, red-teaming. |
| **Braintrust** | Managed platform | Datasets, experiments, scorers (`autoevals` + custom code + judges), online scoring. Pass thresholds via `__pass_threshold`. |
| **Langfuse** | Open-source (MIT except `ee/`), self-hostable | Tracing, prompt management, datasets, annotation, judges. Connected loop first-class. |
| **DeepEval** | Python framework ("Pytest for LLM apps") | G-Eval, DAG (deterministic decision-tree judging), Hallucination, Bias, Toxicity, agent/trajectory metrics. |
| **Ragas** | Apache-2.0 Python metrics | RAG-specific: Faithfulness, Answer Relevancy, Context Precision/Recall, Groundedness. |
| **OpenAI Evals** | Evals API + dashboard | **Deprecating:** read-only Oct 31 2026, shutdown Nov 30 2026. Use Datasets for new work. |
| **Arize Phoenix** | Open-source (Elastic License 2.0) | Built-in evaluators (`FaithfulnessEvaluator`, `CorrectnessEvaluator`, `ToolSelectionEvaluator`) + `ClassificationEvaluator`. |

> **Material change (verified March–Sept 2026):** OpenAI announced an agreement to acquire **promptfoo** on **March 9, 2026**; both parties publicly stated the open-source project **continues to be maintained**. Re-check before betting a long-lived pipeline on it.

> **Vendor claim:** DeepEval calls its metrics "research-backed" and cites "20 million+ daily evaluations" — the metric *definitions* are useful; the popularity figure is marketing. Ragas' repo moved to `vibrantlabsai/ragas`. Langfuse is MIT *except* `ee/`; Phoenix is Elastic 2.0 — free to self-host, but it restricts offering the software as a managed service.

```text
CI gate (fast)                   → promptfoo or DeepEval in GitHub Actions
Dataset + dashboard (long-lived) → Langfuse (self-host) or Braintrust (managed)
RAG metrics                      → Ragas (pulled into the above)
Tracing backbone                 → OpenTelemetry; the platforms ingest it
```

Pick **one** CI tool and **one** dashboard tool. Running five tools is its own regression.
---

## Part 7 — RAG and Agent Metrics

RAG fails three distinguishable ways. Measure each separately or you'll fix the wrong thing:

| Question | Metric | Plain English |
|---|---|---|
| Did we fetch the right stuff? | Context Precision / Recall | Relevant chunks retrieved and ranked high? |
| Did the answer stick to it? | Faithfulness / Groundedness | Is every claim supported by retrieved context? |
| Did it answer the question? | Answer / Response Relevancy | Addresses the question without padding? |

Add **Faithfulness** first — the anti-hallucination metric. Ragas computes it as *supported claims ÷ total claims*; "Einstein was born in Germany" (supported) + "on 20th March 1879" (not) scores 0.5.

> **Distinction:** DeepEval's `HallucinationMetric` compares output against **`context`** (curated ground truth) and measures the *generator*. Ragas' `Faithfulness` compares against **retrieved context** and measures the *runtime pipeline*.

**Agents: evaluate the trajectory.** Evaluate four dimensions — **trajectory**, **tool use**, **task completion**, **multi-turn quality** — starting with one metric per dimension. Step counts, tool selection, and argument validation are **free code checks**; only task completion and conversational resolution need a judge.

> **Verified (Langfuse, Sept 2026):** since **July 2026** agent evaluators can read recorded tool calls through a structured field, so trajectory checks like "did the agent call search before answering" are **decidable in code** rather than requiring a judge.

**Key insight:** an agent that called the wrong tool but got lucky scores well on an answer-only judge. Only a trajectory check catches that.

---

## Part 8 — CI Gating and the Worked Example

**Step 8.1 — Gate the build.** Run the suite on every PR touching prompts, evals, or LLM code. Fail when the aggregate drops below baseline minus tolerance (verify the tool exits non-zero: `npx promptfoo@latest eval; echo "exit=$?"`); fail on structural-validity violations even if the aggregate is fine; post the diff in the PR — "regressed on 2 cases, both tagged `topic=risks`" makes a gate useful.

**Step 8.2 — Control CI cost.** Pre-screen with free code checks; run a **short subset on PRs** and the **full suite nightly**; use a cheaper judge in CI and the strongest judge weekly.

**Step 8.3 — Group by metadata.** An overall 0.85 can hide a 0.40 on a segment that matters. Break down by `topic`, `tier`, `intent`, `language`: "If you only ever look at aggregate scores, you will miss the most actionable signal in your evaluations."

**Step 8.4 — Worked example: competitive-audit report generator.** Input `{company, url, your_product}`; output is HTML with four `data-section` elements (`summary`, `pricing`, `features`, `risks`) and a numeric competitive score in `[0, 100]` inside `[data-score]`.

```yaml
# evals/promptfooconfig.yaml
description: Competitive audit report generator — regression suite
prompts:
  - file://prompts/audit-report.txt            # production prompt
  - file://prompts/audit-report.candidate.txt  # change under test
providers:
  - { id: openai:gpt-5, label: prod-model }
  - { id: openai:gpt-5-mini, label: cheaper-candidate }

defaultTest:
  options:
    provider: { id: openai:gpt-5-mini, config: { temperature: 0 } }
  assert:
    # FREE PRE-SCREEN — every case, no judge call
    - { type: is-html, metric: structure }
    - { type: contains-html, value: 'data-section="summary"',  metric: structure }
    - { type: contains-html, value: 'data-section="pricing"',  metric: structure }
    - { type: contains-html, value: 'data-section="features"', metric: structure }
    - { type: contains-html, value: 'data-section="risks"',    metric: structure }
    - { type: javascript, metric: numeric_range,
        value: "const m=output.match(/data-score=\"([0-9.]+)\"/); return m && +m[1]>=0 && +m[1]<=100 ? 1 : 0;" }
    - { type: latency, threshold: 45000, metric: performance }

tests:
  - description: Enterprise prospect, pricing-heavy comparison
    vars: { company: Acme Corp, url: "https://acme.example", your_product: WidgetPro }
    metadata: { topic: pricing, tier: enterprise, source: manual }
    assert:
      # JUDGE — only reached because the screen passed
      - type: llm-rubric
        metric: quality
        threshold: 0.75
        value: |
          Grade a competitive-audit report for a B2B SaaS sales team.
          Grade ONLY the criterion below. Do not reward length or confident tone.
          Criterion: GROUNDED ACTIONABILITY — every comparative claim must trace
          to the fetched competitor data, and the report must end with at least
          two concrete next actions.
          Score 1.0 — all claims traceable AND 2+ concrete actions
          Score 0.75 — claims traceable but actions are generic
          Score 0.5 — a comparative claim lacks support in the source data
          Score 0.0 — sections present but empty, or facts fabricated
          Respond with JSON only: {"reason": "<2 sentences>", "score": <number>, "pass": <boolean>}
```
**Why it's shaped this way:** two prompts × two models gives a cheap 2×2 comparison; `threshold: 0.75` prevents the documented footgun where a judge returning `{pass: true, score: 0}` passes; metadata enables segment analysis; the rubric anchors every number and forbids rewarding length. Add a **sparse-data guard** case with a rubric that demands the report state the limitation rather than fabricate — your highest-risk failure mode.

```bash
npx promptfoo@latest eval -c evals/promptfooconfig.yaml   # baseline
git checkout -b try-new-prompt                            # one change
npx promptfoo@latest eval -c evals/promptfooconfig.yaml
npx promptfoo@latest view                                 # per-case diffs
```

Check three things before shipping: targeted cases improved, previously-passing cases didn't regress, and changed scores reflect real output differences. If scores moved but outputs are identical, your scorer moved.

**Step 8.5 — Cost ballpark (vendor figure, Sept 2026):** 10 cases × 2 prompts × 2 models = 40 generations; judges run only on cases clearing the pre-screen (~34 calls); at $0.01–$0.10 per assessment, roughly **$0.34–$3.40 per full CI run**, plus generation cost.

---

## Command & Config Cheat Sheet

| Command | What it does |
|---|---|
| `npx promptfoo@latest eval` | Run the suite in `promptfooconfig.yaml` |
| `npx promptfoo@latest eval -c path` | Run a specific config |
| `npx promptfoo@latest eval --grader openai:gpt-5-mini` | Override the judge model |
| `npx promptfoo@latest view` | Open results in the web viewer |
| `npx promptfoo@latest redteam setup` / `run` / `report` | Red-teaming: configure, run, report |
| `bt eval --first N` / `--sample N` | Braintrust: quick check on first / random N cases |
| `bt functions push scorer.py` | Braintrust: share a scorer team-wide |

| Need | Deterministic | Model-graded |
|---|---|---|
| Valid structure | `is-json`, `is-html`, `is-sql`, JSON Schema | — |
| Required content | `contains`, `contains-all`, `regex` | `llm-rubric` |
| Numeric range | custom JS/Python | — |
| Groundedness | — | `context-faithfulness`, Ragas Faithfulness |
| Relevance | — | `answer-relevance`, `context-relevance` |
| Tone / style | — | `llm-rubric`, `g-eval` |
| Cost / latency | `cost`, `latency` | — |
| Tool use (agents) | `trajectory:tool-used`, `trajectory:tool-sequence` | `trajectory:goal-success` |

Key config fields: `threshold` (minimum score to pass — essential for `llm-rubric`), `weight`, `metric`, `provider` (judge override), `metadata` (segment by `topic`/`tier`), `defaultTest`, `repeat` (trials for variance).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Judge scores swing every run | Non-determinism; temperature > 0; ambiguous rubric | Pin `temperature: 0`, tighten the rubric, compare trial averages |
| Verbose wrong answers outscore short correct ones | Verbosity bias | Penalize length in the rubric; test short-correct vs verbose-wrong |
| Judge agrees 90% but misses everything | Class imbalance — "pass" always agrees on a rare failure | Measure TPR and TNR separately; put real failures in the dataset |
| Aggregate fine, users complain | Aggregate hides a bad segment | Group by `metadata.topic`/`tier`; sort by regressions |
| Scores improved, outputs identical | The scorer moved, not the app | Fix/validate the scorer before trusting the run |
| Everything passes but the product is broken | Dataset only has easy cases | Pull real production failures in; add adversarial cases |
| CI costs more than expected | Judges running on everything | Add the code pre-screen; lower judge sampling; cheaper judge |
| Comparisons seem meaningless | Stale baseline, or the judge/model changed | Re-run a fresh baseline; record judge + model + dataset hash |
| `llm-rubric` passes with `score: 0` | `pass` defaults to true and no threshold set | Set `threshold`, or require explicit `pass` |
| RAG faithfulness low but the answer looks right | Retrieval returned noise; the model improvised | Check Context Precision/Recall separately — fix the retriever |
| Agent answers well but made bad tool calls | Only the final answer was scored | Add deterministic trajectory/tool checks |

---

## Video Library

Not invented URLs — YouTube search links, always valid. Click and pick the current best result.

| Search link | What to search for, and why |
|---|---|
| [LLM evals explained](https://www.youtube.com/results?search_query=LLM+evals+explained) | Conceptual intro; watch how "no single correct answer" is framed. |
| [LLM as a judge bias](https://www.youtube.com/results?search_query=LLM+as+a+judge+bias) | Verbosity bias and self-preference discussed concretely. |
| [promptfoo tutorial](https://www.youtube.com/results?search_query=promptfoo+tutorial) | YAML, assertions, `llm-rubric`, CI built end to end. |
| [Braintrust evals tutorial](https://www.youtube.com/results?search_query=Braintrust+evals+tutorial) | Managed workflow: datasets, scorers, experiments, online scoring. |
| [Langfuse evaluation tutorial](https://www.youtube.com/results?search_query=Langfuse+evaluation+tutorial) | Open-source tracing + judges; traces flowing into datasets and scores. |
| [RAGAS metrics tutorial](https://www.youtube.com/results?search_query=RAGAS+metrics+tutorial) | Faithfulness, answer relevancy, context precision/recall. |
| [DeepEval pytest tutorial](https://www.youtube.com/results?search_query=DeepEval+tutorial+pytest) | Pytest-style LLM testing for Python-centric workflows. |
| [Arize Phoenix evals tutorial](https://www.youtube.com/results?search_query=Arize+Phoenix+evals+tutorial) | Phoenix evals on traced data; scores logged to spans. |
| [AI agent evaluation trajectory](https://www.youtube.com/results?search_query=AI+agent+evaluation+trajectory) | Trajectory, tool use, and task completion for agents. |
| [LLM regression testing CI](https://www.youtube.com/results?search_query=LLM+regression+testing+CI) | Exit-code gating and handling flaky judge scores. |

---

## Written References & Repos

Official docs and repos only. Where I'm unsure of a URL, I say so rather than guessing.

| Source | URL |
|---|---|
| Langfuse evals guide | `https://langfuse.com/blog/2025-11-12-evals` |
| Langfuse LLM-as-a-judge docs | `https://langfuse.com/docs/evaluation/evaluation-methods/llm-as-a-judge` |
| Braintrust evaluation best practices | `https://braintrust.dev/docs/evaluate/best-practices` |
| Braintrust scorers guide | `https://www.braintrust.dev/docs/best-practices/scorers` |
| promptfoo | `https://promptfoo.dev` |
| promptfoo assertions reference | `https://www.promptfoo.dev/docs/configuration/expected-outputs/` |
| promptfoo `llm-rubric` | `https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/` |
| OpenAI Evals guide | `https://platform.openai.com/docs/guides/evals` |
| DeepEval docs | `https://deepeval.com/docs/metrics-introduction` |
| DeepEval repo | `https://github.com/confident-ai/deepeval` |
| Ragas docs | `https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/` |
| Ragas repo | `https://github.com/vibrantlabsai/ragas` |
| Arize Phoenix docs | `https://arize.com/docs/phoenix/evaluation/llm-evals` |
| Arize Phoenix custom evaluators | `https://arize.com/docs/phoenix/evaluation/how-to-evals/custom-llm-evaluators` |
| Arize Phoenix repo | `https://github.com/Arize-ai/phoenix` |

Langfuse for calibration/sampling/cost, Braintrust for dataset and baseline discipline, promptfoo for YAML assertions and `llm-rubric` semantics, Ragas for RAG metric definitions, Phoenix for categorical-vs-numeric judge research. Verified Sept 2026.

> **Verification tip:** if a link 404s, search: `<product name> official docs` and navigate from the vendor's own domain — never trust a mirror or an AI-generated link.
---

## Glossary

| Term | Plain-English definition |
|---|---|
| Eval | A scored test of LLM output against criteria you define, on a fixed input set |
| Golden set / dataset | A versioned collection of test inputs with optional expected outputs and metadata |
| Baseline | Recorded scores of the current production version, the comparison point |
| Regression | A score that dropped relative to baseline |
| Deterministic scorer | A code check that always returns the same verdict for the same input |
| LLM-as-judge | A model that scores another model's output against a rubric |
| Calibration | Measuring how often your judge agrees with human labels, and fixing it until stable |
| TPR / TNR | True positive / true negative rate — the right metrics when failures are rare |
| Judge bias | Systematic distortion, e.g. favoring longer, more formal, or self-family outputs |
| Offline / online eval | Dataset run before shipping vs. scoring sampled live production traffic |
| Trace | The recorded execution: inputs, context, tool calls, output, timing, cost |
| Guardrail | A runtime allow/block/redact policy, distinct from measurement |
| Pre-screen | Free code checks that run before a judge, filtering what reaches it |
| Faithfulness | Fraction of an answer's claims supported by the provided context |
| Trajectory | The ordered sequence of steps an agent took |
---

## FAQ & Next Steps

**Do I need a managed platform?** No. Start with a JSONL file and one script. Add a platform when more than one person reviews results or you exceed ~50 cases.

**How many cases is enough?** 5–10 to start, 30–100 once you're pulling real production failures. Add cases only when a failure mode appears.

**Can I use one big judge instead of many scorers?** No. Single-aspect scorers are more reliable and more debuggable.

**Do evals replace my deterministic tests?** Never. Keep unit and integration tests; evals cover what isn't decidable.

**My judge disagrees with me. Is it wrong?** Maybe you are. Calibration cuts both ways — a disagreement sometimes reveals that *your* labels are inconsistent.

**First thing to build?** A 5-case dataset and three deterministic checks. Today.

### Next steps, in order

1. **Today:** create `evals/datasets/*.jsonl` with 5 real cases and metadata.
2. **This week:** write 3–5 deterministic scorers for structural requirements.
3. **Next week:** add one calibrated judge with anchored scoring and a threshold.
4. **Week 3:** run a baseline, then one isolated change, and compare per segment.
5. **Week 4:** wire the suite into CI on a fresh baseline.
6. **Month 2:** add tracing, sample 5% of production, feed failures back into the dataset.
---

## Verification Note

**Verified as of September 2026 from primary sources:**

- Braintrust best practices — small datasets, dataset-from-failures, scorer validation, explicit verbosity-bias testing, baseline currency, one-change-per-experiment, trials for nondeterminism, segment-by-metadata (`braintrust.dev/docs`).
- Langfuse evals guidance — the code-vs-judge-vs-human table, the pre-screen pattern, the $0.01–$0.10 per-assessment ballpark, 80–90% judge-vs-human agreement, the 10%-failure-class warning, 5–10% production sampling, observation-level judges recommended (trace-level legacy as of July 2026), trajectory tool calls decidable in code since July 2026.
- promptfoo's assertion catalog, `llm-rubric` behavior (JSON verdict, threshold semantics, pass-defaults-to-true footgun, grader override), config/CLI reference, and red-team commands (`promptfoo.dev/docs`).
- promptfoo's acquisition by OpenAI **announced March 9, 2026**; both parties stated the open-source project continues.
- Licenses: Langfuse MIT except `ee/`; Ragas Apache-2.0 (repo now `vibrantlabsai/ragas`); Phoenix Elastic 2.0.

**Changes fast:** pricing and cost ballparks (check the pricing page, never a blog); the default judge model; license boundaries; OpenAI Evals deprecation dates (read-only Oct 31 2026, shutdown Nov 30 2026); CLI flag spellings (verify with `--help`); promptfoo's ownership.

**Vendor claims, not independently verified:** DeepEval's "20 million+ daily evaluations"; Arize's preference for categorical over numeric scales; adoption figures attributed to promptfoo. Test *definitions* are reliable; *marketing numbers* are marketing.

**Nothing here is legal advice.** If you self-host Langfuse or Phoenix commercially, read the actual LICENSE files.

---

## Bonus — Handoff Prompt

Copy this into any AI agent to extend this paper into a deeper, product-specific guide.

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js + Postgres SaaS, uses AI coding agents daily, and is
teaching himself AI engineering. He learns by doing.

Paper: markdown_docs/01-ai-evals-regression-testing.md
Topic: AI Evals & Regression Testing for LLM Apps — "How do you know it got worse?"

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Command & Config Cheat Sheet → Troubleshooting → Video Library
(YouTube SEARCH links only) → Written References & Repos (official docs only) → Glossary →
FAQ & Next Steps → Verification Note → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every
fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example and a second
tool's config; (B) add a Part on a topic he names (streaming chat evals, retrieval evaluation,
annotation workflows, multi-turn evals, judge-fleet cost engineering); (C) port the worked
example to his real product — read his repo, find the real LLM feature, and replace the
fictional competitive-audit example with his real inputs and a runnable config.

Rules: never invent URLs, repos, CLI flags, package names, numbers, or prices — if unsure write
"search: <name> official docs." Date every pricing claim; label marketing as vendor claims. Use
blockquote callouts for cost and "this changes fast." No OWASP material. Keep the structure.
Report path, one-line summary, and word count.

Anchors (verified Sept 2026) — reuse and re-verify:
https://langfuse.com/blog/2025-11-12-evals
https://braintrust.dev/docs/evaluate/best-practices
https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/
https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
https://arize.com/docs/phoenix/evaluation/llm-evals
```
