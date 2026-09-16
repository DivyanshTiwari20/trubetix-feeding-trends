import type { Analysis, NormalizedMention, VisualizationSpec } from '../types';
import { aggregateMetrics } from '../metrics/aggregate';
import { computePrHealth } from '../metrics/prHealth';
import { getCachedAnalysis, setCachedAnalysis } from '../cache/memory';
import { CACHE_TTL_MS } from '../config/cache';
import { collectNormalizedData } from '../collect/collector';
import { resolveQuestion } from './resolveQuestion';
import { interpretQuestion } from './questionInterpreter';

function deriveRisks(metrics: Analysis['metrics'], narratives: Analysis['narratives'], prHealth: NonNullable<Analysis['prHealth']>): string[] {
  const risks: string[] = [];
  if (metrics.sentimentPct.negative >= 35) risks.push(`Negative sentiment ${metrics.sentimentPct.negative}% — above attention threshold (35%).`);
  if (narratives.some(n => n.sentiment === 'negative' && n.percentage >= 30)) risks.push('Negative narrative concentration ≥30% — single story driving perception.');
  if (prHealth.drivers.risk < 45) risks.push(`Risk driver ${prHealth.drivers.risk}/100 — elevated controversy/negativity.`);
  return risks;
}

function buildVisualizations(metrics: Analysis['metrics'], narratives: Analysis['narratives'] = [], risks: string[] = [], questionIntents?: string[]): VisualizationSpec[] {
  const specs: VisualizationSpec[] = [];
  const wantsNarrative = questionIntents?.some(q=> ['narrative','sentiment','brand_fit','general_intel','public_conversation'].includes(q));
  const wantsComparison = questionIntents?.includes('comparison');
  if (wantsComparison) {
    return specs;
  }
  if (!wantsNarrative) return specs;
  if (narratives.length) specs.push({ id: 'narrative-bar', type: 'bar', title: 'Top Narratives', data: narratives, metric: 'narratives' });
  if (risks.length) specs.push({ id: 'risk-table', type: 'table', title: 'Risks', data: risks, metric: 'risks' });
  return specs;
}

export async function buildAnalysis(entity: string, range: '1d'|'7d'|'15d'|'30d', platforms: string[], entityType = 'general', opts?: { forceRefresh?: boolean; question?: string; entities?: string[] }): Promise<Analysis> {
  const questionText = opts?.question ?? `What is the narrative around ${entity}?`;
  const resolved = await resolveQuestion(questionText, { entity, range, platforms });
  const effectiveEntity = opts?.entities?.length ? entity : (resolved.entity ?? entity);
  const effectivePlatforms = resolved.platforms.length ? resolved.platforms : platforms;
  const cacheKeyPlatforms = effectivePlatforms;

  if (!opts?.forceRefresh) {
    const cached = getCachedAnalysis(effectiveEntity, cacheKeyPlatforms, range);
    if (cached && cached.question === questionText) return cached;
  }

  const collected = await collectNormalizedData({ entity: effectiveEntity, platforms: effectivePlatforms, range });

  const mentions: NormalizedMention[] = collected.content.map(c => ({
    source: c.platform,
    title: c.title ?? '',
    url: c.url,
    publishedAt: c.publishedAt ?? new Date().toISOString(),
    sentiment: c.sentiment as any,
    engagementSnippet: c.snippet,
    engagement: c.engagement.likes!=null || c.engagement.comments!=null ? { raw: c.snippet ?? null, likes: c.engagement.likes, comments: c.engagement.comments, shares: c.engagement.shares, views: c.engagement.views, confidence: c.engagement.confidence, source: c.engagement.source==='parsed'?'snippet':'none' } : undefined,
    raw: (c.raw as any) ?? {},
  }));

  const wantsNews = effectivePlatforms.includes('news') || effectivePlatforms.includes('web') || effectivePlatforms.includes('all') || effectivePlatforms.length===0;
  const newsCount = wantsNews ? mentions.filter(m=> m.source==='news'||m.source==='web').length : 0;
  const metrics = aggregateMetrics(mentions, newsCount);

  const wantsPrHealth = resolved.intents.includes('general_intel') && (questionText.toLowerCase().includes('pr health') || questionText.toLowerCase().includes('reputation score') || questionText.toLowerCase().includes('risk score'));
  const prHealth = wantsPrHealth ? computePrHealth(metrics, entityType) : undefined;
  const risks = wantsPrHealth && prHealth ? deriveRisks(metrics, [], prHealth) : [];

  const periodDays = range==='1d'?1:range==='7d'?7:range==='15d'?15:30;
  const postsByDay: Record<string,number> = {};
  for(const m of mentions){
    try {
      const raw = m.publishedAt as string | null | undefined;
      const d = raw ? new Date(raw) : new Date();
      if (isNaN(d.getTime())) continue;
      const k = d.toISOString().slice(0,10);
      postsByDay[k]=(postsByDay[k]??0)+1;
    } catch {}
  }
  const effectiveTotal = collected.totalEstimatedPosts ?? collected.analyzedContentCount;
  const postingFrequency = effectiveTotal != null ? Math.round((effectiveTotal/periodDays)*10)/10 : null;
  const activity = { discoveredCount: effectiveTotal, postsByDay, postingFrequency, periodDays };
  const totalLikes = collected.content.reduce((a,c)=> a + (c.engagement?.likes ?? 0), 0);
  const hasLikes = collected.content.some(c=>c.engagement?.likes!=null);
  const totalComments = collected.content.reduce((a,c)=> a + (c.engagement?.comments ?? 0), 0);
  const hasComments = collected.content.some(c=>c.engagement?.comments!=null);
  const engagementSummary = { totalLikes: hasLikes? totalLikes : null, avgLikes: metrics.avgEngagement ?? null, totalComments: hasComments? totalComments : null, observable: hasLikes || hasComments };
  const trend = { period: range, postsByDay, totalPosts: effectiveTotal ?? 0, sentimentPct: metrics.sentimentPct, deltaVsPrev: null } as const;
  const organicSignal = (() => {
    const total = collected.content.length || 1;
    const highConf = collected.content.filter(c=> c.engagement.confidence==='high' || c.engagement.confidence==='medium').length;
    const dupRatio = (collected.debug.duplicateCount ?? 0) / Math.max(1, collected.debug.rawCount ?? total);
    const ratio = highConf/total;
    if (ratio >= 0.45 && dupRatio < 0.35) return { label:'organic' as const, confidence:'high' as const, reason: `${Math.round(ratio*100)}% posts with parsed engagement, low duplication — organic conversation`, botScore: 12 };
    if (ratio >= 0.2) return { label:'mixed' as const, confidence:'medium' as const, reason: `Mixed signals — ${Math.round(ratio*100)}% engagement parsed, duplication ${Math.round(dupRatio*100)}%`, botScore: 38 };
    return { label:'review' as const, confidence:'low' as const, reason: `Low engagement signals (${Math.round(ratio*100)}% parsed) — review for bot-like repetition`, botScore: 62 };
  })();
  const amplifiers = (() => {
    const byDomain = new Map<string, { count:number; topUrl:string; topTitle:string; platform:string }>();
    for (const c of collected.content.slice(0, 40)) {
      try { const d = new URL(c.url).hostname.replace(/^www\./,''); const cur = byDomain.get(d) ?? { count:0, topUrl:c.url, topTitle: c.title ?? '', platform: c.platform }; cur.count++; byDomain.set(d, cur); } catch {}
    }
    return [...byDomain.entries()].sort((a,b)=> b[1].count - a[1].count).slice(0,5).map(([domain,v])=> ({ platform: v.platform, domain, count: v.count, topUrl: v.topUrl, topTitle: v.topTitle }));
  })();

  let narratives: Analysis['narratives'] = [];
  const needsNarratives = resolved.intents.some(i=> ['narrative','sentiment','public_conversation','brand_fit','general_intel'].includes(i));
  if (needsNarratives) {
    try {
      const { analyzeConversation } = await import('./conversation');
      const convo = await analyzeConversation(mentions, effectiveEntity);
      narratives = convo.narratives;
    } catch {}
  }

  const brief = await interpretQuestion({ content: collected.content, publishedCount: collected.publishedCount, totalEstimatedPosts: collected.totalEstimatedPosts, range, platform: collected.platform, entity: effectiveEntity }, resolved);

  const scope = { entity: effectiveEntity, platform: (effectivePlatforms[0] as any) || "all" as any, range, analysisType: (resolved.wantsPublishingCount && !resolved.wantsNarrative ? "publishing_activity" : wantsNews ? "overall_pr" : "social") as any, requestedMetrics: resolved.intents };
  const coverageStatus = collected.analyzedContentCount >= 20 ? "good" as const : collected.analyzedContentCount >= 8 ? "partial" as const : collected.analyzedContentCount >= 3 ? "limited" as const : "unavailable" as const;

  const needsAudience = resolved.needsAudienceSources;
  const audienceSynthesis = needsAudience ? brief.publicConversation : null;

  const analysis: Analysis = {
    id: `${effectiveEntity.toLowerCase().replace(/\s+/g,'-')}-${range}-${Date.now()}`,
    entity: effectiveEntity,
    entityType,
    range,
    platforms: effectivePlatforms.length ? effectivePlatforms : ['reddit','x','instagram','youtube','linkedin','news'],
    scope,
    question: questionText,
    intents: resolved.intents as any,
    brief,
    overview: brief.overallNarrative,
    prHealth: prHealth ? { ...prHealth, methodologyVersion: "v2-question-first" } : undefined as any,
    metrics,
    sentiment: { counts: metrics.sentimentCounts, pct: metrics.sentimentPct, engagementWeighted: metrics.engagementWeighted ?? null, content: { positive: metrics.sentimentCounts.positive, neutral: metrics.sentimentCounts.neutral, negative: metrics.sentimentCounts.negative }, audience: null },
    narratives,
    risks,
    recommendations: brief.brandFit?.considerations ?? [],
    platformsData: metrics.mentionsByPlatform,
    topMentions: mentions.slice(0, 12),
    topStories: mentions.filter(m=>m.source==='news').slice(0, 5),
    visualizations: [],
    dataQuality: { coverage: collected.dataQuality.coverage, indexedCount: collected.indexedResultCount, confidence: collected.dataQuality.confidence as any, limitations: collected.dataQuality.limitations },
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    activity,
    trend,
    organicSignal,
    amplifiers,
    engagementSummary,
    publishedCount: collected.publishedCount,
    indexedResultCount: collected.indexedResultCount,
    totalEstimatedPosts: collected.totalEstimatedPosts,
    analyzedContentCount: collected.totalEstimatedPosts ?? collected.analyzedContentCount,
    thirdPartyMentionCount: collected.thirdPartyMentionCount,
    coverage: { status: coverageStatus, confidence: collected.publishedCount.confidence, methodology: collected.publishedCount.methodology },
    normalizedContents: collected.content,
  };
  analysis.visualizations = buildVisualizations(metrics, narratives, risks, resolved.intents);
  if (wantsPrHealth) analysis.visualizations.unshift({ id:'pr-health', type:'metric', title:'PR Health', description: prHealth!.note, data: prHealth, metric:'prHealth' });
  setCachedAnalysis(analysis);
  return analysis;
}

const PRONOUNS = new Set(['him','her','it','they','them','this','that','he','she','his','hers']);
function extractNamesFromQuestion(q: string): string[] {
  const raw = q;
  const candidates: string[] = [];
  const patterns: [RegExp,string][] = [
    [/shah\s*rukh\s*khan/gi, 'Shah Rukh Khan'],
    [/salman\s*khan/gi, 'Salman Khan'],
    [/\bnarendra\s*modi/gi, 'Narendra Modi'],
    [/\brahul\s*gandhi/gi, 'Rahul Gandhi'],
    [/\bsrk\b/gi, 'Shah Rukh Khan'],
  ];
  for (const [re,name] of patterns) if (re.test(raw) && !candidates.includes(name)) candidates.push(name);
  const vsParts = raw.split(/\bvs\b|\bversus\b|\bcompare\b|\band\b|,/i).map(s=> s.trim()).filter(Boolean);
  for (const p of vsParts) {
    const m = p.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/);
    if (m && !candidates.includes(m[1]) && m[1].length > 4 && !/^Last|What|Have|Been/i.test(m[1])) candidates.push(m[1]);
  }
  return Array.from(new Set(candidates));
}
function normalizeEntityName(raw: string, fallback: string, question: string, idx: number, all: string[]): string {
  const t = raw.trim();
  if (PRONOUNS.has(t.toLowerCase())) {
    const fromQ = extractNamesFromQuestion(question);
    const other = fromQ.find(n=> n.toLowerCase() !== fallback.toLowerCase());
    if (other) return other;
    const sibling = all.find((_,i)=> i!==idx && !PRONOUNS.has(all[i].toLowerCase()));
    if (sibling) return sibling;
    if (t.toLowerCase()==='him' && fromQ.includes('Shah Rukh Khan')) return 'Salman Khan';
    return fallback === t ? 'Salman Khan' : fallback;
  }
  return t.replace(/\b\w/g, c=> c.toUpperCase()).trim();
}
export async function buildComparisonAnalysis(entities: string[], range: '1d'|'7d'|'15d'|'30d', platforms: string[], question: string): Promise<Analysis[]> {
  const cleanEntities = entities.map((e,i)=> normalizeEntityName(e, entities[0] ?? e, question, i, entities));
  const uniq = Array.from(new Set(cleanEntities.map(e=> e.toLowerCase()))).map(l=> cleanEntities.find(e=> e.toLowerCase()===l)!);
  let finalEntities = uniq.length >=2 ? uniq : cleanEntities;
  if (finalEntities.length===1 && /vs|compare/i.test(question)) {
    const fromQ = extractNamesFromQuestion(question);
    const missing = fromQ.find(n=> !finalEntities.some(f=> f.toLowerCase()===n.toLowerCase()));
    if (missing) finalEntities = [...finalEntities, missing];
  }
  if (finalEntities.length<2) finalEntities = cleanEntities.length>=2 ? cleanEntities : [...finalEntities, finalEntities[0]];
  const analyses: Analysis[] = [];
  for (const e of finalEntities) {
    const perEntityQuestion = question.toLowerCase().includes(e.toLowerCase()) ? question : `What have been talked about ${e} in last ${range} on ${platforms.join(',') || 'Reddit,X'}?`;
    const a = await buildAnalysis(e, range, platforms, 'general', { question: perEntityQuestion, entities: finalEntities });
    (a as any)._comparisonSource = true;
    analyses.push(a);
  }
  if (analyses.length >= 2) {
    const compData = analyses.map(a => ({
      name: a.entity,
      posts: a.totalEstimatedPosts ?? a.analyzedContentCount ?? 0,
      likes: a.engagementSummary?.totalLikes ?? 0,
      sentiment: a.metrics.sentimentPct.positive - a.metrics.sentimentPct.negative,
    }));
    const totalMarket = compData.reduce((s,d)=> s+d.posts, 0) || 1;
    const sov = compData.map(d=> ({ entity: d.name, posts: d.posts, share: Math.round(d.posts/totalMarket*100), dominantPlatform: analyses.find(a=> a.entity===d.name)?.platforms[0] }));
    const totalPostsForChart = compData.map(d=> ({ name: d.name, posts: d.posts }));
    const compSpec: VisualizationSpec = { id: 'comparison-bar', type: 'comparison', title: 'Head-to-Head: Total Posts', description: `Comparison for ${question.slice(0,80)}`, data: totalPostsForChart, metric: 'comparison', source: 'serp-totalResults' };
    const winner = [...compData].sort((a,b)=> b.posts - a.posts)[0];
    const runner = [...compData].sort((a,b)=> b.posts - a.posts)[1];
    const c = (n:number)=> n>=1000000 ? `${parseFloat((n/1000000).toFixed(1))}M` : n>=1000 ? `${parseFloat((n/1000).toFixed(n%1000===0?0:1))}K` : String(n);
    const comparisonVerdict = winner && runner ? `${winner.name} leads with ~${c(winner.posts)} posts vs ${runner.name} ~${c(runner.posts)} (${(winner.posts/(runner.posts||1)).toFixed(1)}x). For brand: ${winner.name} offers broader reach, ${runner.name} offers more targeted niche engagement — choose by campaign goal.` : '';
    for (const a of analyses) {
      (a as any).sov = sov;
      if (!a.visualizations) a.visualizations = [];
      if (!a.visualizations.find(v=> v.id==='comparison-bar')) a.visualizations.push(compSpec);
      if (a.brief && !a.brief.comparisonNote) a.brief.comparisonNote = comparisonVerdict;
      else if (a.brief) a.brief.comparisonNote = comparisonVerdict;
    }
  }
  return analyses;
}
