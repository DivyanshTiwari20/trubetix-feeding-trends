# Agent Migration Notes (Phase 1 — inspected 2026-10-11)

## 1. API entry points + UI contract

### `POST /api/chat` (`app/api/chat/route.ts`) — primary UI entry
Request: `{ messages: UIMessage[] ({role, parts|content}), chatId?: string, deepThinking?: boolean }`
`parts` include `text` + `tool-<name>` parts (`tool-ask_user_for_confirmation`, `tool-execute_pipeline`) with `state: call|input-available|output-available`, `input/args`, `output`, `toolCallId`.
Response: **streaming** via `result.toUIMessageStreamResponse()` (Vercel AI SDK `streamText`, `stopWhen: stepCountIs(5)`). Header `X-Chat-Id` set when chat created.
UI depends on: streamed text chunks + tool-call/result parts rendered by `ChatMessage` → `IntelligenceDashboard` / `QuestionBriefView` (cards from `execute_pipeline` output `analyses: Analysis[]`). Text-only post lists are banned — cards must come from pipeline output.
Side effects: auto-creates `Chat`, persists user+assistant messages via Prisma (`persistIncomingMessages`, `onEnd` handler stores text+parts, dedupes by id/content).

### Other routes (unchanged, not UI-streaming)
- `GET/POST /api/analysis` — zod `{entity, platforms|platform, range}` → `buildAnalysis()` → `Analysis` JSON (or `?view=collect` → `CollectResult`).
- `GET/POST /api/collect` — same input + `handleHint` → `collectNormalizedData()` → `CollectResult` JSON. Used by `/inspect` debug page.
- `GET/POST /api/search`, `/api/social`, `/api/chats`, `/api/chats/[id]`, `/api/chats/[id]/messages` — CRUD/history; no business logic.

## 2. Gemini calls
- Central provider: `lib/google.ts` → `createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY ?? GOOGLE_GENERATIVE_AI_API_KEY })`. No file repeats setup.
- Models (all hardcoded today): `models/gemini-3.5-flash-lite` everywhere (chat route, `news.ts` grounding fallback, `webMentions.ts` grounding fallback, `resolveQuestion.ts`, `classifyIntent.ts`, `questionInterpreter.ts`, `conversation.ts`).
- SDK: `ai` v7 + `@ai-sdk/google` v4. Chat uses `streamText` + `tool()` + `convertToModelMessages` (streaming, tools). All others use `generateText` (grounding) or `generateObject` (structured JSON via zod schema).
- Parsing: `generateObject` schema-validated; grounding reads `providerMetadata.google.groundingMetadata.groundingChunks[].web.{uri|url,title}`.
- No native function-calling loop today — chat route exposes 8 `tool()` defs and lets `streamText` multi-step (max 5) orchestrate. New agent must use same SDK `tool()` declarations.

## 3. System prompts (all inline, no separate file)
- `app/api/chat/route.ts:buildSystemPrompt()` — lean-pipeline prompt (~30 lines): voice, volume/comparison/sentiment rules, "repeat brief.directAnswer verbatim", follow-up inheritance, "ONLY data tool is execute_pipeline". Intent-specific suffixes appended (`casual_chat`/`ambiguous`/`volume_query`/`pdf_generation`/full params-present).
- `lib/services/resolveQuestion.ts` — resolver prompt (entity/platforms/range/intents, pronoun resolution, platform-default rules).
- `lib/services/classifyIntent.ts` — 4-way classifier prompt (casual/volume/full/pdf, confidence<0.7 → ambiguous).
- `lib/services/questionInterpreter.ts` — synthesis prompt (polished PR prose, banned-phrase list, volume-vs-buzz branching, K/M compact numbers).
- `lib/services/conversation.ts` — sentiment+narrative clustering prompt (title+snippet classification, 1–6 narratives).
- `lib/adapters/news.ts` / `webMentions.ts` — grounding prompts (`Search Google for: <q>...`, `Search the web for recent news...`).

## 4. SerpAPI/Serper implementation (`lib/adapters/webMentions.ts`, 250 lines)
- `rangeTbs(range)`: 1d→`qdr:d`, 7d/15d→`qdr:w`, 30d→`qdr:m`.
- `getSearchKey()`: `SERPER_API_KEY| SERPAPI_API_KEY|SERP_API_KEY` (rejects placeholder values).
- `parsePublishedAt(displayedLink?, date?)`: passes through `date` if present; else parses "N hours/days/weeks/months ago" → ISO; else `now`.
- `fetchViaSerper(q,tbs,key,page=1)`: POST `https://google.serper.dev/search` `{q,tbs,num:20,page}` → `{organic, searchInformation, ok, status}`.
- `fetchViaSerpApi(q,tbs,key)`: GET `serpapi.com/search.json?engine=google&q&num=20&tbs` → maps `organic_results` → serper shape.
- `fetchViaGemini(q,range)`: `generateText` + `useSearchGrounding`, extracts `groundingChunks` → up to 8 pseudo-organic results (fallback when no key or Serper+SerpAPI both fail).
- `fetchSingleQuery(q,range)`: Serper p1 → adaptive pagination (totalResults>500→10pgs, >200→7, >100→5, >50→4, >15→3, >8→2; plus `organic>=8→5` pages even without total) fetching pages 2..N in parallel; empty→SerpAPI fallback; 401/403→SerpAPI; other fail→Gemini grounding; zod-validates each item (`title,link url,snippet?,date?`) dropping malformed; builds `NormalizedMention{source:'search',title,url,publishedAt,engagementSnippet,raw}`.
- `fetchSerperQueries(queries,range)`: `Promise.all` over `fetchSingleQuery`, per-query try/catch → Gemini last-resort.
- `fetchPlatform(entity,platformId,site,tbs,key)`: Instagram-specific query = `"entity" site:<site>` via Serper (401/403→SerpAPI→Gemini); same zod filter, `source=platformId`.
- `webMentionsAdapter: SignalAdapter`: `fetchSignal(entity,range,{platform?})` filters `SOCIAL_PLATFORMS` by id/label match; no key→single Gemini OR-query; else `Promise.allSettled` per-platform `fetchPlatform`. `isConfigured = !!searchKey || !!GEMINI_API_KEY`.
- Instagram specifics: queries from `lib/collect/queryBuilder.ts` (`site:instagram.com "{e}"`, `site:instagram.com/p "{e}"`, `site:instagram.com/reel "{e}"`); date via `tbs`; engagement extraction downstream (`parseEngagement` on snippet+title, `+`-suffix aware e.g. `3.7K+ likes`); platform filter by hostname (`instagram.com`); ownership via `lib/collect/ownership.ts` (handle-path match → `owned`).

## 5. GNews (`lib/adapters/news.ts`, 90 lines)
- `fetchGNews(entity,range)`: `GNEWS_API_KEY` required; `days: 1d→1,7d→7,15d→15,30d→30`; `from=<today-days>`; GET `gnews.io/api/v4/search?q&from&lang=en&max=10&apikey` → up to 10 `{source:'news',title,url,publishedAt,raw}`, URL-validated. Non-OK → warn + `null`.
- `newsAdapter.fetchSignal`: GNews first; if non-empty return it; else Gemini grounding (`Search the web for recent news about "entity" from past <range>`) → groundingChunks → up to 8 mentions (publishedAt=`now`), then JSON-array-in-text fallback via `mentionSchema{title,url,publishedAt}`. Empty→`{ok,mentions:[]}`. `isConfigured = !!GEMINI_API_KEY || !!GNEWS_API_KEY`.

## 6. Other collectors
- Reddit/X/YouTube/LinkedIn: **no dedicated APIs**. All covered via Serper `site:` queries (`queryBuilder.ts` templates per platform) + `fetchSerperQueries` + `collector.ts`. State: working (indexed-search, not official APIs). `SOCIAL_PLATFORMS` (`lib/config/platforms.ts`) = reddit, twitter(x.com), instagram, youtube, linkedin, news. No Reddit/Twitter/Instagram credentials used even though `.env.example` lists them.
- Page fetching: **none exists** — no readability/fetch-page helper. Must build minimal one (spec Phase 6.4) with SSRF guard.
- `lib/services/discovery.ts`: thin wrappers `searchNews` (newsAdapter + `parseEngagement`), `searchWebMentions` (per-platform `webMentionsAdapter` fan-out), `discoverSocialPosts` (= searchWebMentions alias).

## 7. Normalization / extraction helpers
- `lib/collect/normalize.ts`: `normalizeUrl` (strip utm_*/fbclid/gclid/etc, hash, trailing slash, lowercase); `dedupeMentions` (URL-key then title+url content-key); `parseDateSafe` ("N ago"→low-conf ISO, `Date.parse`→medium, else null); `isWithinRange` (cutoff days + 2h grace, null→keep); `engagementFromSnippet` (snippet then title); `platformFromUrl` (hostname→platform, twitter→x); `contentTypeFromUrl`; `toNormalizedContent` (mention→`NormalizedSocialContent`, id `c-<idx>-<ts>-<hash>`).
- `lib/utils/engagement.ts`: `parseEngagement(snippet)` — patterns for likes/comments/shares/views/upvotes/♥ with `K/M/B` + `+` suffix, compact `4.8K` parsing, confidence none→low→medium→high(explicit keyword). Missing→`null` (never 0).
- `lib/collect/queryBuilder.ts`: `buildQueries(entity,platform,range)` + `buildQueriesForPlatforms` (multi-variant site: templates, sanitize quotes, slice 80, dedupe); `isNewsPlatform`.
- `lib/collect/ownership.ts`: `classifyOwnership` (instagram handle-path→owned else unknown; x/youtube/linkedin handle-path→owned else earned; reddit→earned; fan-keyword override); `enrichOwnership`.
- `lib/collect/collector.ts` (`collectNormalizedData`): builds queries → `fetchSerperQueries` (+ GNews iff `isNewsPlatform(['news','web'])`) → `totalEstimatedPosts` (max `searchInformation.totalResults` > rawCount else rawCount) → platform hostname filter → `dedupeMentions` → date filter → `toNormalizedContent`+ownership → counts (`indexedResultCount=rawCount`, `analyzedContentCount`, `thirdPartyMentionCount`, `publishedCount` estimated only if ≥3 owned, ×1.2) → `CollectResult{content, debug{queries,rawCount,perPlatformRaw,searchInformation}, dataQuality}`.

## 8. Database (Prisma + Postgres, `prisma/schema.prisma`)
- `Chat{id, title, createdAt, updatedAt, messages[]}` + `Message{id, chatId, role, content Text, parts Json?, createdAt}`. No analysis/cache/entity tables.
- Persisted: chat sessions + full message history (user text, assistant text + tool parts JSON). No cached analyses, no entities, no tool cache. Prior-analysis reuse = in-memory TTL map only (below).
- Implication: spec Phase 9 "cache in existing DB" requires **one additive table** (`AgentToolCache{key,tool,items JSON,createdAt,expiresAt}`) OR in-process LRU fallback. `search_prior_analyses` wraps Prisma chat/message search (no schema change needed).

## 9. Analysis logic (post-processing before/after Gemini)
- `lib/services/buildAnalysis.ts` (`buildAnalysis`, `buildComparisonAnalysis`): resolve question → cache check → `collectNormalizedData` → `NormalizedMention[]` map (engagement preserved) → `aggregateMetrics` → `computePrHealth` (only if question asks pr/reputation/risk) → activity/trend/organicSignal/amplifiers (deterministic) → `analyzeConversation` (Gemini sentiment+narratives, only for narrative/sentiment/conversation/brand/general intents) → `interpretQuestion` (Gemini brief: directAnswer/narrative/themes/conversation) → assemble canonical `Analysis` (id, scope, question, intents, brief, metrics, sentiment, narratives, risks, topMentions engagement-ranked top12, visualizations, dataQuality, activity, publishedCount/indexed/totalEstimated/analyzed counts). Comparison = per-entity `buildAnalysis` in sequence + SOV + `comparison-bar` viz + verdict.
- `lib/metrics/aggregate.ts`: counts, `mentionsByPlatform`, sentiment counts/pct (default neutral), `avgEngagement` (likes-only mean, null if none), `topEngaged` top5, coverage high≥8/moderate≥3/low>0.
- `lib/metrics/prHealth.ts`: `computePrHealth(metrics, entityType, momentum?)` — 0–100 from sentiment±, visibility (indexedCount/baseline × platform weight via `entityProfiles.ts`), engagement (log10 avg), risk (100−neg×1.2), momentum; label Excellent≥80/Good≥60/Mixed≥40/Poor≥20/Crisis.
- `lib/metrics/compare.ts`: `comparePeriods` deltas (mentionsGrowth%, sentimentDelta, negativeDelta, engagementDelta%).
- `lib/services/conversation.ts`: batch `generateObject` sentiment+narratives (≤30 items, prompt: title+snippet classification).
- Deterministic risks (`deriveRisks`): neg≥35%, negative narrative≥30%, risk driver<45.

## 10. Classification table
| KEEP & WRAP | REPLACE/RETIRE |
|---|---|
| Serper fetch + pagination + SerpAPI/Gemini fallbacks (`fetchSerperQueries`, `fetchSingleQuery`, `fetchViaSerper/SerpApi/Gemini`) | Fixed sequence inside `buildAnalysis` (always resolve→collect-everything→conversation→interpret) — agent must pick tools dynamically |
| `site:` query templates (`queryBuilder.ts`), `rangeTbs`, Instagram multi-variant queries + hostname filter + ownership | Chat-route hardcoded tool allowlists per intent + `MAX_STEPS=5` implicit orchestration |
| GNews fetch + grounding fallback (`newsAdapter`, `fetchGNews`) | Oversized `questionInterpreter.ts` synthesis prompt (~50 lines of style coaching) — replace with concise evidence-grounded template |
| Normalizers: `normalizeUrl`, `dedupeMentions`, `parseDateSafe`, `isWithinRange`, `parseEngagement`, `platformFromUrl`, `enrichOwnership` | `classifyIntent` 4-way + `resolveQuestion` + route carryover heuristics (triple entity/platform/range resolution) — single plan step covers it |
| DB access (`lib/db.ts` prisma, chat/message persistence) | In-memory `cache/memory.ts` keyed only by entity+platforms+range + question-equality — replace with tool-result cache + prior-analysis reader |
| Deterministic metrics (`aggregate`, `prHealth`, `compare`, risks, activity/trend/organic/amplifiers) | `buildComparisonAnalysis` name-mangling heuristics (`normalizeEntityName`, SRK/Salman special-cases) — plan-step aliases cover it |
| Canonical `Analysis`/`NormalizedSocialContent` types, `SOCIAL_PLATFORMS`, `entityProfiles` weights, `CACHE_TTL_MS` | Duplicate discovery wrappers (`discoverSocialPosts` ≡ `searchWebMentions`) — expose one tool |
| Grounding-chunk → mention mapping pattern (reuse for adapters) | |

## 11. UI response contract (must stay compatible)
- Chat UI streams `UIMessage`s; `ChatMessage` renders `text` parts as markdown + `tool-execute_pipeline` output `analyses: Analysis[]` via `IntelligenceDashboard`→`QuestionBriefView` (Top-3 cards or full paged cards, publishing card posts/likes/comments, evidence table; SocialPostCard Google-style row: platform·likes·date / blue title link / snippet / short URL / thumbnail).
- Non-streaming routes return plain JSON (`Analysis` / `CollectResult`).
- New agent final output MUST adapt to this: return `{ text, analyses }` where `analyses` are full `Analysis` objects (built via existing `buildAnalysis` from gathered evidence or via `interpretQuestion` on EvidenceItems) and `text = brief.directAnswer` verbatim. Markdown prose for chat; JSON for routes. Streaming: research silent, stream only final synthesis tokens.
- No DB schema change except optional additive `AgentToolCache`. No new heavy deps (zod already present). Legacy path unchanged when `AGENT_ENABLED=off`.

## 12. Deviations / open questions (updated end of migration)
- Prisma Postgres (Neon) exists — spec's "SQL/ORM simple migration" holds; chose in-process LRU tool cache (`lib/agent/cache.ts`) as the fallback path instead of adding an `AgentToolCache` table now, so **no schema change**. Table can be added later without touching tools (cache.ts is the seam).
- No contradictions blocking implementation: Gemini is server-side only, DB exists, Serper/GNews wrappers exist.
- **Kept & wrapped:** `fetchSerperQueries`/`fetchSingleQuery`/SerpAPI+Gemini fallbacks, `site:` queryBuilder (instagram variants byte-identical — regression-tested), GNews+grounding, all normalizers (`normalizeUrl`, `parseDateSafe`, `platformFromUrl`, `enrichOwnership`), Prisma chat/message access, deterministic metrics (`aggregate`, `prHealth`, `compare`).
- **Fixed (not just wrapped):** `parseEngagement` never returned likes/comments/shares/views — line 39 wrote into a throwaway object literal, so only the `·`-fallback ever worked. Minimal fix in `lib/utils/engagement.ts`; legacy pipeline benefits too (was silently dropping engagement it claimed to parse per Phase 23).
- **Fixed:** `EvidenceStore` eviction loop re-read shrinking `.size`, retaining 62/60 — same class of bug, fixed with precomputed `over`.
- **Replaced/retired (agent path only, legacy untouched):** fixed resolve→collect-everything→conversation→interpret sequence, per-intent tool allowlists, 4-way classifier + carryover heuristics (single plan step now), in-memory entity-cache reuse (tool cache + prior-analyses reader now).
- **Deprecated:** nothing deleted. Legacy orchestration stays fully functional behind `AGENT_ENABLED=off` (default). No `@deprecated` tags added yet — pending owner verification of the agent path.
- **New files:** `lib/agent/` (types, limits, evidence, cache, prompts, controller, routeAdapter, tools/{index,webSearch,newsSearch,instagramSearch,fetchPage,searchPriorAnalyses,normalize}, `__tests__/` ×6, 45 tests), `vitest.config.ts`, this doc. Modified: `app/api/chat/route.ts` (+13-line flag gate only), `package.json` (+test/typecheck scripts, +vitest devDep).
- **Response contract:** agent streams `text` + `tool-execute_pipeline{status,entities,range,platforms,question,analyses}` via `createUIMessageStream` — the exact part type `ChatMessage` renders. Verified by contract test + clean build.
- **Verification (2026-10-11):** 45/45 tests pass; `tsc --noEmit` clean; eslint clean on all new files (`app/api/chat/route.ts` has 51 pre-existing `no-explicit-any` errors, identical count on pristine HEAD — untouched); `next build` clean; legacy regression = flag default-off (tested) + gate-only diff.
- **Smoke (mocked network):** celebrity 7d → 1 iter, 3 paid calls, 9 items; iPhone perception → 1 iter, 2 paid, 3 items; Adidas vs Nike → 1 iter, 4 paid, 9 items. Typical real run ≈ 1 plan + 2–4 loop + 1 synthesis Gemini calls, est. <$0.01 on Flash-class pricing.
- **Open risks:** (1) loop `generateText`+tools path is exercised only via injected hooks in tests — first real-key run should confirm `toolCalls` parsing against installed `ai` v7; JSON-action fallback not implemented (native preferred per spec; add only if forced). (2) `fetch_page` extraction is heuristic (no readability dep) — capped at 3k chars, fine for contradiction checks. (3) Old oversized synthesis style (questionInterpreter) not reused by agent — brief tone differs until synthesis template is tuned on real runs. Set `AGENT_ENABLED=on` only after a real-key smoke of the three prompts above.
