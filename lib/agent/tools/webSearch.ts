import { z } from 'zod';
import { fetchSerperQueries } from '../../adapters/webMentions';
import { toEvidenceItems } from './normalize';
import type { EvidenceItem } from '../types';

export const webSearchSchema = z.object({
  query: z.string().min(2).max(200),
  entity: z.string().min(1).max(120),
  timeRange: z.enum(['day', 'week', 'month', 'year']).optional(),
  maxResults: z.number().int().min(1).max(8).optional(),
});

export type WebSearchArgs = z.infer<typeof webSearchSchema>;

const rangeMap: Record<string, '1d' | '7d' | '15d' | '30d'> = { day: '1d', week: '7d', month: '30d', year: '30d' };

export async function execWebSearch(args: WebSearchArgs, ctx: { range: '1d' | '7d' | '15d' | '30d'; aliases: string[] }): Promise<{ items: EvidenceItem[]; error?: { kind: 'rate_limit' | 'timeout' | 'upstream' | 'empty'; message: string } }> {
  const range = (args.timeRange ? rangeMap[args.timeRange] : undefined) ?? ctx.range;
  const res = await fetchSerperQueries([args.query], range);
  const r = res[0];
  if (r?.error && !r.mentions.length) {
    const kind = /429|quota|rate/i.test(r.error) ? 'rate_limit' : /timeout/i.test(r.error) ? 'timeout' : 'upstream';
    return { items: [], error: { kind: kind as 'rate_limit', message: r.error } };
  }
  const items = toEvidenceItems({
    hits: (r?.mentions ?? []).slice(0, 10).map(m => ({ title: m.title, url: m.url, snippet: m.engagementSnippet ?? null, publishedAt: m.publishedAt ?? null })),
    entity: args.entity, entityAliases: ctx.aliases, platform: 'web', tool: 'web_search', query: args.query, range,
  });
  if (!items.length) return { items, error: { kind: 'empty', message: 'No web results for this query.' } };
  return { items };
}

export const webSearchDecl = {
  name: 'web_search',
  description: 'General web research: reviews, brand coverage, controversies, background. Not for pure recent news (use news_search) or Instagram activity (use instagram_search).',
  parameters: { type: 'object', properties: { query: { type: 'string' }, entity: { type: 'string' }, timeRange: { type: 'string', enum: ['day', 'week', 'month', 'year'] }, maxResults: { type: 'number' } }, required: ['query', 'entity'] },
};
