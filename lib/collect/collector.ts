import { fetchSerperQueries } from '../adapters/webMentions';
import { newsAdapter } from '../adapters/news';
import type { NormalizedMention, NormalizedSocialContent, PublishedCountEstimate, DataConfidence } from '../types';
import { buildQueriesForPlatforms, isNewsPlatform } from './queryBuilder';
import { dedupeMentions, normalizeUrl, parseDateSafe, isWithinRange, toNormalizedContent } from './normalize';
import { enrichOwnership } from './ownership';

export interface CollectInput {
  entity: string;
  platforms: string[];
  range: '1d'|'7d'|'15d'|'30d';
  handleHint?: string;
}

export interface CollectDebug {
  queries: { platform: string; query: string }[];
  rawCount: number;
  dedupedCount: number;
  duplicateCount: number;
  dateFilteredCount: number;
  perPlatformRaw: Record<string, number>;
  searchInformation?: Record<string, any>;
}

export interface CollectResult {
  entity: string;
  platform: string;
  range: '1d'|'7d'|'15d'|'30d';
  indexedResultCount: number;
  totalEstimatedPosts: number | null;
  analyzedContentCount: number;
  thirdPartyMentionCount: number;
  publishedCount: PublishedCountEstimate;
  content: NormalizedSocialContent[];
  debug: CollectDebug;
  dataQuality: { coverage: string; confidence: DataConfidence; limitations: string[] };
}

function rangeDays(r: string): number { return r==='1d'?1:r==='7d'?7:r==='15d'?15:30; }

function estimatePublishedCountFromOwned(owned: NormalizedSocialContent[], range: string): PublishedCountEstimate {
  if (owned.length===0) return { value:null, type:'unavailable', confidence:'none', evidenceCount:0, methodology:'No verified owned posts discovered via account-specific searches; total published count unavailable from publicly indexed data.' };
  if (owned.length>=3) {
    const est = Math.round(owned.length*1.2);
    return { value:est, type:'estimated', confidence: owned.length>=8?'high':owned.length>=5?'medium':'low', evidenceCount: owned.length, methodology:`Estimated from ${owned.length} verified owned posts discovered via account-specific searches, deduplicated and filtered by date range ${range}.` };
  }
  return { value:null, type:'unavailable', confidence:'low', evidenceCount: owned.length, methodology:`Only ${owned.length} owned post(s) found — insufficient evidence to estimate total published count.` };
}

export async function collectNormalizedData(input: CollectInput): Promise<CollectResult> {
  const { entity, range } = input;
  let platforms = (input.platforms ?? []).map(p=>p.toLowerCase()).filter(Boolean);
  const wantsNews = isNewsPlatform(platforms);
  const socialPlatforms = platforms.filter(p=> !['news','web'].includes(p));
  const effectivePlatforms = wantsNews && !socialPlatforms.length ? [] : socialPlatforms.length ? socialPlatforms : platforms;

  const queries = buildQueriesForPlatforms(entity, effectivePlatforms.length ? effectivePlatforms : (wantsNews ? [] : effectivePlatforms));
  const queryStrings = queries.map(q=>q.query);
  const wantsBuzz = socialPlatforms.some(p=> ['reddit','x','twitter','youtube'].includes(p)) || (!socialPlatforms.length && !wantsNews);

  let rawMentions: NormalizedMention[] = [];
  let perPlatformRaw: Record<string, number> = {};
  let searchInfo: Record<string, any> = {};
  let newsMentions: NormalizedMention[] = [];

  if (queryStrings.length) {
    const results = await fetchSerperQueries(queryStrings, range);
    for (const r of results) {
      rawMentions.push(...r.mentions);
      const plat = queries.find(q=>q.query===r.query)?.platform ?? 'unknown';
      perPlatformRaw[plat] = (perPlatformRaw[plat] ?? 0) + r.mentions.length;
      if (r.searchInformation) searchInfo[r.query] = r.searchInformation;
    }
  }

  if (wantsNews) {
    try {
      const nr = await newsAdapter.fetchSignal(entity, range);
      if (nr.status==='ok') newsMentions = nr.mentions;
    } catch {}
  }

  const allRaw = [...rawMentions, ...newsMentions];
  const rawCount = allRaw.length;
  const indexedResultCount = rawCount;
  let totalEstimatedPosts: number | null = null;
  if (Object.keys(searchInfo).length) {
    const totals: number[] = [];
    for (const v of Object.values(searchInfo)) {
      const raw = (v as any)?.totalResults ?? (v as any)?.total_results ?? (v as any)?.total;
      if (raw != null) {
        const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(n) && n > 0) totals.push(n);
      }
    }
    if (totals.length) {
      const socialPlatformsSet = new Set(socialPlatforms);
      const primaryTotals: number[] = [];
      for (const [q, info] of Object.entries(searchInfo)) {
        const plat = queries.find(x => x.query === q)?.platform;
        if (!plat || socialPlatformsSet.has(plat) || !socialPlatforms.length) {
          const raw = (info as any)?.totalResults ?? (info as any)?.total_results;
          if (raw != null) {
            const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n)) primaryTotals.push(n);
          }
        }
      }
      const candidate = primaryTotals.length ? Math.max(...primaryTotals) : Math.max(...totals);
      totalEstimatedPosts = candidate > rawCount ? candidate : rawCount;
    }
  }

  const needsSocialFilter = !wantsNews && effectivePlatforms.length > 0;
  let preDedup = allRaw;
  if (needsSocialFilter) {
    preDedup = allRaw.filter(m => {
      const plat = (()=>{ try{ const h=new URL(m.url).hostname.toLowerCase(); if(h.includes('instagram.com'))return 'instagram'; if(h.includes('x.com')||h.includes('twitter.com'))return 'x'; if(h.includes('reddit.com'))return 'reddit'; if(h.includes('youtube.com')||h.includes('youtu.be'))return 'youtube'; if(h.includes('linkedin.com'))return 'linkedin'; return 'web'; }catch{ return (m.source||'').toLowerCase(); }})();
      return effectivePlatforms.includes(plat) || effectivePlatforms.includes(plat==='x'?'twitter':plat);
    });
    if (preDedup.length===0) preDedup = allRaw;
  } else if (!wantsNews && platforms.length && platforms[0]!=='all') {
    // platform-specific: keep only matching domain
  }

  const { deduped, duplicateCount } = dedupeMentions(preDedup);

  const filteredByDate = deduped.filter(m => {
    const parsed = parseDateSafe(m.publishedAt);
    return isWithinRange(parsed.iso, range);
  });

  const dateFilteredCount = filteredByDate.length;

  const normalized = filteredByDate.map((m,i)=> toNormalizedContent(m, entity, i));
  const enriched = enrichOwnership(normalized, entity, input.handleHint);

  const analyzedContentCount = enriched.filter(c=> c.title && c.url).length;
  const thirdPartyMentionCount = enriched.filter(c=> c.ownership==='earned' || c.ownership==='fan').length;
  const owned = enriched.filter(c=> c.ownership==='owned');
  const publishedCount = estimatePublishedCountFromOwned(owned, range);

  const confidence: DataConfidence = indexedResultCount>=20?'high':indexedResultCount>=8?'medium':indexedResultCount>=3?'low':'none';
  const limitations = [
    'Results are publicly indexed/search-engine derived — not a complete platform census.',
    'Engagement parsed from snippets with confidence flag; unavailable = null, never 0.',
    'Published count estimated only from verified owned URLs; insufficient evidence → unavailable.',
    wantsNews ? 'News included per scope' : 'News excluded per platform-specific scope',
  ];

  const platformLabel = platforms.length ? platforms.join(',') : 'all';

  return {
    entity,
    platform: platformLabel,
    range,
    indexedResultCount,
    totalEstimatedPosts,
    analyzedContentCount,
    thirdPartyMentionCount,
    publishedCount,
    content: enriched,
    debug: { queries, rawCount, dedupedCount: enriched.length, duplicateCount, dateFilteredCount, perPlatformRaw, searchInformation: searchInfo },
    dataQuality: { coverage: `${enriched.length} indexed items across ${ Object.keys(perPlatformRaw).join(', ') || 'no platform'}`, confidence, limitations },
  };
}
