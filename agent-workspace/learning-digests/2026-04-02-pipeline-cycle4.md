# Learning Digest -- Pipeline Cycle 4
**Date**: 2026-04-02
**Focus**: Pipeline (restaurant/dish data pipeline, job queues, crawl-to-vision-to-review)
**Agent**: NutriScout Learning Agent

---

## 1. Codebase State Assessment

### Current Pipeline Architecture
- **Queue definitions** (`workers/queues.ts`): 5 queues -- menu-crawl, photo-analysis, logistics-update, review-aggregation, dead-letter. All share a single IORedis connection with `removeOnComplete: {count: 100}` and `removeOnFail: {count: 500}`.
- **Crawl worker** (`workers/crawl-worker.ts`): Processes `menu-crawl` jobs at concurrency 3, rate-limited 10/min. On completion, manually queries DB and enqueues photo-analysis jobs. Has DLQ handling on failure.
- **Photo worker** (`workers/photo-worker.ts`): Processes `photo-analysis` at concurrency 2, rate-limited 5/min. Skips low-confidence (<0.4) results. No DLQ forwarding on failure.
- **Review worker** (`workers/review-worker.ts`): Processes `review-aggregation` at concurrency 2, rate-limited 5/min. No DLQ forwarding on failure.
- **Menu crawler** (`src/lib/agents/menu-crawler/`): 3 source strategies (website HTML/JSON-LD, Google Photos via vision, delivery platform stub). Google Places API v1 (Legacy) used throughout.
- **Vision analyzer** (`src/lib/agents/vision-analyzer/index.ts`): Gemini Flash with structured responseSchema. Has `analyzeMultiplePhotos()` ensemble function with MAD outlier detection, but it is **not wired into the worker pipeline** -- only single-photo analysis is used.

### Pipeline-Related Backlog Issues
From `BACKLOG.md`, issues relevant to pipeline:
- **MAJOR**: `delivery=true` is a no-op -- all results have `delivery: null` (logistics poller stub)
- **MINOR**: `photo_count: 0` but photos array has 1 entry (stale field)
- **MINOR**: Only 1 photo per dish -- no carousel variety (seed data)
- **MINOR**: All reviews are identical templates, not dish-specific (seed data)

No CRITICAL pipeline issues currently open. The CRITICAL items are all in the evaluator/orchestrator layers.

### Work Already Done (avoid re-doing)
From improvement logs (2026-04-01 and 2026-04-02):
- Gemini responseSchema for structured JSON output (done)
- USDA synonym map expanded to 100+ entries (done)
- Preparation-aware calorie adjustment (done)
- fetchWithRetry wired into crawler (done)
- Dish deduplication on re-crawl (done)
- Price parsing robustness (done)
- extractJson for review summarization (done)
- Vision batch concurrency 3x improvement (done)
- BullMQ removeOnComplete/removeOnFail on all queues (done)
- Job deduplication via jobId (done)
- Photo worker with priority levels (done)
- DLQ forwarding in crawl-worker (done, but NOT in photo-worker or review-worker)

---

## 2. Key Research Findings

### 2.1 BullMQ FlowProducer for Job Chaining

**Current state**: crawl-worker manually enqueues photo-analysis jobs in its `completed` event handler (lines 64-116 of crawl-worker.ts). This is fragile -- if the worker crashes between completing the crawl job and enqueuing photos, the chain breaks silently.

**Best practice (2026)**: BullMQ FlowProducer (v5.71+) provides atomic parent-child job trees. Children run first; the parent job processes only after all children complete. Key properties:
- Jobs can span different queues (`queueName` per node)
- Atomic addition -- either all jobs are added or none
- Parent can access children's return values
- Built-in telemetry via OpenTelemetry (v5.71)

**Sources**:
- [BullMQ Flows documentation](https://docs.bullmq.io/guide/flows)
- [FlowProducer API reference v5.71](https://api.docs.bullmq.io/classes/v5.FlowProducer.html)
- [BullMQ Job Dependencies with Flows](https://oneuptime.com/blog/post/2026-01-21-bullmq-job-dependencies-flows/view)

**NutriScout applicability**: Replace the manual crawl-worker `completed` handler with a FlowProducer-based flow:
```
area-crawl (parent, menu-crawl queue)
  -> restaurant-crawl (child per restaurant, menu-crawl queue)
    -> photo-analysis (grandchild per dish, photo-analysis queue)
    -> review-aggregation (grandchild, review-aggregation queue)
```
The existing digest at `2026-03-30-deep-database-architecture.md` (section 6.4) already has a reference implementation sketch. This has been deferred twice (04-01, 04-02) at YELLOW risk.

### 2.2 Google Places API v2 (New) Migration

**Current state**: 6 call sites use the Legacy Places API (`maps.googleapis.com/maps/api/place/`):
1. `crawl/area/route.ts` -- Nearby Search
2. `health/route.ts` -- health check ping
3. `menu-crawler/index.ts` -- Place Details (name, address, geometry, etc.)
4. `menu-crawler/sources.ts` -- Place Details (photos) + Place Photo
5. `review-aggregator/index.ts` -- Place Details (reviews)

**Migration requirements** (from Google docs):
- New base URL: `places.googleapis.com/v1/places/`
- Field masks required (`X-Goog-FieldMask` header or `$fields` param)
- Response field name changes (e.g., `name` -> `displayName`, `formatted_address` -> `formattedAddress`)
- Photo references change: `photos[].name` replaces `photos[].photo_reference`, and the photo URL format changes to `https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=1600&key=API_KEY`
- Nearby Search -> Nearby Search (New): POST request to `places.googleapis.com/v1/places:searchNearby`
- Place Details -> Place Details (New): GET request to `places.googleapis.com/v1/places/{place_id}`

**Urgency**: Legacy Places API can no longer be newly enabled. Existing users still work, but Google is deprecating it. The handoff doc rates this Impact 9, Effort 6, Urgency 8.

**Sources**:
- [Migration overview](https://developers.google.com/maps/documentation/places/web-service/legacy/migrate-overview)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Place Photos (New)](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [Google Deprecations page](https://developers.google.com/maps/deprecations)

### 2.3 Menu Data Extraction Techniques

**Current state**: NutriScout uses a 3-tier strategy:
1. JSON-LD structured data extraction (best quality)
2. CSS selector-based HTML parsing with fallback heading/list patterns
3. Google Photos + Claude Haiku vision for menu photo OCR

**Industry patterns (2025-2026)**:
- **DoorDash approach**: LLM transcription of menu photos with ML guardrail layer for quality control. Uses traditional ML to validate LLM outputs at scale.
- **Plate Parser**: Modular pipeline of OCR (EasyOCR) + image preprocessing (OpenCV adaptive thresholding) + LLM structured extraction + vector search for retrieval.
- **Structured output schemas**: Using LLM constrained decoding (Gemini `responseMimeType: "application/json"` + `responseSchema`) is now standard. NutriScout already does this for vision analysis but NOT for the ingredient analysis prompt in `menu-crawler/index.ts`.

**Source**:
- [DoorDash LLM Menu Transcription](https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/)
- [Plate Parser](https://medium.com/@hrishikesh19202/plate-parser-a-modular-llm-powered-system-for-intelligent-menu-digitization-and-retrieval-f30c1acade98)
- [Structured data extraction with LLM schemas](https://simonwillison.net/2025/Feb/28/llm-schemas/)

**NutriScout applicability**: The `analyzeIngredients()` function in `menu-crawler/index.ts` uses Claude Sonnet with a free-text prompt and `extractJson()` parsing. Switching to Anthropic's tool_use / JSON mode or migrating to Gemini with `responseSchema` for the ingredient analysis would reduce parse failures (the fallback placeholder path was added specifically because of parse failures).

### 2.4 Job Queue Reliability Patterns

**Current state**:
- Crawl worker: Has DLQ forwarding after retries exhausted. Uses custom `backoffStrategy` (exponential: 5^n seconds).
- Photo worker: Has exponential backoff but NO DLQ forwarding. Failed photo jobs disappear after `removeOnFail: {count: 500}`.
- Review worker: Same gap -- no DLQ forwarding.

**Best practices (2026)**:
- **Exponential backoff with jitter**: Prevents thundering herd. BullMQ supports `{ type: "exponential", delay: 5000 }` natively but does not add jitter by default. Custom `backoffStrategy` can add it: `baseDelay * 2^attempts + random(0, baseDelay)`.
- **DLQ on all workers**: Every worker should forward to DLQ after exhausting retries. This is a monitoring requirement -- without DLQ, you cannot audit permanent failures.
- **Distinguish transient vs. permanent failures**: API rate limits (429) and timeouts are transient (retry). Invalid place IDs or deleted photos are permanent (skip retries, go straight to DLQ).
- **Graceful shutdown**: Workers should call `worker.close()` on SIGTERM to finish in-flight jobs before exiting. None of the current workers implement this.

**Sources**:
- [BullMQ Retrying Failing Jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ Custom Backoff Strategy](https://docs.bullmq.io/bull/patterns/custom-backoff-strategy)
- [Job Retries with Exponential Backoff](https://oneuptime.com/blog/post/2026-01-21-bullmq-retry-exponential-backoff/view)
- [BullMQ 2026 Guide](https://1xapi.com/blog/bullmq-5-background-job-queues-nodejs-2026-guide)

### 2.5 Multi-Photo Ensemble Analysis (Deferred YELLOW)

**Current state**: `analyzeMultiplePhotos()` exists in `vision-analyzer/index.ts` with MAD outlier detection and confidence-weighted averaging. However, the photo-worker only calls `analyzeFoodPhoto()` (single photo). The ensemble function is dead code in the pipeline context.

**Gap**: The crawl-worker enqueues one photo-analysis job per dish (takes the first photo). Even if a dish has multiple photos in the DB, they are not aggregated.

**Implementation path**: After the crawl-worker finds dishes with multiple photos, it could either:
1. Pass all photo URLs in a single job and call `analyzeMultiplePhotos()` in the photo-worker, OR
2. Use FlowProducer to fan out individual photo jobs as children, then aggregate in a parent job.

Option 1 is simpler (Effort 3). Option 2 is architecturally cleaner but depends on FlowProducer being implemented first.

---

## 3. Cross-Reference with Codebase

| Finding | Codebase Location | Current Gap |
|---------|-------------------|-------------|
| FlowProducer not used | `workers/crawl-worker.ts` lines 64-116 | Manual job chaining in `completed` handler, not atomic |
| Google Places API v1 (Legacy) | 6 call sites across src/ | Should migrate to v2 (New) before deprecation |
| No DLQ in photo-worker | `workers/photo-worker.ts` | Failed photo jobs silently lost after removal |
| No DLQ in review-worker | `workers/review-worker.ts` | Same gap |
| No graceful shutdown | All 3 workers | Risk of lost in-flight jobs on deploy |
| Ensemble analysis unused | `vision-analyzer/index.ts` line 214 | `analyzeMultiplePhotos()` exists but never called from worker |
| No jitter on backoff | All 3 workers | Thundering herd risk under load |
| Ingredient analysis uses free-text JSON | `menu-crawler/index.ts` line 77 | No structured output constraint; relies on extractJson fallback |

---

## 4. Actionable Summary

| # | Item | Risk Tier | Impact (1-10) | Effort (1-10) | Urgency (1-10) | Priority Score | Target File(s) |
|---|------|-----------|---------------|---------------|----------------|----------------|-----------------|
| 1 | Add DLQ forwarding to photo-worker and review-worker | GREEN | 7 | 2 | 7 | 8.2 | `workers/photo-worker.ts`, `workers/review-worker.ts` |
| 2 | Add graceful shutdown (SIGTERM) to all workers | GREEN | 6 | 2 | 6 | 6.7 | `workers/crawl-worker.ts`, `workers/photo-worker.ts`, `workers/review-worker.ts` |
| 3 | Add jitter to exponential backoff strategies | GREEN | 5 | 1 | 5 | 5.5 | All 3 workers |
| 4 | Wire ensemble analysis into photo-worker for multi-photo dishes | YELLOW | 7 | 4 | 5 | 5.8 | `workers/photo-worker.ts`, `workers/crawl-worker.ts` |
| 5 | BullMQ FlowProducer for crawl-to-vision-to-review chaining | YELLOW | 7 | 5 | 5 | 5.0 | `workers/queues.ts`, `workers/crawl-worker.ts`, `src/app/api/crawl/area/route.ts` |
| 6 | Google Places API v2 migration | YELLOW | 9 | 6 | 8 | 8.0 | 6 call sites (see section 2.2) |
| 7 | Structured output for ingredient analysis (tool_use or Gemini) | YELLOW | 6 | 4 | 4 | 4.5 | `src/lib/agents/menu-crawler/index.ts` |

**Priority Score** = `(Impact * 0.4) + (Urgency * 0.4) + ((10 - Effort) * 0.2)`

### Recommended Implementation Order

**Immediate (GREEN, low effort, high reliability impact)**:
1. DLQ forwarding on photo-worker and review-worker (copy pattern from crawl-worker)
2. Graceful shutdown on all workers (`process.on("SIGTERM", () => worker.close())`)
3. Jitter on backoff (one-line change per worker)

**Next cycle (YELLOW, moderate effort)**:
4. Google Places API v2 migration (highest urgency due to deprecation timeline)
5. Wire ensemble analysis into photo-worker (the function already exists)
6. FlowProducer for atomic job chaining (replace manual `completed` handler)
7. Structured output for ingredient analysis (reduces parse failures)

---

## 5. Implementation Sketches

### 5.1 DLQ Forwarding for photo-worker (Item 1)

Add to `workers/photo-worker.ts` after the existing `failed` handler:
```typescript
worker.on("failed", async (job, err) => {
  console.error(`[photo-worker] Job ${job?.id} failed:`, err.message);
  if (job && job.attemptsMade >= (job.opts.attempts ?? 2)) {
    try {
      const { deadLetterQueue } = await import("./queues");
      await deadLetterQueue.add("photo-failed", {
        originalQueue: "photo-analysis",
        jobId: job.id,
        data: job.data,
        error: err.message,
        attempts: job.attemptsMade,
        failedAt: new Date().toISOString(),
      });
    } catch { /* DLQ add failed */ }
  }
});
```

### 5.2 Graceful Shutdown (Item 2)

Add to each worker file:
```typescript
async function shutdown() {
  console.log("[worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

### 5.3 Jitter on Backoff (Item 3)

Replace the custom `backoffStrategy` in each worker:
```typescript
backoffStrategy: (attemptsMade: number) => {
  const base = Math.pow(5, attemptsMade) * 1000;
  const jitter = Math.random() * 1000; // 0-1s jitter
  return base + jitter;
},
```

### 5.4 Google Places API v2 (Item 6) -- Migration Checklist

Create a shared helper `src/lib/google-places/client.ts`:
- Nearby Search: POST to `places.googleapis.com/v1/places:searchNearby` with body `{ includedTypes: ["restaurant"], locationRestriction: { circle: { center: {lat, lng}, radiusMeters } } }` and header `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location`
- Place Details: GET `places.googleapis.com/v1/places/{placeId}` with field mask header
- Place Photos: GET `places.googleapis.com/v1/{photoName}/media?maxWidthPx=1600&key=KEY`
- Update all 6 call sites to use the shared client
- Map response fields: `name` -> `displayName.text`, `formatted_address` -> `formattedAddress`, `geometry.location` -> `location`, `photos[].photo_reference` -> `photos[].name`

---

## 6. Items NOT Recommended

- **Delivery platform API integration** (RED tier): Requires contracts with DoorDash/UberEats/Grubhub. Cannot be implemented without business agreements. Remains a stub.
- **LayoutLM/Donut fine-tuned OCR**: Over-engineered for current scale. Gemini Flash vision is sufficient.
- **Vector search for menu retrieval**: NutriScout already uses pgvector for dish similarity. Adding a separate vector store (Qdrant/Pinecone) for menus would be redundant.

---

## 7. Relationship to Open Backlog Items

| Backlog Issue | Related Finding | Resolution Path |
|---------------|-----------------|-----------------|
| delivery=true is a no-op (MAJOR) | Delivery platform source is a stub | RED tier -- needs business contracts, not a code fix |
| photo_count: 0 but photos has 1 entry (MINOR) | photo-worker updates `photoCountAnalyzed` but initial seed may not set it | Fix in seed script or add migration to reconcile counts |
| Only 1 photo per dish (MINOR) | Ensemble analysis is not wired in | Item 4 above (wire ensemble) + seed more photos |
| Reviews are identical templates (MINOR) | Review worker processes real reviews; seed data is synthetic | Fix in seed script -- generate varied review text |
