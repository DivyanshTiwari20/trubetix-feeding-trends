# V2 MASTER ENGINEERING PROMPT

## PR & Social Intelligence Platform

You are working inside an existing Next.js PR/social-media intelligence application.

Your job is to upgrade the existing application into a significantly smarter, more professional **PR Intelligence & Social Media Health Analysis platform**.

Do NOT blindly rewrite the application.

First inspect the existing repository, architecture, package.json, Prisma schema, API routes, services, adapters, UI components, PDF generation, and current data flow.

Understand what already works and preserve it unless there is a clear architectural reason to change it.

The existing application already has:

* Next.js App Router
* Vercel AI SDK
* Gemini models
* Serper / SerpAPI search
* GNews
* Prisma + PostgreSQL/Neon
* Chat interface
* Entity/date-range analysis
* Social platform search through Google/search-engine queries
* PR scoring
* PDF report generation
* Search result normalization
* Intent classification
* Existing Gemini tools
* Existing analysis UI

The goal of V2 is to evolve this into a **professional PR/social intelligence product**, not merely a better chatbot.

---

# 1. PRODUCT VISION

Think like a senior PR analyst using this product inside a PR agency.

A user should be able to enter:

> Analyze [person/entity] for the last 7 days.

or:

> What's happening with [person] on social media?

or:

> Why is [person]'s PR health bad?

or:

> Compare [person]'s reputation this month with last month.

The application should investigate publicly available information, calculate reliable metrics, identify narratives and risks, and present the result through:

* conversational answers
* visual analytics
* structured dashboards/cards
* detailed reports
* PDF reports

The product must answer the questions a real PR/social-media analyst cares about:

### Visibility

* How much is this person being discussed?
* Where are they being discussed?
* Is attention increasing or decreasing?

### Sentiment

* Is the conversation positive, neutral, or negative?
* Is sentiment changing?
* What is causing negative sentiment?

### Narrative

* What are people talking about?
* What are the dominant narratives?
* Which narratives are positive?
* Which are negative?
* Which narratives are emerging?

### Reputation risk

* Are there developing controversies?
* Are negative narratives accelerating?
* Which topics require attention?

### Engagement

* Which posts/stories are getting attention?
* Which platforms are driving the conversation?
* What engagement information can actually be verified?

### Media

* What are important news outlets reporting?
* Which stories are repeated?
* Which stories appear authoritative?

### Momentum

* Is public perception improving or deteriorating?
* What changed compared with the previous period?

### PR recommendation

* What should a PR team pay attention to?
* What issue should be addressed first?
* What narrative appears worth amplifying?

The final product should feel like an intelligence dashboard, not an AI text generator.

---

# 2. IMPORTANT COST CONSTRAINT

This project is intentionally being built as cheaply as possible.

DO NOT introduce Apify, official social APIs, or other expensive third-party data providers in this V2 unless absolutely necessary.

The existing search-engine-based approach using:

* Serper
* SerpAPI fallback
* GNews
* Google/search-engine queries
* platform-specific site searches

should remain the primary data acquisition strategy.

The application already uses intelligent search queries such as:

`site:instagram.com`

`site:x.com`

`site:youtube.com`

etc.

Improve this system rather than replacing it.

The application should continue extracting whatever publicly available information can be reliably discovered through search.

If a value cannot be reliably obtained, mark it as unavailable rather than inventing it.

---

# 3. DO NOT BUILD A GIANT SOCIAL DATABASE IN V2

Do NOT create a system that permanently stores every discovered post/comment from the internet.

That would increase storage, complexity, cost, legal/privacy concerns, and maintenance for very little V2 benefit.

Instead implement a lightweight caching/reuse strategy.

The application should be able to cache:

* normalized search results
* discovered posts/mentions
* extracted engagement information
* sentiment analysis
* narrative analysis
* computed metrics
* completed analysis results

Use TTL-based caching.

A reasonable initial cache TTL is approximately 30 minutes, but make this configurable.

The purpose is:

User asks:

> Analyze Samarendra.

The application searches and analyzes.

Then the user asks:

> Why is Samarendra's PR health bad?

The application should reuse the existing analysis/search data from the current conversation/cache rather than performing the entire investigation again.

If the user asks for a genuinely new period or explicitly refreshes the analysis, perform a new search.

Design the caching layer so that it can later be replaced or expanded without rewriting the analysis engine.

---

# 4. CONTEXT-AWARE ANALYSIS

The application should understand conversation context.

Example:

User:

> Analyze Samarendra for 7 days.

Assistant performs analysis.

User:

> Why is his PR health bad?

The system should understand that "his" refers to Samarendra and reuse the relevant analysis.

User:

> Which platform is causing most of the negativity?

Reuse the analysis and answer from existing structured data.

User:

> Compare that with last month.

Now perform the additional historical search required for comparison.

Do NOT force the user to repeat the entity every time.

Implement a clean conversation/context resolver rather than relying on fragile string matching.

---

# 5. AGENTIC ANALYSIS FLOW

Replace the current overly rigid routing architecture gradually with a more flexible analysis planner.

The conceptual flow should be:

User Request
↓
Context / Intent Resolver
↓
Analysis Planner
↓
Search / Data Tools
↓
Normalized Data
↓
Deterministic Metrics
↓
Gemini Semantic Analysis
↓
Structured Analysis Object
↓
Chat + Visualizations + Dashboard + PDF

Gemini should determine WHAT needs to be investigated.

Code/tools should perform the actual investigation.

Deterministic code should calculate numerical metrics.

Gemini should interpret the evidence.

Never allow Gemini to invent numerical metrics.

---

# 6. ENTITY INTELLIGENCE

The application must support different entity types:

* celebrity
* actor
* musician
* influencer
* politician
* business leader
* brand
* company
* public figure
* organization

The analysis should NOT treat every entity identically.

For example:

### Celebrity / Actor

Instagram may receive higher relevance because visual/social audience activity is especially important.

Possible weighting:

Instagram > YouTube > X > News > other sources

### Politician

X/Twitter and news coverage may be more important.

Possible weighting:

X > News > YouTube > Instagram

### Influencer

Instagram / YouTube / TikTok-like sources may be more important depending on available data.

### Brand

News + Instagram + X + Reddit/reviews/community sources may be more important.

These should NOT be hardcoded as crude permanent scores.

Create a configurable:

`EntityProfile`

or equivalent configuration that determines platform relevance/weighting.

The weighting should influence the PR health calculation, not fabricate missing data.

If a platform has no reliable data, its weight should not magically create a score.

---

# 7. SOCIAL PLATFORM ARCHITECTURE

Keep the platform system modular.

Do not hardcode platform logic throughout the application.

Create a reusable platform configuration/provider structure containing things such as:

* platform name
* domain
* search query format
* display name
* icon
* default relevance weight
* supported data fields
* URL normalization rules

Initially support the platforms already present in the application and extend the architecture so additional platforms can be added easily.

Examples:

* Instagram
* X/Twitter
* YouTube
* Reddit
* LinkedIn
* News/Web

Do not claim that search results represent the complete activity of a platform.

Use terminology such as:

* discovered mentions
* discovered posts
* indexed mentions
* observable conversation

rather than pretending the application has complete platform coverage.

---

# 8. DATA MODEL

Create clean normalized internal types.

At minimum consider structures similar to:

```ts
SocialPost
SocialComment
NormalizedMention
ParsedEngagement
MetricSnapshot
Narrative
Analysis
VisualizationSpec
EntityProfile
```

However, do not blindly create database tables for everything.

Use the existing database where persistence provides actual value.

The key principle is:

### Source data

What was discovered.

### Metrics

What can be calculated deterministically.

### Analysis

What the evidence means.

### Visualization

How those metrics should be displayed.

These must remain separate.

Do not create one giant object containing everything.

---

# 9. SEARCH / DISCOVERY

Refactor the current search implementation into reusable discovery services.

Existing Serper → SerpAPI fallback should remain.

Create clean functions along the lines of:

```ts
searchWebMentions()
searchNews()
discoverSocialPosts()
```

The exact names can differ if the existing architecture has better conventions.

Search queries should become smarter.

For example, instead of only:

```text
"Samarendra" site:instagram.com
```

the system should be capable of generating multiple focused queries for:

* recent posts
* platform mentions
* important narratives
* controversy
* positive coverage
* negative coverage
* news
* engagement-related information

But control query volume carefully.

Do not explode API usage just because Gemini has discovered that humans invented infinite ways to ask the same question.

---

# 10. COMMENTS

Do NOT make comments a mandatory V2 dependency.

The current cheap search architecture may not reliably retrieve comments.

Therefore:

If comments are available through current public search/data sources, analyze them.

If comments are not available:

* do not fabricate comments
* do not fabricate comment counts
* do not pretend search snippets are complete comment datasets

Design the architecture so that a future `SocialDataProvider` can provide:

```ts
discoverPosts()
getPost()
getComments()
```

But DO NOT require Apify or another provider now.

This should be an extension point for a future version.

---

# 11. ENGAGEMENT DATA

The application should parse engagement values when they are actually present.

Examples:

* likes
* comments
* shares
* views
* reposts

Normalize them into structured numeric fields where possible.

For example:

```ts
{
  likes: 4800,
  comments: 230,
  shares: null,
  views: 120000
}
```

If the search result only says something vague such as:

> "4.8K likes"

parse it when safe.

If no reliable value exists:

```ts
likes: null
```

Never convert missing data into zero.

Zero means zero.

Unknown means unknown.

---

# 12. DETERMINISTIC METRICS

Create a dedicated metrics layer.

Do not calculate important numerical metrics inside Gemini.

Possible metrics:

### Volume

* discovered mentions/posts
* mentions by platform
* news coverage count

### Sentiment

* positive percentage
* neutral percentage
* negative percentage

### Engagement

* total observable engagement
* average engagement
* highest-engagement posts
* engagement by platform

### Momentum

* current-period volume
* previous-period volume
* percentage change

### Narrative

* narrative frequency
* sentiment by narrative
* narrative momentum

### PR Health

Create a transparent score composed of measurable signals.

The score must be explainable.

Example:

```text
PR Health: 64/100

Sentiment:       58
Visibility:      72
Engagement:      69
Risk:             51
Momentum:        66
```

The exact weights should be configurable rather than buried inside random functions.

Do not pretend this is an objective measurement of someone's reputation.

Label it clearly as an analytical/model-derived indicator based on observable data.

---

# 13. SENTIMENT ANALYSIS

Improve the existing title-only sentiment analysis.

Where enough textual evidence exists, sentiment should consider:

* headline
* snippet
* post text
* available comment text
* surrounding context

Avoid classifying based on a headline alone when richer evidence exists.

Store:

```ts
sentiment
sentimentScore
confidence
reason
```

Use structured Gemini output.

Batch analysis where possible to control Gemini costs.

Do not make one Gemini request per comment or post if a batched request can safely perform the same job.

---

# 14. NARRATIVE ANALYSIS

This is one of the most important V2 features.

Identify recurring conversation themes.

Example:

```text
Narrative:
"Recent controversy"

Mentions: 37
Sentiment: 82% negative
Momentum: increasing
Risk: high
```

Possible narrative categories:

* career/work
* controversy
* personal life
* achievement
* criticism
* political issue
* brand/product
* entertainment
* appearance/style
* social cause
* other

Do not restrict Gemini to these categories if the actual evidence suggests something else.

Narratives should be evidence-backed.

---

# 15. RISK DETECTION

Create a PR risk layer.

Identify:

* emerging negative narratives
* rapidly increasing negative sentiment
* repeated controversy coverage
* high-engagement negative stories
* potentially damaging claims
* narrative concentration

Clearly distinguish:

`reported fact`

from

`public allegation`

from

`model interpretation`

Do not state allegations as facts.

This is especially important for politicians, celebrities, and public figures.

---

# 16. VISUAL ANALYTICS

This is a CORE V2 requirement.

The product should NOT return a giant wall of text.

A PR analyst should be able to understand the situation visually within seconds.

Use a mature React-compatible chart/visualization library already present in the project if possible.

If no suitable library exists, inspect the existing dependencies and select a lightweight, mature chart library appropriate for Next.js.

Do not introduce a huge visualization framework unnecessarily.

Build reusable components such as:

```text
MetricCard
SentimentDonut
SentimentTrendChart
PlatformBreakdownChart
MentionVolumeChart
EngagementChart
NarrativeBarChart
NarrativeTrendChart
RiskCard
NarrativeTable
Timeline
ComparisonChart
```

Do not create one-off chart code inside every page.

All charts should consume typed data.

---

# 17. VISUALIZATION DATA MODEL

Create a structured visualization representation.

For example:

```ts
VisualizationSpec
```

It should contain things such as:

```ts
{
  id,
  type,
  title,
  description,
  data,
  metric,
  source
}
```

Supported types might include:

* metric
* line
* area
* bar
* donut
* pie
* table
* timeline
* comparison

Do NOT allow Gemini to generate arbitrary JavaScript/chart code.

Gemini may recommend what should be visualized, but the actual chart rendering must happen through predefined safe React components.

This is important for security, maintainability, consistency, and sanity.

---

# 18. CHART SELECTION

The system should intelligently decide which visualizations are useful.

For example:

If sentiment data exists:

→ Sentiment donut

If sentiment exists across multiple days:

→ Sentiment trend

If platform data exists:

→ Platform breakdown

If narratives exist:

→ Narrative bar chart

If historical comparison exists:

→ Comparison chart

If engagement exists:

→ Engagement chart

Do not show empty charts.

Do not show five charts merely because five charts exist.

Visualizations should answer meaningful PR questions.

---

# 19. CHAT EXPERIENCE

The chat should be able to return:

1. concise explanation
2. important metric cards
3. relevant charts
4. detailed analysis when requested

Example:

```text
PR Health: 61/100

Negative sentiment increased 18% this week, mainly driven by
two emerging narratives.
```

Then render:

* sentiment trend
* narrative chart
* risk card

The visual components should be embedded naturally into the conversation rather than forcing the user into a completely separate dashboard.

---

# 20. STRUCTURED ANALYSIS OBJECT

Create one canonical structured analysis object.

Conceptually:

```ts
Analysis {
  entity
  entityType
  range

  overview

  prHealth

  metrics

  sentiment

  narratives

  risks

  recommendations

  platforms

  topMentions

  topStories

  visualizations

  dataQuality

  generatedAt
}
```

The exact schema should be designed professionally after inspecting the current `ScoreResult` and dossier structures.

This object becomes the source of truth for:

* Chat
* UI cards
* Charts
* Dashboard
* PDF

Do NOT maintain separate incompatible representations for each output.

---

# 21. DATA QUALITY

This is essential.

Every analysis should understand the limitations of the underlying data.

For example:

```text
Data coverage: Moderate

Instagram: High
X: Moderate
YouTube: Low
News: High
```

Or:

```text
Observable mentions: 43
This is not a complete count of all platform activity.
```

Never present search-engine-discovered results as complete platform statistics.

The user should trust the application because it knows what it does NOT know.

---

# 22. HISTORICAL COMPARISON

Implement a lightweight comparison capability.

Example:

```text
This week vs previous week
This month vs previous month
```

Compare:

* mention volume
* sentiment
* negative sentiment
* engagement
* narratives
* PR health
* risk

The comparison engine should use actual data.

Do not create historical values if no historical analysis exists.

If historical data is unavailable, say so.

---

# 23. PDF

Refactor the existing PDF generation so it consumes the new canonical `Analysis` object.

The PDF should contain:

### Executive Summary

### PR Health

### Sentiment

### Media Coverage

### Social Platforms

### Narratives

### Risks

### Top Stories

### Engagement

### Recommendations

### Evidence/Data Sources

Include useful charts where practical.

Do not duplicate analysis logic inside the PDF generator.

The PDF is a rendering layer.

---

# 24. DATABASE / CACHE STRATEGY

Use the existing Prisma/Postgres infrastructure where useful.

Do NOT over-engineer the database.

Persist things that provide real product value:

* completed analyses
* cacheable normalized source data where appropriate
* analysis metadata
* timestamps
* entity/date range
* model/version information

Do not make `SocialPost` belong permanently to exactly one `Analysis`.

The same discovered post may be relevant to:

* 7-day analysis
* 30-day analysis
* historical comparison
* multiple conversations

Design reusable source data relationships if persistence is introduced.

But remember:

**Caching is not the same thing as building a permanent social-media archive.**

Keep the initial implementation lightweight.

---

# 25. MODEL / GEMINI USAGE

Control AI costs.

Use Gemini for:

* intent/context resolution
* narrative interpretation
* sentiment where necessary
* risk interpretation
* final synthesis

Do NOT use Gemini for:

* simple counting
* percentages
* sorting
* date filtering
* engagement arithmetic
* chart rendering
* deterministic calculations

Use normal TypeScript for those.

Batch Gemini requests where practical.

Reuse cached analysis when possible.

---

# 26. TOOLS

Refactor the existing tool architecture toward reusable tools such as:

```text
discover_social_posts
search_web_mentions
search_news
get_cached_analysis
aggregate_social_metrics
analyze_conversation
compare_periods
generate_report
```

The exact implementation should follow the existing Vercel AI SDK patterns.

Do not blindly delete the existing tools.

Maintain compatibility where needed during migration.

---

# 27. EXISTING SYSTEM PROMPT

The existing system prompt currently has rigid routing such as:

* casual_chat
* ambiguous
* volume_query
* pdf_generation
* full_analysis
* confirmation

Improve this architecture rather than simply making the prompt longer.

The system should become context-aware and tool-aware.

Do not put business logic into the system prompt that belongs in TypeScript.

The system prompt should define behavior and reasoning boundaries.

The application code should control actual execution.

---

# 28. UX / DESIGN

The application should look like a serious modern intelligence product.

Use:

* clean hierarchy
* restrained colors
* strong typography
* generous spacing
* subtle borders
* tasteful cards
* responsive layouts
* polished chart styling
* consistent iconography
* loading/skeleton states
* empty states
* error states
* data-quality indicators

Avoid:

* excessive gradients
* random colorful charts
* unnecessary animations
* dashboard clutter
* huge blocks of AI text

Charts should feel like they belong to the same product.

Create reusable design primitives rather than styling each component independently.

---

# 29. ENGINEERING QUALITY

This is extremely important.

Write the code as a senior production engineer would.

Requirements:

* modular architecture
* strong TypeScript types
* reusable components
* clear service boundaries
* no duplicated business logic
* no giant files where logic can be separated
* no hardcoded magic numbers
* centralized configuration
* proper error handling
* Zod validation at external boundaries
* safe handling of malformed search results
* graceful API failures
* typed tool inputs/outputs
* testable pure metric functions
* clear naming
* no unnecessary abstractions
* no hacks
* no temporary architecture disguised as final architecture

Do not introduce jargon-heavy abstractions merely to appear sophisticated.

Prefer simple, understandable engineering.

---

# 30. IMPLEMENTATION STRATEGY

Do NOT attempt to implement every possible V2 feature in one enormous rewrite.

Work incrementally.

### Phase 1

Inspect the repository and produce a concise implementation plan.

Then implement:

* canonical Analysis type
* improved context-aware request resolution
* reusable search/data layer
* deterministic metrics layer
* improved sentiment/narrative analysis
* configurable entity/platform weighting
* caching/reuse
* visual analytics
* updated chat UI
* updated PDF

### Phase 2

Add:

* historical comparison
* deeper narrative momentum
* improved risk detection
* richer engagement analysis
* better persistence

### Future V3

Potential future work:

* official APIs
* Apify or another social data provider
* deeper post/comment collection
* real-time monitoring
* alerts
* scheduled reports
* competitor comparison
* campaign tracking
* influencer/actor/network analysis
* advanced anomaly detection

Do NOT implement these V3 features now unless the existing architecture requires a small extension point for them.

---

# 31. NON-NEGOTIABLE RULES

1. Do not hallucinate data.
2. Do not claim search results represent complete platform activity.
3. Do not invent likes, comments, views, or shares.
4. Do not make Apify mandatory.
5. Do not introduce expensive APIs without a clear need.
6. Do not permanently store everything discovered.
7. Do not put deterministic calculations inside Gemini.
8. Do not allow Gemini to generate arbitrary chart code.
9. Do not duplicate analysis logic between chat, dashboard, and PDF.
10. Do not break currently working functionality unnecessarily.
11. Do not rewrite the entire application just for architectural purity.
12. Do not create giant components when reusable components are appropriate.
13. Do not create empty/useless charts.
14. Do not present model-derived PR scores as objective truth.
15. Clearly communicate data coverage and uncertainty.
16. Keep API usage and Gemini usage cost-conscious.
17. Preserve the existing Serper → SerpAPI fallback strategy.
18. Validate all external data.
19. Keep platform support extensible.
20. Build the architecture so deeper social-data providers can be added later without rewriting the application.

---

# 32. FINAL PRODUCT GOAL

When finished, the application should feel like:

**"Give me a public figure, brand, or organization and a time period, and I will investigate the observable online conversation, explain what is happening, show me the important numbers and trends visually, identify narratives and risks, and tell me what a PR team should care about."**

It should NOT feel like:

**"I searched Google and asked Gemini to summarize ten results."**

That distinction is the entire purpose of V2.

Before changing code, inspect the current repository thoroughly.

Then implement the architecture incrementally, reusing existing working functionality wherever possible.

After each major phase, verify:

* TypeScript compilation
* linting
* existing API behavior
* chat behavior
* analysis generation
* chart rendering
* PDF generation
* error handling

Keep the implementation production-quality, cost-conscious, modular, and maintainable.
