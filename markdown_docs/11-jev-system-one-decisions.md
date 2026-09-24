# The Complete Guide: Jev & System One Decisions

> Stop asking an LLM for JSON and hoping. Send typed questions, get calibrated answers, and let your code make the call — in about a tenth of a second, for a fraction of a cent.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

Every AI feature you have shipped so far has one shape: you write a prompt, you get a paragraph back, and then you write parsing code to turn the paragraph into something your program can actually branch on. That parsing layer is where the bugs live — the model wraps JSON in markdown fences, invents a field, returns "N/A", or answers a *slightly different question* than you asked.

Jev is a different contract entirely. It is not a chat model. It is a **decision model**. You give it a *state* (some text or JSON) and a set of *typed questions*, and it returns typed answers with probabilities. No prose. No parsing. Nothing to validate against a schema, because the schema is the answer space you defined.

```
   USER MESSAGE / TICKET / CRAWLER OUTPUT / AGENT TRACE
                     │
                     ▼
   ┌────────────────────────────────────────────────────────┐
   │  YOUR APP  —  deterministic code owns the control flow │
   │  build a small `state` (only what the question needs)  │
   └───────────────────────┬────────────────────────────────┘
                           │  ONE HTTPS POST
                           ▼
   ┌────────────────────────────────────────────────────────┐
   │  POST https://api.typesafe.ai/v1/systemone             │
   │                                                        │
   │   state: "..."                                         │
   │   questions: {                                         │
   │     department:  Choice  → one option from a set       │
   │     frustration: Score   → a level on a rubric         │
   │     is_urgent:   Noul    → probability the answer is   │
   │                            yes (0.0 → 1.0)             │
   │   }                                                    │
   │                                                        │
   │   every question evaluated IN PARALLEL against state   │
   └───────────────────────┬────────────────────────────────┘
                           │  answers + probabilities + confidence
                           ▼
   ┌────────────────────────────────────────────────────────┐
   │  answers.department.choice      = "technical"          │
   │  answers.department.confidence  = 0.78                 │
   │  answers.frustration.score      = 1.0                  │
   │  answers.is_urgent.noul         = 0.94                 │
   └───────────────────────┬────────────────────────────────┘
                           ▼
        branch / route / queue / block / escalate / ask a human
        — with thresholds YOU wrote, in ordinary `if` statements
```

The single most important idea in this paper: **Jev supplies the judgment; your code supplies the decision.** Jev tells you what it thinks and how sure it is. It never takes an action, never calls a tool, never writes text. That constraint is the feature — it is what makes it safe to put in a hot request path.

The natural comparison is three ways to make the same call:

| | Rules-based code | Generative LLM | Jev (System One) |
|---|---|---|---|
| Output | Deterministic value | Text, which you then parse | Typed value + probability + confidence |
| Good at | Anything you can specify exactly | Writing, summarizing, reasoning | Repeated bounded judgments |
| Unknown input | Falls through the cracks | Usually copes, sometimes hallucinates | Returns a probability, admits uncertainty |
| Failure mode | Silently wrong bucket | Confident, well-formatted nonsense | Low confidence you can gate on |
| Speed | Microseconds | Seconds | 70–500 ms (vendor figure) |
| Cost | Free | Per output token | Per **input** token; output tokens free |

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **State** | The briefing folder handed to an expert before they answer | Everything the questions read. Include only what's relevant — extra context *lowers* accuracy |
| **Choice** | A multiple-choice question | Returns `choice`, the full `probabilities` map, and `confidence` |
| **Score** | "Rate this on a 1–5 scale" with written descriptions of each point | Returns `score` (can land between levels), `probabilities`, `confidence`, and `legend` |
| **Noul** | A yes/no question | Returns one number 0→1: the probability of "yes". No separate confidence |
| **Probability** | The model's bet | Use it to rank, or to threshold |
| **Confidence** | How peaked the distribution is | High = act. Middle = confirm. Low = escalate to a human |
| **System One** | Kahneman's fast, intuitive System 1 | Fast snap judgments, not slow deliberation |
| **RLCD** | The training method, "Reinforcement Learning for Calibrated Decisions" | Why the probabilities are supposed to mean something |
| **Speculative fan-out** | Ask every question you *might* need, ignore the ones you don't | One round trip instead of many |

> **The one-sentence version:** Jev is a frontier-intelligence *function call* — unstructured state in, typed probabilistic decisions out. If you have ever written `JSON.parse(response.choices[0].message.content)`, Jev exists to delete that line.

---

## The 60-Second Version (TL;DR)

1. **Jev is not a chatbot and not a coding model.** It does not write text or call tools. It answers typed questions about a state. Do not try to swap it in behind your coding agent.
2. **Three primitives cover almost everything:** `Choice` (which of these?), `Score` (how much on this scale?), `Noul` (is this true?). Mix them freely in one request.
3. **One request, many questions.** Questions run in parallel; adding them barely changes latency. Ask speculative questions and let your code ignore the irrelevant ones.
4. **Keep questions atomic.** "Is this refund request valid?" hides three judgments. Ask "Did they request a refund?", "Is there a duplicate charge?", "Does the policy cover it?" and combine in code.
5. **Confidence is a second decision axis.** Above your threshold, act. Below it, escalate to a human or a stronger model. Thresholds differ by the cost of being wrong.
6. **Install in one of four ways:** the Playground (no code), raw HTTP/cURL, the Python SDK (`pip install typesafe-sdk`), or the TypeScript SDK (`npm install @typesafe-ai/sdk`). There is also an agent skill for your coding agent.
7. **Real endpoint is `https://api.typesafe.ai/v1/systemone`.** Model name `jev-latest`. Price is **$42 per billion input tokens**; output tokens are free.
8. **Jev does not count, do math, compare dates, or generate.** Do those in code. It reads literally, so say exactly what you mean.
9. **Put your questions and thresholds in one file** so a human can review the policy without spelunking through your app.
10. **Start with one low-stakes decision.** A classification. Measure it against twenty labeled examples. Then expand.

If you read nothing else, read **Part 2 (the primitives)** and **Part 5 (confidence)**. Those two are where the value is.

---

## Prerequisites

- A TypeSafe account. Sign in at `https://console.typesafe.ai/` with the same account you use for the docs.
- An API key from `https://console.typesafe.ai/keys`, exported as `TYPESAFE_API_KEY`. **Server-side only.** Never in browser code, never in a repo.
- **Python 3.10+** if you take the Python path (`python3 --version`).
- **Node.js 20+** if you take the TypeScript path (`node --version`).
- `curl` for the smoke test (preinstalled on macOS).
- Some text to judge. Jev is text-only: strings, JSON objects, or arrays of text. **Images, audio, and video are not accepted** — pre-process them into text first.

> **Cost reality:** you pay per *input* token at $42 per billion ($0.042 per million). A support ticket plus six questions is roughly 500 tokens, so about **$0.00002 per decision**. Output tokens are free. This is cheap enough that the bottleneck is your design, not your bill.

---

## Part 1 — What Jev Is (and Is Not)

### 1.1 It is a decision layer, not a model you chat with

Jev is TypeSafe AI's first **System One model**. TypeSafe's bet is that most AI in production will be machine-to-machine: code asking a model for a narrow judgment many times a second. So Jev optimizes for a software interface rather than a conversation.

Concretely:

- **It does not generate text.** Not even explanations of its reasoning. If you want a rationale, you ask a follow-up `Noul` ("Does the answer depend on the refund policy?"), not "why?".
- **It cannot return a value outside the schema you supplied.** Every answer is a distribution over *your* options or *your* levels. There is no field for it to hallucinate into.
- **It is stateless.** Every request stands alone. There is no session, no memory, no system prompt to preserve.
- **It always exposes uncertainty.** Choice and Score answers carry `confidence`; Noul answers are a probability to begin with.

TypeSafe trains Jev with **RLCD** — Reinforcement Learning for Calibrated Decisions — instead of RLHF. RLHF optimizes for what humans *prefer to read*, which is how you get sycophancy and confident-sounding nonsense. RLCD optimizes for probabilities that track outcomes: things the model assigns 0.8 to should be right about 80% of the time across many predictions. That calibration is what lets you write `if confidence < 0.5: escalate()` and have it mean something.

### 1.2 It is not a drop-in replacement for your coding agent's model

This trips people up, so the TypeSafe docs have a dedicated page for it. Jev has no `model: "jev-latest"` setting for Claude Code, Cursor, or opencode. Those tools need a model that streams text, edits files, and calls tools. Jev does none of that.

What you *do* with Jev is write code — using your normal coding agent — that calls Jev for the decisions inside your product. The two systems solve different problems and coexist.

> **Corollary:** if a tutorial tells you to point your coding agent at Jev, close the tab.

### 1.3 The three architectures, and which one Jev is for

| Approach | Who owns the control flow | Failure mode |
|---|---|---|
| Traditional software | Code | Breaks on inputs nobody specified |
| LLM agent | The model, in a loop | Goes off the rails; needs a human nearby |
| **AI-powered software (Jev)** | **Code** | A single judgment is wrong, and can be retried or gated |

Jev is the third row. You keep the workflow in code — a pipeline, a route handler, a job — and you drop in a decision wherever a rule would be too brittle and a paragraph would be too vague.

---

## Part 2 — The Three Primitives, Precisely

Everything in Jev is one of three question types. Pick by the *shape* of the answer you need, not by topic.

| Primitive | The question it answers | Answer fields |
|---|---|---|
| **Choice** | Which one of these options? | `choice`, `probabilities`, `confidence` |
| **Score** | Where on this ordered scale? | `score`, `legend`, `probabilities`, `confidence` |
| **Noul** | Is this statement true? | `noul` (0 → 1) |

### 2.1 Choice — pick one option from a set

Use it when the answer is a member of a fixed list with no order between the members: which team, which category, which language, which model.

```json
{
  "state": "My running shoes arrived in the wrong size. Can I swap them for a size 10?",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "returns": "Exchanges, wrong or damaged items",
        "shipping": "Delivery status, delays, lost packages",
        "billing": "Charges, invoices, payment problems"
      }
    }
  }
}
```

The response gives you the winner *and* the whole distribution:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "returns",
      "confidence": 1.0,
      "probabilities": { "shipping": 0.0, "returns": 1.0, "billing": 0.0 }
    }
  },
  "usage": { "input_tokens": 328, "output_tokens": 34 }
}
```

Two practical notes:

- **A Choice can hold up to 255 options.** Give the model the whole taxonomy, not a shortlist. Descriptions cost a few tokens each; guessing wrong costs a re-run.
- **Always offer an out.** Add `other` or `none of the above` when the set might not cover every input, otherwise you force a bad match.

When two options keep getting confused, upgrade their descriptions from strings to structured objects with `what`, `not_for`, and `examples`:

```json
"criteria": {
  "return_policy": {
    "what": "Whether and how an item can be returned",
    "not_for": "Progress of a return already sent",
    "examples": ["Can I return shoes I've worn once?", "How long do I have to return an order?"]
  },
  "return_status": {
    "what": "Progress of a return already sent",
    "not_for": "Whether and how an item can be returned",
    "examples": ["Has my return arrived yet?", "When will my refund be paid?"]
  }
}
```

### 2.2 Score — a position on a rubric

Use it when the answer is a point on a spectrum you can describe in words: bug severity, customer frustration, lead quality, report completeness.

```json
{
  "state": "The export button crashes the settings page in Safari. It works in Chrome, but a few of our customers only use Safari.",
  "model": "jev-latest",
  "questions": {
    "bug_severity": {
      "type": "score",
      "instructions": "How severe is the reported issue?",
      "criteria": [
        "Cosmetic; no impact to functionality",
        "Broken or degraded feature, but workaround exists",
        "Blocking issue; no workaround exists"
      ]
    }
  }
}
```

Response:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "bug_severity": {
      "type": "score",
      "score": 1.43,
      "confidence": 0.35,
      "legend": {
        "0": "Cosmetic; no impact to functionality",
        "1": "Broken or degraded feature, but workaround exists",
        "2": "Blocking issue; no workaround exists"
      },
      "probabilities": { "0": 0.0, "1": 0.57, "2": 0.43 }
    }
  },
  "usage": { "input_tokens": 332, "output_tokens": 18 }
}
```

Read `score` as `0 × p0 + 1 × p1 + 2 × p2 = 1.43`. It can land **between** levels. A Score takes 2 to 10 levels.

Three rules that decide whether a Score is useful:

1. **Describe situations, not degrees.** "Broken feature, but a workaround exists" gives the model something to match. "Moderately severe" gives it nothing. If your levels are just "0, 1, 2", the model splits probability and confidence collapses.
2. **One dimension per Score.** "Punctual and smart and experienced" measures three things at once. Split it, then combine with weights in code (that is the *composite scoring* pattern).
3. **Give the extreme case its own level.** Sentiment scales that end at "very angry" should add "abusive or threatening", otherwise both messages score near the top.

### 2.3 Noul — one yes/no judgment

Use it when the answer is binary and the probability *is* the useful signal. A Noul returns a single number: the probability the answer is yes.

```json
{
  "state": "I have asked three times now. Can I please just talk to a real person?",
  "model": "jev-latest",
  "questions": {
    "is_human_escalation": {
      "type": "noul",
      "instructions": "Is the customer asking for a human agent?"
    },
    "is_repeat_contact": {
      "type": "noul",
      "instructions": "Has the customer contacted support about this before?",
      "criteria": {
        "true": "Mentions a prior attempt, ticket, or that they have asked before",
        "false": "No sign of any previous contact"
      }
    }
  }
}
```

Response:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "is_human_escalation": { "type": "noul", "noul": 0.99 },
    "is_repeat_contact":    { "type": "noul", "noul": 0.93 }
  },
  "usage": { "input_tokens": 360, "output_tokens": 39 }
}
```

Rules of thumb:

- **One condition per Noul.** "Is the customer angry *and* asking for a refund?" is two questions. Ask two, combine in code.
- **Phrase it so a high value means yes.** "Is the message free of personal data?" inverts the meaning and future-you will read it backwards.
- **A Noul is not a scale.** A value of 0.5 means "genuinely unsure", *not* "medium skill". If you want degree, use a Score.
- **Threshold in code.** `noul > 0.8` acts; `0.2 < noul < 0.8` goes to a human. The threshold depends on which error is more expensive.

### 2.4 Asking several at once (the thing that makes Jev cheap)

Every question in one request sees the same state, is evaluated independently, and comes back in parallel. Adding questions barely changes latency. The documented result, from the *Parallel questions* cookbook: 13 questions in one call versus 13 single-question calls over the same GDPR article came out **12.2× cheaper and 10.0× faster with identical answers**.

So the default should be: **one request, all the questions.** That includes questions that only matter on some branches. If the ticket turns out to be a feature request, just ignore the `bug_severity` answer.

> **The one exception:** a genuinely dependent question. If the next question's *options* come from the previous answer (walking a hierarchy), or you need to fetch more data for the state, make a second request. Otherwise batch.

---

## Part 3 — Install: Four Paths from Zero to First Decision

Pick one. You can switch later; the HTTP shape is the same underneath all of them.

### 3.0 Path zero — the Playground (no install, 60 seconds)

1. Open `https://console.typesafe.ai/playground` and sign in.
2. Paste any text as the state.
3. Add a Noul question, e.g. *"Does this message express urgency?"*.
4. Add more questions — mix Noul, Choice, and Score — and watch them all answer at once.

Do this first. It costs nothing and it calibrates your intuition about what Jev is good at before you write a line of code.

### 3.1 Path one — raw HTTP with cURL

```bash
export TYPESAFE_API_KEY="ts_..."   # from https://console.typesafe.ai/keys

curl -X POST https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
  {
    "state": "Hi, I've been trying to connect my Stripe account for 3 days and the integration keeps failing. I'm losing sales. Please help ASAP.",
    "model": "jev-latest",
    "questions": {
      "urgency": {
        "type": "noul",
        "instructions": "Does this message express urgency?"
      },
      "department": {
        "type": "choice",
        "instructions": "Which team should handle this",
        "criteria": {
          "billing": "Payment or subscription issues",
          "technical": "Bugs or integration problems",
          "sales": "Pricing or account questions"
        }
      },
      "frustration": {
        "type": "score",
        "instructions": "How frustrated the customer appears",
        "criteria": ["Calm, just stating facts", "Frustrated but civil", "Very angry, strong language"]
      }
    }
  }
EOF
```

You should get back `answers` for all three, with probabilities. To list what your key can call:

```bash
curl https://api.typesafe.ai/v1/models \
  -H "Authorization: Bearer $TYPESAFE_API_KEY"
```

### 3.2 Path two — Python SDK

Requires Python 3.10+. The SDK reads `TYPESAFE_API_KEY` from the environment and defaults to `jev-latest`.

```bash
# with uv (recommended if you use it)
uv add typesafe-sdk

# or with pip
pip install typesafe-sdk
```

```python
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

client = TypeSafeClient()   # reads TYPESAFE_API_KEY

ticket = (
    "Hi, I've been trying to connect my Stripe account for 3 days and the "
    "integration keeps failing. I'm losing sales. Please help ASAP."
)

response = client.system_one(
    state=ticket,
    questions={
        "department": Choice(
            instructions="Which team should handle this",
            criteria={
                "billing": "Payment or subscription issues",
                "technical": "Bugs or integration problems",
                "sales": "Pricing or account questions",
            },
        ),
        "frustration": Score(
            instructions="How frustrated the customer appears",
            criteria=[
                "Calm, just stating facts",
                "Frustrated but civil",
                "Very angry, strong language",
            ],
        ),
        "is_urgent": Noul(
            instructions="The message conveys urgency or time-sensitivity",
        ),
    },
)

print(response.answers["department"].choice)     # "technical"
print(response.answers["frustration"].score)     # 1.0
print(response.answers["is_urgent"].noul)        # 1.0

# Convenience views by type also exist:
print(response.choices["department"].choice)
print(response.scores["frustration"].score)
print(response.nouls["is_urgent"].noul)
```

Use it as a context manager (`with TypeSafeClient() as client:`) or call `close()` when done. For async, use `AsyncTypeSafeClient` and `await client.system_one(...)`.

A few SDK details worth knowing:

- **Model selection:** `TypeSafeClient(model="jev-latest")` or `model="jev-1.13.0"`. Pin the versioned ID if you have tuned thresholds against it — the alias moves when a new release ships, and the answers can move with it.
- **Typed responses:** pass `response_model=` to get a Pydantic model instead of the generic `answers` map. Good for type-checkers.
- **Retries:** `RetryPolicy(max_retries=..., backoff_max=..., timeout=...)`, on the client or per call. Invalid API keys raise at client construction, before any request.
- **Logging:** set `TYPESAFE_LOG_LEVEL=debug`; secret headers are redacted, but **request and response bodies are not** — mind your logs.
- **Env vars:** `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL`, `TYPESAFE_DEFAULT_MODEL`, `TYPESAFE_LOG_LEVEL`.

### 3.3 Path three — TypeScript / JavaScript SDK

Requires Node.js 20+.

```bash
npm install @typesafe-ai/sdk
```

```ts
import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient(); // reads TYPESAFE_API_KEY

const response = await client.systemOne({
  state: { document: "I was charged twice. Please fix this ASAP." },
  questions: {
    category: choice("What is this ticket about?", {
      billing: "Payment, invoice, or refund issues",
      technical: "Bugs or integration problems",
      other: null,
    }),
    refund: noul("Is the customer asking for money back?"),
    urgency: score("How urgent is this?", ["can wait", "this week", "today"]),
  },
});

console.log(response.answers.category.choice);
console.log(response.answers.category.confidence);
console.log(response.answers.category.probabilities);
console.log(response.answers.refund.noul);
```

Answer types are inferred from the questions, and the package ships ESM, CommonJS, and TypeScript declarations.

### 3.4 Path four — let your coding agent do it (the agent skill)

Install the TypeSafe skill so your coding agent knows the API shape, the primitives, and the patterns before it writes the integration.

**Claude Code:**

```bash
claude plugin marketplace add typesafe-ai/skills
claude plugin install typesafe@typesafe-ai
```

**Other agents (Codex, opencode, Cursor, …):**

```bash
npx skills add typesafe-ai/skills --skill typesafe-ai
```

Then, in the project, prompt something like:

```text
Using the TypeSafe skill, explore this project and find places where a fragile
prompt or a pile of parsing could be replaced by a typed Jev decision.
Propose the questions and thresholds before changing code.
```

Two rules from the docs that are worth adopting as your own:

1. **Put the questions and thresholds in one file.** It is the only part a human needs to review.
2. **Don't take the agent's assertions at face value.** Have it validate questions against real examples before you ship.

### 3.5 Optional — call Jev through a gateway

If you already route model calls through a gateway, Jev is available on at least two:

**Vercel AI Gateway** — base URL `https://ai-gateway.vercel.sh/typesafe`, model `typesafe-ai/jev`:

```ts
import { TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: "https://ai-gateway.vercel.sh/typesafe",
});
```

**OpenRouter** — base URL `https://openrouter.ai/api`, model `~typesafe/jev-latest`, using your OpenRouter key:

```python
import os
from typesafe_sdk import Noul, TypeSafeClient

with TypeSafeClient(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url="https://openrouter.ai/api",
    model="~typesafe/jev-latest",
) as client:
    result = client.system_one(
        "I was charged twice.",
        {"billing": Noul(instructions="Is this about billing?")},
    )
    print(result.nouls["billing"].noul)
```

Both paths bill through the gateway and show up in its usage and observability.

> **This changes fast.** Gateway model strings and base URLs are version-specific and move. Confirm the string on the gateway's own docs page before you paste it, and pin it in config rather than scattering it.

---

## Part 4 — State Craft: The Input Is the Whole Game

State is the content the questions read. It can be a plain string, a JSON object, or an array of text. Getting state right is 80% of getting Jev right.

### 4.1 Prefer an object with named fields

```json
{
  "ticket": {
    "subject": "Duplicate charge",
    "messages": [
      {"from": "customer", "text": "I was charged twice for order A-104. Please refund the duplicate."},
      {"from": "support",  "text": "We are checking the charges."}
    ]
  },
  "order": {
    "id": "A-104",
    "charges": [
      {"amount_usd": 49, "status": "captured"},
      {"amount_usd": 49, "status": "captured"}
    ]
  },
  "refund_policy": "Duplicate charges are eligible for a refund."
}
```

This is one state even though it contains a conversation, an order, and a policy. Then point each question at the field it needs with a backticked dot-and-index path:

```json
{
  "refund_requested": {
    "type": "noul",
    "instructions": "Does `ticket.messages[0].text` request a refund?"
  },
  "policy_supports_refund": {
    "type": "noul",
    "instructions": "Does `refund_policy` support the refund requested in `ticket.messages[0].text`, given `order.charges`?"
  }
}
```

Explicit paths do two things: they tell the model where to look, and they make the request readable to the next engineer.

### 4.2 Filter ruthlessly

This is the failure mode people underrate. **Accuracy falls as state fills with irrelevant detail** — unrelated content acts as a distractor and makes a wrong answer harder to debug. Retrieve and filter *in code* first, then send only the fields a question needs.

If you cannot filter in code, you can use a `Noul` to judge relevance before the next request. That is the *classifying RAG passages* cookbook.

### 4.3 Put policy in state, judgment in the question

Keep the content and the supporting facts in state (the message, the order, the refund policy). Keep the *judgment* in the questions. That separation is what lets you change a threshold or a policy document without rewriting a prompt.

### 4.4 Structured instructions when a string won't do

`instructions`, Choice option descriptions, Score level descriptions, and Noul `true`/`false` criteria can all be strings **or** JSON objects or arrays. Reach for structure when:

- The question needs labeled supporting data (a database row, a schema, a candidate record).
- Part of the question comes from your code.
- Several questions share the same shape and need to be distinguishable.

A worked habit: build one question per candidate record, with the record in a named field and the same question text for all of them.

```python
from typesafe_sdk import Noul, TypeSafeClient

SAME_PERSON = "Is the resume for the same person as `potential_duplicate`?"

def duplicate_questions(candidates: list[dict]) -> dict[str, Noul]:
    return {
        f"same_as_record_{c['id']}": Noul(
            instructions={
                "potential_duplicate": {
                    "name": c["name"],
                    "location": c["location"],
                    "last_employer": c["last_employer"],
                },
                "question": SAME_PERSON,
            },
        )
        for c in candidates
    }
```

One request, one answer per candidate, then threshold the probabilities in code. That is entity resolution without a paragraph of prose anywhere.

---

## Part 5 — Confidence and Probabilities: How to Act on Uncertainty

### 5.1 What confidence actually is

Choice and Score answers both come with a `probabilities` map and a derived `confidence` between 0 and 1. Confidence is a statistic over that distribution: **all the probability on one option gives 1.0; an even spread gives a low number.** Noul answers have no separate confidence, because with only two outcomes the `noul` value *is* the full distribution.

TypeSafe provides a sensible default, but you are not locked into it — the raw `probabilities` are always there, so you can compute your own statistic if your domain needs something else.

### 5.2 Probability is not accuracy

Two things it is not:

- **It is not a per-answer guarantee.** Calibration is measured across groups of predictions. A single answer marked 0.9 can still be wrong.
- **It is not a business-accuracy promise.** A confident answer can be wrong for *your* domain, language, or data. Calibrate on your own labeled set before you trust a threshold.

### 5.3 The three-band pattern

The docs' starting pattern is three bands, each with a different behavior:

```python
answer = response.answers["intent"]

if answer.confidence < 0.5:
    route_to_human(message)            # genuinely unsure — do not guess
elif answer.choice == "check_balance":
    show_balance(account_id)           # low stakes, act even at moderate confidence
elif answer.choice == "approve_transfer":
    if answer.confidence > 0.9:
        confirm_then_execute(account_id)   # high stakes, high confidence
    else:
        ask_user_to_confirm(account_id)    # high stakes, moderate confidence
```

The important nuance: **one threshold is not enough.** The confidence you require to show a balance is different from the confidence you require to move money. Encode the risk tolerance in code, next to the action.

### 5.4 Rank with probabilities, gate with confidence

- **Probabilities** are for sorting and for weighted combinations. "Which of these 200 passages is most relevant?" → one Noul per passage, sort by value. Don't threshold a ranking.
- **Confidence** is for deciding *whether to act*. "Is the model sure enough to skip a human?"
- **Noul values** are for thresholding into booleans, and for feeding as features into a classical model.

### 5.5 A checklist for using confidence well

- [ ] Every automated action has a named threshold, in one place.
- [ ] Low-confidence paths go *somewhere* — human review, a retry, a stronger model. Never "take the top answer anyway".
- [ ] Thresholds are set from labeled examples, not vibes.
- [ ] Anything destructive (delete, pay, permission change) requires either a hard rule plus high confidence, or human confirmation.
- [ ] You log the model version, the question definitions, and the final action, so you can replay and evaluate later.

---

## Part 6 — The Four Patterns That Cover Most Work

TypeSafe documents four architectural patterns. Learn these four and you can build almost anything.

| Pattern | What it does | Where you'll use it |
|---|---|---|
| **Speculative fan-out** | Send every question, including ones only some inputs need | Ticket triage, feature extraction |
| **Confidence-gated routing** | Use confidence as a second axis on top of the answer | Anything that takes an irreversible action |
| **Composite scoring** | Several atomic Scores, combined with weights you own | Ranking, prioritization, lead scoring |
| **Intent routing** | Classify, then route to deterministic code, a specialist LLM, or a human | Front doors: support, agents, forms |

### 6.1 Speculative fan-out

Ask everything. Ignore what doesn't apply.

```python
category = response.answers["category"]
if category.choice == "bug_report":
    if response.answers["bug_severity"].score > 1.5 and response.answers["has_reproducible_steps"].noul > 0.6:
        escalate_to_engineering(ticket_id, severity="high")
    else:
        add_to_bug_backlog(ticket_id)
elif category.choice == "billing":
    if response.answers["refund_requested"].noul > 0.7:
        route_to_billing_with_flag(ticket_id, refund_likely=True)
    else:
        route_to_billing(ticket_id)
```

The `bug_severity` answer is simply never read on the billing branch. No extra round trip.

### 6.2 Confidence-gated routing

The voice-banking example from the docs is the canonical shape: classify the intent, then gate *what you do about it* on confidence.

```
intent confidence < 0.6         → human agent
intent == check_balance, ≥ 0.6  → show the balance
intent == approve_transfer, 0.6–0.85 → ask the user to confirm
intent == approve_transfer, > 0.85   → approve the transfer
```

### 6.3 Composite scoring

Break a complex judgment into one Score per dimension, normalize each, and combine with weights in code — so the ranking is inspectable and tunable.

```python
py      = response.answers["python_depth"].score / 4
lead    = response.answers["team_leadership"].score / 4
arch    = response.answers["system_design"].score / 4
general = response.answers["generalist"].score / 4

# Two roles, two weightings, one set of scores
ic_score = 0.40 * py + 0.10 * lead + 0.40 * arch + 0.10 * general
em_score = 0.15 * py + 0.40 * lead + 0.20 * arch + 0.25 * general
```

When the ranking looks wrong, you change a coefficient and re-run — you do not rewrite a prompt. The same trick works for a `Noul` plus a `Score` combination:

```python
spam_risk = (
    0.45 * answers["requests_credentials"].noul
    + 0.30 * answers["sender_identity_mismatch"].noul
    + 0.25 * answers["unexpected_reward"].noul
)

if 0.4 < spam_risk < 0.6:
    route_to_human_review(ticket)     # unsure → a person
elif spam_risk >= 0.6:
    quarantine_as_spam(ticket)
```

### 6.4 Intent routing

Sit in front of everything and decide *which* handler runs: deterministic code (cheap, instant), a specialist LLM (expensive), or a human (slowest).

```python
if intent.confidence < 0.5:
    return route_to_human_agent(ticket_id)

if intent.choice == "order_status":
    handle_order_status(ticket_id)                     # no LLM at all
elif intent.choice == "product_question":
    handle_with_llm(ticket_id, PRODUCT_SPECIALIST)     # specialist model
elif intent.choice == "complaint":
    if complexity.score > 1 or complexity.confidence < 0.5:
        return route_to_human_agent(ticket_id)
    handle_with_llm(ticket_id, COMPLAINT_RESOLUTION)
```

This is the highest-leverage pattern in the whole model. A fast, cheap classifier in front of expensive calls is where the cost savings and the reliability both come from.

---

## Part 7 — Jev Inside a Real Next.js SaaS (a Worked Example)

Let me make this concrete against the kind of product in this shelf: a **competitive-audit report generator** — a Next.js app on Vercel, a Postgres database, a few LLM calls, and users who pay per report. Jev slots in at four places, and none of them replace an LLM.

### 7.1 The four insertion points

```
                       ┌──────────────────────────────┐
   user submits  ─────► │ 1. INTAKE ROUTER   (Jev)     │  which kind of request is this?
   a request            │    Choice + Noul             │  is it abusive? is it a refund ask?
                       └──────────────┬───────────────┘
                                      ▼
                       ┌──────────────────────────────┐
                       │ 2. MODEL ROUTER    (Jev)     │  cheap model, frontier model, or a human?
                       │    Choice + Score            │  how hard / how risky is this one?
                       └──────────────┬───────────────┘
                                      ▼
                       ┌──────────────────────────────┐
   fetch context ─────► │ 3. RAG RERANK      (Jev)     │  which retrieved passages actually matter?
                       │    Noul, one per passage     │  is the question even answerable from them?
                       └──────────────┬───────────────┘
                                      ▼
                       ┌──────────────────────────────┐
   LLM drafts  ───────► │ 4. QUALITY GATE    (Jev)     │  does the report meet the rubric?
                       │    Score + Noul              │  is every claim supported by a source?
                       └──────────────┬───────────────┘
                                      ▼
                              ship / retry / refund / human review
```

Notice the shape: the *expensive* LLM call sits in the middle, and Jev sits on both sides of it — cheap enough to run on every request, fast enough not to be the bottleneck.

### 7.2 Put all the questions in one file

Following the agent-skill advice: one file holds questions and thresholds, so review is a single read.

```ts
// lib/decisions.ts — the only file a human needs to review
import { choice, noul, score } from "@typesafe-ai/sdk";

export const INTAKE_QUESTIONS = {
  request_type: choice("What is the user asking for?", {
    new_report:     "A new competitive audit report",
    edit_report:    "Changes to a report already generated",
    billing:        "Invoices, refunds, failed payments",
    support:        "A bug or a question about the product",
  }),
  is_abusive: noul("Does the message contain abuse, threats, or harassment?"),
  refund_requested: noul("Is the user explicitly asking for money back or a credit?"),
  urgency: score("How time-sensitive is this request?", [
    "Can wait indefinitely",
    "Wants it this week",
    "Wants it today",
    "Production is down or money is actively lost",
  ]),
};

export const ROUTING_QUESTIONS = {
  difficulty: score("How hard is this request for a language model to handle well?", [
    "Trivial: a lookup or a one-line answer",
    "Routine: a standard generation with clear instructions",
    "Hard: multiple sources must be reconciled",
    "Frontier: deep reasoning across conflicting evidence",
  ]),
  risk: score("What is the downside if the model gets this wrong?", [
    "None: an internal draft nobody else sees",
    "Low: a cosmetic issue the user can regenerate",
    "High: a paid deliverable the user will act on",
    "Severe: legal, financial, or safety consequences",
  ]),
};

export const RAG_QUESTIONS = { ... };   // one Noul per retrieved passage, built in code

export const QUALITY_QUESTIONS = {
  rubric_fit: score("How well does the report satisfy the delivery rubric?", [
    "Empty or off-topic",
    "Covers some sections, misses the core question",
    "Covers the core question with thin evidence",
    "Complete, specific, and well evidenced",
  ]),
  claims_supported: noul(
    "Is every factual claim in the report supported by a cited source passage?",
  ),
};

// Thresholds, in one place, next to the questions they gate.
export const THRESHOLDS = {
  minIntakeConfidence: 0.6,
  refundToHuman: 0.7,
  escalateToFrontier: 1.5,   // normalized difficulty above this
  highRisk: 2.0,             // risk above this requires high confidence
  blockReport: 0.4,          // rubric_fit below this: do not ship
  mustCite: 0.7,             // claims_supported below this: do not ship
};
```

### 7.3 The server-side call

Everything here is server-side. The API key never reaches the browser.

```ts
// app/api/intake/route.ts
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { INTAKE_QUESTIONS, THRESHOLDS } from "@/lib/decisions";

const client = new TypeSafeClient(); // TYPESAFE_API_KEY from the server env

export async function POST(req: Request) {
  const { message, account } = await req.json();

  // Filter and shape state in code. Send only what the questions need.
  const state = {
    message,
    account: { plan: account.plan, open_orders: account.openOrders },
  };

  const { answers } = await client.systemOne({
    state,
    questions: INTAKE_QUESTIONS,
  });

  // Policy lives in code, not in a prompt.
  if (answers.is_abusive.noul > 0.8) return block(message);

  if (answers.request_type.confidence < THRESHOLDS.minIntakeConfidence) {
    return routeToHuman(message, "low-confidence intake");
  }

  switch (answers.request_type.choice) {
    case "billing":
      return answers.refund_requested.noul > THRESHOLDS.refundToHuman
        ? routeToBilling(message, { refundLikely: true })
        : routeToBilling(message);
    case "new_report":
    case "edit_report":
      return enqueueReportJob(message, {
        priority: answers.urgency.score >= 2 ? "high" : "normal",
      });
    default:
      return routeToSupport(message);
  }
}
```

### 7.4 The quality gate in front of the deliverable

The highest-value insertion point for a paid product: never ship a report that scored below your bar.

```ts
// lib/quality-gate.ts
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { QUALITY_QUESTIONS, THRESHOLDS } from "@/lib/decisions";

const client = new TypeSafeClient();

export async function gateReport(report: string, sources: string[]) {
  const { answers } = await client.systemOne({
    state: { report, sources },
    questions: QUALITY_QUESTIONS,
  });

  const fit = answers.rubric_fit;
  const cited = answers.claims_supported;

  if (fit.confidence < 0.5) {
    return { action: "human_review", reason: "rubric ambiguous" };
  }
  if (fit.score < THRESHOLDS.blockReport || cited.noul < THRESHOLDS.mustCite) {
    // Do not charge the user for a report that misses the bar.
    return { action: "retry", reason: "below delivery bar", fit: fit.score, cited: cited.noul };
  }
  return { action: "ship" };
}
```

One call, a rubric score, a citation check, and a decision. If you had built this with a generative model, half the code would be parsing.

### 7.5 RAG reranking, without a second model

Build one `Noul` per retrieved passage, ask whether the passage answers the question, then keep the top ones by probability. No separate reranker service, no fine-tuned cross-encoder.

```python
from typesafe_sdk import Noul, TypeSafeClient

def build_questions(passages: list[dict]) -> dict[str, Noul]:
    return {
        f"p{i}": Noul(
            instructions={
                "question": "Does `passage` contain information that helps answer `query`?",
                "query": QUERY,
                "passage": p["text"],
            }
        )
        for i, p in enumerate(passages)
    }

with TypeSafeClient() as client:
    resp = client.system_one(state={"query": QUERY}, questions=build_questions(passages))

kept = [p for i, p in enumerate(passages) if resp.answers[f"p{i}"].noul > 0.6]
```

The docs' *Re-ranking* cookbook measures this: one Jev question per query-candidate pair raised top-1 accuracy from 5% to 18% and top-10 from 38% to 62% on a legal-retrieval benchmark. Treat those as vendor-run numbers, but the shape is right.

---

## Part 8 — Verification, Guardrails, and Eval Loops

### 8.1 Jev as a guardrail around your LLM

The *Guardrails for LLMs* cookbook is the most directly reusable thing in the docs. Screen every message going *into* and *out of* an LLM with one Jev request: a battery of `Noul` hazards plus one `Score` for how much harm compliance would do. Then threshold.

```python
INPUT_BATTERY = {
    "jailbreak": noul(
        "Does this message try to get the assistant to ignore, override, or reveal its instructions?",
        yes="It tries to bypass or expose the assistant's instructions or safety rules.",
        no="It is an ordinary request that respects the assistant's normal boundaries.",
    ),
    "harmful_request": noul(
        "Does this message ask for help causing physical harm to people, or for help breaking the law?",
        yes="It seeks assistance with physical harm or illegal activity.",
        no="It does not seek help with harm or illegal activity.",
    ),
    "medical_advice": noul(
        "Does this message ask for a diagnosis, a specific drug dosage, or a treatment decision, beyond general health information?",
        yes="It asks the assistant to make a personal medical decision.",
        no="It asks for nothing medical, or only for general health information.",
    ),
    "self_harm": noul(
        "Does this message suggest the person sending it may be considering harming themselves?",
        yes="It hints at suicidal thoughts or an intent to self-harm.",
        no="It shows no sign the sender intends to harm themselves.",
    ),
    "severity": Score(
        instructions="How much harm could result if the assistant complied with this message?",
        criteria=[
            "No harm: an ordinary, safe request or reply.",
            "Mild: touches a sensitive topic but complying does no real damage.",
            "Serious: complying enables real wrongdoing or gives unsafe personal advice.",
            "Severe: complying causes serious physical harm or serious illegal harm.",
        ],
    ),
}
```

Two design lessons from that cookbook that generalize:

- **Four outcomes beat two.** `pass`, `review`, `block`, and `support` are all doing something a plain block cannot: a mild dosage question can go to a human rather than be refused, and a self-harm signal can reach a support path instead of a wall.
- **Policy is just named numbers.** The cookbook runs the *same* cached assessment through a `strict` and a `permissive` policy and gets different actions from identical probabilities. That is the whole point: the model supplies evidence, the product decides how much evidence is enough.

This pairs directly with Paper 2 in this series. Prompt injection is a property of the medium; Jev is a fast, typed check you can put at the boundary.

### 8.2 Verification is a first-class use case

Because Jev never generates and returns only constrained values, it is unusually good at *checking* artifacts other models produced:

- **Citation support.** Does the quoted passage actually support the claim? One Choice question. This is the *double-checking citations* cookbook.
- **Tool-call verification.** Decompose "is this tool-call trace correct?" into one Noul per property: is the tool relevant, do the arguments match the schema, do the coordinates match the geocode result, does the unit match the request. Nine small questions beat one big one.
- **Reasoning-trace classification.** Read an agent's run and decide whether a human needs to look at it, and how soon. That is literally one of TypeSafe's published workflow evals.
- **Structured-data-extraction cascades.** Extract with a generative model, then verify field by field with Jev before trusting the record.

### 8.3 Close the loop: Jev as the scorer in your eval suite

Paper 1 argues that evals are how you know an LLM feature got worse. Jev is a natural scorer for them: deterministic in shape, cheap enough to run on every commit, and calibrated enough to threshold.

The skeleton:

1. Keep a JSONL of real production examples with human labels.
2. For each example, call Jev and record the answer and the metric that matters (the `noul`, or the max probability for a Choice, or the normalized score).
3. Compare Jev's answer to the human label, per segment.
4. Gate CI on the agreement rate, exactly the way you gate on a test suite.

```python
# evals/jev_triage.py — a tiny Jev-based scorer set, runnable in CI
import json
from pathlib import Path
from typesafe_sdk import Choice, TypeSafeClient

QUESTIONS = {
    "intent": Choice(
        instructions="What is the primary intent of this message?",
        criteria={
            "refund": "Wants money back",
            "rebook": "Wants a replacement",
            "info": "Only wants information",
        },
    ),
}

def score_case(case: dict, client: TypeSafeClient) -> bool:
    resp = client.system_one(state=case["text"], questions=QUESTIONS)
    return resp.answers["intent"].choice == case["expected"]

def main() -> int:
    cases = [json.loads(l) for l in Path("evals/datasets/triage.jsonl").read_text().splitlines() if l.strip()]
    with TypeSafeClient() as client:
        passed = sum(score_case(c, client) for c in cases)
    rate = passed / len(cases)
    print(f"{passed}/{len(cases)} = {rate:.0%}")
    return 0 if rate >= 0.9 else 1   # exit code gates the build

if __name__ == "__main__":
    raise SystemExit(main())
```

Two cautions, both straight from Paper 1: **calibrate the judge against human labels before trusting it**, and **never gate on a scorer you have not validated**. Jev being fast and cheap does not make it right.

### 8.4 Comparing Jev against an LLM on the same questions

TypeSafe publishes an adapter that lets you run the *same* harness against an LLM instead of Jev, so you can compare cost, speed, and answers on your own data.

```bash
pip install 'system-one-adapter[openai]'      # OpenAI-compatible providers
pip install 'system-one-adapter[anthropic]'   # native Anthropic
pip install 'system-one-adapter[gemini]'      # native Gemini
```

```python
from system_one_adapter import SystemOneAdapterClient, Noul

client = SystemOneAdapterClient(
    structured_outputs=True,
    llm_answer_mode="probabilities",
    normalize_probabilities=True,
)

response = client.system_one(
    state="This book was a delight to read.",
    questions={"positive": Noul(instructions="The book review is positive.")},
    provider="openai",
    model="gpt-4o-mini",
)
```

This is the honest way to answer "is Jev actually better for *my* decision?" rather than trusting a chart. Run both, on your data, and compare.

---

## Part 9 — What It's Good For, and Where It Breaks

### 9.1 Where Jev fits

Straight from the docs' use-case map, plus what I would actually reach for first:

| Job | Primitive | Why Jev |
|---|---|---|
| Ticket / lead / document classification | Choice | Fast, gives a distribution and confidence |
| Routing to a handler, a queue, a model | Choice + Score | The intent-routing pattern |
| Severity, quality, risk, frustration | Score | A rubric you can read and tune |
| Guardrails, moderation, PII detection | Noul battery | Cheap enough to run on every message |
| Search, reranking, retrieval filtering | Noul per candidate | Replaces a reranker service |
| Feature extraction for a classical model | Noul / Score | Probabilities become numeric features |
| Verifying citations, tools, extractions | Noul battery | Never generates, only judges against criteria |
| Model routing for agents | Choice + Score | Pick the cheap path when it will do |

### 9.2 Where it breaks — the jaggedness list

TypeSafe documents its own failure modes for `jev-1.13`, and they matter more than the benchmarks. Learn them and you will avoid most bad integrations:

| Failure mode | What happens | Do this instead |
|---|---|---|
| **Literal reading** | It answers the question you *wrote*, not the one you meant. "It can be quite literal" | Write the exact condition; put boundary cases in the criteria. If you find yourself explaining what you meant, that explanation belongs in the instruction |
| **Math and numbers** | It is not a calculator. Counting is unreliable and gets worse with size | Do arithmetic in code. Iterate and count with one question per item, then add them up yourself |
| **Date and time comparison** | It reads dates as text, not ordered quantities | Extract date parts (a Choice over months/days, with a "not stated" option), then compare in code |
| **Indirection** | Double negatives and multi-hop questions cost accuracy | Ask directly; point to the relevant state by name |
| **Large, noisy state** | Accuracy falls with irrelevant detail; "context rot" | Filter in code first; send only what the question needs |
| **Adversarial content** | State is treated as data, not as hostile. Injected instructions can move the answer | Be explicit in criteria; test edge cases before deploying broadly |
| **Contradictory instructions/criteria** | If instruction and criteria ask for different things, it gets confused | Treat criteria as an extension of the instruction; align them |
| **Structural invariants** | `Noul` and a yes/no `Choice` on the same question will not sum to 1; a question and its negation may not add to 1 | Don't rely on arithmetic identities across separate questions; word each to mean exactly what you want |
| **Generation** | It does not generate text. Forcing it is slow and bad | Use a generative model. Jev picks, judges, and scores |

> **The big one is math.** Do not ask Jev "how many of these 40 items are defects?" Ask 40 Noul questions — one per item — and count in code. The *Jev 1.13 jaggedness* page spells this out with a worked example.

### 9.3 The decision table

| The answer I need is… | Use |
|---|---|
| One of a fixed set, unordered | **Choice** |
| A position on a described scale | **Score** |
| Yes/no, and the probability matters | **Noul** |
| A number I can compute | **Code** |
| Several independent factors | **Several questions, combined in code** |
| A paragraph of prose | **A generative LLM** |
| A date comparison or a count | **Extract with Jev, compute in code** |

---

## Part 10 — Cost, Rate Limits, and Data Handling

### 10.1 Pricing

| | Jev 1.13 (`jev-1.13.0`) |
|---|---|
| Input | **$0.042 per million tokens** — i.e. **$42 per billion** |
| Output | **Free** |
| Rate limits | 250,000 tokens/sec, 1,200 requests/min |
| Context | 64k tokens per request; 32k for state + the longest single question |

Billing is **per input token**. Because questions are evaluated in parallel, adding questions adds only their tokens — and because the state is the bulk of most requests, batching many questions into one call is dramatically cheaper than one call per question. The docs' cookbook measured **12.2× cheaper and 10.0× faster** for 13 batched questions versus 13 single-question calls.

> **These numbers change.** Pricing and rate limits are live figures. Rate limits in particular are documented as adjusting dynamically while TypeSafe scales capacity. Re-check the Models page before you size a build.

### 10.2 Vendor claims, clearly labeled

TypeSafe's launch post claims Jev is "two orders of magnitude faster and more efficient", with home-page figures of **193.6× faster and 444.6× cheaper** on their workflow evals, and **zero hallucinations** because the output space is constrained. Their published workflow evals show Jev around 67.8% mean accuracy at roughly $0.0004 and 0.4 s per case, against much more expensive LLM configurations.

These are **vendor-run evaluations**. The methodology is disclosed and the reference labels are an ensemble of other frontier models, which is a reasonable approach — but it is still the vendor grading the vendor. Treat the *shape* of the result as credible (a small, constrained decision model is far cheaper and faster at bounded judgments than a frontier LLM) and the *numbers* as marketing until you reproduce them on your own data. The adapter in Part 8.4 is how you reproduce them.

### 10.3 Rate limits and errors

- `401 Unauthorized` — missing or bad API key.
- `422 Unprocessable Entity` — request failed validation (missing field, malformed question). The body names the offending field.
- `429 Too Many Requests` — over a rate limit. Back off and retry.
- `529 Overloaded` — TypeSafe is temporarily overloaded. Retry after a short delay.

The official SDKs retry with backoff by default and honor `retry-after`. If you call HTTP directly, implement exponential backoff yourself.

### 10.4 Data handling

Jev is **not trained on customer requests or responses**. The same weights serve every account; you shape answers through state and questions, not through fine-tuning. There is a Data Processing Agreement, a Privacy Policy, and zero data retention (ZDR) for enterprise customers. If your product handles regulated data, read those documents rather than trusting a summary — including this one.

---

## Cheat Sheet

```bash
# One decision, from the shell
curl -X POST https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"state":"My card was charged twice.","model":"jev-latest",
       "questions":{"refund":{"type":"noul","instructions":"Is the customer asking for money back?"}}}'

# What can my key call?
curl https://api.typesafe.ai/v1/models -H "Authorization: Bearer $TYPESAFE_API_KEY"

# SDKs
pip install typesafe-sdk          # Python 3.10+
npm install @typesafe-ai/sdk      # Node 20+

# Agent skill
npx skills add typesafe-ai/skills --skill typesafe-ai
```

```python
# Python, the shape you'll write most often
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

with TypeSafeClient() as client:
    r = client.system_one(
        state=text,
        questions={
            "category": Choice(instructions="...", criteria={"a": "...", "b": "..."}),
            "severity": Score(instructions="...", criteria=["low", "medium", "high"]),
            "urgent":   Noul(instructions="..."),
        },
    )

r.answers["category"].choice, r.answers["category"].confidence
r.answers["severity"].score, r.answers["severity"].probabilities
r.answers["urgent"].noul
```

```json
// Question shapes, verbatim
{"type":"choice","instructions":"…","criteria":{"key":"description","key2":null}}
{"type":"score","instructions":"…","criteria":["level 0","level 1","level 2"]}
{"type":"noul","instructions":"…","criteria":{"true":"…","false":"…"}}
```

| Field | Meaning | Use it for |
|---|---|---|
| `choice` | Highest-probability option | Branching |
| `probabilities` | Full distribution (Choice: options, Score: levels) | Ranking, weighted combines |
| `confidence` | 0–1, peakedness of the distribution | Gating automation |
| `score` | Probability-weighted position on levels | Thresholds, ranking |
| `legend` | Score levels mapped back to descriptions | Auditing |
| `noul` | 0–1 probability that the answer is yes | Boolean gating, features |

| Rule | Why |
|---|---|
| One request, many questions | Parallel, near-constant latency, far cheaper |
| One judgment per question | Higher accuracy, easier to debug |
| Filter state in code first | Irrelevant context lowers accuracy |
| Keep questions and thresholds in one file | A human must be able to review the policy |
| Never do math, counting, or date math in Jev | It is not a calculator |
| Add an `other` option to every Choice | Avoid forcing a bad match |
| Threshold confidence by risk | Cheap actions and destructive actions differ |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401` | Key missing, whitespace, or wrong env var | Re-export `TYPESAFE_API_KEY`; SDK strips surrounding whitespace but rejects internal whitespace and non-ASCII |
| `422` | Missing `criteria`, wrong `type`, malformed field | Read the error body; it names the field |
| `429` / `529` | Rate limit or overload | Use the SDK's default retry, or back off exponentially |
| Answers look arbitrary | Question is compound or ambiguous | Split it; add structured criteria with `what` / `not_for` / `examples` |
| Confidence always low | Levels overlap, or the question measures several things, or state lacks the facts | One dimension per question; describe situations not degrees; add the missing state |
| Model picks the wrong option | Options too similar | Add `not_for` and `examples` to each option |
| Wrong answer on an obviously easy case | State is full of distractors | Filter the state; send only relevant fields |
| Counting is wrong | Jev does not count | One question per item; add the numbers in code |
| Scores used as exact magnitudes | Scores are not numerically calibrated | Use the score to threshold or rank, not to reconstruct a number |
| `Noul` and its negation don't sum to 1 | Not a guaranteed invariant | Don't rely on cross-question arithmetic; word each independently |
| Agent invented a request field | Stale skill | Update the skill (`npx skills update` / plugin update) |
| Results moved after a deploy | You used the `jev-latest` alias and a new release shipped | Pin the versioned ID (`jev-1.13.0`); the response's `model` field tells you which answered |

---

## Production Checklist

- [ ] API key is server-side only, in the platform's secret store.
- [ ] Every question lives in one reviewable file, with thresholds beside it.
- [ ] Each question asks exactly one thing.
- [ ] Every Choice has an `other` / `none of the above` option.
- [ ] Score levels describe situations, not degrees, and cover the extreme case.
- [ ] Nouls are phrased so a high value means yes.
- [ ] State is filtered to relevant fields before the call.
- [ ] Every automated action has a named confidence threshold.
- [ ] Low-confidence and high-risk paths have a human or retry fallback.
- [ ] No math, counting, or date arithmetic in a question.
- [ ] The model is pinned to a versioned ID, and you log the `model` returned.
- [ ] Requests and responses are logged with question definitions, so you can replay.
- [ ] A labeled eval set exists, and a Jev-based scorer is validated against human labels before it gates anything.
- [ ] You have compared Jev against an LLM on your own data before committing.
- [ ] Vendor benchmark numbers are treated as vendor numbers.

---

## Video Library

No official TypeSafe video series exists yet. Search rather than follow a link that may rot.

| Search | What you'll find |
|---|---|
| [TypeSafe Jev System One model](https://www.youtube.com/results?search_query=TypeSafe+Jev+System+One+model) | Launch coverage and explainers |
| [Jev TypeSafe tutorial](https://www.youtube.com/results?search_query=Jev+TypeSafe+tutorial) | Walkthroughs and integrations |
| [System One model vs LLM](https://www.youtube.com/results?search_query=System+One+model+vs+LLM) | Conceptual comparisons |
| [structured outputs vs decision models](https://www.youtube.com/results?search_query=structured+outputs+vs+decision+models) | Why typed decisions differ from JSON mode |
| [Kahneman Thinking Fast and Slow explained](https://www.youtube.com/results?search_query=Kahneman+Thinking+Fast+and+Slow+explained) | The naming inspiration, and the idea behind it |
| [LLM guardrails architecture](https://www.youtube.com/results?search_query=LLM+guardrails+architecture) | Where a fast classifier fits in front of an LLM |
| [model routing LLM](https://www.youtube.com/results?search_query=model+routing+LLM) | The cost-reduction pattern Jev is built for |

---

## Written References & Docs

Official TypeSafe sources first. Where a page is version-specific, I say so.

| Source | URL |
|---|---|
| TypeSafe home | `https://typesafe.ai` |
| Launch post — System One Models & Jev | `https://typesafe.ai/blog/introducing-system-one-models-and-jev` |
| Manifesto | `https://typesafe.ai/manifesto` |
| Docs index (machine-readable) | `https://docs.typesafe.ai/llms.txt` |
| Docs — Introduction | `https://docs.typesafe.ai/` |
| Docs — Quick start | `https://docs.typesafe.ai/introduction/quickstart` |
| Docs — Jev with coding agents | `https://docs.typesafe.ai/introduction/coding-agents` |
| Docs — AI primer (RLCD) | `https://docs.typesafe.ai/introduction/machine-learning-primer` |
| Docs — System One | `https://docs.typesafe.ai/concepts/system-one` |
| Docs — State | `https://docs.typesafe.ai/concepts/state` |
| Docs — How to build with System One | `https://docs.typesafe.ai/concepts/how-to-build-with-system-one` |
| Docs — Example use cases | `https://docs.typesafe.ai/concepts/use-case-map` |
| Docs — Primitives (questions) | `https://docs.typesafe.ai/primitives` |
| Docs — Choice | `https://docs.typesafe.ai/primitives/choice` |
| Docs — Score | `https://docs.typesafe.ai/primitives/score` |
| Docs — Noul | `https://docs.typesafe.ai/primitives/noul` |
| Docs — Advanced: structure | `https://docs.typesafe.ai/primitives/advanced` |
| Docs — Confidence | `https://docs.typesafe.ai/confidence` |
| Docs — Patterns | `https://docs.typesafe.ai/patterns` |
| Docs — Speculative fan-out | `https://docs.typesafe.ai/patterns/fan-out` |
| Docs — Confidence-gated routing | `https://docs.typesafe.ai/patterns/confidence-routing` |
| Docs — Composite scoring | `https://docs.typesafe.ai/patterns/composite-scoring` |
| Docs — Intent routing | `https://docs.typesafe.ai/patterns/intent-routing` |
| Docs — Cookbooks index | `https://docs.typesafe.ai/cookbooks` |
| Cookbook — Parallel questions | `https://docs.typesafe.ai/cookbooks/parallel_questions` |
| Cookbook — Guardrails for LLMs | `https://docs.typesafe.ai/cookbooks/llm_guardrails` |
| Cookbook — Re-ranking | `https://docs.typesafe.ai/cookbooks/rerank_typesafe` |
| Cookbook — Classifying RAG passages | `https://docs.typesafe.ai/cookbooks/classifying_rag_passages` |
| Cookbook — Double-checking citations | `https://docs.typesafe.ai/cookbooks/citation_check` |
| Cookbook — Structured-data-extraction cascade | `https://docs.typesafe.ai/cookbooks/sde_cascade` |
| Cookbook — Hierarchical classification | `https://docs.typesafe.ai/cookbooks/hierarchical_classification` |
| Cookbook — Classification using confidence | `https://docs.typesafe.ai/cookbooks/classification_using_confidence` |
| Cookbook — Self-consistency (Noul) | `https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook` |
| Docs — Models, pricing, limits | `https://docs.typesafe.ai/models` |
| Docs — Jev 1.13 jaggedness | `https://docs.typesafe.ai/model-jaggedness/jev-1.13` |
| Docs — HTTP API reference | `https://docs.typesafe.ai/api` |
| Docs — Client SDKs | `https://docs.typesafe.ai/sdk` |
| Docs — Python SDK | `https://docs.typesafe.ai/sdk/python` |
| Docs — Python SDK usage | `https://docs.typesafe.ai/sdk/python/usage` |
| Docs — JavaScript SDK | `https://docs.typesafe.ai/sdk/javascript` |
| Docs — Agent skill | `https://docs.typesafe.ai/agent-skill` |
| Docs — Legal (DPA, privacy, ZDR) | `https://docs.typesafe.ai/legal` |
| Console — Playground | `https://console.typesafe.ai/playground` |
| Console — API keys | `https://console.typesafe.ai/keys` |
| TypeSafe workflow evals | `https://evals.typesafe.ai/` |

| Repo / package | URL |
|---|---|
| Python SDK repo | `https://github.com/typesafe-ai/typesafe-sdk-python` |
| JavaScript SDK repo | `https://github.com/typesafe-ai/typesafe-sdk-js` |
| Agent skill repo | `https://github.com/typesafe-ai/skills` |
| LLM comparison adapter (Python) | `https://github.com/typesafe-ai/system-one-adapter-python` |
| Python package on PyPI | `https://pypi.org/project/typesafe-sdk/` |
| JS package on npm | `https://www.npmjs.com/package/@typesafe-ai/sdk` |

| Integration | URL |
|---|---|
| Vercel AI Gateway — TypeSafe API | `https://vercel.com/docs/ai-gateway/sdks-and-apis/typesafe` |
| OpenRouter — TypeSafe/Jev | `https://openrouter.ai/~typesafe/jev-latest` |

| Context | URL |
|---|---|
| Third-party "Jev AI" site — **not TypeSafe** | `https://thejevai.com/` |
| Community article on Jev (Hugging Face blog) | `https://huggingface.co/blog/sora-2/what-is-jev-ai-a-practical-guide-to-system-one-and` |

> **Read this before you follow any "Jev" link.** There is a cluster of third-party sites — `thejevai.com`, `jevaimodel.net`, `jevaimodel.org`, `bestjevai.com`, `jevmodel.net` — that present themselves as Jev products. One of them states plainly that it is *"an independently operated product and is not affiliated with, operated by, or endorsed by TypeSafe."* The Hugging Face community article that compares them even shows a request against `https://thejevai.com/v1/systemone`, which is **not** the TypeSafe API. The real endpoint is `https://api.typesafe.ai/v1/systemone`, the real docs are `https://docs.typesafe.ai/`, and the real console is `https://console.typesafe.ai/`. Verify the domain before you send a key or a credit card anywhere.

---

## Glossary

| Term | Plain-English definition |
|---|---|
| System One model | A model class built for fast, structured decisions that software consumes directly |
| Jev | TypeSafe's flagship System One model; does not generate text |
| State | The content a request is evaluated against; string, JSON object, or array of text |
| Question | A typed judgment about the state: Choice, Score, or Noul |
| Choice | A question returning one option from a defined set, plus probabilities and confidence |
| Score | A question returning a position on an ordered rubric, plus probabilities and confidence |
| Noul | A yes/no question returning the probability that the answer is yes, 0 to 1 |
| Criteria | The options (Choice) or levels (Score) or yes/no descriptions (Noul) |
| `choice` | The winning option on a Choice answer |
| `score` | The probability-weighted position on a Score answer; may fall between levels |
| `noul` | The yes-probability on a Noul answer |
| `probabilities` | The model's full distribution over your options or levels |
| `confidence` | A 0–1 statistic describing how peaked the distribution is (Choice and Score only) |
| Calibration | Whether stated probabilities match observed outcome rates across many predictions |
| RLCD | Reinforcement Learning for Calibrated Decisions — how Jev is post-trained |
| RLHF | Reinforcement Learning from Human Feedback — how chat models are post-trained |
| Speculative fan-out | Asking every question, including ones only some inputs need |
| Composite scoring | Combining several atomic Scores with weights you control |
| Confidence-gated routing | Choosing an action based on how confident the answer is |
| Intent routing | Classifying a request, then choosing the handler |
| State filtering | Sending only the fields a question needs, to protect accuracy |
| Alias (`jev-latest`) | A name that resolves to the current versioned model ID |
| Pin / pinning | Choosing a versioned model ID so answers don't shift under you |
| ZDR | Zero data retention; available to enterprise customers |

---

## FAQ & Next Steps

**Can Jev replace my LLM?** No. It replaces the *parsing and branching* around your LLM calls. Keep the LLM for generation and reasoning; use Jev for the bounded decisions.

**Is it a smaller LLM?** No. It is a different class of model, trained to return calibrated decisions rather than text. TypeSafe's own docs call out that framing as wrong.

**Is this just JSON mode?** No. JSON mode makes an LLM produce structured text that you then validate; it can still invent fields and go off the rails. Jev's output space is defined up front, so there is nothing to invent — every answer is a distribution over your options.

**How fast is it, really?** Vendor figures land between 70 and 500 ms, with a fast lane on paid plans. Treat those as positioning, not an SLA, and validate latency from your own region and at your own concurrency.

**How accurate is it?** On TypeSafe's published workflow evals, around 68% mean accuracy at a fraction of a cent. On their own benchmark that is competitive-in-the-neighborhood of much larger models — but it is their benchmark. Measure on your data.

**Do I need to fine-tune it?** No, and you can't per-account. You adapt it through state and questions. TypeSafe states it does not train on customer data.

**What about non-English?** English is the primary training language. Other languages, including CJK, are accepted but at lower accuracy. Test on your own content and watch confidence.

**Can I use it for images?** Not yet. Text, JSON objects, and arrays of text only. Pre-process images into text or structured fields first.

**How do I deal with a question whose answer depends on another?** If your code cannot build the second question until it has the first answer, make a second request. Otherwise ask both and combine in code.

**What's the single best first use?** A low-risk classification on your real traffic — ticket type, lead quality, content category — measured against twenty labeled examples. Then expand.

### Next steps, in order

1. **Today:** run one decision in the Playground. No code.
2. **This week:** create a key, call the API with cURL, then port it to the SDK in your language.
3. **Next week:** pick one real decision in your product. Write the questions in one file. Log the answers and the actions.
4. **Week 3:** collect 20–50 labeled examples. Measure Jev against them. Tune criteria and thresholds.
5. **Week 4:** add a confidence gate and a human fallback. Run the LLM-comparison adapter on the same examples.
6. **Month 2:** add Jev as a guardrail on the LLM call and as a scorer in your eval suite.

---

## Verification Note

**Verified as of September 2026 from primary sources:**

- **Model and pricing:** `jev-1.13.0`, alias `jev-latest`; $42 per billion input tokens ($0.042/Mtok); output tokens free; 250,000 tokens/sec and 1,200 requests/min, documented as dynamically adjusting; 64k-token request context with a 32k state + longest-question budget; text-only input (`docs.typesafe.ai/models`).
- **Endpoint and shapes:** `POST https://api.typesafe.ai/v1/systemone`; request fields `state`, `model`, `questions`; answer fields per primitive (`docs.typesafe.ai/api`, `docs.typesafe.ai/primitives/*`).
- **SDKs:** Python `typesafe-sdk` 0.7.1, released Sep 21 2026, Python ≥3.10 (PyPI); JavaScript `@typesafe-ai/sdk` 0.6.0, Node ≥20 (npm).
- **Agent skill:** install via the Claude Code plugin marketplace or `npx skills add typesafe-ai/skills --skill typesafe-ai` (`docs.typesafe.ai/agent-skill`).
- **Patterns and cookbooks:** the four named patterns; the parallel-questions result of 12.2× cheaper / 10.0× faster for 13 batched questions; the guardrails battery structure and its four routing outcomes; the citation, re-ranking, and cascade cookbooks (`docs.typesafe.ai/patterns/*`, `docs.typesafe.ai/cookbooks/*`).
- **Jaggedness:** the nine documented failure modes for `jev-1.13`, last reviewed 2026-09-17 (`docs.typesafe.ai/model-jaggedness/jev-1.13`).
- **Data handling:** not trained on customer requests or responses; DPA, privacy policy, and enterprise ZDR (`docs.typesafe.ai/legal`).
- **Integrations:** Vercel AI Gateway base URL `https://ai-gateway.vercel.sh/typesafe` with model `typesafe-ai/jev`; OpenRouter base URL `https://openrouter.ai/api` with model `~typesafe/jev-latest` (Vercel docs; TypeSafe Python SDK usage page).
- **The LLM comparison adapter:** `system-one-adapter-python`, installable with `[openai]` / `[anthropic]` / `[gemini]` extras (GitHub).

**Vendor claims, not independently verified:** the 193.6× / 444.6× headline figures; "zero hallucinations"; the 238× lower input price versus a named competitor; the workflow-eval accuracy, cost, and latency numbers on `evals.typesafe.ai`; the re-ranking and parallel-question percentages (these come from TypeSafe's own cookbooks, with published methodology and cached results, but they are still vendor-run on vendor-chosen tasks). Reproduce on your own data before relying on any of them.

**Changes fast:** pricing, rate limits (explicitly dynamic), the default model alias, gateway model strings and base URLs, and SDK versions. Re-check the Models page and the relevant package registry before sizing a build or pinning a model.

**Not legal advice.** If you handle regulated data, read TypeSafe's DPA and Privacy Policy directly.

**A note on third-party sites.** Several domains present themselves as "Jev" products and are explicitly unaffiliated with TypeSafe. One popular community article links to them and shows a non-TypeSafe endpoint. This paper cites TypeSafe's own domains for every technical claim; where it cites the community article, it is labeled as such.

---

## Your Setup Notes (Mac · VS Code · opencode)

**How I'd actually wire this into my own stack.**

| In my workspace | Verdict |
|---|---|
| Solo Next.js SaaS on Vercel, Postgres, one paid deliverable | Jev's sweet spot: a cheap classifier and a quality gate around the expensive LLM call |
| opencode as the coding agent | Install the TypeSafe skill so it writes correct integrations |
| LLM calls already in route handlers | Put Jev server-side, in the same handlers, one module away |
| No eval suite yet | Paper 1's 5-case dataset is the prerequisite; Jev is the scorer you add to it |

**Recommended stack for this paper's workflows:**

- **Language:** TypeScript in the app (`@typesafe-ai/sdk`), Python for evals and one-off analysis (`typesafe-sdk`). Both speak the same HTTP shape, so you can mix.
- **Where the key lives:** Vercel environment variable, server-only. Never `NEXT_PUBLIC_`.
- **Where the questions live:** one `lib/decisions.ts` per product area, with `THRESHOLDS` right below them. This is the file you review in a PR.
- **Where the decision runs:** the Route Handler, before any expensive work. Log `{question set, model, answer, confidence, action}` to Postgres so you can replay.
- **Version pinning:** use `jev-latest` while exploring, pin `jev-1.13.0` once thresholds are tuned, and log the `model` field from the response.
- **The first three insertions I'd make, in order:** (1) an intake classifier in front of support/contact forms; (2) the quality gate in front of the paid deliverable; (3) a citation check on anything the LLM writes that quotes a source.
- **What I would not use it for:** generating any user-facing prose, any arithmetic or date math, anything needing an image, and anything where a wrong answer is unrecoverable *and* I have not yet measured confidence on my own labels.
- **The habit that matters:** when a decision goes wrong, first ask whether the bug is in the *question*, the *state*, or the *threshold*. Nine times out of ten it is the question — it was compound, or literal, or the criteria did not separate the options.

**Smoke test for the first session, in order:**

```bash
export TYPESAFE_API_KEY="ts_..."
curl https://api.typesafe.ai/v1/models -H "Authorization: Bearer $TYPESAFE_API_KEY"
# then run the quickstart cURL from Part 3.1 and read the probabilities
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, ships a Next.js + Postgres SaaS on Vercel, uses opencode and AI
coding agents daily, and learns by doing.

Paper: markdown_docs/11-jev-system-one-decisions.md
Topic: Jev & System One Decisions (TypeSafe AI) — typed, calibrated decisions inside software.

Match the house style: title "# The Complete Guide: <Topic>"; a blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Production Checklist →
Video Library (YouTube SEARCH links only) → Written References & Docs (official docs only) →
Glossary → FAQ & Next Steps → Verification Note → Your Setup Notes. Pure Markdown, no HTML.
Every fence has a language tag. Clear, second-person, no filler.

Do whichever Chris asks: (A) expand one Part by 1,000+ words with a worked example; (B) add a
Part on a topic he names (agent-trace verification, hierarchical classification, feature
extraction into a classical model, streaming/real-time decisions, the adapter comparison at
scale); (C) port the worked example to his real product — read his repo, find the real
decision points, and replace the fictional competitive-audit example with his inputs and a
runnable module.

Rules: never invent URLs, endpoints, model IDs, prices, or SDK flags. If unsure, write
"search: <name> official docs" and say how to verify. Label every vendor benchmark as a vendor
claim and date every pricing claim. Distinguish TypeSafe's own domains (typesafe.ai,
docs.typesafe.ai, console.typesafe.ai, api.typesafe.ai) from unaffiliated third-party "Jev"
sites. Keep the structure. Report path, one-line summary, and word count.

Anchors (verified September 2026) — reuse and re-verify:
https://docs.typesafe.ai/
https://docs.typesafe.ai/llms.txt
https://docs.typesafe.ai/introduction/quickstart
https://docs.typesafe.ai/primitives
https://docs.typesafe.ai/confidence
https://docs.typesafe.ai/patterns
https://docs.typesafe.ai/model-jaggedness/jev-1.13
https://docs.typesafe.ai/models
https://typesafe.ai/blog/introducing-system-one-models-and-jev
```
