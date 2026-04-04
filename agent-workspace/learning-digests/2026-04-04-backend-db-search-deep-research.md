# Backend, DB & Search Deep Research Digest
**Date:** 2026-04-04
**Session:** AGENTIC FOOD - learning schedule
**Topics:** PostgreSQL 17, pgvector 0.8, Redis 8, BullMQ 5, Prisma 7.4, FTS, Semantic Cache, Rate Limiting, Connection Pooling

---

## 1. pgvector 0.8 HNSW Iterative Scan — ef_search Danger Zone

**Source:** https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/
**What it means for FoodClaw:**
The similarity/index.ts already uses `SET LOCAL hnsw.iterative_scan = 'relaxed_order'` correctly inside a transaction — good. However the `ef_search` value of 100 is safe, but there is a **critical danger zone**: above ef_search=200 with halfvec(3072), PostgreSQL's cost model flips to a sequential scan (365ms vs 2.4ms). Our current 4-dimension vectors are not at risk, but if we ever upgrade to full-dimension food embeddings, we must stay below 200. Also: the current `max_scan_tuples = 10000` is below the default 20000 — this could cause early termination on highly selective dietary filter combos (e.g., kosher + nut_free in a city with sparse data). Recommend bumping to 20000 (the upstream default).

**Risk tier:** GREEN (safe tuning of existing working code)
**Target files:** `nutriscout/src/lib/similarity/index.ts` (line 107: `SET LOCAL hnsw.max_scan_tuples = 10000`)
**Specific code change:**
```sql
-- Change from:
SET LOCAL hnsw.max_scan_tuples = 10000
-- To:
SET LOCAL hnsw.max_scan_tuples = 20000
```
Also add to `scripts/post-migrate.sql` HNSW index creation:
```sql
-- Increase ef_construction from 64 to 128 for better recall at index build time
-- (only applies on next rebuild, not live queries)
CREATE INDEX IF NOT EXISTS idx_dish_macro_embedding ON dishes
  USING hnsw(macro_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 128);
```

**Impact:** 3 | **Effort:** 1 | **Urgency:** 2

---

## 2. pgvector 0.8 — Scalar Subquery Pattern for Index Pushdown

**Source:** https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/
**What it means for FoodClaw:**
The current `findSimilarDishesViaVector()` in `similarity/index.ts` (lines 121–141) uses `d.macro_embedding <=> (SELECT macro_embedding FROM dishes WHERE id = ${dishId}::uuid)` as a scalar subquery — this is **already the correct pattern**. The guide confirms that cross-join patterns prevent index pushdown; the scalar subquery pattern enables it. No change needed here.

**Risk tier:** GREEN (confirm existing code is correct)
**Target files:** `nutriscout/src/lib/similarity/index.ts`
**Specific code change:** None. Pattern is already correct.

**Impact:** N/A | **Effort:** N/A | **Urgency:** N/A

---

## 3. Prisma 7.4 — Query Plan Caching (compilerBuild = "fast")

**Source:** https://www.prisma.io/blog/prisma-orm-v7-4-query-caching-partial-indexes-and-major-performance-improvements
**What it means for FoodClaw:**
Prisma 7.4 introduced query plan caching. Without it, each Prisma query pays 0.1–1ms in JavaScript compilation overhead. With `compilerBuild = "fast"`, repeated queries (same shape, different values — e.g., repeated searches) hit the cache and pay only 1–10µs. The schema already has `compilerBuild = "fast"` set (confirmed on line 5 of schema.prisma). However, Prisma 7.4 also introduced **partial indexes** via `previewFeatures = ["partialIndexes"]` — this is not yet in our schema. Partial indexes would allow targeted indexes like `WHERE macro_confidence < 0.7` directly in Prisma schema rather than raw SQL in post-migrate.sql.

**Risk tier:** GREEN (compilerBuild already set; partialIndexes is additive preview feature)
**Target files:** `nutriscout/prisma/schema.prisma`
**Specific code change:**
```prisma
generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  previewFeatures = ["postgresqlExtensions", "partialIndexes"]
  compilerBuild   = "fast"
}
```
Then migrate the partial indexes currently in `post-migrate.sql` into schema.prisma (optional — post-migrate.sql approach also works fine).

**Impact:** 2 | **Effort:** 1 | **Urgency:** 2

---

## 4. PostgreSQL 17 — Vacuum & WAL Performance for High-Concurrency

**Source:** https://medium.com/@DevBoostLab/postgresql-17-performance-upgrade-2026-f4222e71f577
**What it means for FoodClaw:**
PostgreSQL 17's vacuum tracks only changed pages (not full table scans), reducing vacuum duration by up to 10x for large tables. The `dishes` table, which gets bulk-inserted during nightly crawl, will benefit significantly. Also: bi-directional B-tree index scans eliminate need for duplicate DESC/ASC index pairs. Our current schema has separate `idx_dishes_protein ON dishes(protein_max_g DESC)` — on PG17 a single index serves both sort directions. The WAL improvement (2x write throughput) benefits the nightly bulk insert of crawled menu items.

**Risk tier:** GREEN (these are PostgreSQL internals — no code changes needed, just upgrade)
**Target files:** None (infrastructure upgrade)
**Specific code change:** Upgrade to PostgreSQL 17 in your deployment. Verify with `SELECT version()`. No schema or code changes needed to take advantage of vacuum and WAL improvements — they're automatic. The duplicate protein index is fine to leave; it's not harmful on PG17.

**Impact:** 3 | **Effort:** 2 | **Urgency:** 2

---

## 5. Redis 8.6 — New Hash Commands (HGETDEL, HGETEX, HSETEX)

**Source:** https://redis.io/blog/redis-8-ga/
**What it means for FoodClaw:**
Redis 8 added `HGETDEL` (get fields and delete), `HGETEX` (get with optional expiry update), and `HSETEX` (set with expiry) on hash types. The current cache layer uses plain `GET`/`SET` for all cache entries. For restaurant invalidation patterns (where we need to atomically get-then-expire cache references), `HGETEX` could simplify `invalidateRestaurant()`. Redis 8 also added **vector sets** (new native data type for vector similarity search). This could eventually replace the pgvector-in-Redis semantic cache approach, but is still beta.

**Risk tier:** YELLOW (new commands need testing; vector sets are beta)
**Target files:** `nutriscout/src/lib/cache/index.ts` (invalidateRestaurant function)
**Specific code change:** Currently `invalidateRestaurant()` does a SCAN + DEL loop. If upgrading to Redis 8 and want to optimize: use `HGETDEL` for the ref-set-based invalidation pattern described in AGENTS.md. However, the SCAN approach works and there's no bug here — defer unless Redis 8 upgrade is happening anyway.

**Impact:** 2 | **Effort:** 2 | **Urgency:** 3

---

## 6. Redis 8 — I/O Threading for 2x Throughput

**Source:** https://redis.io/blog/redis-8-ga/
**What it means for FoodClaw:**
Redis 8 defaults to 1 I/O thread. With multi-core servers, setting `io-threads 8` in `redis.conf` gives up to 2x throughput improvement. The current ioredis client in `cache/redis.ts` needs no code changes — this is a Redis server configuration. During nightly crawl when all 6 agents are running simultaneously, Redis throughput becomes a bottleneck (semantic cache checks + BullMQ state + rate limiter sorted sets all hit Redis at once).

**Risk tier:** GREEN (Redis server config change, no code changes)
**Target files:** Redis server config (`redis.conf`)
**Specific code change:**
```conf
io-threads 8
io-threads-do-reads yes
```
Note: Only beneficial on machines with 4+ CPU cores. Confirm your server spec first.

**Impact:** 3 | **Effort:** 1 | **Urgency:** 2

---

## 7. BullMQ — Sandboxed Processors for Memory Leak Isolation

**Source:** https://docs.bullmq.io/guide/workers/concurrency, https://oneuptime.com/blog/post/2026-01-21-bullmq-sandboxed-processors/view
**What it means for FoodClaw:**
The photo-worker.ts and crawl-worker.ts handle vision analysis (Gemini API calls) and HTML parsing — both are memory-intensive and can grow indefinitely if a single job accumulates large base64 image buffers or DOM trees. BullMQ sandboxed processors run each job in a child process that is torn down after the job completes, preventing heap accumulation. Current workers run in the main process (confirmed by file structure — no sandboxed processor setup found). The `CONCURRENCY=3` for vision batch is a good start but doesn't isolate memory per-job.

**Risk tier:** YELLOW (behavioral change to worker execution model; needs testing)
**Target files:** `nutriscout/workers/photo-worker.ts`, `nutriscout/workers/crawl-worker.ts`
**Specific code change:**
```typescript
// In photo-worker.ts, change Worker instantiation from inline processor:
const worker = new Worker('photo-analysis', async (job) => { ... }, { connection });

// To sandboxed processor:
const worker = new Worker('photo-analysis', './processors/photo-processor.js', {
  connection,
  useWorkerThreads: false, // child process, not worker thread
});
// Then create workers/processors/photo-processor.ts with the job logic
```
Consider for vision/crawl workers specifically. Logistics and review workers are lower memory and don't need sandboxing.

**Impact:** 4 | **Effort:** 3 | **Urgency:** 2

---

## 8. BullMQ — OpenTelemetry Tracing (v5.71+)

**Source:** https://1xapi.com/blog/bullmq-5-background-job-queues-nodejs-2026-guide (403, from search results)
**What it means for FoodClaw:**
BullMQ 5.71 (March 2026) added native OpenTelemetry support. This would allow distributed tracing across the nightly pipeline: from the discovery agent queuing a restaurant → crawl-worker picking it up → photo-worker → USDA resolver. Currently there is no tracing — debugging which job caused a failure requires scanning logs. The `worker-start-all.ts` could be updated to initialize an OTel provider.

**Risk tier:** YELLOW (additive feature; requires OTel collector setup)
**Target files:** `nutriscout/workers/start-all.ts`, `nutriscout/workers/queues.ts`
**Specific code change:**
```typescript
// In workers/start-all.ts, before any Queue/Worker instantiation:
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_URL }),
  serviceName: 'foodclaw-workers',
});
sdk.start();
```
Defer until there is an OTel collector available (Jaeger, Grafana Tempo, etc.).

**Impact:** 2 | **Effort:** 3 | **Urgency:** 3

---

## 9. Full-Text Search — ts_rank_cd Already Used (Confirm Correct)

**Source:** https://xata.io/blog/postgres-full-text-search-engine, https://leapcell.io/blog/optimizing-postgresql-full-text-search-performance
**What it means for FoodClaw:**
The existing `fullTextSearchDishes()` in `geo.ts` already uses `ts_rank_cd` (cover density) — this is the **recommended choice** for multi-word food queries like "spicy chicken pad thai" where term proximity matters. The function also already uses `websearch_to_tsquery` with English dictionary + simple fallback. The `setweight()` pattern (name='A', description='B', category='C') is also correct and follows best practices. The GIN index on `search_vector` is in `post-migrate.sql`.

One gap: the relevance scoring in `orchestrator/index.ts` incorporates FTS rank with a 30% weight. A further improvement would be combining FTS rank with trigram similarity for a hybrid text score (for partial-word queries that FTS doesn't catch). This is the Hybrid RRF pattern already noted in AGENTS.md.

**Risk tier:** GREEN (confirming existing implementation is correct; hybrid RRF is YELLOW)
**Target files:** `nutriscout/src/lib/db/geo.ts`, `nutriscout/src/lib/orchestrator/index.ts`
**Specific code change for hybrid text scoring in relevanceScore():**
```typescript
// In orchestrator/index.ts, relevanceScore():
// When ftsRank > 0, also check if trgm similarity is available and boost
// This would require passing trgm scores from findDishesByNameSimilarity() alongside FTS
// Complexity: medium — defer to next dedicated search improvement cycle
```

**Impact:** 3 | **Effort:** 3 | **Urgency:** 2

---

## 10. PostgreSQL FTS — Weighted tsvector Missing `name` in 'simple' Fallback

**Source:** https://leapcell.io/blog/optimizing-postgresql-full-text-search-performance
**What it means for FoodClaw:**
In `fullTextSearchDishes()`, the fallback 'simple' path (for foreign food names) computes the tsvector on-the-fly without using the `search_vector` generated column — which means the GIN index is NOT used for the fallback path. The query does a full sequential scan computing `to_tsvector('simple', name)` on every row. For a small DB this is fine, but as data grows this becomes O(N).

**Fix:** Add a second generated column `search_vector_simple` for the simple dictionary, or add the 'simple' tsvector to the existing search_vector as a separate weight level and index it.

**Risk tier:** YELLOW (requires adding a generated column + index via migration)
**Target files:** `nutriscout/scripts/post-migrate.sql`, `nutriscout/src/lib/db/geo.ts`
**Specific code change:**
In `post-migrate.sql`:
```sql
-- Add simple-dictionary tsvector column for foreign food names (ramen, sushi, nori)
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS search_vector_simple tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_dishes_search_simple ON dishes USING GIN(search_vector_simple);
```
Then in `geo.ts`, change the simple fallback to use `search_vector_simple @@ websearch_to_tsquery('simple', ...)`.

**Impact:** 3 | **Effort:** 2 | **Urgency:** 2

---

## 11. Redis Semantic Cache — Partition by Dietary Hash (Safety Critical)

**Source:** https://redis.io/blog/what-is-semantic-caching/, https://redis.io/blog/building-a-context-enabled-semantic-cache-with-redis/
**What it means for FoodClaw:**
Current `buildQueryCacheKey()` in `cache/index.ts` (line 82) already includes `dietaryFilters` and `allergens` in the cache key — confirmed. This is correct. Serving a nut_free user cached results from a non-nut_free query would be a safety failure. The current key format: `query:${text}:${filters}:${goal}:${cats}:${sort}:cal${calCap}:prot${protMin}:alg${allergens}:wait${maxWait}:${lat},${lng}:r${radius}` is comprehensive.

However, the semantic cache threshold (if we ever add vector-similarity based cache lookup) must NEVER relax the dietary partition — even semantically similar queries ("high protein dinner" ≈ "protein-rich food") should not share cache entries across different dietary restriction combos. This is already noted in AGENTS.md. No code change needed for the current string-key cache.

**Risk tier:** GREEN (existing implementation is correct; note for future semantic cache upgrade)
**Target files:** `nutriscout/src/lib/cache/index.ts`
**Specific code change:** None for current implementation. If adding vector-similarity semantic cache later, partition the vector index by dietary hash before cosine similarity search.

**Impact:** N/A | **Effort:** N/A | **Urgency:** N/A

---

## 12. PgBouncer — Transaction Mode Required for Prisma 7

**Source:** https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer
**What it means for FoodClaw:**
If FoodClaw is deployed with PgBouncer (not currently confirmed but common for production), PgBouncer **must** be configured in **Transaction Mode** for Prisma to work. Session mode breaks prepared statements. Also: since PgBouncer 1.21.0, the `?pgbouncer=true` flag in the connection string should NOT be set (it was needed pre-1.21 for advisory lock workarounds that are no longer needed). The `prisma.$transaction()` calls in `similarity/index.ts` require transaction-mode PgBouncer.

**Risk tier:** YELLOW (infrastructure change; wrong config causes silent query failures)
**Target files:** PgBouncer config (`pgbouncer.ini`), `.env` (`DATABASE_URL`)
**Specific code change:**
```ini
; pgbouncer.ini
pool_mode = transaction
; For Prisma 7 + PgBouncer 1.21+: do NOT set pgbouncer=true in connection string
; DATABASE_URL should be: postgresql://user:pass@pgbouncer-host:5432/db
; (no ?pgbouncer=true suffix)
```
Also add a direct connection URL for Prisma CLI commands (migrate, studio):
```env
DATABASE_URL=postgresql://user:pass@pgbouncer:5432/foodclaw
DIRECT_DATABASE_URL=postgresql://user:pass@postgres:5432/foodclaw
```
In `prisma.config.ts` (if it exists) or schema.prisma datasource block.

**Impact:** 4 | **Effort:** 2 | **Urgency:** 3

---

## 13. Rate Limiter — Current Implementation is Best Practice

**Source:** https://redis.io/tutorials/howtos/ratelimiting/, https://blogs.halodoc.io/taming-the-traffic-redis-and-lua-powered-sliding-window-rate-limiter-in-action/
**What it means for FoodClaw:**
The current sliding window rate limiter in `middleware/rate-limiter.ts` is already using all current best practices:
- Atomic Lua script (ZREMRANGEBYSCORE + ZCARD + ZADD pattern)
- Monotonic counter member names to avoid collision (`${now}:${++counter}`)
- Retry-after calculation from oldest window entry
- Fail-open on Redis errors
- Per-category limits (auth, search, read, write, crawl)

The 2026 best practice guides confirm this is the correct pattern. No changes needed.

One minor improvement: add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers in `middleware/with-rate-limit.ts` for API consumers who check standard rate limit headers.

**Risk tier:** GREEN (additive headers, existing logic is correct)
**Target files:** `nutriscout/src/lib/middleware/with-rate-limit.ts`
**Specific code change:** Check if rate limit response headers are currently set; add standard headers if not.

**Impact:** 2 | **Effort:** 1 | **Urgency:** 3

---

## 14. GIN Index on dietaryFlags — Verify it's Applied

**Source:** AGENTS.md cross-reference, confirmed via post-migrate.sql
**What it means for FoodClaw:**
The GIN index `idx_dishes_dietary ON dishes USING GIN(dietary_flags jsonb_path_ops)` IS in `post-migrate.sql` (line 26). However, `post-migrate.sql` is a manually-run script. We should verify this index actually exists in production by checking:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'dishes' AND indexname = 'idx_dishes_dietary';
```
The dietary filter in `buildDietaryWhere()` uses `{ path: [key], equals: true }` which maps to a Prisma JSONB path query — this uses the `@>` containment operator which IS optimized by `jsonb_path_ops` GIN.

**Risk tier:** GREEN (verification only)
**Target files:** `nutriscout/scripts/post-migrate.sql` (already correct)
**Specific code change:** None — just verify index exists in deployed DB. Add to startup health check if desired.

**Impact:** 3 | **Effort:** 1 | **Urgency:** 2

---

## 15. BullMQ — addBulk API for Nightly Discovery Batch Inserts

**Source:** https://docs.bullmq.io/changelog (BullMQ 5 search results)
**What it means for FoodClaw:**
The nightly discovery script (`scripts/nightly-discovery.ts`) queues restaurants for crawl one-at-a-time. BullMQ's `addBulk()` method batches multiple job insertions into a single Redis pipeline, significantly reducing Redis round-trips. For 50 restaurants queued per night, this saves 49 extra Redis commands.

**Risk tier:** GREEN (API already exists in BullMQ, purely additive)
**Target files:** `nutriscout/scripts/nightly-discovery.ts`
**Specific code change:**
```typescript
// Instead of: for (const restaurant of newRestaurants) { await menuCrawlQueue.add(...) }
// Use:
await menuCrawlQueue.addBulk(
  newRestaurants.map(restaurant => ({
    name: 'crawl-restaurant',
    data: { googlePlaceId: restaurant.googlePlaceId },
    opts: { jobId: `crawl-${restaurant.googlePlaceId}`, priority: 5 }
  }))
);
```

**Impact:** 2 | **Effort:** 1 | **Urgency:** 3

---

## Summary Table

| # | Finding | Risk | Impact | Effort | Urgency | Target File |
|---|---------|------|--------|--------|---------|-------------|
| 1 | pgvector max_scan_tuples 10k → 20k | GREEN | 3 | 1 | 2 | similarity/index.ts |
| 2 | pgvector scalar subquery pattern (already correct) | GREEN | N/A | N/A | N/A | — |
| 3 | Prisma 7.4 partialIndexes preview feature | GREEN | 2 | 1 | 2 | schema.prisma |
| 4 | PostgreSQL 17 vacuum/WAL (infra upgrade) | GREEN | 3 | 2 | 2 | infra only |
| 5 | Redis 8 HGETDEL/HGETEX/HSETEX | YELLOW | 2 | 2 | 3 | cache/index.ts |
| 6 | Redis 8 I/O threading (server config) | GREEN | 3 | 1 | 2 | redis.conf |
| 7 | BullMQ sandboxed processors for photo/crawl | YELLOW | 4 | 3 | 2 | workers/*.ts |
| 8 | BullMQ OpenTelemetry tracing | YELLOW | 2 | 3 | 3 | workers/start-all.ts |
| 9 | FTS ts_rank_cd already correct | GREEN | N/A | N/A | N/A | — |
| 10 | FTS 'simple' fallback missing GIN index | YELLOW | 3 | 2 | 2 | post-migrate.sql, geo.ts |
| 11 | Semantic cache dietary partition (already correct) | GREEN | N/A | N/A | N/A | — |
| 12 | PgBouncer transaction mode for Prisma 7 | YELLOW | 4 | 2 | 3 | pgbouncer.ini, .env |
| 13 | Rate limiter (already best practice) | GREEN | N/A | N/A | N/A | — |
| 14 | GIN dietary index verify in DB | GREEN | 3 | 1 | 2 | post-migrate.sql |
| 15 | BullMQ addBulk for discovery batching | GREEN | 2 | 1 | 3 | nightly-discovery.ts |
