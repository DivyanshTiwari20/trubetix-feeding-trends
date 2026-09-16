import { z } from 'zod';
import { SignalAdapter, AdapterResult, NormalizedMention } from '../types';
import { generateText } from 'ai';
import { google } from '@/lib/google';
import { SOCIAL_PLATFORMS } from '@/lib/config/platforms';
export { SOCIAL_PLATFORMS } from '@/lib/config/platforms';

const serperResultSchema = z.object({
  title: z.string().min(1),
  link: z.string().url(),
  snippet: z.string().optional(),
  date: z.string().optional(),
});

function rangeTbs(range: string): string {
  switch (range) {
    case '1d': return 'qdr:d';
    case '7d': return 'qdr:w';
    case '15d': return 'qdr:w';
    case '30d': return 'qdr:m';
    default: return 'qdr:w';
  }
}

function getSearchKey(): string | undefined {
  const k = process.env.SERPER_API_KEY || process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!k || k === 'your_serper_key_here' || k === 'your_serpapi_key_here') return undefined;
  return k.trim();
}

function parsePublishedAt(displayedLink?: string, date?: string): string {
  if (date) return date;
  if (!displayedLink) return new Date().toISOString();
  const lower = displayedLink.toLowerCase();
  const now = Date.now();
  const ago = lower.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/);
  if (ago) {
    const n = parseInt(ago[1], 10);
    const unit = ago[2];
    const ms = unit.startsWith('hour') ? n * 3600000 : unit.startsWith('day') ? n * 86400000 : unit.startsWith('week') ? n * 7 * 86400000 : n * 30 * 86400000;
    return new Date(now - ms).toISOString();
  }
  return new Date().toISOString();
}

async function fetchViaSerper(q: string, tbs: string, key: string, page: number = 1): Promise<{ organic: any[]; searchInformation?: any; ok: boolean; status: number }> {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, tbs, num: 10, page }),
    });
    if (!res.ok) return { organic: [], ok: false, status: res.status };
    const data = await res.json();
    return { organic: data?.organic ?? [], searchInformation: data?.searchInformation, ok: true, status: 200 };
  } catch {
    return { organic: [], ok: false, status: 0 };
  }
}

async function fetchViaSerpApi(q: string, tbs: string, key: string): Promise<{ organic: any[]; searchInformation?: any; ok: boolean; status: number }> {
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&api_key=${key}&num=10&tbs=${encodeURIComponent(tbs)}`;
    const res = await fetch(url);
    if (!res.ok) return { organic: [], ok: false, status: res.status };
    const data = await res.json();
    const organic: any[] = data?.organic_results ?? [];
    const total = data?.search_information?.total_results;
    const si = total ? { totalResults: total } : data?.searchInformation;
    const normalized = organic.map((o: any) => ({
      title: o.title,
      link: o.link,
      snippet: o.snippet ?? o.displayed_link ?? '',
      date: o.date ?? parsePublishedAt(o.displayed_link, o.date),
      displayed_link: o.displayed_link,
      thumbnail: o.thumbnail ?? o.image ?? null,
    }));
    return { organic: normalized, searchInformation: si, ok: true, status: 200 };
  } catch {
    return { organic: [], ok: false, status: 0 };
  }
}

async function fetchViaGemini(q: string, range: string): Promise<{ organic: any[]; searchInformation?: any }> {
  try {
    const res: any = await generateText({
      model: google('models/gemini-3.5-flash-lite'),
      providerOptions: { google: { useSearchGrounding: true } } as any,
      prompt: `Search Google for: ${q} from past ${range}. Return 8 real results with title, url, snippet, published date.`,
    });
    const chunks: any[] = res.providerMetadata?.google?.groundingMetadata?.groundingChunks ?? (res as any).groundingMetadata?.groundingChunks ?? [];
    const organic: any[] = [];
    const seen = new Set<string>();
    for (const c of chunks) {
      const web = c.web ?? c;
      const uri = web?.uri ?? web?.url;
      const title = web?.title;
      if (uri && title && !seen.has(uri)) {
        seen.add(uri);
        organic.push({ title: title.slice(0, 160), link: uri, snippet: title, date: new Date().toISOString() });
        if (organic.length >= 8) break;
      }
    }
    return { organic, searchInformation: organic.length ? { totalResults: organic.length } : undefined };
  } catch {
    return { organic: [] };
  }
}

async function fetchSingleQuery(q: string, range: string): Promise<{ mentions: NormalizedMention[]; searchInformation?: { totalResults?: number }; error?: string }> {
  const tbs = rangeTbs(range);
  const key = getSearchKey();
  let organic: any[] = [];
  let searchInformation: any = undefined;

  if (key) {
    const r = await fetchViaSerper(q, tbs, key, 1);
    if (!r.ok && (r.status === 403 || r.status === 401)) {
      const fb = await fetchViaSerpApi(q, tbs, key);
      organic = fb.organic;
      searchInformation = fb.searchInformation;
    } else if (r.ok) {
      organic = [...r.organic];
      searchInformation = r.searchInformation;
      const tr = searchInformation?.totalResults ? parseInt(String(searchInformation.totalResults).replace(/[^0-9]/g, ''), 10) : 0;
      const pages = tr > 500 ? 10 : tr > 200 ? 7 : tr > 100 ? 5 : tr > 50 ? 4 : tr > 15 ? 3 : tr > 8 ? 2 : 1;
      if (pages > 1 && organic.length >= 6) {
        const pageNums = Array.from({length: pages-1}, (_,i)=> i+2);
        const extras = await Promise.all(pageNums.map(p=> fetchViaSerper(q, tbs, key, p)));
        for (const e of extras) if (e.ok && e.organic.length) { organic = organic.concat(e.organic); if (!searchInformation?.totalResults && e.searchInformation?.totalResults) searchInformation = e.searchInformation; }
      }
      if (organic.length === 0) {
        const fb = await fetchViaSerpApi(q, tbs, key);
        if (fb.ok && fb.organic.length) { organic = fb.organic; searchInformation = fb.searchInformation; }
      }
    } else {
      const fb = await fetchViaSerpApi(q, tbs, key);
      if (fb.ok) { organic = fb.organic; searchInformation = fb.searchInformation; }
      else {
        const g = await fetchViaGemini(q, range);
        organic = g.organic; searchInformation = g.searchInformation;
        if (!organic.length) return { mentions: [], searchInformation, error: `Search unavailable (${r.status})` };
      }
    }
  } else {
    const g = await fetchViaGemini(q, range);
    organic = g.organic;
    searchInformation = g.searchInformation;
  }
  if (!organic) organic = [];
  const mentions: NormalizedMention[] = [];
  for (const item of organic) {
    const parsed = serperResultSchema.safeParse(item);
    if (!parsed.success) continue;
    mentions.push({
      source: 'search',
      title: parsed.data.title,
      url: parsed.data.link,
      publishedAt: parsed.data.date ? parsePublishedAt(undefined, parsed.data.date) : new Date().toISOString(),
      engagementSnippet: parsed.data.snippet ?? (item as any).displayed_link,
      raw: item as Record<string, unknown>,
    });
  }
  return { mentions, searchInformation };
}

export async function fetchSerperQueries(queries: string[], range: string): Promise<{ query: string; mentions: NormalizedMention[]; searchInformation?: { totalResults?: number }; error?: string }[]> {
  if (!queries.length) return [];
  return Promise.all(queries.map(async (q) => {
    try {
      const { mentions, searchInformation, error } = await fetchSingleQuery(q, range);
      return { query: q, mentions, searchInformation, error };
    } catch (e: any) {
      const g = await fetchViaGemini(q, range);
      const mentions: NormalizedMention[] = g.organic.map((o: any) => ({
        source: 'search',
        title: o.title,
        url: o.link,
        publishedAt: o.date ?? new Date().toISOString(),
        engagementSnippet: o.snippet,
        raw: o,
      }));
      if (mentions.length) return { query: q, mentions, searchInformation: g.searchInformation };
      return { query: q, mentions: [], error: e?.message ?? 'Search failed' };
    }
  }));
}

async function fetchPlatform(entity: string, platformId: string, site: string, tbs: string, apiKey: string): Promise<NormalizedMention[]> {
  const q = `"${entity}" site:${site}`;
  const r = await fetchViaSerper(q, tbs, apiKey);
  let organic = r.organic;
  if (!r.ok && (r.status === 403 || r.status === 401)) {
    const fb = await fetchViaSerpApi(q, tbs, apiKey);
    if (fb.ok) organic = fb.organic;
    else {
      const g = await fetchViaGemini(q, '7d');
      organic = g.organic;
    }
  }
  const mentions: NormalizedMention[] = [];
  for (const item of organic) {
    const parsed = serperResultSchema.safeParse(item);
    if (!parsed.success) continue;
    mentions.push({
      source: platformId,
      title: parsed.data.title,
      url: parsed.data.link,
      publishedAt: parsed.data.date ?? new Date().toISOString(),
      engagementSnippet: parsed.data.snippet,
      raw: item as Record<string, unknown>,
    });
  }
  return mentions;
}

export const webMentionsAdapter: SignalAdapter = {
  name: 'webMentions',
  isConfigured: () => !!getSearchKey() || !!process.env.GEMINI_API_KEY,
  fetchSignal: async (entity: string, range: string, options?: { platform?: string }): Promise<AdapterResult> => {
    const apiKey = getSearchKey();
    const tbs = rangeTbs(range);
    let targetPlatforms = SOCIAL_PLATFORMS as readonly typeof SOCIAL_PLATFORMS[number][];
    if (options?.platform) {
      const searchStr = options.platform.toLowerCase();
      const matched = SOCIAL_PLATFORMS.filter(p => p.id.toLowerCase() === searchStr || p.label.toLowerCase().includes(searchStr));
      if (matched.length > 0) targetPlatforms = matched as any;
    }
    try {
      if (!apiKey) {
        const g = await fetchViaGemini(`"${entity}" ${targetPlatforms.map(p => `site:${p.site}`).join(' OR ')}`, range);
        const mentions: NormalizedMention[] = g.organic.map((o: any) => ({
          source: 'web',
          title: o.title,
          url: o.link,
          publishedAt: o.date ?? new Date().toISOString(),
          engagementSnippet: o.snippet,
          raw: o,
        }));
        return { status: 'ok', mentions };
      }
      const results = await Promise.allSettled(targetPlatforms.map((p) => fetchPlatform(entity, p.id, p.site, tbs, apiKey)));
      const mentions: NormalizedMention[] = [];
      for (const r of results) if (r.status === 'fulfilled') mentions.push(...r.value);
      return { status: 'ok', mentions };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'webMentions error' };
    }
  },
};
