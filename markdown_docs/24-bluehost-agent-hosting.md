# The Complete Guide: Bluehost Agent Hosting

> Bluehost spent twenty years selling shared hosting to WordPress users, then started selling one-click VPS environments for OpenClaw, n8n, Claude Code, and Hermes Agent. Here is what the price actually means, what is included, and what can genuinely run on it.

**Last verified: September 2026**

**Series: Chris Wander · New Paper Series**

---

## The Big Picture

"Agent Hosting" is not a new kind of computer. It is a **self-managed virtual private server (VPS) with an agent-friendly wrapper**: a curated one-click catalog of AI apps, a persistent vector-memory service, an API gateway, and copy that speaks agent. Underneath the marketing you get an AMD EPYC virtual machine with full root SSH, 4–16 GB of DDR5 RAM, 100–450 GB of NVMe storage, a dedicated IPv4 address, unmetered bandwidth, and a 99.99% uptime promise — for a promotional price between roughly $4 and $33 per month depending on which page you buy from.

The mental model that explains every price and every limitation: **it is a Linux box, and you are still the sysadmin.** Bluehost runs the hardware, the network, and the hypervisor. Everything above that — the OS, the packages, the agent, the memory store, the backups — is yours. The "agent hosting" layer is convenience, not abstraction:

```
   WHAT YOU ARE ACTUALLY BUYING

   ┌──────────────────────────────────────────────────────────────┐
   │  YOUR AGENT                                                  │
   │  OpenClaw · Hermes · n8n · Claude Code · your own Python/Node│
   └───────────────────────────┬──────────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  API GATEWAY (included)                                      │
   │  REST endpoint on your domain · auto SSL · rate limiting     │
   │  API key / JWT / OAuth · request transform · webhooks        │
   └───────────────────────────┬──────────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  THE VPS (you manage it)                                     │
   │  root SSH + API · AMD EPYC vCPU · DDR5 RAM · NVMe SSD        │
   │  dedicated IP · DDoS protection · 99.99% SLA · 5 data centers│
   └───────────────────────────┬──────────────────────────────────┘
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  PERSISTENT VECTOR MEMORY (included)                         │
   │  pgvector or Chroma · survives restarts and upgrades         │
   └──────────────────────────────────────────────────────────────┘

   Fed by: ONE-CLICK MARKETPLACE (OpenClaw, n8n, Ollama, Docker,
   Claude Code, Magento, LAMP, 40+ more) — install now, patch later.
```

The single most important idea: **"always-on" is the product.** Everything Bluehost sells here — the memory store, the gateway, the zero-cold-start language, the anti-Lambda comparisons — exists because agents want a process that never sleeps. A VPS is simply the cheapest honest way to sell that.

### The analogy table

| Term | Plain-English analogy | Why it matters to you |
|---|---|---|
| **Agent Hosting** | A pre-furnished workshop inside a rented warehouse | You bring the agent; the building has power, locks, and a loading dock |
| **Self-Managed VPS** | The same warehouse, unfurnished | Same hardware, you install everything yourself |
| **Root access** | The master key | Install anything; also break anything |
| **One-click deploy** | IKEA furniture, pre-assembled | App running in minutes; still your job to maintain |
| **Persistent vector memory** | A filing cabinet that survives power cuts | Your agent remembers between sessions |
| **API gateway** | The building's reception desk | Auth, rate limits, and webhooks handled before requests reach your agent |
| **Zero cold start** | A shop that never closes | No wake-up delay on the first request, unlike serverless |
| **Renewal price** | The rent after the first year's discount | The number that actually decides your budget |
| **Due today** | First and last month, in advance | Intro price × term length, charged up front |
| **Infrastructure-only support** | The landlord fixes the pipes, not your furniture | They debug the hypervisor; you debug your agent |
| **Managed VPS** | A serviced apartment | Someone else patches and monitors; less control |
| **The 25% / 90-second clause** | The "no loud parties" line in the lease | Sustained resource hogging can get your account flagged |

> **The one-sentence version:** Bluehost Agent Hosting is a self-managed VPS with a one-click AI app catalog, a persistent vector memory store, and an API gateway bolted on — so the price you see is a promotional rent on a Linux box you still have to run, and the renewal price is the one that matters.

---

## The 60-Second Version (TL;DR)

1. **"Agent Hosting" is a wrapper, not a platform.** Same NVMe VPS tiers as the main Self-Managed VPS line, plus a curated agent catalog, vector memory (pgvector or Chroma), and an API gateway. Full root SSH included.
2. **There are two prices for everything: intro and renewal.** From the September 2026 VPS page: NVMe 4 is **$9.49/mo intro → renews at $11.99/mo**; NVMe 8 is **$12.99 → $28.99** (a 123% jump); NVMe 16 is **$25.99 → $49.99**.
3. **The term is 24 months and "Due today" is real money.** NVMe 4: `$9.49 × 24 = $227.76` charged up front. The agent-branded pages have run their own (usually lower) tiers — **$3.85 / $7.70 / $15.40 / $32.55**, renewing **$4.13 / $8.25 / $16.50 / $34.88** in the spring–summer 2026 snapshots.
4. **Headline prices are floors of floors.** The OpenClaw and Hermes pages say "starting at just $2.09/mo" while their own tables start at $3.85; the Agent Hosting page's closing banner says "From $4.18/mo" while its cards say $7.70.
5. **What every tier includes:** root SSH + API, a dedicated static IP, DDoS protection, unmetered bandwidth, free auto-renewed SSL, 99.99% uptime SLA, five data centers, one-click deploys and one-click upgrades.
6. **cPanel is not included** on self-managed plans — it is a **+$14.99/mo** add-on (Admin tier, 5 accounts). The VPS FAQ notes plans run **$4.69 to $99.99/mo** across the range.
7. **Support is "infrastructure only" on these plans.** Bluehost maintains hardware, network, and virtualization; you manage the OS, configurations, and applications. Some agent pages list "24/7 Support*" — read the asterisk.
8. **What can run: anything that runs on Linux.** Node, Python, Go, and Docker are first-class; `pip`, `npm`, and `apt` are unrestricted. The one-click catalog covers OpenClaw, n8n, Claude Code, Hermes Agent, Ollama, Open WebUI, Dify, Langflow, DeepSeek, Coolify, Portainer, LAMP/LEMP, WordPress, Magento, Odoo, and more — the picker advertises "45 apps."
9. **What cannot run: GPU workloads, Windows, and anything you refuse to maintain.** Ollama on these boxes is CPU inference — fine for small quantized models, slow for anything big. Backups, monitoring, and patching are not advertised as included on self-managed plans.
10. **The honest bottom line:** if you can run an agent on any $5–$10 VPS, you can run it here. You are paying for the catalog, the memory and gateway extras, and a big brand's support org — not for magic.

---

## Prerequisites

| Requirement | Why | How to check / get |
|---|---|---|
| Comfort with a terminal | Self-managed means SSH is your control panel | `ssh root@your-vps` |
| A 24-month prepay budget | Intro pricing requires the term; "due today" is charged up front | `$112.56`–`$623.76` at current promo prices |
| Model access, purchased separately | Bluehost hosts the agent, not the LLM | Anthropic / OpenAI / OpenRouter keys, or local Ollama |
| A domain (recommended) | The API gateway wants a custom domain for its REST endpoint | Any registrar; DNS A record to your dedicated IP |
| Realistic sizing math | Agents are RAM-hungry once memory and containers pile up | Start at NVMe 4; see Part 5 |
| Backup discipline | No managed backups are advertised on self-managed plans | `rsync`/`tar` to off-box storage, tested restores |
| Tolerance for patching | You own the OS and every package on it | `apt upgrade` is now your hobby |

> **Before you start:** decide which half of the product you are buying. If you want someone else to run the server, that is Managed VPS (or a PaaS) — not this. Agent Hosting's "one-click" applies to the app, not the machine.

---

## Part 1 — What Bluehost Actually Sells Now

**The old company and the new lineup.** Bluehost is a two-decade-old shared-hosting brand (part of Newfold Digital) that built its reputation on WordPress — "trusted by over 5 million WordPress users," its own footer says, with a WordPress.org recommendation badge. As of the September 2026 site, the catalog is:

| Line | What it is | Headline intro price (Sept 2026) |
|---|---|---|
| **Web Hosting (shared)** | Starter / Business / eCommerce Essentials; 10–100 sites, 10–100 GB NVMe | $3.99 / $6.99 / $14.99 per month, 36-month term |
| **WordPress / WooCommerce / Cloud** | Managed WordPress-shaped hosting | Varies; not the agent story |
| **Self-Managed VPS** | Root-access NVMe VMs — the actual hardware under Agent Hosting | $4.69 / $9.49 / $12.99 / $25.99 per month, 24-month term |
| **OpenClaw VPS · n8n VPS · Claude Code VPS · Hermes Agent VPS** | The same NVMe tiers sold through agent-branded landing pages | $3.85 / $7.70 / $15.40 / $32.55 per month in the archived 2026 snapshots |
| **Managed VPS / Dedicated / Virtual Dedicated / Agency** | For teams that do not want self-management | Quote-based to $99.99+/mo |
| **AI Tools** | AI All-Access Pack, AI Website Builder, AI Store, AI Domain Name Generator, AI Receptionist, **Agent Hosting** | Mixed; the pack is advertised at $20.00/mo |

**Where Agent Hosting sits.** The `/agent-hosting` page is a marketing umbrella over the self-managed VPS line. Its H1 reads "Deploy AI agents. Host anything. Scale instantly," and it promises to "run OpenClaw, Hermes, n8n, Claude Code and other AI applications in an always-on environment with full root access, NVMe speed and scalable resources." Four badges sit under it: **always-on workloads, persistent vector memory, API gateway included, 1-click installation.** That is the entire pitch — and, to be fair, it is an accurate description of what the plans contain.

**This is a funded product line, not an experiment.** The first Agent Hosting captures appear in the Internet Archive in **April 2026**; by **September 2026** the site-wide VPS banner reads "NEW: Claude Code pre-installed on every plan," the navigation lists four agent-branded VPS products, and the one-click catalog has grown to dozens of AI apps. Whatever else you conclude about the pricing, Bluehost is betting real estate on agents.

**Why agents can't live on the shared plans.** Bluehost's own comparison table on the VPS page draws the line: shared hosting is "pooled resources; no guaranteed vCPU/RAM" with "low control; limited stack changes." The VPS line is "allocated resources (CPU, RAM, NVMe)" with "complete control to install custom software." An agent that must stay resident, hold memory, and accept webhooks needs allocated resources and a process supervisor — that is the VPS line by definition.

---

## Part 2 — What the Price Actually Means

This is the part the product pages make deliberately fuzzy, so let's be concrete. Three different numbers appear for every plan, and they mean three different things.

**1. The intro (promotional) price.** Advertised as "Save 18%" to "Save 60%," available only on a long term — 24 months for VPS, 36 months for shared. This is the number in the headline.

**2. The renewal price.** What you pay after the term, at "the then current rate." This is the number your budget actually lives with, and it is typically 20%–125% higher than the intro price.

**3. "Due today."** The intro price multiplied by the term length, charged up front. This is the number your credit card actually sees.

### The main VPS price list (as archived 23 September 2026)

| Plan | Specs | Intro /mo | Renews at | Due today (24 mo) |
|---|---|---|---|---|
| **NVMe 2** | 1 vCPU · 2 GB DDR5 · 50 GB NVMe | $4.69 | $5.69 | $112.56 |
| **NVMe 4** | 2 vCPU · 4 GB DDR5 · 100 GB NVMe | $9.49 | $11.99 | $227.76 |
| **NVMe 8** | 4 vCPU · 8 GB DDR5 · 200 GB NVMe | $12.99 | $28.99 | $311.76 |
| **NVMe 16** | 8 vCPU · 16 GB DDR5 · 450 GB NVMe | $25.99 | $49.99 | $623.76 |

All tiers: unmetered bandwidth, dedicated IP, DDoS protection, root SSH + API, multiple data centers. NVMe 4/8/16 carried limited-time Amazon gift-card offers ($50/$60/$75) in this snapshot.

### The agent-page price list (archived spring–summer 2026)

The OpenClaw, Hermes Agent, and Claude Code landing pages sell the same four sizes at different numbers:

| Plan | Intro /mo | Renews at | Notes |
|---|---|---|---|
| **NVMe 2** | $3.85 | $4.13 | "Infrastructure/hardware support" |
| **NVMe 4** | $7.70 | $8.25 | Recommended for Claude Code; $50 gift card |
| **NVMe 8** | $15.40 | $16.50 | $60 gift card |
| **NVMe 16** | $32.55 | $34.88 | $75 gift card; "Best VPS, April 2026" per the Claude Code page |

The Agent Hosting page itself lists **$7.70/mo** tiers for Claude Code, n8n, and OpenClaw (2 vCPU / 4 GB / 100 GB), with n8n and OpenClaw renewing at **$9.35/mo** and "Save 18%."

> **Read this twice:** the same physical NVMe 4 has appeared at **$9.49 intro / $11.99 renewal** on the main VPS page and **$7.70 intro / $8.25 renewal** on the agent pages — and NVMe 8 at **$28.99 renewal** versus **$16.50 renewal**. The snapshots are from different months, so some of the gap is price drift over time; some of it is different bundles and promos. The practical rule survives either way: **the page you land on decides the price you get, and the cart decides the truth.** Screenshot the cart and the renewal line before you pay.

### What else the price includes — and what it doesn't

**Included in every number:** root SSH + API access, a dedicated static IP per instance, always-on DDoS protection, unmetered bandwidth, free auto-renewed SSL, the 99.99% uptime SLA, five data centers (USA–Virginia, USA–Arizona, London, Toronto, Amsterdam), one-click app installs, and one-click resource upgrades.

**Not included, or costs extra:**

- **cPanel** — **+$14.99/mo** for the Admin tier (5 accounts); other tiers "also available." Self-managed plans ship as plain Linux (AlmaLinux 9 by default) unless you add a panel or pick one from the marketplace.
- **Your model bill** — Claude Code requires its own access/account; every hosted-LLM agent needs your API keys.
- **VAT/GST** — advertised prices exclude both; EU and Indian customers see tax itemized at checkout.
- **A domain** — the free-domain-for-one-year offer belongs to the shared hosting plans (redeem within 90 days, specific TLDs only). The VPS line does not advertise a free domain.
- **Backups** — not advertised for self-managed plans. Assume you are the backup strategy.
- **Managed support** — "premium support is available if you contact sales." The included tier is infrastructure-only (see below).

**The guarantees, precisely.** The 99.99% uptime SLA is published with a modest remedy: if uptime drops below the promise, you can claim **a single 5% monthly credit within 30 days** (that credit language lives on the shared-hosting page, and the VPS pages repeat the 99.99% figure). The **30-day money-back guarantee** is also a shared-hosting term — on the VPS and agent pages I could not find an equivalent refund clause in the archived snapshots. Treat a 24-month prepay as committed money unless checkout says otherwise in writing.

**Support semantics — the asterisk matters.** The VPS and agent pages state it plainly under "Infrastructure Only Support": *"We maintain the hardware, network, and virtualization layer. You manage your OS, configurations, and applications."* Meanwhile the Claude Code page lists "24/7 Support*" as a plan bullet and the Agent Hosting banner claims "24/7 developer support." Both can be true — you can reach someone at 3 a.m. about the hypervisor — but nobody at Bluehost is going to debug your agent's Python traceback on a self-managed plan. If that sentence worries you, the correct products are Managed VPS or Dedicated.

**The fine print that bites agents specifically.** Every VPS and agent page carries the bandwidth FAQ verbatim: *"we do require all customers to be fully compliant with our Terms of Service and to not exceed 25% or more of system resources for longer than 90 seconds."* The VPS pages soften it — "most customers running websites, applications, APIs, or business workloads on a VPS remain well within our acceptable usage guidelines" — but the clause is the clause. A healthy always-on agent is bursty and mostly idle; a runaway loop or a CPU-bound model server is neither. If your workload plans to sit hot, get written clarity from sales before you prepay two years.

---

## Part 3 — What's Included, Feature by Feature

### The published specification table

Straight from the Agent Hosting page:

| Category | Item | Detail |
|---|---|---|
| **Compute & memory** | CPU | AMD EPYC vCPU |
| | RAM | 4 GB – 16 GB DDR5 |
| | Storage | 100 GB – 450 GB NVMe SSD |
| **Deployment** | Install | One-click from marketplace |
| | Runtimes | Node, Python, Go, Docker |
| | Updates | One-click upgrade |
| **API gateway & networking** | Bandwidth | Unmetered |
| | SSL | Auto-renewed, free |
| | IP | Dedicated static IP per instance |
| **Security & access** | Access | Full root + SSH |
| | DDoS | Always-on |
| | Uptime SLA | 99.99% |

### Persistent vector memory

Every Agent Hosting plan includes *"a vector memory store, powered by pgvector or Chroma, based on your choice,"* which *"persists across restarts, deployments and updates."* The point is architectural, not cosmetic: your agent can write embeddings in one session and retrieve them weeks later without you running a separate database service. In practice this is Postgres+pgvector or Chroma running on your box — which means it lives on your NVMe, dies with your box, and is exactly as backed up as you made it. Design it like the production datastore it is.

### The API gateway

The FAQ describes it as *"a clean REST endpoint on your custom domain with automatic SSL,"* with configurable **rate limiting, authentication (API key, JWT, or OAuth), request/response transformation, and webhook listeners** — "without deploying separate infrastructure." This is the single most agent-shaped piece of the offering: agents live on webhooks and HTTP surfaces, and this saves you writing and hardening a reverse proxy before day one. It does not replace authorization logic inside the agent. Auth at the gate, decisions in the app.

### Zero cold start

Bluehost's sharpest, truest marketing: *"Unlike serverless tools such as AWS Lambda or Vercel Edge, Agent Hosting keeps your environment always warm, so the first request is as fast as the thousandth."* That is simply what owning a VPS means. If your agent's job is answering a chat message or reacting to a webhook in under a second, a serverless cold start is a product defect, and this is the fix.

### The one-click marketplace

"Deploy in one click" installs preconfigured containers with dependencies and settings — OpenClaw's FAQ describes the flow as *"pick your provider, select your AI model, add your API keys, and you're ready to go."* The same catalog serves OS images (Ubuntu, AlmaLinux, Debian, CentOS, Fedora, Rocky), control panels (cPanel, CyberPanel, CloudPanel, HestiaCP, Webuzo, and more), and the app list below. One-click is real for install day; it says nothing about day 90, when the container needs an update and the app's own release notes are your problem.

### What is conspicuously not advertised

Backups, snapshots, monitoring, alerting, OS patching, malware scanning (a shared-hosting feature), and load balancing are absent from the self-managed VPS and Agent Hosting pages. Absent from marketing does not always mean absent from the product — but it means absent from the promise. Build the missing half yourself, or buy Managed VPS.

---

## Part 4 — What Can Actually Run On It

**The runtime truth is broad and simple.** The FAQ says the platform *"supports any framework that runs on Linux,"* with full root access so you can *"install dependencies with pip, npm or apt without restrictions."* The use-case banner puts it more casually: *"Any agent, any framework, any workflow. If it runs in Python or Node.js, it runs here."* Node, Python, Go, and Docker are the named runtimes. That covers essentially every open-source agent framework in existence — the constraint is resources, not compatibility.

### The one-click catalog (as advertised, September 2026)

| Group | Apps |
|---|---|
| **Agents & agent tooling** | OpenClaw, Hermes Agent, Hermes Agent + Open WebUI, GatorClaw, NanoClaw ("always-on AI agent"), BMAD (AI agent development framework), Paperclip |
| **Automation & orchestration** | n8n, Sim, Dify, Langflow |
| **Models & model UIs** | Ollama, DeepSeek, Open WebUI |
| **Developer tools** | Claude Code, Coolify, Portainer, gstack, OpenLiteSpeed + Node.js |
| **Commerce** | Magento, Odoo, WooCommerce (WordPress) |
| **Content, comms & learning** | WordPress, Ghost, Moodle, Chatwoot, Rocket.Chat, Jitsi Meet |
| **Classic stacks** | LAMP, LEMP |
| **Control panels** | cPanel, aaPanel, CloudPanel, Cloudron, CyberPanel, Easypanel, HestiaCP, ISPConfig 3, WebAdmin, AdminBolt, Webuzo |
| **Operating systems** | AlmaLinux, Ubuntu, CentOS, Debian, Fedora, Rocky Linux |

The picker's own header says "Show all 45 apps" — treat that as the current catalog size, because the list has grown with every snapshot.

### The four flagship agent products, honestly compared

| Product | What it is | Best at | The catch |
|---|---|---|---|
| **OpenClaw** | Self-hosted agent with messaging integrations | Always-on multi-step agents; WhatsApp, Telegram, Discord, Slack; RBAC + audit logs | Page title says "self-managed," body copy says "fully managed" — the app is one-click, the server is still yours |
| **n8n** | Visual workflow automation | Always-on webhooks, scheduled flows with retry logic, "no timeout limits" | Workflows are only as reliable as the box; you own upgrades |
| **Claude Code** | Terminal-first coding agent in a persistent workspace | Repo work, refactors, long test runs that outlive your laptop | Requires Claude Code access/account separately; it is a coding environment, not a chatbot host |
| **Hermes Agent** | Agent-first assistant with persistent memory and reusable skills | Scheduled and recurring workflows; cron-driven tasks; OpenAI/OpenRouter/custom providers | Its own comparison concedes OpenClaw is the stronger pick for orchestration-heavy pipelines |

A useful way to read Bluehost's own positioning: **Hermes is "agent-first" (memory and skills), OpenClaw is "gateway-first" (routing and orchestration), n8n is the workflow glue, and Claude Code is the developer.** They coexist happily on one box — the FAQ confirms you can run "n8n for workflow automation, OpenClaw for agentic app workflows and Claude Code for repo work from one persistent environment," best separated with containers, ports, or subdomains.

### What cannot run, or will disappoint

- **No GPUs anywhere in the lineup.** The Hermes FAQ is candid: *"A GPU becomes more relevant if you plan to run local LLM inference directly on the same server."* Ollama works on these plans, but it is CPU inference — fine for small quantized models on light traffic, painful for anything larger. Bluehost's own suggested pattern is to "pair it with a private local model" for cost control, which is true, provided your expectations are sized to the CPU.
- **No Windows.** Linux distributions only.
- **No high availability.** One instance, one IP, one point of failure. Nothing on the pages advertises failover, load balancing, or multi-node orchestration — "high availability ready" on the VPS page means *you* can architect it, not that it ships.
- **No escape from the 25%/90-second clause** described in Part 2.
- **No managed anything on self-managed plans** — including the security patches, which matter more when the box holds your agent's memory and API keys.

---

## Part 5 — Choosing a Plan for Your Agent

**The sizing question is not "how big is my agent" — it is "how many processes, how much memory, and is there a local model."** Agents themselves are light; embeddings, containers, browsers, and models are heavy.

| Your workload | Plan | Why | Monthly after renewal |
|---|---|---|---|
| One n8n instance with webhooks and a few workflows | NVMe 4 | 2 vCPU / 4 GB is the recommended starting tier in Bluehost's own Claude Code FAQ | $8.25–$11.99 |
| Claude Code as a persistent dev box for one repo | NVMe 4 | Their FAQ: "start with the NVMe 4 plan" | $8.25–$11.99 |
| OpenClaw single agent + memory + a couple of integrations | NVMe 4 | Memory store and agent fit comfortably; containers fit if lean | $8.25–$11.99 |
| n8n + OpenClaw + memory + a panel or Coolify | NVMe 8 | 4 vCPU / 8 GB is the first comfortable multi-container size | $16.50–$28.99 |
| Ollama with small local models, or Magento/Odoo | NVMe 16 | 8 vCPU / 16 GB; still CPU-only inference | $34.88–$49.99 |
| Team workflows, compliance, "just make it work" | Managed VPS / Dedicated | Someone else holds the pager | Quote |

**Do the two-year math before you commit.** Worked examples at the archived promo prices:

```text
NVMe 8 on the main VPS page (Sept 2026 pricing)
  First 24 months:   $12.99 x 24 = $311.76 due today
  Months 25-36:      $28.99 x 12 = $347.88
  Three-year total:  $659.64   (effective ~$18.32/mo)

NVMe 4 on the agent pages (spring-summer 2026 pricing)
  First 24 months:   $7.70 x 24  = $184.80
  Months 25-36:      $8.25 x 12  = $99.00
  Three-year total:  $283.80    (effective ~$7.88/mo)
```

Both are legitimate ways to host an agent. The first is a bigger box on a steeper renewal curve; the second is the "agent bundle" pricing that may or may not still be available when you read this. The lesson is not which number is right — it is that **you cannot evaluate these plans from the headline month, and you should price the full 36 months before clicking.**

**One upgrade note in your favor:** scaling is genuinely one-click and preserves your data and IP. The sensible strategy is to start at NVMe 4, watch `htop` and disk for a month, and size up when the numbers — not the vibes — say so.

---

## Part 6 — The Kinks (From Someone Who Read the Fine Print)

1. **The Agent Hosting page shipped with placeholder prices.** In both the April and July 2026 archived snapshots, its pricing cards literally read `$xx/mo`, `Save XX%`, and `Renews at $x.xx /mo` in the Claude Code card. If a live page ever shows you something like that, trust the cart, not the card.
2. **The same plan is priced differently depending on which page you buy from.** NVMe 4: $9.49/renews $11.99 on the VPS page; $7.70/renews $8.25 on the agent pages. NVMe 8's renewal differs by more than $12/month between the two. Compare before you buy, and check whether the cheaper price is tied to a different term or bundle.
3. **Headline prices are the cheapest corner of the matrix.** "Starting at just $2.09/mo" (OpenClaw/Hermes heroes) sits above a table whose cheapest row is $3.85; "From $4.18/mo" (Agent Hosting CTA) sits above cards priced $7.70. Neither number is a lie — both are the smallest configuration, longest term, best promo — but neither is the price of the plan you will actually pick.
4. **Renewal shock is real and steep on the bigger tiers.** NVMe 8 goes $12.99 → $28.99 (+123%). Set a calendar reminder for month 23 and re-shop the market; renewal prices are "the then current rate," and there is no published cap.
5. **"Self-managed" and "fully managed" appear in the same breath.** The OpenClaw page's own subtitle reads "Deploy fully managed OpenClaw… no setup, no DevOps," while the page's title and support section say self-managed and infrastructure-only. The reconciliation: the *application* is one-click; the *server* is yours forever.
6. **Support scope needs to be read, not assumed.** "24/7 Support*" bullets, "24/7 developer support" banners, and "Infrastructure Only Support" sections coexist on the same properties. The asterisk is doing a lot of work.
7. **The 25%-of-resources-for-90-seconds clause rides along on the agent pages too.** It is a shared-hosting-shaped term on a product pitched at always-on workloads. Ask sales in writing what it means for your specific agent before prepaying.
8. **No GPUs, and the FAQs admit it.** Plan for hosted model providers, or small local models with modest expectations.
9. **The documentation is the FAQ.** The richest technical material Bluehost publishes for these products is the accordion FAQ on each landing page plus a handful of blog guides. The practical knowledge for running your stack will come from the open-source projects themselves — budget for that, not for vendor docs.
10. **Taxes, gift cards, and add-ons are all "checkout-time" facts.** VAT/GST excluded, gift-card promos are limited-time with their own terms, cPanel is +$14.99/mo, and premium support is a sales conversation. Read the cart line by line.

---

## Part 7 — Deploying Your First Agent (A Working Skeleton)

The vendor's flow is three steps: buy a plan, click Manage, add API keys. That gets you a running app. This gets you a running app that survives the week.

**1. Buy, then pick your stack.** Choose the NVMe size (Part 5), then in the marketplace pick your app — OpenClaw, n8n, Hermes, Claude Code, or plain Ubuntu if you want to build it yourself. You land with root SSH and a dedicated IP.

**2. First hour: harden the box.**

```bash
# As root, on the fresh VPS
adduser chris && usermod -aG sudo chris
rsync --archive --chown=chris:chris ~/.ssh /home/chris
# then, as chris:
ssh-copy-id chris@your-vps-ip   # from your laptop, if keys aren't in place

# On the server: lock the front door
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
sudo apt update && sudo apt install -y ufw unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades   # automatic security patches
```

**3. Install your runtime.** For Node-based agents, either the app's own installer from the marketplace or:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
```

Docker-based stacks skip this — the one-click catalog already delivered containers; manage them with `docker compose`.

**4. Run the agent as a service — the single most important step.** An agent started in an SSH session dies with the session. systemd is what makes "always-on" true:

```ini
# /etc/systemd/system/my-agent.service
[Unit]
Description=My AI agent
After=network-online.target
Wants=network-online.target

[Service]
User=chris
WorkingDirectory=/home/chris/agent
EnvironmentFile=/home/chris/agent/.env
ExecStart=/usr/bin/node /home/chris/agent/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now my-agent
systemctl status my-agent --no-pager
journalctl -u my-agent -f          # live logs
```

**5. Put the API gateway (or nginx) in front.** If your plan's gateway is configured, point your custom domain at it and set auth and rate limits. If you are fronting the agent yourself:

```nginx
# /etc/nginx/sites-available/agent
server {
  listen 443 ssl;
  server_name agent.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/agent /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d agent.example.com
```

**6. Give it memory that survives.** If you use the included pgvector/Chroma service, treat its data directory as production data — it lives on your NVMe and nowhere else. If you are rolling your own:

```yaml
# docker-compose.yml — pgvector as agent memory
services:
  db:
    image: pgvector/pgvector:pg16
    restart: always
    environment:
      POSTGRES_PASSWORD: change-me
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

**7. Schedule the recurring work with cron, not vibes.**

```bash
crontab -e
# Every 15 minutes: run the agent's queue drain
*/15 * * * * cd /home/chris/agent && /usr/bin/node run-queue.js >> /var/log/agent-queue.log 2>&1
```

**8. Back up off the box, and test the restore.** No managed backup is advertised on these plans, so:

```bash
# Nightly at 03:00: database dump + project archive to remote storage
0 3 * * * pg_dump -U postgres agentdb | gzip > /tmp/agentdb-$(date +\%F).sql.gz && \
  rsync -az /tmp/agentdb-*.sql.gz /home/chris/agent /backup-remote:agent-backups/
```

**9. Monitor the one thing that matters.** A dead agent is worse than no agent — it fails silently. Point any uptime service at your gateway's health endpoint, and alert on non-200s. `systemctl status` tells you what happened after; the health check tells you it happened.

**10. When you outgrow it, resize — don't migrate.** Upgrades are one-click and keep your data and IP. Watch `htop` (RAM headroom) and `df -h` (NVMe fills fast once models and containers land), and size up before you are paged.

---

## Cheat Sheet

**The two price lists (archive-verified)**

| Tier | Specs | VPS page (Sept 2026) | Agent pages (spring–summer 2026) |
|---|---|---|---|
| NVMe 2 | 1 vCPU · 2 GB · 50 GB | $4.69 → $5.69 | $3.85 → $4.13 |
| NVMe 4 | 2 vCPU · 4 GB · 100 GB | $9.49 → $11.99 | $7.70 → $8.25 |
| NVMe 8 | 4 vCPU · 8 GB · 200 GB | $12.99 → $28.99 | $15.40 → $16.50 |
| NVMe 16 | 8 vCPU · 16 GB · 450 GB | $25.99 → $49.99 | $32.55 → $34.88 |

**Included at every tier:** root SSH + API · dedicated static IP · unmetered bandwidth · free auto-renewed SSL · DDoS protection · 99.99% SLA · five data centers · one-click deploys and upgrades. **Extra:** cPanel +$14.99/mo.

**Commands you will actually use**

| Command | Purpose |
|---|---|
| `ssh root@<ip>` | First login; then create a user and disable root/password auth |
| `ufw allow OpenSSH && ufw enable` | Firewall, minimum viable |
| `systemctl enable --now <service>` | Make an agent survive reboots and SSH exits |
| `journalctl -u <service> -f` | Live agent logs |
| `docker compose up -d` | Run catalog-installed containers |
| `certbot --nginx -d <domain>` | Free SSL on your own proxy |
| `crontab -e` | Scheduled agent runs |
| `df -h` / `htop` / `free -h` | The three commands that tell you when to resize |
| `pg_dump` + `rsync` | Your entire backup strategy, realistically |

**The decision in one line:** NVMe 4 for your first agent; NVMe 8 when containers multiply; NVMe 16 only when a local model or a commerce stack forces it.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Agent dies when you close the SSH window | Process attached to the session | Run under systemd (Part 7, step 4) or `tmux` at minimum |
| Agent killed overnight, logs end abruptly | OOM killer; agent + memory + containers exceed RAM | Add swap as a cushion, trim the stack, or move up a tier |
| 502 from your domain, agent is "running" | Proxy pointing at the wrong port, or agent bound to localhost only | Check `proxy_pass` port and the agent's bind address |
| Webhook never fires | Firewall, gateway config, or app not exposing the route | `ufw status`, then the gateway's webhook listener config, then app logs |
| CPU pinned at 100% for minutes at a time | Local model inference (Ollama) on shared-ish CPU; or a runaway loop | Expect CPU-bound inference; cap concurrency; move big models to a hosted API |
| "No space left on device" on a 50–100 GB disk | Models, container layers, and logs | `du -sh /var/lib/docker/*`, prune images, consider NVMe 8+ |
| Agent forgets everything after a restart | Memory store on a container-internal path, not a volume | Mount the pgvector/Chroma data directory as a persistent volume |
| Renewal invoice is 2× the intro price | The promo ended; you are at "the then current rate" | Calendar month 23; re-shop or downgrade before it hits |
| Support says "that's outside infrastructure scope" | Self-managed plan; app layer is yours | Expected; escalate as infrastructure only if the hypervisor is at fault |
| Gift card never arrived | Promo terms and timing | Check the offer's terms at checkout; chase support with the order number |
| Agent works, but only from your laptop | Cloud firewall / gateway auth blocking external calls | Verify the public endpoint with `curl` from a different network |

---

## Video Library

YouTube **search** links only — pricing and catalog pages change too fast for fixed links.

| Search | What you'll find |
|---|---|
| [Bluehost VPS review](https://www.youtube.com/results?search_query=Bluehost+VPS+review) | Honest third-party walkthroughs of the platform |
| [OpenClaw tutorial](https://www.youtube.com/results?search_query=OpenClaw+tutorial) | Setting up the flagship agent |
| [self-host n8n VPS](https://www.youtube.com/results?search_query=self+host+n8n+VPS) | Always-on workflows and webhooks |
| [Claude Code on a VPS](https://www.youtube.com/results?search_query=Claude+Code+on+a+VPS) | Persistent coding-agent environments |
| [Ollama VPS CPU inference](https://www.youtube.com/results?search_query=Ollama+VPS+CPU+inference) | What local models actually feel like without a GPU |
| [systemd service node app](https://www.youtube.com/results?search_query=systemd+service+node+app) | The "always-on" skill, taught properly |
| [nginx reverse proxy node](https://www.youtube.com/results?search_query=nginx+reverse+proxy+node) | Fronting your agent with a domain and SSL |
| [pgvector tutorial](https://www.youtube.com/results?search_query=pgvector+tutorial) | The memory store, from the database up |
| [Ubuntu VPS hardening](https://www.youtube.com/results?search_query=Ubuntu+VPS+hardening) | First-hour security for a root-access box |
| [n8n webhook always on](https://www.youtube.com/results?search_query=n8n+webhook+always+on) | Reliable webhook patterns |

---

## Written References & Docs

| Source | URL |
|---|---|
| Agent Hosting (the product page) | `https://www.bluehost.com/agent-hosting` |
| Self-Managed VPS (the hardware line) | `https://www.bluehost.com/vps-hosting` |
| OpenClaw VPS | `https://www.bluehost.com/vps-hosting/openclaw` |
| n8n VPS | `https://www.bluehost.com/vps-hosting/n8n` |
| Claude Code VPS | `https://www.bluehost.com/vps-hosting/claude-code` |
| Hermes Agent VPS | `https://www.bluehost.com/vps-hosting/hermes-agent` |
| Managed VPS (the "I don't want to be the sysadmin" option) | `https://www.bluehost.com/vps-hosting/managed` |
| Shared hosting (for contrast — what agents can't live on) | `https://www.bluehost.com/hosting/shared` |
| Best open-source AI agent frameworks (Bluehost blog) | `https://www.bluehost.com/blog/best-open-source-ai-agent-frameworks/` |
| n8n AI agent guide (Bluehost blog) | `https://www.bluehost.com/blog/n8n-ai-agent/` |
| Terms of Service (the 25%/90-second clause) | Linked from the footer of every Bluehost page |
| Server status | Linked from the Support menu on bluehost.com |
| Internet Archive snapshots used for verification | `https://web.archive.org/web/*/bluehost.com/agent-hosting` |

---

## Glossary

| Term | Meaning |
|---|---|
| **Agent Hosting** | Bluehost's umbrella product: self-managed VPS + agent catalog + vector memory + API gateway |
| **Self-managed VPS** | A virtual machine with root access where you run the OS and everything above it |
| **Managed VPS** | A VPS where Bluehost handles updates and monitoring for you |
| **Intro price** | Promotional monthly rate, tied to a 24- or 36-month term |
| **Renewal price** | The rate after the promo term, at "the then current rate" |
| **Due today** | Intro price × term length, charged up front |
| **KVM isolation** | Hardware-level virtualization giving each VPS dedicated CPU/RAM allocations |
| **NVMe SSD** | High-throughput storage protocol; the Claude Code page cites >3,000 MB/s |
| **Root access** | The master key to the server; required for installing anything |
| **Persistent vector memory** | An embeddings store (pgvector or Chroma) that survives restarts |
| **pgvector** | Postgres extension for vector similarity search |
| **Chroma** | Open-source vector database, the alternative memory option |
| **API gateway** | Front door for HTTP: auth, rate limits, transforms, webhook listeners |
| **Zero cold start** | Process stays warm 24/7; no serverless-style wake-up delay |
| **Unmetered bandwidth** | No per-GB billing, subject to the Terms of Service resource clause |
| **25%/90-second clause** | ToS limit on sustained system-resource use; the fine print that matters for hot workloads |
| **99.99% uptime SLA** | Uptime promise with a modest credit remedy (5% of one month, claimed within 30 days) |
| **OpenClaw** | Self-hosted agent framework with messaging integrations and RBAC |
| **Hermes Agent** | Agent-first assistant with persistent memory and reusable skills |
| **n8n** | Visual workflow automation tool, first-class on this platform |
| **Claude Code** | Anthropic's terminal-first coding agent; needs its own account |
| **GatorClaw / NanoClaw** | Bluehost-adjacent agent tools in the one-click catalog |

---

## FAQ & Next Steps

**Is Agent Hosting a different product from the Self-Managed VPS?** Same hardware, different wrapper and landing pages. The agent layer adds the curated catalog, the vector memory store, the API gateway, and agent-shaped copy. The prices differ between the two paths, so compare carts.

**Can I run an agent on the $3.99 shared plan instead?** No. Shared hosting is pooled, managed, and built for websites. Agents need allocated resources, root, and a process supervisor — the VPS line exists for exactly this reason.

**What will I actually pay?** Whatever the cart says, times 24. Then whatever the renewal rate says after that. The two numbers to record in your notes: intro × term = due today, and renewal rate = your future bill.

**Do I need a GPU?** Only for local model inference. Hosted model providers (Anthropic, OpenAI, OpenRouter) work fine from these boxes — Bluehost's own FAQ says so.

**Can I run several agents on one server?** Yes — their FAQ explicitly blesses n8n + OpenClaw + Claude Code on one persistent environment, recommending containers, services, ports, or subdomains to keep runtimes separate.

**Is this cheaper than a bare VPS elsewhere?** Sometimes, for 24 months, at promo prices — the agent-page NVMe 4 at $7.70/mo is genuinely competitive. The renewal prices are less so. You are buying the catalog, the extras, and the brand's support org; price the alternative honestly and decide what that is worth.

**What should I read next in this series?**

- [The Local, On-Device AI Stack](04-local-on-device-ai-stack.html) — the model side of "pair it with a private local model."
- [Prompt Injection & Agent Security](02-prompt-injection-agent-security.html) — read before you expose any agent to the open web.
- [Containers & Dev Environments on macOS](07-containers-dev-environments-macos.html) — the container instincts that keep a multi-agent VPS sane.
- [Graphify + Obsidian: An AI Agent Guide](graphify-obsidian-ai-agent-guide.html) — agent workflows for knowledge work.
- [The Linear + opencode Workflow](linear-opencode-workflow.html) — what a terminal-first coding agent workflow looks like in practice.

---

## Verification Note

Verified in September 2026 against Bluehost's own pages where reachable, and against Internet Archive snapshots where the live site served a bot challenge. Specifically: the shared hosting page (snapshot 19 September 2026) for the shared tiers, money-back terms, free-domain policy, and SLA credit language; the Self-Managed VPS page (snapshot 23 September 2026) for the main price list, specifications, catalog, cPanel add-on, and support scope; the Agent Hosting page (snapshots 22 April and 1 July 2026 — identical) for the specification table, badges, use cases, FAQ answers, and the $7.70/$9.35 pricing cards, including the placeholder values ("$xx", "Save XX%", "$x.xx") that shipped in its template; the OpenClaw, Hermes Agent, and Claude Code VPS pages (snapshots 1 July, 3 May, and 17 June 2026 respectively) for the agent-page price list, per-app FAQs, and claims such as "Best VPS, April 2026" and "NVMe storage >3,000 MB/s."

Promotional pricing rotates frequently — every price in this paper is dated in the text for that reason. Renewal prices and the Terms of Service clause are the stable anchors; where a detail was not on any page (backups, HA, refunds on VPS plans), the paper says "not advertised" rather than guessing. Nothing has been invented.

---

## Your Setup Notes

```text
THE DECISION
  Which page am I buying from?       VPS page / agent page / other: ________
  Tier chosen:                       NVMe 2 / 4 / 8 / 16
  Intro price recorded:              $________ /mo
  Renewal price recorded:            $________ /mo
  Term:                              ＿＿ months
  Due today (intro x term):          $________
  Cart screenshot saved:             [ ]

THE AGENT
  App (catalog or custom):           ____________________
  Model provider + keys stored:      ____________________
  Memory store:                      pgvector / Chroma / none
  API gateway configured:            [ ] domain: ____________________

THE BORING STUFF THAT SAVES YOU
  SSH keys installed, password auth off:   [ ]
  ufw enabled:                             [ ]
  Unattended upgrades on:                  [ ]
  systemd service name:                    ____________________
  Health-check URL + monitor:              ____________________
  Backups run where:                       ____________________
  Restore tested on:                       ____________________

THE CALENDAR
  Month 23 reminder to re-shop renewal:    [ ] date: ____________
  Disk/RAM review (df -h, htop):           monthly on the ____th
```

---

## Bonus — Handoff Prompt

```text
Extend an existing long-form technical paper for a semi-technical reader named Chris. He is
comfortable on a terminal, runs AI coding agents daily, takes notes in Markdown, and learns by
doing. He is evaluating Bluehost's "Agent Hosting" (and the OpenClaw / n8n / Claude Code / Hermes
Agent VPS pages) as a place to run always-on agents, and he asked the practical questions first:
what does the price actually mean, what is included, and what can actually run on it.

Paper: markdown_docs/24-bluehost-agent-hosting.md
Topic: Bluehost Agent Hosting — the self-managed VPS line beneath the agent-branded wrapper;
intro vs renewal vs "due today" pricing; included features (root SSH, dedicated IP, DDoS,
unmetered bandwidth, 99.99% SLA, five data centers, one-click catalog, pgvector/Chroma memory,
API gateway, zero cold start); what runs (any Linux framework; the catalog's 45 apps); sizing
guidance per workload; the honest kinks (placeholder prices on the agent page, price drift
between landing pages, renewal shock, support-scope asterisks, the 25%-of-resources-for-90-
seconds ToS clause, no GPUs); and a working deploy skeleton (hardening, systemd, nginx, certbot,
pgvector, cron, backups).

Match the house style: title "# The Complete Guide: <Topic>"; blockquote one-liner, then
"Last verified: <Month Year>", then "Series: Chris Wander · New Paper Series"; order = Big
Picture (ASCII diagram + analogy table) → 60-Second Version → Prerequisites → numbered
"## Part N — Title" sections → Cheat Sheet → Troubleshooting → Video Library (YouTube SEARCH
links only) → Written References & Docs → Glossary → FAQ & Next Steps → Verification Note →
Your Setup Notes → Bonus — Handoff Prompt. Pure Markdown, no HTML. Every fence language-tagged.

Do whichever Chris asks: (A) expand a Part (e.g., a full multi-agent deploy walkthrough on
NVMe 8, a cost model vs Hetzner/Fly/Railway at renewal prices, or a security hardening deep
dive for an internet-facing agent); (B) add a Part he names; (C) turn Part 7 into a
step-by-step checklist for his actual server and return exact commands and config diffs.

Rules: never invent prices, specs, ToS claims, or feature promises. Re-verify each against
the live pages (bluehost.com/agent-hosting, /vps-hosting, /vps-hosting/{openclaw,n8n,
claude-code,hermes-agent}) or, when the live site bot-challenges, against Internet Archive
snapshots — and date every price in the text. Distinguish intro from renewal pricing and
"advertised" from "included." Keep the structure. Report path, one-line summary, word count.

Anchors (verified September 2026) — reuse and re-verify:
https://www.bluehost.com/agent-hosting
https://www.bluehost.com/vps-hosting
https://www.bluehost.com/vps-hosting/openclaw
https://www.bluehost.com/vps-hosting/n8n
https://www.bluehost.com/vps-hosting/claude-code
https://www.bluehost.com/vps-hosting/hermes-agent
https://www.bluehost.com/vps-hosting/managed
https://www.bluehost.com/hosting/shared
https://www.bluehost.com/blog/best-open-source-ai-agent-frameworks/
https://www.bluehost.com/blog/n8n-ai-agent/
https://web.archive.org/web/*/bluehost.com/agent-hosting
```
