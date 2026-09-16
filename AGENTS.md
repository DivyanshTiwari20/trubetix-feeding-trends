# AGENTS.md — Standing Rules for This Repo

Read this file before starting any task in this codebase. If you make an architectural decision that isn't reflected here, update this file in the same session — don't leave decisions living only in chat history.

**Workflow Rule:** Divide work into parts. Update this `AGENTS.md` file after every section of a part is complete, before your token limit is reached, to track progress.


## Stack (locked — don't substitute without updating this file)

- Next.js App Router
- shadcn/ui + Tailwind + Radix — use prebuilt components for everything. No custom-built UI primitives. Reference `github.com/vercel/chatbot` for chat shell, sidebar, and chat-history patterns specifically — adapt it, don't rebuild it from scratch.
- Vercel AI SDK (`ai` + `@ai-sdk/google`) for Gemini — streaming, tool calls, thought/reasoning display
- Prisma + Neon Postgres — used for both dev and current deployment. When moving to Google Cloud, swap `DATABASE_URL` to Cloud SQL for PostgreSQL. Connection string change only, no code or schema change.
- `@react-pdf/renderer` for PDF report export
- Zod for all data validation
- Recharts for visual analytics — SentimentChart, PostingActivityChart, EngagementChart, NarrativeChart (no manual SVG)

## Data sourcing policy (V2 — cost-conscious, no Apify)

- No scraping, anywhere, ever. All external data comes from:
  1. GNews API for news (`lib/adapters/news.ts`), with Gemini Search grounding fallback — used ONLY when user asks for news/sentiment or includes news/web in scope
  2. Serper API (`google.serper.dev/search`) with site-restricted queries for social (`lib/adapters/webMentions.ts` + `lib/services/discovery.ts`) — querying Google's index via Serper, not platforms (smart query: `"entity" site:instagram.com` etc per `SOCIAL_PLATFORMS`)
  3. SerpAPI fallback when Serper 401/403
  4. Gemini grounding fallback when no Serper key — same `site:` query pattern
  5. Future `SocialDataProvider` extension point (`lib/providers/social.ts`) for Apify/official APIs — NOT required in V2
- Cost constraint: Serper/SerpAPI/GNews remain primary. Do NOT introduce Apify or paid social APIs unless explicitly approved.
- Social platforms live in one config array `SOCIAL_PLATFORMS` in `lib/config/platforms.ts` — one-line add/remove, never rearchitecture. Each entry: `{id,label,site,weight, icon, urlPattern}`.
- User controls platforms per query via toggle UI; default all enabled.
- Every adapter output Zod-validated per mention — one malformed mention dropped, never fails batch.
- If `SERPER_API_KEY` missing, `webMentions.ts` falls back to Gemini grounding with same `site:` queries — still indexed search, not hallucination.
- Discovery = indexed search results via Serper/SerpAPI/Google index — report as `indexedCount`. For platform-specific query (Instagram), count = discovered posts for that entity+platform+range. Never claim complete platform census.
- Engagement parsing: `ParsedEngagement {raw:string|null, likes:number|null, comments:number|null, shares:number|null, views:number|null, confidence:'high'|'medium'|'low'|'none', source:'snippet'|'none'}` — parse "4.8K" etc only when safe; unknown stays `null`, never 0. Sum only where likes!=null; report totalLikes = sum(observable) or null if none.
- Gemini used ONLY for: intent/context, sentiment/semantic classification on Reddit/X snippets, narrative clustering, synthesis. Never for counting/percentages/metrics/math — code does that. Gemini is intelligent agent over SERP results, not data source for counts.

## Discovery / webMentions query patterns

- Each platform in `SOCIAL_PLATFORMS` gets site-restricted Serper query: `"entity" site:reddit.com`
- Date range via `tbs`: `1d→qdr:d`, `7d→qdr:w`, `15d→qdr:w`, `30d→qdr:m`
- `num:10` per platform, parallel `Promise.allSettled` in `lib/services/discovery.ts` (wraps adapters)
- `discoverSocialPosts()` / `searchWebMentions()` / `searchNews()` are reusable — adapters never called directly from routes
- Engagement: `engagementSnippet` (raw) + `ParsedEngagement` (numeric, nullable, confidence). Never invent likes.

## Simple Pipeline (V2.2 — lean, user-asked-only)

- Default path for EVERY query:
  1. Resolve `entity/entities + platform(s) + range` via `resolveQuestion` (pronoun/context aware). `"for Instagram"` → `platforms:["instagram"]`. No platform mentioned + vague → ask user (one-line), don't guess.
  2. SERP indexed search (Serper → SerpAPI → Gemini grounding) with smart `site:` queries per `SOCIAL_PLATFORMS` + date `tbs`. Collect via `collectNormalizedData` (dedupe + date filter).
  3. Report: `totalPosts = analyzedContentCount` (deduped, date-filtered indexed items for that entity+platform+range) + `totalLikes = sum(likes where !=null)` + `totalComments` where observable. Missing = `null` → "—", never 0. List what was found (title/url/date/likes) — nothing extra.
  4. Gemini as intelligent agent ONLY on top of those SERP results — not as count source.
- Comparison: `entities=[A,B]` + same platform+range → run pipeline per entity in parallel, report side-by-side totals (posts/likes/comments) from indexed sets.
- Sentiment / "what are people talking about": route to Reddit/X (site:reddit.com / site:x.com) plus YouTube if in scope; classify sentiment from snippets via `conversation.ts`. `brand_fit/narrative` may include themes. News only via GNews when `news/web` in scope or user asks for news.
- News: `lib/adapters/news.ts` (GNews → grounding) only when scope includes news/web/all or question is news/sentiment-related. Instagram-only never calls GNews.
- Minimal output: answer what user asked, hide PR Health/risks/recommendations/visualizations unless explicitly requested. Methodology collapsed. Never pad with dossier/27-item/report language.

## Intent / Request resolution (V2)

- Resolver in `lib/services/resolveRequest.ts` (replaces 4-way): extracts `{entity, entityType, platforms[], range, metrics[], needsComments, needsComparison, output:'chat'|'dashboard'|'pdf', reuseAllowed}` from NL + conversation context
- Context preserved across turns: entity/range/platforms from last `Analysis` — "why is his health bad?" resolves `his`→last entity without re-asking
- Confidence-gated clarification only when ambiguity cannot be inferred (e.g. no entity and no prior context)
- `lib/services/analysisPlanner.ts` decides which tools to call — Gemini decides WHAT to investigate, code decides HOW
- Back-compat: old `casual_chat/volume_query/full_analysis/pdf_generation` mapped internally; `ask_user_for_confirmation`+`execute_pipeline` kept as aliases until Phase 2 removal

## Persona

- Sharp, quick, a little playful in HOW it talks — never in WHAT the data says
- Numbers, scores, and reputational findings are always precise and serious
- Emoji: max 1-2 per reply, only when it genuinely adds tone, never on data
- Length: crisp, no padding — if the answer is one line, give one line

## Scoring / Metrics policy (V2)

- Deterministic only: `lib/metrics/aggregate.ts` (counts/percents) + `lib/metrics/prHealth.ts` (PR health) + `lib/metrics/compare.ts` (momentum)
- `prHealth` is analytical index 0-100, not objective truth — always labeled as such, with drivers (sentiment, visibility, engagement, risk, momentum) and configurable weights via `lib/config/entityProfiles.ts`
- Gemini never does math — only classifies sentiment/narratives/emotion and writes interpretation on top of code-calculated numbers
- Scores use `ParsedEngagement` (nullable) — missing = null, never 0; platform weight ignored if no data

## Architecture layering — do not violate

1. `/lib/adapters/*` — one file per data source, all implementing the shared `SignalAdapter` interface
2. `/lib/services/*` — orchestration only (e.g. `analyzeEntity.ts` calls adapters + scoring). API routes call services; API routes never contain business logic themselves
3. `/lib/scoring.ts` → `lib/metrics/*` — pure functions, no I/O, no model calls (aggregate, prHealth, compare)
4. `/lib/providers/social.ts` — `SocialDataProvider {discoverPosts, getPost, getComments}` abstraction — V2 extension point, no Apify required now
5. `/lib/config/*` — `platforms.ts` (SOCIAL_PLATFORMS), `entityProfiles.ts` (weights per entityType), `cache.ts` (TTL=30m configurable)
6. `/components/*` — dumb, reusable, shadcn-based. Receive data as props, no business logic inside
   - `/components/layout/*` — AppShell parts (`AppSidebar`, `AppHeader`) — no chat logic, purely presentational
   - `/components/chat/*` — one concern per file: `ChatMessage` (render), `ChatInput` (hero+compact variants), `ChatWelcome` (orb+greeting+input+cards), `PromptCards` (grid), `ThinkingPanel`/`ScoreCard`/`AnalysisForm` — all props-driven, no duplication
   - `/components/analytics/*` — `MetricCard`, `SentimentDonut`, `PlatformBreakdown`, `NarrativeBar`, `RiskCard`, `ComparisonChart` — typed, consume `Analysis.metrics/visualizations`
   - `/components/intelligence/*` — `IntelligenceDashboard` (post-centric orchestrator), `AnalysisHeader`, `PRHealthCard`, `MetricGrid`, `SocialPostCard`, `Charts` (Recharts: Sentiment/PostingActivity/Engagement/Narrative), `DataCoverageCard`, `AnalysisSection`, `VisualizationRenderer` — dashboard-first, data→interpretation
   - `/components/ui/*` — shadcn primitives only (Card/Badge/Table/Alert/Separator/Progress/Tabs/ScrollArea/Skeleton etc), extended via `cva` variants not copy-paste classes
7. `/lib/types.ts` — all shared types (`Analysis`, `SocialPost`, `SocialComment`, `ParsedEngagement`, `Narrative`, `MetricSnapshot`, `VisualizationSpec`, `EntityProfile`, `AdapterResult`, `NormalizedMention`, `ScoreResult`) centralized here, every layer imports from this one place
8. `/lib/config.ts` — single source of truth for `HISTORY_GROUPS`, `PROMPT_CARDS`, `SIDEBAR_NAV` — adding a prompt or history group is a one-line config change, never a component edit
9. `/lib/google.ts` — centralizes `@ai-sdk/google` creation with `GEMINI_API_KEY` ↔ `GOOGLE_GENERATIVE_AI_API_KEY` fallback so no file repeats provider setup
10. `/lib/cache/*` — TTL cache for `Analysis` reuse by `entity+platforms+range`; never permanent social archive

## Canonical Analysis object (V2 source of truth)

`Analysis { id, entity, entityType, range, platforms[], overview, prHealth{score,label,drivers}, metrics(MetricSnapshot), sentiment{pos/neu/neg/mixed, pct, engagementWeighted}, narratives:Narrative[], risks, recommendations, topMentions(12), topStories, visualizations:VisualizationSpec[], dataQuality{coverage, indexedCount, confidence, limitations}, generatedAt, expiresAt, activity{discoveredCount, postsByDay, postingFrequency, periodDays}, engagementSummary{totalLikes, avgLikes, totalComments, observable} }` — consumed by chat + dashboard + PDF (no separate representations). Table shows `posts discovered` (indexedCount), not total; missing → "—"

## Visualization model

`VisualizationSpec { id, type:'metric'|'donut'|'bar'|'line'|'area'|'table'|'timeline'|'comparison', title, description, data, metric, source }` — Gemini recommends WHAT to show, code renders via whitelisted Recharts components. No arbitrary JS.

## Caching strategy (lightweight, NOT archive)

- TTL 30m (configurable `CACHE_TTL_MS`), key = `entity_norm + platforms_sorted + range`
- In-memory `Map` initially (`lib/cache/memory.ts`), swappable to Redis/DB without rewriting analysis
- Reuse when user asks follow-up ("why is his health bad?", "what about Instagram?", "compare last month" reuses + fetches delta window)
- Explicit refresh if user says "refresh" or new period requested; do not re-fetch identical data
- No permanent `SocialPost` storage in V2; Analysis JSON stores normalized snapshots only

## Agentic flow (V2)

`User NL → resolveRequest (context+intent) → analysisPlanner → [discoverSocialPosts|searchWebMentions|searchNews|getCachedAnalysis|aggregateSocialMetrics|analyzeConversation|comparePeriods] → deterministic metrics → Gemini interpretation → Analysis → IntelligenceDashboard (Recharts) → chat/visuals/PDF`

## Intelligence UX (dashboard-first, post-centric)

- Order: WHAT HAPPENED (posts discovered, frequency, sentiment, engagement, narratives) → SO WHAT (risks, verdict, recommendations)
- Instagram-specific: prioritize discovered Instagram posts, show Table (Post|Date|Likes|Comments|Views|Sentiment) with "—" for missing, cards via `SocialPostCard`, filtered by platforms[] when provided
- Use shadcn Card/Badge/Table/Alert/Separator + Recharts only — no manual SVG/div charts
- `IntelligenceDashboard` is single orchestrator for chat + PDF data; `ChatMessage` renders it data-first (dashboard before prose)

## UI requirements

- ChatGPT-style layout: sidebar with past chat sessions grouped by date, main chat pane, streaming responses
- Visible "thinking" panel: model thought summaries plus explicit pipeline step events (fetch, classify, score), shown as collapsible, auto-collapsing once the answer streams in
- Fully responsive across devices — sidebar collapses to a drawer on mobile
- Date range control (1 day / 7 days / 30 days) and platform toggle control sit alongside the chat input, not buried in a settings page

## Non-goals right now — do not build these unless this file is updated to say otherwise

- No auth / no login / no sessions
- No billing / no Stripe / no Razorpay
- No Docker
- No scraping of any platform
- No multi-tenant data isolation
- No PPTX export (PDF only)

## Before deploying anywhere with a public URL

Add a minimum access gate (shared password / basic auth middleware) before the app is reachable outside localhost. Without it, anyone with the URL can run entity searches on the project's Gemini billing. This is a hard requirement at deploy time, not optional.
## Progress Tracker

- [x] **Part 1: Setup & Dependencies**
- [x] **Phase 1: Chat Shell & Thinking UI**
- [x] **Phase 2: Entity Resolution**
- [x] **Phase 3: News Adapter + Scoring Engine**
- [x] **Phase 4: Cortex UI Clone (full-screen, no violet bg) — reusable ChatInput/ChatWelcome/PromptCards/AppSidebar/AppHeader, single config.ts**
- [x] **Phase 5: Refactor to scalable reusable components — no duplicated markup, page.tsx is 70 lines of orchestration only**
- [x] **Phase 6: Fix analysis pipeline — upgrade model to gemini-3.5-flash, enable Google Search grounding in news adapter, strengthen system prompt for reliable tool chaining**
- [x] **Phase 7: PDF Export — implemented @react-pdf/renderer for 1-2 page executive summary and mentions table, with download button in ScoreCard (using shadcn Select to prevent overflow clipping)**
- [x] **Phase 8: Single-confirm fix + Gemini-only platform strategy — fixed double-confirm (correct addToolOutput shape + hidden form after result), fixed 1d range bug (ThinkingPanel shows confirmed range), added webMentions adapter via site: grounding, centralized SOCIAL_PLATFORMS in config.ts, no extra API keys**
- [x] **Phase 9: Full 27-item PR Dossier — extended types with Dossier (1 identity → 27 evidence), upgraded analyzeEntity to generate dossier via Gemini grounded generateObject (handles, tier, SOV, sentiment, topics, risks, timeline, gaps, KPIs), rebuilt AnalysisReport as scalable 7-page modular dossier (cover/identity, media, social, actors, risk, strategy, evidence), selectable Summary(1p)/Full(7p)**
- [x] **Phase 10: PDF Rendering Redesign — fixed pagination to continuous flow (no one-section-per-page), A4 48pt margins, hierarchy 26pt/16pt/13pt/10.5pt, minimal black/white + single purple accent, markdown bold/italic/links rendered via parser, compact header, compact hero, compact metrics, readable tables with wrapping, widow/orphan control, eliminated collisions/empty space**
- [x] **Phase 11: Search Backend Swap + Smart Routing — swapped webMentions from Gemini grounding to Serper API, added 4-way intent classifier (casual_chat/volume_query/full_analysis/pdf_generation) with ambiguity handling, sharpened persona, PDF always explicit-ask-only, wired webMentions adapter into analyzeEntity pipeline**
- [x] **Phase 12: V2 Foundation — canonical Analysis/Metric/Narrative/ParsedEngagement types, EntityProfile weights, platform config modular (platforms.ts), TTL cache 30m (cache.ts+memory.ts), engagement parser (null≠0), provider abstraction (social.ts), discovery services (searchNews/discoverSocialPosts), deterministic metrics (aggregate/prHealth/compare), Analysis builder (buildAnalysis.ts), visual specs**
- [x] **Phase 13: V2 Agent & Evidence Layer — added 6 composable tools (discover_social_posts/search_web_mentions/search_news/get_cached_analysis/aggregate_social_metrics/compare_periods) alongside legacy execute_pipeline/volume_query (now also emits Analysis), rebuilt system prompt for agentic hierarchy (evidence: observed>indexed>estimated>unavailable, context preservation, cost-aware reuse), platform-aware scoring (entityProfiles weighting), PDF now consumes Analysis as source of truth (fallback to ScoreResult) via AnalysisReport + PdfDownloadButton duality**
- [x] **Phase 14: V2 Intelligence Completion — batch sentiment (title+snippet, mixed, confidence) via conversation.ts, narrative clustering (1-6 evidence-backed), deterministic risk layer (neg≥35%, concentration≥30%, risk<45), AnalysisView embedding (MetricCard/SentimentDonut/PlatformBreakdown/NarrativeBar/RiskCard+engagement+dataQuality), compare_periods rendered via ComparisonChart deltas, rich engagement (ParsedEngagement nullable) surfaced in metrics/topEngaged**
- [x] **Phase 15: V2 Correction — Dashboard-First — post-centric Instagram activity (Table with discovered posts, posting frequency, — for missing not 0, SocialPostCard with platform icon/sentiment/narrative/open source), shadcn Table/Alert/Separator/Badge, Recharts Sentiment/PostingActivity/Engagement/Narrative charts, IntelligenceDashboard orchestrator, VisualizationRenderer, activity{discoveredCount, postsByDay, postingFrequency}+engagementSummary in Analysis, platform-aware execute_pipeline (platforms param), ChatMessage data-first (dashboard before prose), build verified**
- [x] **Phase 16: V2 Critical Scope Fix — platforms extracted via classifier (instagram→["instagram"], empty→ask), AnalysisForm platform selector (chips + Overall), Instagram pipeline no longer calls GNews unless platform includes news/web/all, scope-aware buildAnalysis (filtered dedup, metrics on filtered set), raw JSON suppressed (focused discovered card), follow-ups reuse cached Analysis via get_cached_analysis (pronoun/platform/range inherited), duplicate key fix (uniqueKey), lite model thinkingConfig removed (3.5-flash-lite 400 fixed)**
- [x] **Phase 17: V2.1 Accuracy — PublishedCountEstimate (value/type/confidence/evidence/methodology) vs indexedResultCount vs analyzedContentCount vs thirdPartyMentionCount, ContentOwnership (owned/earned/fan/repost), NormalizedSocialContent, Engagement source/confidence, Posting frequency from publishedCount not indexed, Instagram owned discovery, DataConfidence labels, content vs audience sentiment split, soft 400 handling, dashboard shows Published/Indexed/Analyzed + methodology + Most Relevant vs Top Performing**
- [x] **Phase 18: Data Collection First — collector layer (queryBuilder multi-variant site: queries per platform, normalize dedup+date filter, ownership classify, engagement null≠0), count semantics strict (indexed vs analyzed vs thirdParty vs published unavailable), backend APIs /api/collect /api/search /api/social /api/analysis (platform-scoped, no secrets leaked), frontend /inspect data-inspection page (entity/platform/range, counts, queries debug, content table ownership/confidence), buildAnalysis now delegates to collector, GNews only when news/web in scope**
- [x] **Phase 19: Question-First Intelligence — resolveQuestion multi-intent (publishing_count/narrative/public_conversation/brand_fit etc), questionInterpreter (Gemini grounded brief: directAnswer→narrative→themes→publicConversation, no invented story, audience from Reddit/X/YouTube only), buildAnalysis question-adaptive (prHealth only on explicit request, brief embedded), chat route passes original question through pipeline, IntelligenceDashboard → QuestionBriefView (adaptive sections, selective evidence, hidden indexed noise, methodology collapsed), sentiment meaningful, engagement preserved**
- [x] **Phase 20: Simple Pipeline V2.2 — lean user-asked-only: SERP smart site: queries → totalPosts(analyzedCount)+totalLikes(sum where observable) per entity+platform+range, comparison parallel, sentiment via Reddit/X (+GNews only when news/web in scope), Gemini as intelligent agent over SERP results, QuestionBriefView shows publishing card (posts/likes/comments) + evidence table only, narrative/themes/sentiment only when requested, system prompt enforces nothing-extra**
