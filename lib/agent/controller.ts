import { generateObject, generateText, tool } from 'ai';
import { z } from 'zod';
import { google } from '../google';
import { aggregateMetrics } from '../metrics/aggregate';
import type { Analysis, NormalizedMention, NormalizedSocialContent } from '../types';
import { CACHE_TTL_MS } from '../config/cache';
import { LIMITS, LOOP_MODEL, SYNTH_MODEL } from './limits';
import { EvidenceStore, isSufficient } from './evidence';
import { AGENT_SYSTEM_PROMPT, loopInstructions, planInstructions, synthesisInstructions } from './prompts';
import { executeTool, getToolDeclarations } from './tools';
import type { ExecCtx } from './tools';
import type { AgentPlan, AgentRequest, AgentResult, ToolCallRequest } from './types';

const planSchema = z.object({
  entities: z.array(z.object({ name: z.string(), type: z.string().default('general'), aliases: z.array(z.string()).default([]) })).min(1).max(3),
  intent: z.enum(['profile', 'sentiment', 'narrative', 'comparison', 'product_perception', 'event', 'other']).default('other'),
  timeRange: z.object({ from: z.string().nullable().optional(), to: z.string().nullable().optional(), label: z.string().default('last 7 days'), range: z.enum(['1d', '7d', '15d', '30d']).default('7d') }),
  priorityPlatforms: z.array(z.string()).default([]),
  initialQueries: z.array(z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()) })).max(3).default([]),
  notes: z.string().default(''),
});

export interface LoopHooks {
  planCall?: (question: string, history: string) => Promise<AgentPlan>;
  loopCall?: (prompt: string, tools: unknown) => Promise<ToolCallRequest[] | null>;
  synthCall?: (prompt: string) => Promise<string>;
}

async function defaultPlanCall(question: string, history: string): Promise<AgentPlan> {
  const tryOnce = async (repairHint?: string) => {
    const { object } = await generateObject({
      model: google(LOOP_MODEL),
      schema: planSchema,
      temperature: 0.2,
      prompt: planInstructions(question, history) + (repairHint ? `\nPrevious output invalid: ${repairHint}. Return valid JSON.` : ''),
    });
    return object;
  };
  try {
    const o = await tryOnce();
    return normalizePlan(o);
  } catch (e) {
    try {
      const o = await tryOnce(e instanceof Error ? e.message : 'schema error');
      return normalizePlan(o);
    } catch {
      return fallbackPlan(question);
    }
  }
}

function normalizePlan(o: z.infer<typeof planSchema>): AgentPlan {
  return {
    entities: o.entities.map(e => ({ name: e.name, type: e.type, aliases: e.aliases ?? [] })),
    intent: o.intent,
    timeRange: { from: o.timeRange.from ?? null, to: o.timeRange.to ?? null, label: o.timeRange.label, range: o.timeRange.range },
    priorityPlatforms: o.priorityPlatforms ?? [],
    initialQueries: (o.initialQueries ?? []).slice(0, 3),
    notes: o.notes ?? '',
  };
}

function fallbackPlan(question: string): AgentPlan {
  const phrase = question.replace(/[?"'.]/g, '').trim().slice(0, 80) || 'unknown entity';
  return {
    entities: [{ name: phrase, type: 'general', aliases: [] }],
    intent: 'other',
    timeRange: { from: null, to: null, label: 'last 7 days', range: '7d' },
    priorityPlatforms: [],
    initialQueries: [
      { tool: 'news_search', args: { query: phrase, entity: phrase } },
      { tool: 'web_search', args: { query: phrase, entity: phrase } },
    ],
    notes: 'fallback plan (plan step failed twice)',
  };
}

function toAiTools(): Record<string, object> {
  const decls = getToolDeclarations() as { name: string; description: string; parameters: unknown }[];
  const out: Record<string, object> = {};
  for (const d of decls) {
    out[d.name] = tool({ description: d.description, inputSchema: z.record(z.string(), z.unknown()) as unknown as z.ZodTypeAny });
  }
  return out;
}

async function defaultLoopCall(prompt: string): Promise<ToolCallRequest[] | null> {
  try {
    const res = await generateText({
      model: google(LOOP_MODEL),
      system: AGENT_SYSTEM_PROMPT,
      prompt,
      tools: toAiTools() as never,
      temperature: 0.25,
      maxOutputTokens: 800,
    } as never);
    const calls = (res as { toolCalls?: { toolName: string; input?: unknown; args?: unknown }[] }).toolCalls ?? [];
    if (!calls.length) return null;
    return calls.slice(0, 3).map(c => ({ name: c.toolName, args: ((c.input ?? c.args ?? {}) as Record<string, unknown>) }));
  } catch {
    return null;
  }
}

async function defaultSynthCall(prompt: string): Promise<string> {
  const res = await generateText({ model: google(SYNTH_MODEL), system: AGENT_SYSTEM_PROMPT, prompt, temperature: 0.4, maxOutputTokens: 1500 } as never);
  return (res as { text?: string }).text ?? '';
}

function evidenceToMentions(items: import('./types').EvidenceItem[]): NormalizedMention[] {
  return items.map(i => ({
    source: i.platform,
    title: i.title ?? '(untitled)',
    url: i.url ?? `evidence://${i.id}`,
    publishedAt: i.publishedAt ?? new Date().toISOString(),
    engagementSnippet: i.snippet,
    engagement: { raw: i.snippet, likes: i.metrics?.likes ?? null, comments: i.metrics?.comments ?? null, shares: i.metrics?.shares ?? null, views: i.metrics?.views ?? null, confidence: i.metrics ? 'medium' : 'none', source: i.metrics ? 'snippet' : 'none' },
    raw: { agentTool: i.tool, agentQuery: i.query } as Record<string, unknown>,
  }));
}

function buildAnalysesFromEvidence(opts: {
  plan: AgentPlan; range: '1d' | '7d' | '15d' | '30d'; store: EvidenceStore; synthText: string; question: string;
}): Analysis[] {
  const entities = opts.plan.entities.map(e => e.name);
  const isComparison = entities.length > 1;
  const perEntity = isComparison ? LIMITS.maxSynthesisItemsPerEntity : LIMITS.maxSynthesisItems;
  return entities.map((entity, idx) => {
    const items = opts.store.rankedBalanced([entity], perEntity);
    const all = items.length ? items : opts.store.ranked(perEntity);
    const mentions = evidenceToMentions(all);
    const metrics = aggregateMetrics(mentions, mentions.filter(m => m.source === 'news').length);
    const totalLikes = all.reduce((a, i) => a + (i.metrics?.likes ?? 0), 0);
    const hasLikes = all.some(i => i.metrics?.likes != null);
    const totalComments = all.reduce((a, i) => a + (i.metrics?.comments ?? 0), 0);
    const hasComments = all.some(i => i.metrics?.comments != null);
    const contents: NormalizedSocialContent[] = all.map((i, n) => ({
      id: `agent-${idx}-${n}-${i.id.slice(0, 8)}`,
      platform: (['instagram', 'x', 'reddit', 'youtube', 'news', 'web'].includes(i.platform) ? i.platform : 'web') as NormalizedSocialContent['platform'],
      url: i.url ?? `evidence://${i.id}`,
      title: i.title ?? undefined,
      snippet: i.snippet,
      publishedAt: i.publishedAt,
      ownership: 'unknown',
      engagement: { likes: i.metrics?.likes ?? null, comments: i.metrics?.comments ?? null, views: i.metrics?.views ?? null, shares: i.metrics?.shares ?? null, reposts: null, source: i.metrics ? 'parsed' : 'unknown', confidence: i.metrics ? 'medium' : 'none' },
      contentType: 'unknown',
      themes: [],
      confidence: 'medium',
      source: 'other',
      raw: { agentTool: i.tool },
    }));
    const directAnswer = opts.synthText.split('\n').slice(0, 4).join('\n').slice(0, 500) || `${entity}: insufficient evidence.`;
    return {
      id: `agent-${entity.toLowerCase().replace(/\s+/g, '-')}-${opts.range}-${Date.now()}-${idx}`,
      entity,
      entityType: opts.plan.entities[idx]?.type ?? 'general',
      range: opts.range,
      platforms: opts.plan.priorityPlatforms.length ? opts.plan.priorityPlatforms : ['reddit', 'x', 'instagram', 'youtube', 'news'],
      question: opts.question,
      intents: ['general_intel'],
      brief: {
        directAnswer,
        overallNarrative: opts.synthText.slice(0, 1400),
        keyThemes: [],
        publicConversation: null,
        overallImage: null,
        sentimentSummary: null,
        brandFit: null,
        comparisonNote: null,
        engagementNote: hasLikes || hasComments ? `~${totalLikes} likes where observable.` : null,
      },
      overview: opts.synthText.slice(0, 1400),
      prHealth: undefined as unknown as Analysis['prHealth'],
      metrics,
      sentiment: { counts: metrics.sentimentCounts, pct: metrics.sentimentPct, engagementWeighted: metrics.engagementWeighted ?? null },
      narratives: [],
      risks: [],
      recommendations: [],
      platformsData: metrics.mentionsByPlatform,
      topMentions: mentions.slice(0, 12),
      topStories: mentions.filter(m => m.source === 'news').slice(0, 5),
      visualizations: [],
      dataQuality: { coverage: `${all.length} agent items`, indexedCount: all.length, confidence: all.length >= 8 ? 'medium' : 'low', limitations: ['Agent evidence set; search-index derived, not a platform census.'] },
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      activity: { discoveredCount: all.length, postsByDay: {}, postingFrequency: null, periodDays: opts.range === '1d' ? 1 : opts.range === '7d' ? 7 : opts.range === '15d' ? 15 : 30 },
      engagementSummary: { totalLikes: hasLikes ? totalLikes : null, avgLikes: metrics.avgEngagement ?? null, totalComments: hasComments ? totalComments : null, observable: hasLikes || hasComments },
      indexedResultCount: all.length,
      totalEstimatedPosts: all.length,
      analyzedContentCount: all.length,
      thirdPartyMentionCount: all.length,
      normalizedContents: contents,
    } as Analysis;
  });
}

export async function runAgent(req: AgentRequest, hooks: LoopHooks = {}): Promise<AgentResult> {
  const deadline = Date.now() + LIMITS.wallClockBudgetMs;
  const store = new EvidenceStore();
  const seenCalls = new Set<string>();
  const historyText = (req.history ?? []).slice(-6).map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n');
  const planCall = hooks.planCall ?? defaultPlanCall;
  const loopCall = hooks.loopCall ?? defaultLoopCall;
  const synthCall = hooks.synthCall ?? defaultSynthCall;

  const toolCallsLog: AgentResult['meta']['toolCalls'] = [];
  let cacheHits = 0;
  let stoppedBy: string | null = null;
  let consecutiveFailures = 0;
  const unavailable = new Set<string>();
  const failedRecent: string[] = [];

  // 1. PLAN
  let plan: AgentPlan;
  try {
    plan = await planCall(req.question, historyText);
  } catch {
    plan = fallbackPlan(req.question);
  }
  if (req.entities?.length) {
    plan.entities = req.entities.slice(0, 3).map(n => ({ name: n, type: plan.entities[0]?.type ?? 'general', aliases: [] }));
  }
  if (req.range) plan.timeRange.range = req.range;
  if (req.platforms?.length) plan.priorityPlatforms = req.platforms;
  const entityNames = plan.entities.map(e => e.name);
  const aliases = [...new Set(plan.entities.flatMap(e => e.aliases ?? []))];
  const maxCalls = entityNames.length > 1 ? LIMITS.maxToolCallsComparison : LIMITS.maxToolCalls;
  const execCtx: ExecCtx = { range: plan.timeRange.range, aliases, store, seenCalls, fetchPageCount: 0 };

  const runCalls = async (calls: ToolCallRequest[]): Promise<void> => {
    const limited = calls.filter(c => !unavailable.has(c.name)).slice(0, LIMITS.maxToolsPerIteration);
    const results = await Promise.all(limited.map(c => executeTool(c.name, c.args, execCtx)));
    for (const r of results) {
      toolCallsLog.push({ tool: r.tool, ok: r.ok, fromCache: r.fromCache });
      if (r.fromCache) cacheHits++;
      if (r.error?.kind === 'rate_limit') unavailable.add(r.tool);
      if (!r.ok || r.error?.kind === 'empty') {
        consecutiveFailures++;
        failedRecent.push(r.tool);
      } else {
        consecutiveFailures = 0;
      }
    }
  };

  // First iteration: cheap prior-analyses lookup when entities exist.
  if (entityNames.length && Date.now() < deadline) {
    await runCalls(entityNames.slice(0, 2).map(n => ({ name: 'search_prior_analyses', args: { entity: n } })));
  }
  // Plan's initial queries (max 3, within budget).
  if (plan.initialQueries.length && Date.now() < deadline) {
    await runCalls(plan.initialQueries.map(q => ({ name: q.tool, args: { ...q.args as object, entity: ((q.args as { entity?: string }).entity ?? entityNames[0] ?? '') } })));
  }

  // 2. LOOP
  let iterations = 0;
  const paidCalls = () => toolCallsLog.filter(t => !t.fromCache).length;
  while (iterations < LIMITS.maxIterations && paidCalls() < maxCalls && Date.now() < deadline) {
    if (consecutiveFailures >= LIMITS.maxConsecutiveFailures) { stoppedBy = 'consecutive_failures'; break; }
    if (store.coverage(plan.timeRange.range, entityNames).saturated && isSufficient(store, plan.timeRange.range, entityNames, plan.entities[0]?.type ?? '')) {
      stoppedBy = 'sufficient_and_saturated';
      break;
    }
    const coverageLine = store.coverageLine(plan.timeRange.range, entityNames);
    const prompt = `${loopInstructions({
      question: req.question,
      planSummary: `${entityNames.join(' vs ')} | intent=${plan.intent} | range=${plan.timeRange.range} | platforms=[${plan.priorityPlatforms.join(',') || 'auto'}]`,
      coverageLine,
      itersLeft: LIMITS.maxIterations - iterations,
      callsLeft: maxCalls - paidCalls(),
      failedTools: failedRecent.slice(-3),
      unavailable: [...unavailable],
    })}\n\nPrior digests:\n${store.digestForModel()}`;
    let calls: ToolCallRequest[] | null = null;
    try {
      calls = await loopCall(prompt, getToolDeclarations());
    } catch {
      consecutiveFailures++;
      iterations++;
      continue;
    }
    if (!calls || !calls.length) break; // ready to synthesize
    iterations++;
    await runCalls(calls);
    if (Date.now() >= deadline) { stoppedBy = 'wall_clock'; break; }
    if (paidCalls() >= maxCalls) { stoppedBy = 'max_tool_calls'; break; }
  }
  if (!stoppedBy && iterations >= LIMITS.maxIterations) stoppedBy = 'max_iterations';

  // 3. SYNTHESIZE
  const topItems = entityNames.length > 1
    ? store.rankedBalanced(entityNames, LIMITS.maxSynthesisItemsPerEntity)
    : store.ranked(LIMITS.maxSynthesisItems);

  if (!topItems.length) {
    const attempted = [...new Set(toolCallsLog.map(t => t.tool))].join(', ') || 'none';
    const text = `I couldn't find sufficient evidence for "${entityNames.join(', ') || req.question}" in the last ${plan.timeRange.label}. Attempted: ${attempted}. Try narrowing the entity name, a different time range, or a specific platform.`;
    return {
      text,
      analyses: buildAnalysesFromEvidence({ plan, range: plan.timeRange.range, store, synthText: text, question: req.question }),
      insufficientEvidence: true,
      meta: { iterations, toolCalls: toolCallsLog, itemsRetained: 0, cacheHits, stoppedBy: stoppedBy ?? 'zero_evidence' },
    };
  }

  const evidenceBlock = topItems.map((i, n) =>
    `[${n}] (${i.entity}) ${i.platform} | ${i.source} | ${(i.publishedAt ?? '?').slice(0, 10)} | ${(i.title ?? '').slice(0, 120)} | ${i.snippet.slice(0, 300)}`).join('\n');
  const covLine = store.coverageLine(plan.timeRange.range, entityNames);
  const uncovered = [
    ...(['instagram'].filter(p => !store.coverage(plan.timeRange.range, entityNames).platforms.includes(p) && /celebrity|influencer|actor|creator|brand/i.test(plan.entities[0]?.type ?? '') ? `no Instagram data retrieved` : '')),
    ...[...unavailable].map(t => `${t} unavailable (rate-limited)`),
  ].filter(Boolean).join('; ');
  const limitNote = stoppedBy && stoppedBy !== 'sufficient_and_saturated' ? `Note: research stopped early (${stoppedBy}); confidence reflects available evidence.` : '';
  let synthText = '';
  try {
    synthText = await synthCall(synthesisInstructions(req.question, evidenceBlock, covLine, uncovered, limitNote));
  } catch {
    synthText = `${entityNames.join(', ')}: evidence gathered (${topItems.length} items). ${covLine}.`;
  }
  if (!synthText.trim()) synthText = `${entityNames.join(', ')}: ${topItems.length} items found. ${covLine}.`;

  return {
    text: synthText,
    analyses: buildAnalysesFromEvidence({ plan, range: plan.timeRange.range, store, synthText, question: req.question }),
    insufficientEvidence: false,
    meta: { iterations, toolCalls: toolCallsLog, itemsRetained: topItems.length, cacheHits, stoppedBy },
  };
}
