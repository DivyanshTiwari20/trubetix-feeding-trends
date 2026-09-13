import { newsAdapter } from '../adapters/news';
import { webMentionsAdapter } from '../adapters/webMentions';
import { calculateScore } from '../scoring';
import { ScoreResult, NormalizedMention, Dossier } from '../types';
import { generateObject } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';
import { isQuotaError } from '../quota';

const TIER_1_OUTLETS = ['nytimes','nytimes.com','bbc','bbc.co.uk','bbc.com','variety','variety.com','reuters','reuters.com','wsj','wsj.com','bloomberg','bloomberg.com','theguardian','theguardian.com','cnn','cnn.com','washingtonpost','washingtonpost.com','apnews','apnews.com','cnbc','cnbc.com','ft','ft.com','forbes','forbes.com','businessinsider','businessinsider.com','techcrunch','techcrunch.com','wired','wired.com','theverge','theverge.com','hollywoodreporter','hollywoodreporter.com','deadline','deadline.com','npr','npr.org','time','time.com','newsweek','newsweek.com','usatoday','usatoday.com'];
function getSourceAuthority(url: string): 'tier1'|'tier2'|'tier3' { try { const h=new URL(url).hostname.replace('www.',''); return TIER_1_OUTLETS.includes(h)?'tier1':'tier2'; } catch { return 'tier3'; }}

const cache = new Map<string,{ at:number; data: ScoreResult }>();
const TTL = 5*60*1000;

const dossierSchema = z.object({
  identity: z.object({ displayName: z.string(), aliases: z.array(z.string()), category: z.string(), bio: z.string() }),
  officialProfiles: z.array(z.object({ platform: z.string(), handle: z.string(), url: z.string(), verified: z.boolean(), followers: z.string().optional() })).max(6),
  searchPresence: z.object({ summary: z.string(), visibility: z.string(), resultCount: z.string() }),
  mediaQuality: z.string(),
  mediaSentiment: z.object({ distribution: z.string(), narrative: z.string() }),
  mediaSOV: z.object({ estimatedSOV: z.string(), volumeNote: z.string() }),
  socialProfiles: z.array(z.object({ platform: z.string(), handle: z.string(), url: z.string(), metrics: z.string() })).max(5),
  socialSentiment: z.string(),
  topTopics: z.array(z.string()).min(1).max(6),
  topNarratives: z.array(z.string()).min(1).max(6),
  narrativeMomentum: z.string(),
  keyMessages: z.array(z.string()).min(1).max(5),
  messagePullThrough: z.string(),
  topJournalists: z.array(z.object({ name: z.string(), outlet: z.string() })).max(5),
  topInfluencers: z.array(z.object({ name: z.string(), platform: z.string(), note: z.string() })).max(5),
  audienceSignals: z.array(z.string()).min(1).max(5),
  competitorBenchmark: z.array(z.object({ name: z.string(), note: z.string() })).max(4),
  reputationRisks: z.array(z.string()).min(1).max(4),
  crisisTimeline: z.array(z.object({ date: z.string(), event: z.string(), sentiment: z.enum(['positive','negative','neutral']) })).max(5),
  searchReputation: z.string(),
  aiVisibility: z.string(),
  reputationGaps: z.array(z.string()).min(1).max(4),
  prOpportunities: z.array(z.string()).min(1).max(4),
  strategicRecommendations: z.array(z.string()).min(1).max(5),
  measurementKPI: z.array(z.object({ kpi: z.string(), target: z.string(), cadence: z.string() })).max(5),
});

function pad<T>(arr: T[] | undefined, min: number, filler: T): T[] {
  const a = arr ?? [];
  while (a.length < min) a.push(filler);
  return a;
}
function normalizeDossier(d: any): Dossier {
  d.topTopics = pad(d.topTopics, 1, 'Insufficient topic data for this window');
  d.topNarratives = pad(d.topNarratives, 1, d.topNarratives?.[0] ?? 'No distinct narrative detected');
  d.keyMessages = pad(d.keyMessages, 1, 'No key message pull-through detected');
  d.reputationRisks = pad(d.reputationRisks, 1, 'No acute risk flagged in window');
  d.reputationGaps = pad(d.reputationGaps, 1, 'No major gap identified');
  d.prOpportunities = pad(d.prOpportunities, 1, 'Monitor for opportunistic newsjacking');
  d.strategicRecommendations = pad(d.strategicRecommendations, 1, 'Maintain monitoring cadence');
  d.audienceSignals = pad(d.audienceSignals, 1, 'Audience signal limited in window');
  return d as Dossier;
}

export async function analyzeEntity(entity: string, range: '1d'|'7d'|'15d'|'30d'): Promise<ScoreResult> {
  const key = `${entity.toLowerCase()}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now()-hit.at < TTL) return hit.data;

  let mentions: NormalizedMention[] = [];
  try {
    const newsResult = await newsAdapter.fetchSignal(entity, range);
    if (newsResult.status==='ok') mentions.push(...newsResult.mentions);
  } catch(e){
    const q=isQuotaError(e); if(q.hit) throw Object.assign(new Error(`QUOTA:${q.retryAfter}`),{isQuota:true, retryAfter:q.retryAfter});
  }

  // Fetch web/social mentions via Serper (if configured)
  if (webMentionsAdapter.isConfigured()) {
    try {
      const webResult = await webMentionsAdapter.fetchSignal(entity, range);
      if (webResult.status === 'ok') mentions.push(...webResult.mentions);
    } catch (e) {
      console.warn('webMentions adapter failed:', e instanceof Error ? e.message : e);
    }
  }

  if (mentions.length===0) {
    const empty = calculateScore([], range);
    const res = { ...empty, stats:{positive:0,negative:0,neutral:0,tier1:0,tier2:0,tier3:0,total:0} };
    cache.set(key,{at:Date.now(), data:res});
    return res;
  }

  try {
    const payload = mentions.map((m,i)=>({id:i, title:m.title}));
    const { object } = await generateObject({
      model: google('models/gemini-3.5-flash'),
      providerOptions:{ google:{ thinkingConfig:{includeThoughts:false, thinkingBudget:0}}} as any,
      schema: z.object({ classifications: z.array(z.object({ id:z.number(), sentiment: z.enum(['positive','negative','neutral'])})) }),
      prompt:`Classify sentiment of headlines about "${entity}": ${JSON.stringify(payload)}`,
    });
    mentions = mentions.map((m,i)=>({ ...m, sentiment: object.classifications.find(c=>c.id===i)?.sentiment||'neutral', sourceAuthority: getSourceAuthority(m.url)}));
  } catch(e:any){
    const q=isQuotaError(e); if(q.hit) { mentions = mentions.map(m=>({ ...m, sentiment:'neutral' as const, sourceAuthority:getSourceAuthority(m.url)})); }
    else mentions = mentions.map(m=>({ ...m, sentiment:'neutral' as const, sourceAuthority:getSourceAuthority(m.url)}));
  }

  const scored = calculateScore(mentions, range);
  const stats = { positive: mentions.filter(m=>m.sentiment==='positive').length, negative: mentions.filter(m=>m.sentiment==='negative').length, neutral: mentions.filter(m=>m.sentiment==='neutral').length, tier1: mentions.filter(m=>m.sourceAuthority==='tier1').length, tier2: mentions.filter(m=>m.sourceAuthority==='tier2').length, tier3: mentions.filter(m=>m.sourceAuthority==='tier3').length, total: mentions.length };

  let dossier: Dossier | undefined;
  let analysis: ScoreResult['analysis'];
  try {
    const { object } = await generateObject({
      model: google('models/gemini-3.5-flash'),
      providerOptions:{ google:{ thinkingConfig:{includeThoughts:false, thinkingBudget:0}}} as any,
      schema: z.object({ dossier: dossierSchema, analysis: z.object({ executiveSummary: z.string(), sentimentNarrative: z.string(), keyThemes: z.array(z.string()).min(1).max(6), risks: z.array(z.string()).min(1).max(4), opportunities: z.array(z.string()).min(1).max(4), recommendations: z.array(z.string()).min(1).max(5), timelineInsights: z.string(), sourceAnalysis: z.string() }) }),
      prompt:`Senior PR analyst for "${entity}" ${range}. Score ${scored.compositeScore}/100 ${scored.label} breakdown ${JSON.stringify(scored.breakdown)} stats ${JSON.stringify(stats)} headlines: ${mentions.slice(0,8).map(m=>`[${m.sentiment}/${m.sourceAuthority}] ${m.title}`).join(' | ')}. Generate ONE concise dossier + analysis. Be specific, no filler. For handles use real URLs if known else "not verified".`,
    });
    dossier = normalizeDossier(object.dossier);
    analysis = { ...object.analysis, keyThemes: pad(object.analysis.keyThemes,1,'No theme'), risks: pad(object.analysis.risks,1,'No risk'), opportunities: pad(object.analysis.opportunities,1,'No opportunity'), recommendations: pad(object.analysis.recommendations,1,'Maintain watch') };
  } catch(e:any){
    const q=isQuotaError(e); if(q.hit) throw Object.assign(new Error(`QUOTA:${q.retryAfter}`),{isQuota:true, retryAfter:q.retryAfter});
    console.error('dossier gen failed',e);
    if (e?.cause?.message?.includes('Type validation failed') || e?.message?.includes('No object generated')) {
      try {
        const raw = (e as any)?.cause?.value ?? (e as any)?.value;
        if (raw?.dossier) { dossier = normalizeDossier(raw.dossier); analysis = raw.analysis; }
      } catch {}
    }
  }

  const res = { ...scored, analysis, dossier, stats } as ScoreResult;
  cache.set(key,{at:Date.now(), data:res});
  return res;
}
