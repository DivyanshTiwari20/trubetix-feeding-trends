import { z } from 'zod';
import { fetchSerperQueries } from '../../adapters/webMentions';
import { buildQueries } from '../../collect/queryBuilder';
import { toEvidenceItems } from './normalize';
import type { EvidenceItem } from '../types';

export const instagramSearchSchema = z.object({
  entity: z.string().min(1).max(120),
  handleOrQuery: z.string().max(120).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  maxResults: z.number().int().min(1).max(8).optional(),
});

export type InstagramSearchArgs = z.infer<typeof instagramSearchSchema>;

/** Wraps the existing Google-indexed Instagram logic: multi-variant site: queries via Serper. */
export function buildInstagramQueries(entity: string, handleOrQuery?: string): string[] {
  const base = buildQueries(entity, 'instagram', '7d').map(q => q.query);
  if (handleOrQuery && handleOrQuery.trim() && !base.includes(handleOrQuery)) {
    return [`site:instagram.com "${handleOrQuery.trim()}"`, ...base];
  }
  return base;
}

export async function execInstagramSearch(args: InstagramSearchArgs, ctx: { range: '1d' | '7d' | '15d' | '30d'; aliases: string[] }): Promise<{ items: EvidenceItem[]; error?: { kind: 'rate_limit' | 'timeout' | 'upstream' | 'empty'; message: string } }> {
  const queries = buildInstagramQueries(args.entity, args.handleOrQuery);
  const res = await fetchSerperQueries(queries, ctx.range);
  const seen = new Set<string>();
  const hits: { title: string; url: string; snippet: string | null; publishedAt: string | null }[] = [];
  for (const r of res) {
    for (const m of r.mentions) {
      const k = m.url.toLowerCase().replace(/\/$/, '');
      if (seen.has(k)) continue;
      seen.add(k);
      hits.push({ title: m.title, url: m.url, snippet: (m.engagementSnippet ?? null) as string | null, publishedAt: m.publishedAt ?? null });
      if (hits.length >= 10) break;
    }
    if (hits.length >= 10) break;
  }
  // Engagement figures from Google-indexed snippets can be partial/stale — flagged via snippet + prompt.
  const items = toEvidenceItems({
    hits, entity: args.entity, entityAliases: ctx.aliases, platform: 'instagram',
    tool: 'instagram_search', query: queries[0] ?? args.entity, range: ctx.range,
  });
  if (!items.length) return { items, error: { kind: 'empty', message: 'No indexed Instagram posts found (normal for low-presence entities).' } };
  return { items };
}

export const instagramSearchDecl = {
  name: 'instagram_search',
  description: 'Instagram-specific discovery via Google-indexed site: queries (existing logic). Engagement numbers are approximate/stale. Use for celebrities/influencers/visual brands. Skip for politicians/B2B unless asked.',
  parameters: { type: 'object', properties: { entity: { type: 'string' }, handleOrQuery: { type: 'string' }, fromDate: { type: 'string' }, toDate: { type: 'string' }, maxResults: { type: 'number' } }, required: ['entity'] },
};
