# The Complete Guide: Postgres as the Whole Backend

> One Postgres instance can be your relational store, your document store, your vector store, your search engine, your job queue, and your tenant firewall — if you know which knobs to turn.

Last verified: September 2026
Series: Chris Wander · New Paper Series

---

## The Big Picture

You are building a Next.js + Postgres SaaS. The default move is to sign up for four or five vendors: Neon or Supabase for the database, a vector store for RAG, Redis for caching and queues, Inngest for durable workflows, maybe a hosted search engine. Every one of those vendors is a dashboard, an API key, a bill, a status page, a data-residency conversation, and a copy of your data that can drift out of sync with the source of truth.

Postgres already ships — or accepts as an extension — most of what those vendors sell. The trick is not that Postgres is *better* at each job. The trick is that one system you already run and already back up can do a good-enough version of all of them, and "good enough, in the database you already operate" beats "world-class, in a system you now have to operate."

```
                         ┌──────────────────────────────────────────────┐
                         │           ONE POSTGRES INSTANCE              │
                         │                                              │
   Next.js Server  ───▶  │  ┌────────────┐  ┌──────────────────────┐    │
   Actions / Routes      │  │ Relational │  │ JSONB documents      │    │
   (via pooler)          │  │ tables     │  │ (semi-structured)    │    │
                         │  └────────────┘  └──────────────────────┘    │
                         │  ┌────────────┐  ┌──────────────────────┐    │
                         │  │ vector /   │  │ tsvector + pg_trgm   │    │
                         │  │ halfvec    │  │ (keyword + fuzzy)    │    │
                         │  └────────────┘  └──────────────────────┘    │
                         │  ┌────────────┐  ┌──────────────────────┐    │
                         │  │ job queue  │  │ ROW-LEVEL SECURITY   │    │
                         │  │ SKIP LOCKED│  │ tenant_id policies   │    │
                         │  │  / pgmq    │  │                      │    │
                         │  └────────────┘  └──────────────────────┘    │
                         │   GIN · HNSW · GiST · B-tree indexes          │
                         │   WAL · backups · PITR · one connection pool  │
                         └──────────────────────────────────────────────┘

   REPLACES (for a typical SaaS):          YOU MAY STILL ADD:
     • separate vector DB                    • object storage (big blobs)
     • hosted search engine                  • durable step-function engine
     • Redis list/BullMQ queue               • edge cache / CDN
     • application-level tenant filters      • analytics warehouse
```

Here is the mapping you will come back to:

| Postgres capability | Replaces | Honest caveat |
|---|---|---|
| Tables + foreign keys | Primary OLTP database | None. This is the core job. |
| JSONB + GIN | MongoDB / document store | Schema-on-read means you enforce shape yourself. |
| pgvector (`vector`, `halfvec`) | Pinecone / Weaviate / Qdrant | No dedicated ANN hardware; recall tuning is on you. |
| `tsvector` + `pg_trgm` | Algolia / Elasticsearch (basic) | Not a relevance-tuning platform; no typo-tolerant fuzzy at massive scale. |
| `SELECT … FOR UPDATE SKIP LOCKED` | Redis + BullMQ / sidekiq | You build retries and dashboards yourself. |
| pgmq extension | SQS / RSMQ | No built-in step functions or workflow visualization. |
| Row-level security | App-layer `WHERE tenant_id = …` | Session-variable plumbing; does not survive naive pooling. |
| One connection pooler | N× connection limits per vendor | Transaction-mode pooling has feature restrictions. |

The point of this paper is not "cancel everything." It is: know the shape of the boundary. You should consolidate aggressively, but you should consolidate *knowingly*.

---

## The 60-Second Version (TL;DR)

- **JSONB** gives you a document store inside the same transaction as your relational data. Index it with GIN, query it with containment (`@>`), containment-in-reverse (`<@`), and `jsonb_path_query`. Do not let "just add a field" replace schema design.
- **pgvector** stores embeddings as `vector(n)`. The `vector` type indexes up to **2,000 dimensions**; above that, store as `halfvec` (16-bit) which indexes up to **4,000**. `text-embedding-3-large` is 3,072 dims — that means halfvec.
- **HNSW is the default index.** It is a navigable graph with no training step, best query-time recall. It costs more memory (~1.5–2× raw vector bytes) and slower builds. **IVFFlat** builds roughly 5–6× faster with lower memory but needs representative training data and degrades when the distribution drifts.
- Tune the query knob: `hnsw.ef_search` (default **40**; ~100 ≈ 95% recall@10, ~200 ≈ 98–99%). Set `maintenance_work_mem` to 2–8GB for builds. Use `CREATE INDEX CONCURRENTLY`.
- **Full-text search** (`tsvector`, GIN) plus **`pg_trgm`** covers keyword search and typos. You can run vector and keyword retrieval in the same query and fuse with **reciprocal rank fusion (RRF)**.
- **Queues**: `SELECT … FOR UPDATE SKIP LOCKED` is the primitive. **pgmq** packages it with visibility timeouts and archives. You lose step functions, retries-with-backoff-as-a-feature, and dashboards.
- **RLS** enforces tenant isolation in the database. Set the tenant with `set_config('app.tenant_id', …, true)` per transaction. Beware: table owners and `BYPASSRLS` roles bypass it, and PgBouncer transaction mode breaks session-level `SET`.
- **Serverless + Postgres needs a pooler.** Neon uses PgBouncer transaction mode; Supabase uses Supavisor. Use pooled connections for app traffic, direct connections for migrations and `pg_dump`.

---

## Prerequisites

- A working Postgres you can connect to — local Docker, Neon, Supabase, or self-hosted. Postgres 15+ recommended for the features below; pgvector supports Postgres 13+.
- `psql` on your terminal (`brew install libpq` on macOS, then add it to PATH) or any SQL client.
- Basic SQL: `SELECT`, `INSERT`, `CREATE TABLE`, `WHERE`, `JOIN`. You have this.
- Basic Next.js knowledge: server actions or route handlers, and the ability to set an environment variable.
- Optional but useful: a way to produce embeddings. Any embedding API or a local model. The SQL below does not care where the numbers come from.

Create a scratch database. If you use Docker:

```bash
docker run --name pgtest -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:17
psql "postgres://postgres:postgres@localhost:5432/postgres"
```

**Verify in the Postgres docs: CREATE EXTENSION** for how extension installation works on your platform, and **search: pgvector installation** for the correct package for your version (v0.8.x line as of this writing).

---

## Part 1 — Why Consolidate (And When Not To)

### Step 1: Count your actual vendors

Write down every service your app talks to. For the SaaS described in the brief, the "obvious" stack is: database (Neon/Supabase), vector store, Redis, Inngest, and possibly a search service. That is four or five systems, each with:

- its own connection lifecycle and failure modes;
- its own auth model and secret rotation;
- its own backup/restore story (and often no transactional guarantee with the primary DB);
- its own bill, plus the engineering cost of keeping data in sync.

### Step 2: Separate "hard" from "convenient"

Ask of each service: *is this doing something Postgres cannot do, or something Postgres can do adequately but more conveniently elsewhere?*

- **Pinecone/Weaviate**: Postgres can do it (pgvector). Convenience is real at 100M+ vectors, but you are not there.
- **Redis as a cache**: Postgres is not a cache. If you need sub-millisecond hot reads, keep Redis.
- **Redis/BullMQ as a queue**: Postgres can do it. You lose ergonomics, not capability, until throughput gets serious.
- **Inngest**: This is the interesting one — it offers durable step functions, automatic retries, and a visual run log. Postgres gives you a durable queue and retries you implement. See Part 6 for the honest comparison.
- **Elasticsearch**: For basic keyword search, Postgres full-text is enough. For relevance engineering, synonyms at scale, and typo tolerance on large corpora, a search engine earns its keep.

### Step 3: Price the operational surface

The real cost of a vendor is not the monthly fee — it is the incident. A single Postgres means one thing to page on. Five vendors means five "is it us or them?" investigations and five status pages.

### Step 4: Be honest about the breaking points

Consolidate by default. But add a service when **one** of these is true:

1. **Volume beats the single node.** If you genuinely have hundreds of millions of vectors or billions of searchable documents, a specialized system will win on cost and latency.
2. **Durability semantics you cannot build.** Multi-step workflows with compensation, long-running timers, fan-out/fan-in, and human-in-the-loop pauses are genuinely nicer in a workflow engine.
3. **A different access pattern dominates.** Analytical scans over the same tables will fight your OLTP workload; a warehouse or read replica earns its keep.
4. **Compliance requires isolation.** Sometimes a separate store is a contractual or regulatory requirement, not a technical one.

Everything else is a candidate for absorption. The rest of this paper is the absorption toolkit.

> **Cost note:** Moving from N vendors to 1 typically shifts spend toward a larger database instance. A bigger Neon/Supabase compute tier plus extension support can cost more than a small dedicated vector store did. The win is engineering time and operational simplicity, not always the invoice. Date-check pricing: vendor pricing pages change; treat any number you read as a vendor claim.

---

## Part 2 — JSONB: Documents Without a Second Database

### When to normalize, when not to

Normalize when you query, filter, join, or enforce constraints on a field. Use JSONB when the shape is genuinely variable and you mostly read the whole blob back.

Good JSONB candidates: third-party webhook payloads you replay; per-tenant integration settings; AI metadata such as model name, token counts, and retrieval provenance; feature flags; audit event payloads.

Bad candidates: anything you filter frequently, anything with referential integrity, anything whose shape you will regret in six months. The classic failure: `settings JSONB` becomes your schema, nobody documents it, and every query does `settings->>'x'`.

### Create and index

```sql
CREATE TABLE events (
  id          bigserial PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  kind        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Default GIN index: supports @>, ?, ?|, ?&
CREATE INDEX events_payload_gin ON events USING gin (payload);

-- For scalar lookups on a known path, an expression B-tree is cheaper than GIN
CREATE INDEX events_model_btree
  ON events ((payload->>'model'));
```

`jsonb_ops` is the default GIN operator class and supports the broadest set of operators. `jsonb_path_ops` produces a smaller, faster index but **only** supports `@>`. Choose based on which operators you actually use.

### Containment operators

```sql
-- Does payload contain these keys/values?
SELECT id FROM events WHERE payload @> '{"model": "gpt-x", "cached": true}';

-- Is this object contained by payload? (reverse containment)
SELECT id FROM events WHERE payload <@ '{"a":1,"b":2}'::jsonb;

-- Key existence
SELECT id FROM events WHERE payload ? 'error';

-- Any of these keys / all of these keys
SELECT id FROM events WHERE payload ?| array['error','warning'];
SELECT id FROM events WHERE payload ?& array['error','code'];
```

### SQL/JSON path queries

Postgres ships a SQL/JSON path engine. This is how you ask structured questions of nested documents without exploding them into columns:

```sql
SELECT id, jsonb_path_query(payload, '$.items[*].sku') AS sku
FROM events
WHERE payload @> '{"kind": "order"}';

-- Filtering inside the path expression (note: @? means "does path match?")
SELECT id
FROM events
WHERE payload @? '$.items[*] ? (@.qty > 10)';

-- Extract one value
SELECT payload #>> '{error,code}' AS error_code FROM events;
```

`jsonb_path_query` returns a set (use in the `SELECT` list or `FROM`). The `@?` operator tests whether a path returns any item; `@@` tests whether a path predicate is true. **Verify in the Postgres docs: JSON Functions and Operators** for the full path syntax, because it is large.

### Schema-on-read pitfalls

- **No constraints.** Nothing stops `{"qty": "ten"}` where you expected a number. Add a `CHECK` for critical shapes: `CHECK (jsonb_typeof(payload->'qty') = 'number')`.
- **No statistics.** The planner does not know your document shapes. Complex JSONB predicates can plan badly. `EXPLAIN (ANALYZE, BUFFERS)` is your friend.
- **Index bloat.** GIN indexes on write-heavy JSONB tables grow fast. Watch `pg_stat_user_indexes` and plan `REINDEX CONCURRENTLY`.
- **Type discipline.** JSON has one number type; Postgres distinguishes `int`/`numeric`. Big integers can lose precision through `jsonb` in some paths. Keep identifiers as real columns.

Rule of thumb: **JSONB for the edges, columns for the core.** If you filter on it, it should probably be a column.

---

## Part 3 — pgvector Fundamentals

### Types

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id         bigserial PRIMARY KEY,
  content    text NOT NULL,
  embedding  vector(1536),          -- float32, up to 16,000 dims for storage
  embedding_half halfvec(3072)      -- float16, for high-dimension indexing
);
```

- `vector(n)` — 32-bit floats. Storage works to 16,000 dims, but **indexes cap at 2,000 dims** for `vector`.
- `halfvec(n)` — 16-bit floats. Roughly half the storage, and **indexes work up to 4,000 dims**. This is the escape hatch for 3,072-dim embeddings like `text-embedding-3-large`.
- `bit(n)` — binary vectors, indexable to 64,000 dims, for binary quantization.
- `sparsevec(n)` — up to 1,000 non-zero elements.

> **The 2,000-dimension ceiling is a page-size artifact.** Postgres pages are 8KB; a 32-bit vector entry must fit alongside other index data, so ~2,048 floats is the practical ceiling for the `vector` opclass. `halfvec` halves the width and raises the indexed ceiling to 4,000. This is why high-dimensional embedding models force you toward halfvec or quantization.

### Distance operators and functions

| Operator | Distance | Use with opclass |
|---|---|---|
| `<->` | L2 / Euclidean | `vector_l2_ops` / `halfvec_l2_ops` |
| `<#>` | Negative inner product | `vector_ip_ops` |
| `<=>` | Cosine distance | `vector_cosine_ops` |
| `<+>` | L1 / taxicab (0.7.0+) | `vector_l1_ops` |

Cosine distance is the most common for text embeddings, because most embedding models are trained for cosine similarity. If your vectors are already normalized, L2 and cosine rank identically.

```sql
-- Nearest neighbors by cosine distance
SELECT id, content
FROM documents
ORDER BY embedding <=> '[0.01, 0.02, ...]'::vector
LIMIT 10;
```

By default this is **exact** nearest neighbor — perfect recall, and a sequential scan. Fine up to tens of thousands of rows; painful beyond that.

### Distance function consistency

You must index and query with the **same** distance function. An index built with `vector_cosine_ops` will not accelerate an `<->` query. If you want two distance functions, you need two indexes.

```sql
CREATE INDEX documents_embedding_hnsw
  ON documents USING hnsw (embedding vector_cosine_ops);

-- Filtering is applied AFTER the index scan. This matters. See Part 4.
SELECT id FROM documents
WHERE tenant_id = $1
ORDER BY embedding <=> $2
LIMIT 10;
```

**pgvector version note:** HNSW was added in **0.5.0**; iterative index scans arrived in **0.8.0**. Confirm your server's version:

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

**Verify in the pgvector docs: pgvector/pgvector README, "Indexing" and "Querying"** — operator/opclass lists change between releases.

---

## Part 4 — Index Choice: HNSW vs IVFFlat

This is the single most consequential pgvector decision. There is a default, and there is one legitimate reason to deviate.

### HNSW (Hierarchical Navigable Small Worlds)

HNSW builds a multi-layer navigable graph. Search enters at the top (coarse), descends through regional layers, and explores the detailed bottom layer. There is **no training step**, so you can build the index on an empty table. It has the best query-time speed/recall tradeoff. The prices are memory (~1.5–2× the raw vector bytes) and build time.

```sql
SET maintenance_work_mem = '4GB';
SET max_parallel_maintenance_workers = 4;

CREATE INDEX CONCURRENTLY documents_embedding_hnsw
  ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Build knobs:

- `m` — max connections per layer. Default **16**. Higher = better recall, more memory, slower build. For 1M+ rows, **32–64** is a common production setting.
- `ef_construction` — size of the build-time candidate list. Default **64**. Higher = better graph quality, slower build. For large sets, **128–256**.

> **Memory warning:** `maintenance_work_mem` bounds the in-memory build phase. If the graph does not fit, pgvector spills to disk and build time degrades sharply. 2–8GB is a reasonable range for non-trivial tables — but do not set it so high that you exhaust server memory alongside everything else running. Track progress with `pg_stat_progress_create_index`. Long builds on live tables should use `CREATE INDEX CONCURRENTLY`, and remember that concurrent index builds cannot run inside a transaction block.

Query knob:

- `hnsw.ef_search` — size of the query-time candidate list. Default **40**. Raising it trades latency for recall. Empirically, ~**100 ≈ 95% recall@10** and ~**200 ≈ 98–99%** (numbers depend on dataset; measure yours).

```sql
SET hnsw.ef_search = 100;
SELECT id FROM documents ORDER BY embedding <=> $1 LIMIT 10;
```

**Iterative index scans (0.8.0+)** matter for filtered queries. Because filtering happens after the index scan, a selective `WHERE` can return far fewer rows than `LIMIT` asked for. With `ef_search = 40` and a predicate matching 10% of rows, you average ~4 matches. Iterative scans automatically scan more of the index:

```sql
SET hnsw.iterative_scan = strict_order;   -- exact distance order
-- or relaxed_order for better recall on filtered queries
```

Alternatives for filtered search: **partial indexes** when you filter on a small set of distinct values (`WHERE category_id = 123`), and **partitioning** when there are many. Also index the filter columns normally.

### IVFFlat

IVFFlat clusters vectors into lists via k-means, then searches the nearest lists. It builds faster (~**5–6× faster** than HNSW in reported benchmarks — e.g. roughly 5s vs 29s on 25K 3,072-dim vectors) and uses less memory, but has lower query-time speed/recall, requires **training data at build time**, and degrades when the distribution drifts (centroid drift).

```sql
SET maintenance_work_mem = '4GB';
CREATE INDEX documents_embedding_ivf
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

- `lists` — number of clusters. Rough guidance: rows/1000 up to 1M rows, rows/10000 above that. Confirm current guidance in the pgvector README — it has changed slightly between versions.
- `ivfflat.probes` — lists to search at query time. More probes = better recall, slower.

Build rules: index **after** loading initial data (it needs rows to train on). If recall silently drops, or you have inserted a large fraction of new rows since the last build (a ~30% signal is often cited), `REINDEX` to refresh centroids.

> **Destructive-adjacent operation:** `REINDEX` of a large IVFFlat index is a heavy operation. Use `REINDEX INDEX CONCURRENTLY` where supported, and monitor `pg_stat_progress_create_index`. Plan it for a maintenance window.

### The decision rule

**Start with HNSW unless you have a reason not to.** Choose IVFFlat when build time or memory is the binding constraint, the workload is write-heavy or bulk-loaded, or the corpus is mostly static and known.

### Measure recall, not just latency

Approximate = approximate. Validate:

```sql
-- Exact (ground truth) — force a seq scan to bypass the ANN index
SET enable_indexscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM documents ORDER BY embedding <=> $1 LIMIT 10;
```

Compare the top-10 IDs from the exact plan against the indexed plan. Compute recall@10 = (overlap / 10). Do this on a sample of real queries at the `ef_search` you intend to ship. Latency without recall is meaningless — a fast wrong answer is still wrong.

---

## Part 5 — Full-Text Search, pg_trgm, and Hybrid Retrieval

### Full-text search

Postgres has a real FTS engine: `tsvector` (documents) and `tsquery` (queries), with GIN indexes. It handles stemming, stop words, and ranking.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE documents
  ADD COLUMN content_fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX documents_fts_gin ON documents USING gin (content_fts);

-- Ranked keyword search
SELECT id, content,
       ts_rank_cd(content_fts, query) AS rank
FROM documents, plainto_tsquery('english', $1) query
WHERE content_fts @@ query
ORDER BY rank DESC
LIMIT 20;
```

`to_tsquery` takes an explicit query with operators (`&`, `|`, `!`, `<->`); `plainto_tsquery` parses plain user input safely; `websearch_to_tsquery` mimics search-engine syntax. Prefer the latter two for user input.

### Typo tolerance with pg_trgm

FTS is lexeme-exact after stemming. It does not match `postgre` to `postgres`. Trigram similarity does:

```sql
-- GIN index for fast similarity / LIKE queries
CREATE INDEX documents_content_trgm ON documents USING gin (content gin_trgm_ops);

-- Similarity search
SELECT content, similarity(content, $1) AS sim
FROM documents
WHERE content % $1          -- % is the similarity threshold operator
ORDER BY sim DESC
LIMIT 10;

-- Set the threshold (default ~0.3)
SET pg_trgm.similarity_threshold = 0.2;
```

Trigram indexes also accelerate `LIKE '%foo%'` and `ILIKE` queries — a capability a plain B-tree cannot provide.

### Hybrid retrieval with reciprocal rank fusion

The reason to keep keyword search alongside vectors: **they fail differently.** Vector search misses exact identifiers, SKUs, and rare proper nouns; keyword search misses paraphrase and synonym. Run both, fuse the rankings.

RRF scores each document by `sum(1 / (k + rank))` across result lists. It is robust and needs no score calibration — you never have to normalize a cosine distance against a `ts_rank`. A common `k` is 50–60.

```sql
WITH semantic AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY embedding <=> $1) AS rank
  FROM documents
  WHERE tenant_id = $3
  ORDER BY embedding <=> $1
  LIMIT 50
),
keyword AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY ts_rank_cd(content_fts, plainto_tsquery('english', $2)) DESC
         ) AS rank
  FROM documents
  WHERE tenant_id = $3
    AND content_fts @@ plainto_tsquery('english', $2)
  ORDER BY ts_rank_cd(content_fts, plainto_tsquery('english', $2)) DESC
  LIMIT 50
)
SELECT COALESCE(s.id, k.id) AS id,
       COALESCE(1.0 / (60 + s.rank), 0.0)
     + COALESCE(1.0 / (60 + k.rank), 0.0) AS score
FROM semantic s
FULL OUTER JOIN keyword k ON s.id = k.id
ORDER BY score DESC
LIMIT 10;
```

Both halves of this hybrid query live in one database, one transaction, one connection, one backup. That is the core argument for consolidation: you are not synchronizing a vector index and a search index through a message bus.

**Practical note:** if a lexical step already narrows to a few hundred candidates, you can skip the ANN index entirely and rerank exactly with `ORDER BY embedding <=> $1` over just those rows. That is often simpler and gives exact recall within the candidate set.

**Verify in the Postgres docs: Full Text Search (Chapter 12) and pg_trgm** for ranking functions and operator semantics.

---

## Part 6 — In-Database Queues (and What You Give Up)

### The primitive: FOR UPDATE SKIP LOCKED

Postgres can be a reliable work queue with one locking pattern. It has been production-grade for years.

```sql
CREATE TABLE jobs (
  id          bigserial PRIMARY KEY,
  queue       text NOT NULL DEFAULT 'default',
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'queued',
  run_at      timestamptz NOT NULL DEFAULT now(),
  attempts    int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  locked_by   text,
  locked_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobs_dequeue ON jobs (queue, run_at)
  WHERE status = 'queued';
```

Claim a batch atomically. `SKIP LOCKED` means concurrent workers skip rows another transaction has locked instead of blocking:

```sql
WITH claimed AS (
  SELECT id
  FROM jobs
  WHERE status = 'queued' AND run_at <= now()
  ORDER BY run_at, id
  LIMIT 5
  FOR UPDATE SKIP LOCKED
)
UPDATE jobs j
SET status = 'running',
    locked_by = $1,
    locked_at = now(),
    attempts = j.attempts + 1
FROM claimed
WHERE j.id = claimed.id
RETURNING j.*;
```

Complete or fail:

```sql
UPDATE jobs SET status = 'done', locked_by = NULL WHERE id = $1;

-- Retry with backoff, or dead-letter
UPDATE jobs
SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
    run_at = now() + (interval '1 minute' * power(2, attempts)),
    locked_by = NULL
WHERE id = $1;
```

Add a **visibility timeout** sweep for crashed workers — reclaim rows `running` with a stale `locked_at`.

### pgmq

pgmq packages this pattern as an extension. Per its docs, every queue is a table `pgmq.q_<name>`, with API parity to SQS/RSMQ:

```sql
CREATE EXTENSION IF NOT EXISTS pgmq;

SELECT pgmq.create('emails');

SELECT pgmq.send(queue_name => 'emails',
                  msg => '{"to":"a@b.com","template":"welcome"}');

-- Read 2 messages, invisibility timeout 30s
SELECT * FROM pgmq.read(queue_name => 'emails', vt => 30, qty => 2);
SELECT pgmq.archive(queue_name => 'emails', msg_id => 1);
```

It provides "exactly once delivery within a visibility timeout," delays, archives for replay, and (in recent versions) FIFO with message group keys and partitioning for large queues. It is used by Tembo and Supabase, among others. Version cadence is active (1.13.x line as of September 2026).

### Honest comparison to Inngest / Redis

| Concern | Postgres queue | Inngest | Redis + BullMQ |
|---|---|---|---|
| Durability | Full ACID, same WAL/backups as your data | Vendor-managed durable store | Depends on Redis persistence config |
| Retries | You implement backoff | First-class, configurable | Built-in |
| Step functions / sleep / fan-out | You build it (state machine in a table) | Core feature | Limited; you build it |
| Dashboard / run history | You build it (or query the table) | Built-in | UI available |
| Throughput ceiling | Lower; writes compete with app traffic | Scales independently | Very high |
| Transactional enqueue | **Yes** — enqueue in the same tx as the data change | No (outbox pattern needed) | No |
| Ops surface | Zero new vendors | One vendor | One more system |

The transactionally-enqueued job is the killer feature. "Insert the order and enqueue the fulfillment job in one transaction" removes an entire class of dual-write bugs. You cannot get that from Redis or Inngest without an outbox table — which is, itself, a Postgres queue.

Where the specialty tools win: **high fan-out workflows with many steps, long timers, and human-in-the-loop pauses**, plus observability you would otherwise build. If your product's value depends on complex orchestration, a workflow engine earns its place. If you have "send an email, resize an image, call the LLM," a table and `SKIP LOCKED` is enough.

> **Cost note:** pgmq is free and open source; you pay only for the Postgres you already run. Inngest and Redis-hosted plans are vendor-priced. Treat any specific figure as a vendor claim and re-check.

---

## Part 7 — Row-Level Security for Multi-Tenant Isolation

This is the capability that lets an agency/white-label tier share one database safely. The alternative — every query remembering `WHERE tenant_id = …` — fails the day someone forgets.

### The pattern

```sql
CREATE TABLE documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  title      text NOT NULL,
  content    text NOT NULL
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

`USING` governs visibility for `SELECT`/`UPDATE`/`DELETE`. `WITH CHECK` governs what `INSERT`/`UPDATE` may write — without it, a tenant could insert a row for another tenant and never see it, corrupting your data invisibly.

Set the tenant per transaction. Use `set_config` with the `is_local` flag (`true`) so it resets at transaction end:

```sql
BEGIN;
SELECT set_config('app.tenant_id', '3fa85f64-5717-4562-b3fc-2c963f66afa6', true);
SELECT * FROM documents;   -- only this tenant's rows
INSERT INTO documents (tenant_id, title, content) VALUES (...);
COMMIT;
```

`current_setting('app.tenant_id', true)` returns `NULL` rather than erroring when unset — which makes the policy deny everything, the safe default. Note the tradeoff: `NULL` never matches, so a missing setting yields zero rows, not an error. Some teams add a `COALESCE`/explicit check to fail loudly.

In a Next.js server action, wrap each unit of work:

```ts
// pseudocode shape: one transaction per request
await sql.begin(async (tx) => {
  await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  return tx`SELECT * FROM documents ORDER BY created_at DESC LIMIT 50`;
});
```

### Pitfalls you will actually hit

- **Owners bypass RLS.** Table owners normally bypass row security, and superusers / `BYPASSRLS` roles always do. If your app connects as the table owner, RLS does nothing. Create a dedicated non-owner application role, and consider `ALTER TABLE documents FORCE ROW LEVEL SECURITY` so even the owner is subject to policies.
- **Pooling kills session-level `SET`.** PgBouncer transaction mode returns connections to the pool after each transaction, so a bare `SET app.tenant_id = …` can leak to the next request or vanish. Use `set_config(..., true)` **inside** the same transaction as the query. Better still, use `SET LOCAL` semantics or configure the role default with `ALTER ROLE app_user SET app.tenant_id = ''` and always override per transaction.
- **Performance.** The policy predicate is added to every plan. Index `tenant_id` on every RLS table. Avoid wrapping the tenant lookup in a `SECURITY DEFINER` function that cannot be evaluated once — repeated per-row function calls have caused severe plan regressions in real reports. Prefer a plain, index-friendly predicate. Test with `EXPLAIN (ANALYZE, BUFFERS)` at realistic data volume.
- **Policies are not grants.** RLS filters rows; it does not grant access. You still need `GRANT SELECT, INSERT, … ON documents TO app_user`. And RLS does not apply to tables without it — a table in an exposed schema with no RLS is wide open to any granted role.
- **Write policies separately.** Write `FOR SELECT`, `FOR INSERT`, `FOR UPDATE`, `FOR DELETE` policies explicitly rather than one `FOR ALL`, so it is obvious what each rule covers. Postgres does not accept multiple operations in one `FOR`.

**Verify in the Postgres docs: CREATE POLICY and Row Security Policies.** Supabase also documents an `auth.uid()` helper and warns that service/secret keys carry `BYPASSRLS` — never ship those to the browser.

---

## Part 8 — Managed vs Self-Host, Pooling, and Serverless

### The three realistic choices

**Neon** — serverless Postgres with separated storage and compute. Two features matter for Next.js: **instant branching** (copy-on-write database branches for preview environments and safe migrations) and **scale-to-zero** (idle compute suspends, cold starts on next connection). It uses PgBouncer in **transaction mode**: pooled string in the hostname with `-pooler`, up to 10,000 client connections at the pooler, with actual concurrent transactions far lower than that. Use pooled for serverless, direct for migrations, `pg_dump`, logical replication, and anything needing session state. (As of a 2026 check, Neon is part of the Databricks platform and markets additional bundled services; treat feature bundles as vendor claims and date-check them.)

**Supabase** — Postgres plus bundled auth, storage, realtime, and a REST layer. The pooler is **Supavisor** with transaction mode (port 6543) and session mode (port 5432); paid plans can add a dedicated PgBouncer. Transaction mode does not support prepared statements or session-level `SET`/`LISTEN`. If you want auth and storage handled, Supabase's bundling is exactly the "one database as the whole backend" thesis taken further.

**Self-host** — a Postgres on a VM or container you own. Maximum control, extension freedom, no vendor limits. You now own backups, PITR, upgrades, and failover. Choose this when compliance, cost at scale, or extension requirements force it — not as a default.

### Why serverless + Postgres needs pooling

Postgres connections are processes. `max_connections` is a hard ceiling — often a few hundred or low thousands depending on instance size. Next.js serverless functions scale horizontally and each invocation may want a connection; without pooling you exhaust the ceiling and get `FATAL: sorry, too many clients already`.

A pooler sits in front and multiplexes many client connections onto few database connections.

| Mode | Behavior | Supports | Use for |
|---|---|---|---|
| Session | One DB connection per client for the session | `SET`, `LISTEN/NOTIFY`, prepared statements, advisory locks | Long-lived servers, migrations |
| Transaction | DB connection shared per transaction | Protocol-level prepared statements (PgBouncer configurable) | **Serverless/edge** |

```bash
# Neon: pooled (serverless) vs direct (migrations)
postgresql://user:pw@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require
postgresql://user:pw@ep-xxx.region.aws.neon.tech/db?sslmode=require
```

**Serverless driver option:** Neon ships a serverless driver that speaks the Postgres wire protocol over HTTP/WebSocket, removing the persistent connection problem for edge runtimes. That is a real architectural advantage for Next.js on Vercel — but note that it is not a drop-in for every library.

Also: pool on the client side. Every serverless invocation opening a fresh pool is itself the problem. Tune `max` per pool, use a singleton pattern in long-lived Node processes, and set `connectionTimeoutMillis`. **Verify in the docs: PgBouncer (features/transaction mode), Neon "Connection pooling", Supabase "Connect to your database".**

---

## Part 9 — A Worked Multi-Tenant Schema

A small agency/white-label SaaS: tenants, users, documents with embeddings and FTS, a job queue, and RLS throughout.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- Tenant & users ----------
CREATE TABLE tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  plan       text NOT NULL DEFAULT 'free'
               CHECK (plan IN ('free','pro','agency')),
  settings   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- JSONB: variable shape
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX app_users_tenant_idx ON app_users (tenant_id);

-- ---------- Documents: vectors + FTS in one row ----------
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  content     text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding   halfvec(1536),                       -- halfvec: storage headroom
  content_fts tsvector GENERATED ALWAYS AS
                (to_tsvector('english', title || ' ' || content)) STORED,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_tenant_idx  ON documents (tenant_id, created_at DESC);
CREATE INDEX documents_fts_gin     ON documents USING gin (content_fts);
CREATE INDEX documents_meta_gin    ON documents USING gin (metadata jsonb_path_ops);
CREATE INDEX documents_title_trgm  ON documents USING gin (title gin_trgm_ops);

-- Vector index: build after initial load, CONCURRENTLY in production
CREATE INDEX documents_embedding_hnsw
  ON documents USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ---------- Job queue ----------
CREATE TABLE jobs (
  id           bigserial PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','running','done','dead')),
  run_at       timestamptz NOT NULL DEFAULT now(),
  attempts     int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  locked_by    text,
  locked_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_dequeue ON jobs (run_at, id) WHERE status = 'queued';

-- ---------- Row-level security ----------
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs       ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant ON app_users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY docs_tenant ON documents
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY jobs_tenant ON jobs
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Application role: NOT the table owner, so RLS applies
CREATE ROLE app_user LOGIN PASSWORD 'change-me';
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON tenants, app_users, documents, jobs TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

Per-request pattern (server action):

```sql
BEGIN;
SELECT set_config('app.tenant_id', $1, true);

-- transactional enqueue: the job and the data change commit together
INSERT INTO documents (tenant_id, title, content, embedding)
VALUES ($1, $2, $3, $4);
INSERT INTO jobs (tenant_id, kind, payload)
VALUES ($1, 'embed-and-index', jsonb_build_object('document_id', lastval()));

COMMIT;
```

Hybrid retrieval for one tenant, with HNSW recall tuned for a filtered query:

```sql
SET LOCAL hnsw.ef_search = 100;
SET LOCAL hnsw.iterative_scan = strict_order;

WITH semantic AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $2::halfvec) AS rank
  FROM documents
  WHERE tenant_id = $1
  ORDER BY embedding <=> $2::halfvec
  LIMIT 50
),
keyword AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY ts_rank_cd(content_fts, plainto_tsquery('english', $3)) DESC
         ) AS rank
  FROM documents
  WHERE tenant_id = $1
    AND content_fts @@ plainto_tsquery('english', $3)
  ORDER BY ts_rank_cd(content_fts, plainto_tsquery('english', $3)) DESC
  LIMIT 50
)
SELECT d.id, d.title,
       COALESCE(1.0/(60+s.rank),0) + COALESCE(1.0/(60+k.rank),0) AS score
FROM semantic s
FULL OUTER JOIN keyword k USING (id)
JOIN documents d ON d.id = COALESCE(s.id, k.id)
ORDER BY score DESC
LIMIT 10;
```

Two notes on this schema:

1. Index only what your queries use. A partial index on `(run_at, id) WHERE status = 'queued'` keeps the dequeue path small and hot.
2. `halfvec_cosine_ops` requires the query vector cast to `$2::halfvec`. The index and the query must agree on type and opclass. If your embedding column is `vector`, use `vector_cosine_ops` and cast accordingly.

---

## Cheat Sheets

### JSONB

| Task | Statement |
|---|---|
| Create GIN index | `CREATE INDEX i ON t USING gin (col);` |
| Path-ops (smaller, `@>` only) | `CREATE INDEX i ON t USING gin (col jsonb_path_ops);` |
| Scalar path B-tree | `CREATE INDEX i ON t ((col->>'k'));` |
| Contains | `col @> '{"k":"v"}'` |
| Contained by | `col <@ '{"k":"v"}'` |
| Key exists | `col ? 'k'` |
| Any / all keys | `col ?| array['a','b']` / `col ?& array['a','b']` |
| Path query (set) | `jsonb_path_query(col, '$.a[*].b')` |
| Path predicate | `col @? '$.a[*] ? (@.n > 3)'` |
| Extract text path | `col #>> '{a,b}'` |

### pgvector

| Task | Statement |
|---|---|
| Extension | `CREATE EXTENSION vector;` |
| Column types | `vector(n)`, `halfvec(n)`, `bit(n)`, `sparsevec(n)` |
| L2 / IP / cosine / L1 | `<->` / `<#>` / `<=>` / `<+>` |
| HNSW index | `CREATE INDEX i ON t USING hnsw (col vector_cosine_ops) WITH (m=16, ef_construction=64);` |
| IVFFlat index | `CREATE INDEX i ON t USING ivfflat (col vector_cosine_ops) WITH (lists=100);` |
| halfvec index | `... USING hnsw (col halfvec_cosine_ops)` |
| Query recall | `SET hnsw.ef_search = 100;` |
| IVFFlat probes | `SET ivfflat.probes = 10;` |
| Iterative scans | `SET hnsw.iterative_scan = strict_order;` |
| Build memory | `SET maintenance_work_mem = '4GB';` |
| Build progress | `SELECT * FROM pg_stat_progress_create_index;` |
| Exact ground truth | `SET enable_indexscan = off;` then `EXPLAIN ANALYZE` |

### Full-text / trigram

| Task | Statement |
|---|---|
| Generated tsvector column | `tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED` |
| GIN index | `CREATE INDEX i ON t USING gin (fts);` |
| Query parse | `plainto_tsquery('english', $1)` / `websearch_to_tsquery(...)` |
| Match | `fts @@ query` |
| Rank | `ts_rank_cd(fts, query)` |
| Trigram extension | `CREATE EXTENSION pg_trgm;` |
| Trigram GIN | `CREATE INDEX i ON t USING gin (col gin_trgm_ops);` |
| Fuzzy match | `col % $1`, `similarity(col,$1)` |

### Queues

| Task | Statement |
|---|---|
| Claim work | `SELECT … FOR UPDATE SKIP LOCKED` |
| Enqueue | `INSERT INTO jobs (kind, payload) VALUES (…);` |
| Complete | `UPDATE jobs SET status='done' WHERE id=$1;` |
| Retry w/ backoff | `run_at = now() + interval '1 min' * power(2, attempts)` |
| Dead-letter | `status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END` |
| pgmq create/send | `pgmq.create('q')` / `pgmq.send(queue_name=>'q', msg=>'{}')` |
| pgmq read/archive | `pgmq.read(queue_name=>'q', vt=>30, qty=>2)` / `pgmq.archive(...)` |

### RLS

| Task | Statement |
|---|---|
| Enable | `ALTER TABLE t ENABLE ROW LEVEL SECURITY;` |
| Force for owner too | `ALTER TABLE t FORCE ROW LEVEL SECURITY;` |
| Policy | `CREATE POLICY p ON t USING (tenant_id = current_setting('app.tenant_id', true)::uuid);` |
| Write check | `… WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);` |
| Set per-tx | `SELECT set_config('app.tenant_id', $1, true);` |
| Inspect | `SELECT * FROM pg_policies WHERE tablename='t';` |
| Bypass roles | superusers, `BYPASSRLS` roles, and table owners by default |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `column cannot have more than 2000 dimensions for hnsw index` | `vector` type indexes cap at 2,000 dims | Store/index as `halfvec` (up to 4,000), or add an expression index on `embedding::halfvec(n)` |
| Vector query returns too few rows despite `LIMIT` | Filtering applied after ANN scan; `ef_search` too low | Raise `hnsw.ef_search`; enable `hnsw.iterative_scan`; use partial index or partition for selective predicates |
| Vector index not used (Seq Scan) | Opclass/operator mismatch, or no `LIMIT` | Match opclass to operator (`cosine` ↔ `<=>`); add `ORDER BY … LIMIT`; check with `EXPLAIN (ANALYZE, BUFFERS)` |
| HNSW build slow or spills | `maintenance_work_mem` too low for graph | Raise to 2–8GB; raise `max_parallel_maintenance_workers`; build after bulk load |
| IVFFlat recall dropped over time | Centroid drift after inserts/distribution shift | `REINDEX CONCURRENTLY`, or switch to HNSW |
| `memory required is N MB, maintenance_work_mem is 64 MB` on IVFFlat | Build on small/empty table (version-dependent) | Set `maintenance_work_mem` higher; ensure representative data before building |
| RLS policies do nothing | App connects as table owner/superuser, or `BYPASSRLS` | Use a dedicated non-owner role; `FORCE ROW LEVEL SECURITY` |
| Tenant value leaks between requests | Session-level `SET` under transaction-mode pooling | Use `set_config(..., true)` inside the same transaction; use direct connection for session needs |
| `FATAL: sorry, too many clients already` | Serverless connection explosion, no pooler | Use pooled connection string; cap client pool `max`; use serverless driver where supported |
| Two jobs processed twice | Worker crashed before delete; no visibility timeout reclaim | Add stale-lock sweep; use pgmq visibility timeout |
| Dual-write inconsistency (row saved, job missing) | Enqueue outside the data transaction | Enqueue in the same transaction as the write |
| GIN index grows unbounded | Heavy JSONB/FTS writes, no maintenance | Monitor `pg_stat_user_indexes`; `REINDEX CONCURRENTLY` |
| JSONB predicate slow | No statistics on document shape | Add expression index or promote hot paths to typed columns |

---

## Video Library

Search links only — no invented URLs. Descriptions tell you what to look for.

- [pgvector tutorial: storing and querying embeddings in Postgres](https://www.youtube.com/results?search_query=pgvector+postgres+tutorial+embeddings) — end-to-end setup of the `vector` type, inserting embeddings, and similarity queries.
- [pgvector HNSW vs IVFFlat explained](https://www.youtube.com/results?search_query=pgvector+hnsw+vs+ivfflat+explained) — visual explanation of the graph vs clustering tradeoff and recall tuning.
- [Postgres JSONB tutorial](https://www.youtube.com/results?search_query=postgres+jsonb+tutorial+gin+index) — JSONB operators, containment, and GIN index behavior.
- [Postgres full-text search tutorial](https://www.youtube.com/results?search_query=postgres+full+text+search+tsvector+tutorial) — `tsvector`, `tsquery`, ranking, and GIN indexing.
- [Hybrid search with pgvector and full-text search](https://www.youtube.com/results?search_query=postgres+hybrid+search+pgvector+full+text+rrf) — combining vector and keyword results with reciprocal rank fusion.
- [Postgres row-level security multi-tenant](https://www.youtube.com/results?search_query=postgres+row+level+security+multi+tenant+saas) — policies, session variables, and tenant isolation patterns.
- [Postgres queues with FOR UPDATE SKIP LOCKED](https://www.youtube.com/results?search_query=postgres+for+update+skip+locked+job+queue) — building a reliable worker loop.
- [pgmq walkthrough](https://www.youtube.com/results?search_query=pgmq+postgres+message+queue+tutorial) — installing and using the pgmq extension.
- [PgBouncer and serverless Postgres connection pooling](https://www.youtube.com/results?search_query=pgbouncer+transaction+mode+serverless+postgres) — why serverless needs pooling and what transaction mode restricts.
- [Neon Postgres branching and scale-to-zero](https://www.youtube.com/results?search_query=neon+postgres+branching+scale+to+zero+tutorial) — database branching for preview environments.

---

## Written References & Repos

Official docs only. Where unsure of a URL, use "search: <name>".

- pgvector repository and README (types, operators, HNSW/IVFFlat, tuning) — search: `pgvector/pgvector GitHub README`
- pgvector Python examples, including hybrid search with reciprocal rank fusion — search: `pgvector-python examples hybrid_search rrf`
- PostgreSQL docs: JSON Types and JSON Functions and Operators — search: `PostgreSQL JSON functions and operators`
- PostgreSQL docs: Full Text Search (Chapter 12) — search: `PostgreSQL full text search documentation`
- PostgreSQL docs: pg_trgm — search: `PostgreSQL pg_trgm documentation`
- PostgreSQL docs: `SELECT` (`FOR UPDATE SKIP LOCKED`) — search: `PostgreSQL SELECT FOR UPDATE SKIP LOCKED`
- PostgreSQL docs: CREATE POLICY and Row Security Policies — search: `PostgreSQL row security policies documentation`
- PostgreSQL docs: CREATE INDEX and index concurrency — search: `PostgreSQL CREATE INDEX CONCURRENTLY`
- pgmq repository and docs (extension install, SQL API) — search: `pgmq GitHub tembo`
- Neon docs: Connection pooling and Branching — search: `Neon connection pooling docs`
- Supabase docs: Row Level Security, Connecting to Postgres, Connection management — search: `Supabase RLS docs`
- PgBouncer docs: features and pool modes — search: `PgBouncer features documentation`
- The "2000-dimension ceiling" discussion — pgvector issue #461 — search: `pgvector issue 461 max dimensions`

---

## Glossary

- **ANN** — Approximate Nearest Neighbor. Faster than exact search at the cost of recall.
- **BYPASSRLS** — A role attribute that skips all row-level security. Superusers have it implicitly.
- **Centroid drift** — IVFFlat's clusters becoming stale as data distribution changes.
- **Cosine distance** — `1 - cosine similarity`; the `<=>` operator. Standard for text embeddings.
- **ef_construction** — HNSW build-time candidate list size. Default 64.
- **ef_search** — HNSW query-time candidate list size. Default 40.
- **GIN** — Generalized Inverted Index; the workhorse for JSONB, arrays, and `tsvector`.
- **halfvec** — 16-bit float vector type; halves storage and raises the indexed dimension limit to 4,000.
- **HNSW** — Hierarchical Navigable Small Worlds; a graph-based ANN index. The default choice.
- **IVFFlat** — Inverted File with Flat compression; a clustering-based ANN index requiring training.
- **iterative index scan** — pgvector 0.8.0+ feature that scans more of an ANN index to satisfy filtered queries.
- **lists** — IVFFlat's number of clusters.
- **m** — HNSW's max connections per layer. Default 16.
- **maintenance_work_mem** — Memory available for index builds and maintenance.
- **pgmq** — A Postgres extension implementing an SQS-like message queue.
- **pg_trgm** — Trigram extension for fuzzy matching and `LIKE` acceleration.
- **probes** — IVFFlat's query-time number of lists to search.
- **RLS** — Row-Level Security; row filtering enforced by the database engine.
- **RRF** — Reciprocal Rank Fusion; `sum(1/(k+rank))` across result lists.
- **SKIP LOCKED** — Locking modifier that skips rows already locked, enabling concurrent queue consumers.
- **Supavisor** — Supabase's connection pooler.
- **tsquery / tsvector** — Postgres query and document types for full-text search.
- **WITH CHECK** — RLS clause constraining rows that may be written.
- **visibility timeout** — Time a dequeued message stays invisible to other consumers.

---

## FAQ & Next Steps

**Do I really need to drop Redis entirely?**
No. Drop Redis-as-a-queue and Redis-as-a-source-of-truth. Keep it for ephemeral caching, rate limiting, and sessions if you move fast — but recognize you have added a second stateful system to operate. Postgres queues are durable and transactional; Redis is fast and simple. Pick per workload.

**What about Inngest?**
Keep it if durable multi-step workflows with visual run history are core to your product. Replace it with a Postgres queue if your jobs are mostly "do one thing, retry on failure." The transactional-enqueue advantage is significant and Inngest cannot match it without an outbox table.

**Is pgvector good enough for real RAG?**
For most SaaS-scale corpora — thousands to low millions of chunks — yes. Measure recall, tune `ef_search`, use halfvec for >2,000 dims, and consider exact reranking over a lexical candidate set. At hundreds of millions of vectors with tight latency budgets, a dedicated store may win on cost and operational maturity.

**Which index should I use?**
HNSW by default. IVFFlat only when build time or memory is the constraint, or the corpus is static and bulk-loaded.

**Can I use RLS with Next.js server actions?**
Yes, with discipline: one transaction per request, `set_config('app.tenant_id', …, true)` at the top, and a non-owner application role. Do not rely on a session-level `SET` with a transaction-mode pooler.

**Does RLS replace application authorization?**
No. RLS handles tenant isolation (which rows). Role/permission logic (which actions) still belongs in your app or in database grants.

**Will consolidation hurt performance?**
It can. Vector index builds, large GIN indexes, and queue polling all compete for the same CPU, memory, and I/O. Mitigate with a separate work queue connection limit, off-peak index builds, and scaling the instance rather than adding a node. Watch `shared_buffers` so the HNSW graph stays resident — a vector index that spills to disk has a latency tail no parameter fixes.

**Next steps (do these in order):**

1. Enable `vector` and `pg_trgm` on your database; run `SELECT extname, extversion FROM pg_extension;`.
2. Add a `documents` table with `embedding` and a generated `content_fts` column; load a few hundred rows.
3. Build a HNSW index and an FTS GIN index. Compare exact vs approximate top-10s on 50 real queries. Record your recall.
4. Implement the hybrid RRF query and diff its results against vector-only.
5. Create `jobs` and implement `FOR UPDATE SKIP LOCKED` claim/complete, then enqueue from the same transaction as a write.
6. Enable RLS, create a non-owner app role, and verify with `SET ROLE app_user` that tenant B cannot see tenant A's rows.
7. Configure the pooled connection string, run migrations over the direct string, and load-test the serverless path.
8. Only now decide whether you still need the extra vendors.

---

## Verification Note

The SQL and API usage in this paper was checked against the pgvector README and pgEdge pgvector docs (HNSW type limits, defaults, index options, iterative scans), the pgmq GitHub repository and docs (extension usage, visibility timeout, supported Postgres versions 14–18, 1.13.x release line), Neon's connection pooling documentation (PgBouncer transaction mode, pooled vs direct, feature restrictions), Supabase's connection and RLS documentation (Supavisor modes and ports, `BYPASSRLS` behavior), AWS's prescriptive guidance for multi-tenant RLS with `current_setting`, the pgvector hybrid-search RRF example, and the PostgreSQL documentation pages for JSON functions, text search, row security, and `SKIP LOCKED`. Defaults and dimension limits reflect pgvector as of the 0.8.x line and September 2026. Vendor features and pricing change; re-verify anything version- or price-sensitive before relying on it. Where a specific URL could not be confirmed, this paper uses a `search:` instruction rather than a fabricated link.

---

## Bonus — Handoff Prompt

```text
You are expanding an existing long-form technical paper:
markdown_docs/03-postgres-as-the-whole-backend.md

Audience: a semi-technical builder named Chris who learns by doing. Comfortable on
a terminal, knows basic SQL, is building a Next.js + Postgres SaaS, and currently
plans to use Neon or Supabase plus Inngest, a vector store, and maybe Redis.

Goal of the paper: show how much of that multi-vendor stack one Postgres instance
can absorb via pgvector, JSONB, full-text search, in-database queues, and RLS.

TASK
Deepen and extend the existing paper without changing its locked structure or
voice. Keep it pure Markdown (no HTML), second person, plain English, no filler,
3,500–5,000+ words. Preserve the exact section order:

1. # The Complete Guide: Postgres as the Whole Backend
2. One-line blockquote + "Last verified: September 2026" +
   "Series: Chris Wander · New Paper Series"
3. ## The Big Picture (ASCII diagram + capability→tool mapping table)
4. ## The 60-Second Version (TL;DR)
5. ## Prerequisites
6. ## Part N — Title sections (keep the existing 9 parts, add depth)
7. ## Cheat Sheets (SQL command tables)
8. ## Troubleshooting (symptom → cause → fix table)
9. ## Video Library (YouTube SEARCH links only, one-line descriptions)
10. ## Written References & Repos (official docs only; use "search: <name>"
    instead of inventing a URL)
11. ## Glossary
12. ## FAQ & Next Steps
13. ## Verification Note
14. ## Bonus — Handoff Prompt

WHAT TO ADD (pick the highest-value gaps):
- A concrete, runnable end-to-end walkthrough: install extensions on Docker
  Postgres, seed 10k synthetic documents with fake embeddings, build HNSW and
  FTS indexes, run exact-vs-approximate recall measurement, print a recall
  table, then run the hybrid RRF query and show representative output shape.
- A short Node.js/TypeScript snippet (using `pg` or `postgres`/`postgres.js`)
  showing per-request transaction + set_config('app.tenant_id', ..., true),
  and one showing the SKIP LOCKED worker loop. No invented packages.
- A cost model worked example: single Postgres instance vs a 5-vendor stack,
  clearly labeled as illustrative and date-stamped, with the caveat that
  vendor pricing changes.
- A section on observability for a consolidated Postgres: pg_stat_statements,
  pg_stat_activity, pg_stat_progress_create_index, pg_stat_user_indexes,
  slow query log, and what to alert on.
- A hardening section: least-privilege roles, SECURITY DEFINER pitfalls,
  FORCE ROW LEVEL SECURITY, connection limits per role, statement_timeout.
- A migration appendix: moving from a separate vector store or search engine
  into Postgres, dual-write/backfill/shadow-read strategy, and rollback.

HARD RULES
- Never invent SQL syntax, extension names, function names, URLs, or version
  numbers. If unsure, write "verify in the Postgres docs: <term>".
- Date every pricing or version claim. Label vendor claims as vendor claims.
- Use blockquote callouts for destructive operations (index rebuilds, RLS
  bypass) and for cost.
- Be honest about the limits of the one-database approach. Do not oversell.
- All SQL goes in fenced ```sql blocks. Numbered steps inside procedures.
- Keep the verified anchors: pgvector types/dimension limits (vector 2,000 /
  halfvec 4,000 indexed), HNSW vs IVFFlat guidance with the ~5–6x build-time
  difference, hnsw.ef_search default 40 with recall guidance, m/ef_construction
  defaults, pgmq, Neon branching/scale-to-zero, PgBouncer transaction mode,
  Postgres JSONB/GIN/SKIP LOCKED/RLS/FTS/pg_trgm docs.

OUTPUT: the complete, updated Markdown file at the same path. Do not summarize;
write the whole file.
```
