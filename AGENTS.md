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

## Data sourcing policy

- No scraping, anywhere, of any platform, ever. All external data comes from:
  1. GNews API for news (`news.ts`), with Gemini Search grounding as fallback
  2. Serper API (`google.serper.dev/search`) with site-restricted queries for social platforms (`webMentions.ts`) — querying Google's index via Serper, not the platforms' own servers
  3. Stub adapters for official paid APIs (`reddit.ts`, `twitter.ts`, `instagram.ts`, `seo.ts`), activated later only by adding real credentials to env vars
- Social platforms live in one config array (`SOCIAL_PLATFORMS`) in `webMentions.ts` — adding or removing a platform is a one-line change, never a rearchitecture
- User controls which platforms are included per query via a toggle UI; default is all platforms enabled
- Every adapter's output is validated per individual mention via Zod. One malformed mention is dropped and logged — it never fails the whole batch or crashes the pipeline
- If `SERPER_API_KEY` is missing or empty, `webMentions.ts` returns `coming_soon` — it does not silently fall back to Gemini grounding
- Gemini is used ONLY for: sentiment/source-tier classification, dynamic topic generation, intent classification, chat conversation, and narrative writing. Gemini never does the actual searching

## webMentions.ts query patterns

- Each platform in `SOCIAL_PLATFORMS` gets a site-restricted Serper query: `"entity" site:reddit.com`
- Date range via Serper's `tbs` parameter: `1d` → `qdr:d`, `7d` → `qdr:w`, `15d` → `qdr:w`, `30d` → `qdr:m`
- `num: 10` results per platform, all platforms fetched in parallel via `Promise.allSettled`
- Engagement snippet text (e.g. "4.8K+ likes") captured from Serper's `snippet` field and stored in `NormalizedMention.engagementSnippet`

## Intent classification

- 4-way classifier in `lib/services/classifyIntent.ts`: `casual_chat` | `volume_query` | `full_analysis` | `pdf_generation`
- Returns `ambiguous` when confidence < 0.7 for volume_query/full_analysis — route asks user to clarify
- Routing happens in `app/api/chat/route.ts` BEFORE any tools are invoked
- Tools (ask_user_for_confirmation, execute_pipeline) are only included for `full_analysis` intent
- PDF generation is always a separate, explicit ask — never auto-generated

## Persona

- Sharp, quick, a little playful in HOW it talks — never in WHAT the data says
- Numbers, scores, and reputational findings are always precise and serious
- Emoji: max 1-2 per reply, only when it genuinely adds tone, never on data
- Length: crisp, no padding — if the answer is one line, give one line

## Scoring policy

- The composite score is always computed by a deterministic formula (`lib/scoring.ts`) — sentiment + volume + trend + source-authority weighting
- Gemini writes the narrative/explanation on top of the number. Gemini never invents or overrides the score itself

## Architecture layering — do not violate

1. `/lib/adapters/*` — one file per data source, all implementing the shared `SignalAdapter` interface
2. `/lib/services/*` — orchestration only (e.g. `analyzeEntity.ts` calls adapters + scoring). API routes call services; API routes never contain business logic themselves
3. `/lib/scoring.ts` — pure function, no I/O, no model calls
4. `/components/*` — dumb, reusable, shadcn-based. Receive data as props, no business logic inside
   - `/components/layout/*` — AppShell parts (`AppSidebar`, `AppHeader`) — no chat logic, purely presentational
   - `/components/chat/*` — one concern per file: `ChatMessage` (render), `ChatInput` (hero+compact variants), `ChatWelcome` (orb+greeting+input+cards), `PromptCards` (grid), `ThinkingPanel`/`ScoreCard`/`AnalysisForm` — all props-driven, no duplication
   - `/components/ui/*` — shadcn primitives only, extended via `cva` variants not copy-paste classes
5. `/lib/types.ts` — all shared types (`AdapterResult`, `NormalizedMention`, `ScoreResult`) centralized here, every layer imports from this one place
6. `/lib/config.ts` — single source of truth for `HISTORY_GROUPS`, `PROMPT_CARDS`, `SIDEBAR_NAV` — adding a prompt or history group is a one-line config change, never a component edit
7. `/lib/google.ts` — centralizes `@ai-sdk/google` creation with `GEMINI_API_KEY` ↔ `GOOGLE_GENERATIVE_AI_API_KEY` fallback so no file repeats provider setup

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
