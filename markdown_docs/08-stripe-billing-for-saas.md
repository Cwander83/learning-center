# The Complete Guide: Stripe Billing for a Solo SaaS

> Take money correctly the first time: hosted Checkout, verified webhooks, and a credits ledger you control — the three things that separate a working SaaS from one that leaks cash and double-grants value.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

You are building a competitive-audit report generator. Free instant scan as a lead magnet. A paid one-off full report. Prepaid credit packs — 3 for $79, 10 for $199 — because every run costs you real money (LLM tokens plus third-party APIs). And an agency subscription tier with white-label branding.

That is three payment shapes in one product: a one-time payment, a prepaid balance, and a recurring subscription. Most tutorials cover one of them badly. This paper covers all three, plus the part nobody teaches you: **the money flow between your browser, your server, and Stripe's ledger** — and exactly where each step can lie to you.

The single most important idea: **Stripe is a ledger you don't own.** It tracks what happened on its side. Your database tracks what happened on *your* side — who has credits, who has access, who generated what. Those two ledgers must be reconciled by trustworthy messages, and the only trustworthy message channel is the webhook.

```
 ┌─────────────┐
 │   BROWSER   │  user clicks "Buy 3 credits — $79"
 └──────┬──────┘
        │ POST /api/checkout   (your session, your auth)
        ▼
 ┌──────────────────────────┐
 │  YOUR SERVER (Next.js)   │  creates a Checkout Session with
 │  Route Handler / Action  │  metadata: { userId, packId }
 └──────┬───────────────────┘
        │ stripe.checkout.sessions.create(...)
        │ (Idempotency-Key header)
        ▼
 ┌──────────────────────────┐
 │  STRIPE CHECKOUT (hosted)│  card details live here — never on your box
 │  checkout.stripe.com/... │  PCI handled by Stripe
 └──────┬───────────────────┘
        │ user pays
        ▼
 ┌──────────────────────────┐
 │     STRIPE LEDGER        │  PaymentIntent → succeeded
 │  (the source of truth)   │  Invoice / Charge recorded
 └──────┬───────────────────┘
        │
        │  ┌─────────────────────────────┐
        └─▶│  TWO PATHS, ONE IS A LIE     │
           └──────────────┬──────────────┘
                          │
        (a) redirect back to success_url    (b) webhook POST to your endpoint
            ── CAN BE FAKED ──                  ── signed by Stripe ──
                          │                              │
                          ▼                              ▼
                   show "thanks!"           verify signature → dedupe event id
                   DO NOT GRANT VALUE       → write ledger row → grant credits
                          │                              │
                          └──────────────┬───────────────┘
                                         ▼
                              ┌────────────────────┐
                              │  YOUR POSTGRES DB  │
                              │  credits_ledger    │  balance = SUM(delta)
                              │  stripe_events     │  processed event ids
                              │  subscriptions     │  plan state mirror
                              └─────────┬──────────┘
                                        ▼
                              ┌────────────────────┐
                              │   ENTITLEMENT      │  can this user run a report?
                              │  check + deduct    │  deduct → run → refund on failure
                              └────────────────────┘
```

### Analogy table

| Stripe concept | Plain-English analogy | Why it matters to you |
| --- | --- | --- |
| **PaymentIntent** | A request to move money. "Please charge this card $79." | It can be `requires_action`, `processing`, or `succeeded`. Do not treat it as money until `succeeded`. |
| **Webhook** | The receipt that actually counts. | The redirect back to your site is a note the customer can scribble themselves. The webhook is notarized. Grant value only from the webhook. |
| **Idempotency key** | A "don't do this twice" ticket at a coat check. | Send the same ticket twice and you get the same coat — not a second coat. Prevents double-charges on network retries. |
| **Checkout Session** | The shopping cart + receipt template. | It carries your `metadata` (userId, packId) across the boundary. This is how the webhook knows *who* to credit. |
| **Customer** | A filing cabinet drawer in Stripe's office. | Holds saved cards, invoices, subscription state. Reuse it so subscriptions can renew. |
| **Price** | The price tag on a shelf. | Immutable. Change a price by creating a *new* Price, not editing the old one. |
| **Subscription** | A standing order at the bank. | Renews itself. Your DB mirrors its state; Stripe owns the truth. |
| **Invoice** | A bill + payment record for a period. | `invoice.paid` is your subscription renewal signal. |
| **Coupon** | A discount stamped on the bill. | Applies at the amount level; useful for win-back offers. |
| **Your credits ledger** | Your own bank passbook. | Stripe has never heard of "credits." You invent this table and you guard it. |

> **Security / money-loss callout:** Any feature that grants value — credits, report access, plan upgrade — must have exactly one entry point: a signature-verified webhook. If you can also grant value from a URL parameter, a query string, or a client-side callback, you have a bug that a teenager can exploit with `curl`.

---

## The 60-Second Version (TL;DR)

1. **Use hosted Checkout.** Redirect the user to `checkout.stripe.com`. Do not build a card form. You get PCI compliance, wallets, 3DS, and localization for free.
2. **Create the Session server-side** from a Next.js Route Handler or Server Action, with `metadata: { userId, packId }`.
3. **Never grant value on the success redirect.** Render "thanks, credits arriving" and poll your own DB. The redirect is a hint, not proof.
4. **Verify every webhook** with `stripe.webhooks.constructEvent(rawBody, sig, secret)` using the **raw** request body.
5. **Dedupe on `event.id`.** Store processed event IDs in Postgres. Webhooks are delivered at-least-once and out of order.
6. **Return `200` in under a few seconds.** Do the minimum synchronous work; queue the rest if needed.
7. **Credits live in your ledger table**, not in a Stripe field. `balance = SUM(delta)`. Grant on webhook, deduct-then-refund on failure.
8. **Subscriptions use `mode: 'subscription'`** plus the Stripe customer portal for cancellation and card updates. Mirror state via `customer.subscription.*` and `invoice.*` webhooks.
9. **Test locally with the Stripe CLI:** `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
10. **Assume every key can leak.** Secret keys server-only, verify signature, rate-limit your own endpoints, and know that Stripe fees mean a $5 product can barely survive.

If you read nothing else, read **Part 4 (webhooks)** and **Part 5 (credits)**. Those two parts are where the money is won or lost.

---

## Prerequisites

- A Next.js (App Router) project on Vercel, with at least one deployed route.
- A Postgres database (Neon, Supabase, Vercel Postgres, or self-hosted). You need tables; this paper assumes SQL migrations you run yourself.
- Node.js 18+ (the Stripe CLI npm install requires it; your MacBook Pro M5 Pro is fine).
- A Stripe account (test mode is free and instant).
- The Stripe CLI. On macOS via Homebrew:

```bash
brew install stripe
stripe login
```

Alternatively, if you already have Node 18+ and prefer npm: `npm install -g @stripe/cli` — then `stripe login`. Homebrew is the cleaner macOS path because it self-updates with `brew upgrade stripe`.

- The Node SDK in your app:

```bash
npm install stripe
```

- Basic TypeScript comfort. You will write ~200 lines of server code total.

> **This changes fast:** Stripe ships API versions, new event types, and dashboard reshuffles constantly. Every claim about endpoints, parameters, and fees in this paper is dated September 2026. When something looks different, check `search: Stripe API changelog` and the linked docs.

---

## Part 1 — The Mental Model: Stripe as a Ledger You Don't Own

### Step 1: Separate the two ledgers

Think of Stripe as a bank and your app as a shop. The bank knows money moved. The shop knows what was bought and delivered. Your job is to make the shop react to the bank — reliably.

- **Stripe's ledger:** Products, Prices, Customers, PaymentIntents, Invoices, Subscriptions, Charges, Refunds, Disputes.
- **Your ledger:** `users`, `credits_ledger`, `reports`, `stripe_events`, `subscriptions`.

Every dollar question resolves to: *what did Stripe say, and did my ledger record it exactly once?*

### Step 2: Understand the two flows

| Flow | How it works | When to use |
| --- | --- | --- |
| **Hosted Checkout (redirect)** | Your server creates a Session; you `redirect()` the browser to the returned `url`; Stripe handles payment on its domain. | **Your default.** 95% of solo SaaS needs. |
| **Embedded Checkout** | Session rendered inside your page via Stripe's embedded page or Elements. | When brand continuity matters more than speed to ship. More moving parts. |

Both produce the same webhook events. The fulfillment code is identical. Only the front-end differs.

### Step 3: Know what your server is actually responsible for

Your server does five jobs and nothing more:

1. Authenticate the user (so `userId` in metadata is trustworthy).
2. Create the Session with the *server-derived* price/quantity (never trust a price sent by the browser).
3. Receive and verify webhooks.
4. Write to your ledger and grant/revoke entitlement.
5. Enforce entitlement at run time (does this user have credit to run a report?).

Your server never sees, stores, or transmits a card number. That is the entire point of Checkout.

### Step 4: Learn the core objects

| Object | What it represents | Key fields you'll use |
| --- | --- | --- |
| **Product** | What you sell ("Full Audit Report", "Agency Plan") | `id`, `name`, `metadata` |
| **Price** | The amount + currency + interval for a Product | `id`, `unit_amount`, `currency`, `recurring` |
| **Customer** | A buyer record in Stripe | `id`, `email`, `metadata.userId` |
| **Checkout Session** | One checkout attempt | `id`, `url`, `mode`, `payment_status`, `metadata`, `customer` |
| **PaymentIntent** | The actual charge attempt | `id`, `status`, `amount`, `metadata` |
| **Subscription** | A recurring agreement | `id`, `status`, `items`, `current_period_end` |
| **Invoice** | A bill for a period | `id`, `status`, `amount_paid`, `subscription` |
| **Coupon** | A discount definition | `id`, `percent_off` / `amount_off` |
| **Credits ledger** | *(yours)* prepaid balance | `id`, `user_id`, `delta`, `reason`, `stripe_ref` |

> **Honesty note:** `unit_amount` is in the smallest currency unit. $79.00 USD must be `7900`. Getting this wrong by a factor of 100 is the most common "I lost money" bug in Stripe integrations, and it cuts both ways: you can accidentally charge $7,900 or give away a $7.90 product.

---

## Part 2 — Choosing the Integration Shape

There are three rungs on the ladder. Start at the bottom; climb only when forced.

| Approach | Code required | Control | Best for | Trade-off |
| --- | --- | --- | --- | --- |
| **Payment Links** | None | Low — price fixed in dashboard | Phase 0 validation, one-off report, manual fulfillment | Fulfillment is manual; no user binding unless you pass `client_reference_id` |
| **Hosted Checkout** | ~40 lines server + webhook | Medium-high | **Your default** for packs, reports, and the agency plan | Redirect leaves your domain briefly |
| **Payment Element / Elements** | 200+ lines, client + server | Maximum | Embedded card form inside your UI | You now own more of the payment UX and its edge cases |

### Step 1: Consider Payment Links seriously for Phase 0

Your Phase 0 plan is literally "Payment Link + manual fulfillment." That is a legitimate way to start, not a hack. Create a Product + Price and a Payment Link in the dashboard, put it on your pricing page, and when an order arrives, you manually grant the credit by hand.

The reason this is fine: **you cannot automate a business you have not validated.** Manual fulfillment for the first ten customers teaches you what the automated version must do. It also costs zero engineering.

A Payment Link can pass `client_reference_id` in the URL, which appears on the resulting Checkout Session and its webhook. That is your hook to bind a payment to a user even before you write Session-creation code.

### Step 2: Graduate to hosted Checkout when manual stops scaling

You'll know it's time when you're granting credits at 2 a.m. or when you want the credits to land instantly. At that point, move to Part 3.

### Step 3: Skip Elements unless you have a specific reason

> **Honesty note:** Elements is often overkill for a solo dev. It buys you a fully in-page experience and lets you compose payment methods precisely — at the cost of owning more states, more errors, and more PCI scope. Unless a design requirement forces it, hosted Checkout plus a branded success page gets you the same revenue with a fraction of the surface area.

**Decision rule:** Payment Link → Hosted Checkout → Elements. Move right only when a concrete limitation blocks you, never "just in case."

---

## Part 3 — One-Time Payments, End to End

This is the exact flow for your $29 one-off full report. The credits flow in Part 5 is a variation.

### Step 1: Create the Price in the dashboard (or API)

In the Stripe dashboard, create a Product ("Full Audit Report") and a one-time Price of $29.00 USD (`2900`). Copy the Price ID (`price_...`). Store it in an environment variable so code and dashboard don't drift:

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_PRICE_FULL_REPORT=price_...
```

### Step 2: Create a Route Handler that makes the Session

```ts
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth'; // your session helper

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-08-26', // pin an explicit version; check current in Stripe docs
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL!;

  const checkout = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_FULL_REPORT!, quantity: 1 }],
      // Bind the payment to YOUR user. This is the thread the webhook pulls.
      metadata: { userId: session.user.id, kind: 'one_off_report' },
      // Prefill email if you have it.
      customer_email: session.user.email ?? undefined,
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,
      allow_promotion_codes: true,
    },
    {
      // Idempotency: a retried request returns the same Session,
      // it does not create a second charge opportunity.
      idempotencyKey: `checkout:${session.user.id}:${Date.now()}`,
    }
  );

  return NextResponse.json({ url: checkout.url });
}
```

Two things to notice:

- **The price is resolved server-side** from an env var. The browser never sends an amount. If your client could send `amount: 1`, you'd sell $29 reports for a penny.
- **`metadata.userId`** is the join key. Without it, the webhook cannot know who to credit, and you'll be matching payments to users by email — which breaks the moment someone pays with a different email.

> **Note on the Idempotency-Key value:** the SDK option is `idempotencyKey`. In raw HTTP it's the `Idempotency-Key` header. Keys should be unique per logical operation. Using a fresh timestamped key per click is fine for Session creation (each click *is* a new cart). Where idempotency really saves you is retrying a create you already sent — see Part 5, Step 3.

### Step 3: Kick off checkout from the client

```ts
// components/BuyReportButton.tsx
'use client';

export function BuyReportButton() {
  async function go() {
    const res = await fetch('/api/checkout', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url; // to Stripe-hosted page
  }
  return <button onClick={go}>Get the full report — $29</button>;
}
```

### Step 4: Handle the return without trusting it

`success_url` should render a page that says "Payment received — your report is being prepared," then polls your own API for entitlement. Do **not** flip a database flag based on the presence of `?session_id=`.

Why: `session_id` is visible in the URL. Anyone can visit `/billing/success?session_id=cs_test_whatever`. If that page grants the report, you just shipped free product. The redirect is a UX affordance. The webhook is the source of truth.

### Step 5: Grant entitlement in the webhook (Part 4)

The route handler's job ends at "the user is on Stripe's page." Everything financial happens in the webhook.

---

## Part 4 — Webhooks Done Right (the most important Part)

> **Money-loss callout:** Roughly every "Stripe charged the customer but they didn't get access" and "customer got access without paying" story traces to webhook handling. Signature verification, raw body, fast 200, and idempotency are not optional polish. They are the load-bearing walls.

### Step 1: Understand what Stripe guarantees

From Stripe's own docs: delivery is **at-least-once**, retried with exponential backoff for up to **three days in live mode** (roughly three attempts over a few hours in sandbox), and **ordering is not guaranteed**. Distinct events can share a `created` timestamp. Therefore:

- You WILL see duplicates. Dedupe on `event.id`.
- You MUST NOT depend on order. Fetch current state from the API when it matters.
- You MUST return `2xx` quickly, or Stripe retries — which is just more duplicates.

### Step 2: Get the raw body in Next.js App Router

Signature verification hashes the *exact bytes* Stripe sent. If any middleware parses and re-serializes the JSON, the hash changes and verification fails with `No signatures found matching the expected signature for payload`. In App Router, read the raw text — do not use `req.json()` before verifying.

```ts
// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-08-26',
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text(); // RAW. Do not JSON.parse before verifying.
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    // Invalid signature: 400. Stripe will retry — that is fine and correct.
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Dedupe + handle. Return 200 fast; keep heavy work minimal.
  try {
    await handleStripeEvent(event);
  } catch (err) {
    // Returning 500 tells Stripe to retry. Only do this for errors you
    // genuinely want retried (e.g. DB down). Logic errors should be logged
    // and swallowed with a 200, or you'll hammer yourself for 3 days.
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

> **This changes fast:** Next.js and the Stripe Node examples evolve. The canonical working example lives in Stripe's `stripe-node` repo under `examples/webhook-signing/nextjs/app/api/webhooks/route.ts`. If you hit a body-parsing issue, compare against that file, and check `search: stripe-node Next.js App Router webhook signature`.

### Step 3: Dedupe with a `stripe_events` table

```sql
CREATE TABLE stripe_events (
  id            TEXT PRIMARY KEY,        -- event.id, e.g. evt_...
  type          TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ
);
```

Claim the event atomically, then process. If the insert conflicts, you've already seen it — return 200 immediately.

```ts
async function claimEvent(eventId: string, type: string): Promise<boolean> {
  const res = await db.query(
    `INSERT INTO stripe_events (id, type)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [eventId, type]
  );
  return res.rowCount === 1; // true = first time we've seen it
}
```

### Step 4: Dispatch only the events you need

Subscribe narrowly. Listening to every event is documented as a strain on your endpoint and generates noise you'll never handle.

| Event | Fires when | What you do |
| --- | --- | --- |
| `checkout.session.completed` | A Checkout Session completes successfully | Grant credits / mark order paid. **Your primary fulfillment trigger.** |
| `payment_intent.succeeded` | A payment attempt succeeds | Optional secondary confirmation; useful when you create PaymentIntents directly |
| `invoice.paid` | A subscription invoice is paid (incl. renewals) | Extend subscription entitlement for the new period |
| `invoice.payment_failed` | A renewal charge fails | Start dunning: notify user, warn about downgrade |
| `customer.subscription.updated` | Plan change, trial→active, status change | Mirror plan and status into your DB |
| `customer.subscription.deleted` | Subscription ends | Revoke agency entitlement |

> **Careful with `checkout.session.completed`:** for payment methods with delayed settlement (bank debits and similar), the Session can complete while payment is still pending. Check `session.payment_status` (`paid` vs `unpaid`) before granting. For card payments via Checkout it is normally `paid` at completion, but the defensive check costs one line.

### Step 5: A complete handler

```ts
// lib/stripe/handlers.ts
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { grantCredits, upsertSubscription } from '@/lib/ledger';

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return; // delayed methods

      const userId = session.metadata?.userId;
      const kind = session.metadata?.kind;
      if (!userId) {
        console.error('Session missing userId metadata', session.id);
        return;
      }

      if (kind === 'credit_pack') {
        const credits = Number(session.metadata?.credits ?? '0');
        await grantCredits({
          userId,
          credits,
          reason: 'purchase',
          stripeRef: session.id,
        });
      }
      if (kind === 'one_off_report') {
        await grantCredits({
          userId,
          credits: 1,
          reason: 'purchase_one_off',
          stripeRef: session.id,
        });
      }
      return;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await upsertSubscription(invoice);
      return;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await markPastDue(invoice);
      return;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscriptionState(sub);
      return;
    }

    default:
      return; // ignore everything else
  }
}
```

### Step 6: Wire it into the route

```ts
// inside app/api/stripe/webhook/route.ts, after verification:
const isNew = await claimEvent(event.id, event.type);
if (!isNew) return NextResponse.json({ received: true, duplicate: true });

await handleStripeEvent(event);
return NextResponse.json({ received: true });
```

`grantCredits` should itself be idempotent on `stripeRef` — see Part 5.

> **Security callout:** Without signature verification, anyone who learns your webhook URL can POST a fake `checkout.session.completed` and mint themselves credits. The URL is guessable (`/api/stripe/webhook`). Verify. Always. Even in dev.

---

## Part 5 — Prepaid Credits (Your Exact Model)

### Step 1: Model credits as an append-only ledger

Never store a mutable integer balance that you increment and decrement. Store *movements* and derive the balance. You get an audit trail, natural idempotency, and no lost updates.

```sql
CREATE TABLE credits_ledger (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  delta       INTEGER NOT NULL,          -- +3 purchase, -1 run, +1 refund
  reason      TEXT NOT NULL,             -- 'purchase' | 'run' | 'refund' | 'grant'
  stripe_ref  TEXT,                      -- session/payment id, for idempotency
  run_id      UUID,                      -- links a run to its deduct+refund pair
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One credit movement per Stripe object, ever.
CREATE UNIQUE INDEX credits_ledger_stripe_ref_uniq
  ON credits_ledger (stripe_ref)
  WHERE stripe_ref IS NOT NULL;

CREATE INDEX credits_ledger_user_idx ON credits_ledger (user_id);
```

Balance is a query:

```sql
SELECT COALESCE(SUM(delta), 0) AS balance
FROM credits_ledger
WHERE user_id = $1;
```

### Step 2: Grant only on a verified webhook

```ts
// lib/ledger.ts
export async function grantCredits(opts: {
  userId: string;
  credits: number;
  reason: string;
  stripeRef: string;
}) {
  await db.query(
    `INSERT INTO credits_ledger (user_id, delta, reason, stripe_ref)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_ref) DO NOTHING`, // second delivery = no-op
    [opts.userId, opts.credits, opts.reason, opts.stripeRef]
  );
}
```

The partial unique index plus `ON CONFLICT DO NOTHING` means that even if Part 4's event dedupe somehow missed, the same `session.id` can never grant credits twice.

### Step 3: Use `idempotencyKey` when creating payment objects

If you ever create PaymentIntents or Customers programmatically (not just Checkout Sessions), pass an idempotency key so a network timeout doesn't create a second object when you retry. Stripe caches the first response for at least 24 hours and replays it. Do not use emails or personal identifiers as keys; use a UUID or a stable internal reference.

### Step 4: Deduct-then-refund on failure

This is the pattern that protects you from burning money on failed runs.

1. **Reserve (deduct) before the work starts.** Check balance ≥ 1, then insert `delta = -1, reason = 'run', run_id = X`.
2. **Run the report.**
3. **On success,** do nothing.
4. **On failure,** insert `delta = +1, reason = 'refund', run_id = X`.

```ts
export async function reserveCredit(userId: string, runId: string): Promise<boolean> {
  // Atomic: only inserts if the current balance is at least 1.
  const res = await db.query(
    `INSERT INTO credits_ledger (user_id, delta, reason, run_id)
     SELECT $1, -1, 'run', $2
     WHERE (SELECT COALESCE(SUM(delta),0) FROM credits_ledger WHERE user_id = $1) >= 1
     RETURNING id`,
    [userId, runId]
  );
  return res.rowCount === 1;
}

export async function refundCredit(userId: string, runId: string) {
  await db.query(
    `INSERT INTO credits_ledger (user_id, delta, reason, run_id)
     VALUES ($1, +1, 'refund', $2)
     ON CONFLICT DO NOTHING`,
    [userId, runId]
  );
}
```

The `WHERE (SELECT SUM...) >= 1` clause is what prevents negative balances under concurrency. Two simultaneous requests each see the balance inside the same statement; only one insert succeeds when the balance is exactly 1. Add a unique partial index on `(run_id, reason)` if you want to guarantee one refund per run.

> **Money-loss callout:** Never take the user's word for their balance from the client. Always re-derive server-side inside the transaction that reserves the credit. A client that says "I have 5 credits" is a client that can say anything.

### Step 5: Why credits beat metered billing for you

| Dimension | Prepaid credits | Metered billing |
| --- | --- | --- |
| **Cash flow** | Money lands before you spend on LLM/API calls | You front the cost, bill later, hope they pay |
| **Disputes** | "You bought 3 credits and used 1" is trivially explainable | Usage disputes require logs both sides trust |
| **Complexity** | One integer ledger, one deduct/refund pair | Metering, aggregation, thresholds, proration |
| **Fraud exposure** | Bounded to the pack size | Unbounded until you notice |
| **User psychology** | Prepaid = "I've committed"; lowers friction on price | Usage anxiety can suppress adoption |

For a solo dev whose marginal cost per run is real money, prepaid credits are the risk-managed choice. Metered billing is a later-stage optimization, not a starting point.

---

## Part 6 — Subscriptions for the Agency Tier

### Step 1: Create a recurring Price

In the dashboard, create a Product ("Agency — White Label") and a **recurring** Price (e.g. monthly). Recurring prices carry a `recurring: { interval: 'month' }`. Copy the Price ID.

```bash
STRIPE_PRICE_AGENCY_MONTHLY=price_...
```

### Step 2: Create the Session in subscription mode

```ts
const checkout = await stripe.checkout.sessions.create({
  mode: 'subscription', // required for recurring line items
  line_items: [{ price: process.env.STRIPE_PRICE_AGENCY_MONTHLY!, quantity: 1 }],
  metadata: { userId: session.user.id, kind: 'agency' },
  customer_email: session.user.email ?? undefined,
  subscription_data: {
    metadata: { userId: session.user.id }, // so subscription webhooks can join too
  },
  success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/pricing?canceled=1`,
  allow_promotion_codes: true,
});
```

Note the second `metadata` on `subscription_data`. Subscription and invoice webhooks carry *the subscription's* metadata, not the Checkout Session's. Set it in both places or your renewal handler won't know the user.

### Step 3: Let the customer portal handle lifecycle

Do not build your own cancel/update-card screens. Activate the Stripe customer portal in the dashboard and create a portal Session from your server:

```ts
const portal = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
});
return NextResponse.json({ url: portal.url });
```

The portal covers card updates, invoice history, cancellation (immediate or period-end), and plan switching where configured. This is one of the highest-leverage "don't build it" decisions available to a solo dev.

### Step 4: Understand proration and trials

- **Proration:** when a plan changes mid-cycle, Stripe by default credits unused time and charges for the new plan, netting on the next invoice. This is configurable; understand the setting before you flip it, because it affects what customers see on their bill.
- **Trials:** set `subscription_data.trial_period_days` on the Session to start a free trial. For a zero-dollar initial invoice, Checkout may not collect a payment method unless configured otherwise — see `search: Stripe Checkout free trials` before you promise "no card required."

### Step 5: Mirror plan state without trusting the dashboard

Your app should answer "is this user an agency member?" from your own table, kept in sync by webhooks — not by querying Stripe on every request and not by a manual toggle you might forget to flip.

```sql
CREATE TABLE subscriptions (
  stripe_subscription_id TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL,           -- active, trialing, past_due, canceled...
  price_id       TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

```ts
export async function syncSubscriptionState(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  await db.query(
    `INSERT INTO subscriptions
       (stripe_subscription_id, user_id, status, price_id, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, to_timestamp($5), now())
     ON CONFLICT (stripe_subscription_id) DO UPDATE
       SET status = EXCLUDED.status,
           price_id = EXCLUDED.price_id,
           current_period_end = EXCLUDED.current_period_end,
           updated_at = now()`,
    [
      sub.id,
      userId,
      sub.status,
      sub.items.data[0]?.price.id ?? '',
      sub.items.data[0]?.current_period_end ?? 0,
    ]
  );
}
```

Entitlement check becomes a local query: `status IN ('active','trialing') AND current_period_end > now()`.

> **This changes fast:** field locations on Subscription/Invoice objects shift between API versions (e.g. where `current_period_end` lives). Pin your `apiVersion`, and when you upgrade, re-read the migration guide. Never silently run unversioned API calls in production.

---

## Part 7 — Failed Payments, Dunning, and Refunds

### Step 1: Let Stripe retry, then act

Stripe Billing performs smart retries on failed renewals. You do not write retry logic. You react:

- `invoice.payment_failed` fires. Mark the subscription `past_due` in your DB and email the user. Give them a one-click link to the customer portal to fix their card.
- If retries succeed, `invoice.paid` fires and you restore `active`.

### Step 2: Downgrade gracefully, not instantly

> **Honesty note:** Immediately revoking access on the first failed charge is a churn machine. Cards expire, banks hiccup, travelers get flagged. A short grace period — access retained while `past_due`, revoked after Stripe gives up and marks the subscription `canceled`/`unpaid` — recovers far more revenue than it costs.

Practical shape:

| Subscription status | Your app's behavior |
| --- | --- |
| `active`, `trialing` | Full access |
| `past_due` | Full access + banner + email ("update your card") |
| `canceled`, `unpaid`, `incomplete_expired` | Revoke agency features; keep data intact |

`customer.subscription.deleted` is your revocation trigger. Handle it, or canceled agencies keep white-label access forever.

### Step 3: Refunds and credits already spent

Refunds are a money question and an accounting question, and they interact with your ledger:

- A refund reverses *cash*. It does **not** automatically reverse *credits*. If a user bought 3 credits, spent 2, and gets refunded, you now have a business decision, not a technical one.
- Sensible default: refund only for unspent credits, or refund the full amount while revoking the balance (set remaining balance to zero via a `delta` adjustment, never by deleting ledger rows).
- Never delete ledger history. Record a `refund_reversal` movement so the audit trail stays intact.

```ts
// Revoke remaining credits as an explicit movement, not a deletion.
await db.query(
  `INSERT INTO credits_ledger (user_id, delta, reason, stripe_ref)
   VALUES ($1, -$2, 'refund_reversal', $3)`,
  [userId, remainingBalance, refundId]
);
```

> **Money-loss callout:** Chargebacks (disputes) cost a fee per dispute on top of the reversed amount — Stripe's published US pricing as of September 2026 lists a $15.00 dispute fee, with a $15.00 countered fee for manually contested disputes (returned if you win, not if you lose). A single disputed $29 credit pack can cost you more than the sale was worth. This is precisely why prepaid credits and a clear, non-refundable-consumed-usage policy matter.

---

## Part 8 — Local Development and Testing

### Step 1: Log in and forward webhooks

```bash
brew install stripe
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The command prints a webhook signing secret beginning with `whsec_`. Put **that** value in `.env.local` for local dev — it is different from any dashboard endpoint's secret. Mixing them up is the #1 cause of local signature failures (see Troubleshooting).

### Step 2: Trigger events without clicking through checkout

```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

`stripe trigger` creates real test objects as side effects — expect extra Products, Customers, and Invoices in your sandbox. Use `--override` and `--add` to inject your own metadata when you need the handler to find a real `userId`:

```bash
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.userId=<your-uuid> \
  --add checkout_session:metadata.kind=credit_pack
```

### Step 3: Test cards

| Card | Purpose | Details |
| --- | --- | --- |
| `4242 4242 4242 4242` | Success | Any future expiry, any CVC |
| `4000 0000 0000 0002` | Generic decline | `card_declined` / `generic_decline` |
| `4000 0000 0000 9995` | Insufficient funds | `insufficient_funds` |
| `4000 0000 0000 3220` | 3DS required, succeeds | Forces an authentication challenge |
| `4000 0000 0000 0341` | Decline after attaching | Card attaches to Customer, later charge fails |

Use test API keys with test cards, always. Prefer `pm_card_visa` over raw numbers when writing code — Stripe explicitly notes that raw card numbers in server-side code can jeopardize PCI compliance later.

### Step 4: Time-travel subscriptions with test clocks

To test renewal, dunning, and cancellation without waiting a month, use Stripe's test clocks (Simulations). These let you advance a subscription's clock and observe how your webhook handling behaves at each stage. Exact commands vary by version; start with `search: Stripe test clocks simulate subscriptions` and the CLI reference for the current resource subcommands.

> **This changes fast:** the Billing testing surfaces (Simulations / test clocks) were reorganized recently. Follow the docs rather than memorized commands.

### Step 5: Watch your API traffic

```bash
stripe logs tail
```

When an object isn't what you expect, this shows the actual request and response. It is the fastest debugger you own.

---

## Part 9 — Money, Tax, and Compliance, Honestly

### Step 1: Know your fee math

The following figures come from Stripe's public US pricing page as fetched in **September 2026**. Label them as such and **verify on [stripe.com/pricing](https://stripe.com/pricing)** before you model anything.

| Item | Published rate (US, dated September 2026) | Note |
| --- | --- | --- |
| Cards / wallets (domestic) | 2.9% + 30¢ per successful transaction | Standard pricing |
| International cards | +1.5% | On top of base |
| Currency conversion | +1% | When conversion required |
| Checkout | Included with Payments | No separate charge |
| Payment Links | Included with Payments | Custom domain $10/mo if used |
| Billing (subscriptions) | 0.7% of Billing volume (pay-as-you-go) | Or from $620/mo on an annual contract |
| Stripe Tax (Basic, no-code) | 0.5% per transaction where registered | API integration: $0.50/transaction |
| Disputes | $15.00 received fee; $15.00 countered fee | Returned if you win |
| Managed Payments (merchant of record) | 3.5% per successful transaction in addition to Payments fees | Stripe handles tax remittance |
| Instant payouts | 1.5% of volume, 50¢ minimum | Standard payouts are free |

**The $5-product problem.** On a $5.00 charge: 2.9% + 30¢ = $0.145 + $0.30 = **$0.445**, or **8.9%** of revenue. On a $79 charge: 2.9% + 30¢ = $2.291 + $0.30 = **$2.591**, or **3.3%**. Fixed fees punish small tickets. Your packs at $79 and $199 have healthy margin; a hypothetical $5 product would bleed. This is a pricing argument for packs over micro-purchases, not just a payments note.

### Step 2: Tax — where responsibility actually sits

> **Not legal, tax, or financial advice.** Everything below is a technical summary. Tax obligations depend on your business location, your customers' locations, what you sell, and thresholds you cross over time. Talk to an accountant.

Key truths:

- Selling software services across borders can create sales-tax/VAT/GST registration obligations in multiple jurisdictions once you pass thresholds.
- Stripe Tax can **calculate** and collect tax based on customer location and product tax codes — but **calculation is not compliance**. You are still responsible for registering where required and filing.
- Stripe Tax offers threshold monitoring to alert you when you approach registration obligations. Use it as an early-warning system.
- If tax compliance is a burden you want fully offloaded, a **Merchant of Record** (Stripe's Managed Payments, Paddle, Lemon Squeezy) sells *to* the customer and remits tax on your behalf. That convenience costs more per transaction (Stripe's published Managed Payments rate is 3.5% on top of Payments fees as of September 2026 — verify).
- Because your product is a business tool sold B2B, some customers will want a **VAT ID** on their invoice and reverse-charge handling. Stripe Checkout can collect tax IDs; use it.

### Step 3: Receipts and invoices

Stripe can email receipts automatically (toggle in dashboard settings). For post-payment invoices on one-time Checkout purchases, there is a published fee (0.4% on transaction total, $2.00 cap, as of September 2026 — verify). Confirm what your B2B customers need before enabling, because "no invoice" is a real purchasing blocker.

---

## Part 10 — Security and Hardening

### Step 1: Keys

| Key | Prefix | Where it lives | Exposure |
| --- | --- | --- | --- |
| Publishable | `pk_` | Client code, fine to expose | Low risk |
| Secret | `sk_` | Server only, env vars | Full API access — never expose |
| Webhook signing secret | `whsec_` | Server only | Lets you verify authenticity |

> **Security callout:** Never commit keys. Never `NEXT_PUBLIC_` a secret key — that prefix ships it to every browser. Never paste a secret key into a screenshot, a Discord message, or an error report.

### Step 2: Environment handling on Vercel

Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as environment variables in the Vercel dashboard, scoped separately for Production and Preview. Use `.env.local` for local dev and keep it gitignored. Never put live keys in a Preview deployment that's publicly reachable.

### Step 3: Restrict key permissions

Stripe supports restricted API keys. Create one that can do only what your app needs (e.g. Checkout Sessions, Customers, read Billing) instead of using the full secret key. If it leaks, the blast radius is bounded. See `search: Stripe restricted API keys`.

### Step 4: Rate-limit your own endpoints

`/api/checkout` creates Stripe objects on every call. An attacker (or a retry loop) can spam it. Add per-user rate limiting, and require authentication. Your webhook endpoint should NOT be rate-limited in a way that makes Stripe's legitimate retries fail — protect it with signature verification instead.

### Step 5: You never touch card data

Checkout means card numbers go from the customer's browser to Stripe. They never transit your server, so they never land in your logs. If you ever *do* find a card number in a log line, treat it as an incident: rotate keys, purge the log, and figure out how it got there. This is the whole reason to use hosted Checkout rather than a homemade form.

---

## Part 11 — A Worked Scenario, End to End

Everything so far, assembled. The path: **free scan → email capture → $29 credit pack → webhook grants 1 credit → user generates a report → failure refunds the credit.**

### Step 1: Free scan captures the email

The free instant scan runs, then asks for an email to send the results. That write creates (or finds) a user row. Nothing payment-related happens yet. The purpose is to have a `userId` before money enters the picture — because `metadata.userId` must point at a real row.

### Step 2: The $29 pack is a Stripe Price, not a number in your code

Create the Product and Price in the dashboard and store the Price ID in an env var. The pack's *content* (how many credits) lives in your code, keyed by the same server-resolved identity:

```ts
// lib/packs.ts — the single source of truth for pack contents.
export const PACKS = {
  full_report: { credits: 1, kind: 'one_off_report' },
  // extend later: pack_3: { credits: 3, kind: 'credit_pack' }
} as const;
```

### Step 3: Session creation — one route, server-resolved

```ts
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth';
import { PACKS } from '@/lib/packs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-08-26' });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const packKey = 'full_report' as const; // server decides; client cannot pass this
  const { credits, kind } = PACKS[packKey];
  const origin = process.env.NEXT_PUBLIC_APP_URL!;

  const checkout = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [{ price: process.env.STRIPE_PRICE_FULL_REPORT!, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        kind,               // 'one_off_report'
        credits: String(credits), // '1'
      },
      customer_email: session.user.email ?? undefined,
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/scan?canceled=1`,
    },
    { idempotencyKey: `checkout:${session.user.id}:${packKey}:${Date.now()}` }
  );

  return NextResponse.json({ url: checkout.url });
}
```

### Step 4: The webhook grants exactly one credit

```ts
// app/api/stripe/webhook/route.ts (excerpt — full route in Part 4)
const isNew = await claimEvent(event.id, event.type);
if (!isNew) return NextResponse.json({ received: true, duplicate: true });

if (event.type === 'checkout.session.completed') {
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.payment_status === 'paid' && s.metadata?.userId) {
    await grantCredits({
      userId: s.metadata.userId,
      credits: Number(s.metadata.credits ?? '1'),
      reason: 'purchase',
      stripeRef: s.id, // unique index prevents a second grant
    });
  }
}
return NextResponse.json({ received: true });
```

At this point the user's balance query returns `1`.

### Step 5: The report run reserves, then refunds on failure

```ts
// app/api/reports/route.ts (excerpt)
const runId = crypto.randomUUID();

const reserved = await reserveCredit(session.user.id, runId);
if (!reserved) {
  return NextResponse.json({ error: 'No credits remaining' }, { status: 402 });
}

try {
  const report = await generateReport(/* ...LLM + APIs... */);
  return NextResponse.json({ report, runId });
} catch (err) {
  await refundCredit(session.user.id, runId); // failure costs the user nothing
  console.error('Report run failed, credit refunded', runId, err);
  return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
}
```

### Step 6: Prove it

```sql
-- Balance should be 0 after one consumed run
SELECT COALESCE(SUM(delta), 0) FROM credits_ledger WHERE user_id = '...';
```

Re-deliver the same webhook (`stripe events resend <event_id> --webhook-endpoint=<ep_id>`) and confirm the balance does **not** change. That is the proof that idempotency holds. Run a report whose generator throws, and confirm the balance returns to `1`.

---

## Cheat Sheet

### Stripe CLI commands (macOS)

| Command | What it does |
| --- | --- |
| `brew install stripe` | Install the CLI (Homebrew) |
| `brew upgrade stripe` | Update it |
| `stripe login` | Authenticate the CLI with your account |
| `stripe listen --forward-to localhost:3000/api/stripe/webhook` | Forward webhooks locally; prints your dev `whsec_` |
| `stripe listen --events=checkout.session.completed` | Only forward specific events |
| `stripe trigger checkout.session.completed` | Fire a test event (creates test objects) |
| `stripe trigger invoice.payment_failed` | Simulate a failed renewal |
| `stripe logs tail` | Stream API request logs |
| `stripe events resend <event_id> --webhook-endpoint=<ep_id>` | Manually redeliver an event |

### Webhook events that matter

| Event | Use it for |
| --- | --- |
| `checkout.session.completed` | Grant credits / mark order fulfilled |
| `payment_intent.succeeded` | Secondary confirmation for direct PaymentIntents |
| `invoice.paid` | Subscription renewal succeeded |
| `invoice.payment_failed` | Start dunning / mark `past_due` |
| `customer.subscription.updated` | Mirror plan/status changes |
| `customer.subscription.deleted` | Revoke agency entitlement |

### Test cards

| Card | Scenario |
| --- | --- |
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Generic decline |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 3220` | 3DS challenge, then success |
| `4000 0000 0000 0341` | Decline after customer attach |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Webhook returns `400`, log says `No signatures found matching the expected signature for payload` | Wrong endpoint secret, or the raw body was parsed/mutated | Use `await req.text()` before `constructEvent`; confirm the `whsec_` matches the endpoint. For CLI-forwarded events, use the secret `stripe listen` printed, not the dashboard endpoint's. |
| Duplicate credits for one purchase | Processing the same `event.id` twice, or no idempotency on the grant | Insert `event.id` into `stripe_events` with `ON CONFLICT DO NOTHING`; give `credits_ledger.stripe_ref` a unique index and use `ON CONFLICT DO NOTHING`. |
| Local webhooks never arrive | `stripe listen` not running, wrong port, or route path typo | Confirm the forward URL matches your route exactly (`/api/stripe/webhook`), keep `stripe listen` open in a VS Code terminal, and check for a 404 in its output. |
| Test vs live key mix-up | `sk_test_` key with live `whsec_`, or live deployment using test keys | Audit env vars per Vercel environment. Test key + test secret together; live with live. A live endpoint receiving test events will fail signature checks. |
| Charge succeeds in Stripe but no entitlement in app | Webhook endpoint failing (5xx) or not subscribed to the event | Open Workbench → Webhooks → Event deliveries, check the status code, and confirm the endpoint subscribes to `checkout.session.completed`. |
| Price / amount mismatch — charged the wrong amount | `unit_amount` wrong by 100×, or price edited in code without creating a new Price | Prices are immutable; create a new Price and update the env var. Always store amounts in the smallest currency unit ($79.00 → `7900`). |
| User got access without paying | Value granted from `success_url` / client callback | Move all granting into the verified webhook. The redirect must only render UI. |
| `customer.subscription.updated` handler can't find the user | Metadata only set on the Checkout Session, not on `subscription_data` | Set `metadata.userId` on `subscription_data` as well, and on `payment_intent_data` if you create PaymentIntents directly. |

---

## Video Library

No invented links — these are YouTube search pages. Pick the freshest result; Stripe's surface changes.

| Topic | Link | Why watch |
| --- | --- | --- |
| Stripe Checkout with Next.js App Router | https://www.youtube.com/results?search_query=stripe+checkout+nextjs+app+router | See the redirect + Route Handler pattern end to end |
| Stripe webhooks with Next.js and signature verification | https://www.youtube.com/results?search_query=stripe+webhooks+nextjs+signature+verification | Raw-body handling, the exact bug that breaks verification |
| Stripe CLI local webhook testing | https://www.youtube.com/results?search_query=stripe+cli+listen+local+webhooks | `stripe listen` workflow in a real terminal |
| Stripe subscriptions and the customer portal | https://www.youtube.com/results?search_query=stripe+subscriptions+customer+portal+nextjs | Recurring mode, portal sessions, lifecycle webhooks |
| Stripe test clocks / simulations | https://www.youtube.com/results?search_query=stripe+test+clocks+simulate+subscriptions | Time-travel renewal and dunning tests |
| Prepaid credits / usage-based billing design | https://www.youtube.com/results?search_query=prepaid+credits+billing+saas+architecture | Ledger patterns beyond Stripe's built-in objects |

---

## Written References & Docs

Official Stripe and Next.js documentation only.

- Stripe docs home — https://docs.stripe.com
- Checkout — https://docs.stripe.com/payments/checkout
- Fulfillment with Checkout Sessions — https://docs.stripe.com/checkout/fulfillment
- Webhooks overview — https://docs.stripe.com/webhooks
- Webhook signature verification (and troubleshooting) — https://docs.stripe.com/webhooks/signature
- Idempotent requests — https://docs.stripe.com/api/idempotent_requests
- Testing (test cards, declines, 3DS) — https://docs.stripe.com/testing
- Billing testing / test clocks (Simulations) — https://docs.stripe.com/billing/testing/test-clocks
- Stripe CLI — https://docs.stripe.com/stripe-cli
- Customer portal — https://docs.stripe.com/customer-management
- Stripe Tax — https://docs.stripe.com/tax
- Stripe pricing — https://stripe.com/pricing
- Checkout Session API — https://docs.stripe.com/api/checkout/sessions/create
- Next.js App Router Route Handlers — https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- stripe-node webhook signing example (Next.js App Router) — https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/nextjs/app/api/webhooks/route.ts
- Stripe code samples — https://github.com/stripe-samples

If a link 404s after a Stripe docs reorganization, fall back to `search: <term> Stripe docs`.

---

## Glossary

| Term | Meaning |
| --- | --- |
| **PaymentIntent** | Stripe object representing an attempt to collect a payment; has a `status` |
| **Checkout Session** | A checkout attempt, hosted or embedded; carries `metadata` and produces events |
| **Webhook** | HTTP POST Stripe sends to your endpoint when an event occurs; signed via `Stripe-Signature` |
| **Signature verification** | Confirming a webhook genuinely came from Stripe using the raw body, header, and `whsec_` secret |
| **Idempotency key** | Client-generated key that makes a retried request return the original result instead of repeating the operation |
| **Dedupe** | Skipping an already-processed webhook, keyed on `event.id` |
| **Price** | Amount + currency + interval attached to a Product; immutable |
| **Product** | The thing you sell |
| **Customer** | Stripe's record of a buyer; holds saved payment methods |
| **Subscription** | Recurring agreement that renews on an interval |
| **Invoice** | A bill for a billing period; `invoice.paid` signals renewal success |
| **Coupon** | A discount definition applied at the amount level |
| **Proration** | Crediting unused time and charging for new time when a plan changes mid-cycle |
| **Dunning** | The process of recovering failed recurring payments |
| **Test clock / Simulation** | Mechanism to advance subscription time in a sandbox |
| **Credits ledger** | Your append-only table of credit movements; balance = SUM(delta) |
| **Entitlement** | What the user is allowed to do right now, derived from your DB |
| **Merchant of Record** | An entity that sells to the end customer and remits tax for you (e.g. Paddle, Lemon Squeezy, Stripe Managed Payments) |

---

## FAQ & Next Steps

**Can I skip webhooks if I use Payment Links?**
You can, if you fulfill manually. That's Phase 0. The moment you want automatic credits, you need a webhook.

**What if my webhook handler is slow (LLM call inside it)?**
Never run the report inside the webhook. Return `200` fast, write the ledger row, and let the user trigger the run from the app. Webhooks are for recording that money moved, not for doing work.

**Do I need Elements for the agency tier's white-label branding?**
No. White-label means *your* brand on *their* reports. Checkout branding (logo, colors) plus a custom success page covers the payment side.

**How do I test a failed renewal without waiting a month?**
Test clocks / Simulations. Also `stripe trigger invoice.payment_failed` for the handler logic alone.

**Should I use metered billing for report runs?**
No — for a solo dev with real per-run costs, prepaid credits are simpler and safer (Part 5, Step 5).

**How do I handle refunds after credits are spent?**
Refund cash at Stripe; record a `refund_reversal` movement in your ledger to zero the remaining balance. Never delete ledger rows.

**Next steps for Chris:**
1. Build the Phase 0 Payment Link + manual fulfillment this week. Sell one pack.
2. Add hosted Checkout + the webhook route. Verify with `stripe listen` and a test card.
3. Add the credits ledger and deduct-then-refund.
4. Add the agency subscription + customer portal.
5. Only then consider Elements or metered billing.

---

## Verification Note

Every endpoint, object, parameter, event name, CLI flag, and fee figure in this paper was cross-checked against Stripe's official documentation and pricing page in **September 2026**. Fee figures in particular move; the numbers in Part 9 are dated and should be re-checked on [stripe.com/pricing](https://stripe.com/pricing). Where a detail could not be pinned down (notably the current Billing test-clock CLI surface, which was recently reorganized), this paper points you to the docs with a `search:` phrase rather than inventing a command. Nothing here is legal, tax, or financial advice — it is engineering guidance with honest boundaries.

---

## Bonus — Handoff Prompt

Copy this into a fresh session to expand the paper into a build-along workshop.

```text
You are expanding the paper "08-stripe-billing-for-saas.md" into a hands-on build-along for a solo developer.

Context: Next.js (App Router) + Postgres on Vercel. Product is a competitive-audit report generator sold as prepaid credit packs (3 for $79, 10 for $199), a $29 one-off report, and an agency subscription with white-label branding. Reader is on macOS (Homebrew, VS Code). He is semi-technical and learns by doing.

Produce, in order:
1. A repo blueprint: exact folder tree (app/api/checkout, app/api/stripe/webhook, app/api/billing-portal, lib/ledger.ts, lib/stripe.ts) and the SQL migration file for credits_ledger, stripe_events, and subscriptions.
2. A numbered build sequence where each step ends with a runnable checkpoint command and the expected output.
3. Full TypeScript for: checkout session creation (packs + one-off + subscription modes), the raw-body webhook route with signature verification and event dedupe, grantCredits/reserveCredit/refundCredit, and the customer portal route.
4. A local test plan using the Stripe CLI: the exact `stripe listen` and `stripe trigger` commands, the test cards to use, and the DB queries that prove credits were granted exactly once.
5. A failure-injection checklist: simulate duplicate webhook delivery, out-of-order delivery, a 400 signature failure, a 5xx from the handler, and an out-of-credits run. For each, state the expected system behavior.

Rules: use only verified Stripe endpoints and event names; no invented fields; date every fee claim and say "verify on stripe.com/pricing"; use blockquote callouts for security and money-loss risks; never grant entitlement from a success redirect; macOS commands only.
```

---

## Your Setup Notes (Mac + VS Code + Next.js on Vercel)

**Terminal layout.** Keep two VS Code integrated terminals open while building billing: one running `stripe listen --forward-to localhost:3000/api/stripe/webhook`, one running `npm run dev`. When a webhook silently fails, you'll see it in the listen window instantly. This one habit saves hours.

**Homebrew first.** `brew install stripe` then `brew upgrade stripe` keeps the CLI current. If you prefer npm, `npm install -g @stripe/cli` works, but pin the version if you care about reproducible flags.

**Env files.** `.env.local` for local dev (gitignored), Vercel dashboard env vars for Production and Preview with *separate* values. Never let Preview hold live keys. Never `NEXT_PUBLIC_` a secret.

**TypeScript safety.** Pin `apiVersion` in the `new Stripe(...)` constructor. When Stripe ships a new API version, upgrade deliberately and re-read the migration notes — don't let Vercel quietly pick up a new default.

**Database.** On a 24 GB M5 Pro, running Postgres locally via Docker is trivially cheap if you want a fast dev loop, but Neon or Supabase serverless fits Vercel's model better. Either way, put the unique index on `credits_ledger.stripe_ref` in the first migration — retrofitting idempotency after you've double-granted is painful.

**Vercel function limits.** Vercel functions are not the place for long LLM runs. Keep the webhook handler to milliseconds of work (verify, dedupe, insert, return 200) and push report generation to a background path. If a webhook handler times out, Stripe retries and you get duplicate deliveries — the exact failure mode Part 4 is designed to prevent.

**Observability.** Log `event.id`, `event.type`, and your handler's decision (granted / duplicate / ignored) at info level. When a customer says "I paid and got nothing," one query against `stripe_events` and `credits_ledger` tells you whether Stripe told you, whether you processed it, and whether you granted it. Build that audit trail before you need it.

**Stripe VS Code extension.** Stripe maintains tooling for VS Code that surfaces API logs and can help trigger events without leaving the editor. If you want it, look for the Stripe extension in the marketplace and confirm the current features in the docs — don't assume; check.

**One blunt recommendation.** Hosted Checkout + verified webhooks + a credits ledger covers roughly 95% of what your product needs. Elements, metered billing, and multi-currency can all wait. Ship the simple version, sell a pack, and let real customer behavior tell you what to build next.
