import { z } from 'zod';
import { newsAdapter } from '../../adapters/news';
import { toEvidenceItems } from './normalize';
import type { EvidenceItem } from '../types';

export const newsSearchSchema = z.object({
  query: z.string().min(2).max(200),
  entity: z.string().min(1).max(120),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  maxResults: z.number().int().min(1).max(8).optional(),
});

export type NewsSearchArgs = z.infer<typeof newsSearchSchema>;

export async function execNewsSearch(args: NewsSearchArgs, ctx: { range: '1d' | '7d' | '15d' | '30d'; aliases: string[] }): Promise<{ items: EvidenceItem[]; error?: { kind: 'rate_limit' | 'timeout' | 'upstream' | 'empty'; message: string } }> {
  // newsAdapter takes (entity, range); query refines entity for GNews reuse path.
  const r = await newsAdapter.fetchSignal(args.entity, ctx.range);
  if (r.status !== 'ok') return { items: [], error: { kind: 'upstream', message: (r as { message?: string }).message ?? 'News fetch failed' } };
  const q = args.query.toLowerCase();
  const ranked = [...r.mentions].sort((a, b) => {
    const aq = a.title.toLowerCase().includes(q) ? 0 : 1;
    const bq = b.title.toLowerCase().includes(q) ? 0 : 1;
    return aq - bq;
  });
  const items = toEvidenceItems({
    hits: ranked.slice(0, 10).map(m => ({ title: m.title, url: m.url, snippet: (m.raw as { description?: string })?.description ?? m.engagementSnippet ?? null, publishedAt: m.publishedAt ?? null })),
    entity: args.entity, entityAliases: ctx.aliases, platform: 'news', tool: 'news_search', query: args.query, range: ctx.range,
  });
  if (!items.length) return { items, error: { kind: 'empty', message: 'No news results for this query/range.' } };
  return { items };
}

export const newsSearchDecl = {
  name: 'news_search',
  description: 'Recent news coverage and publication-dated events for an entity. Use for time-windowed, politician, launch, controversy questions. Not for social-only reaction.',
  parameters: { type: 'object', properties: { query: { type: 'string' }, entity: { type: 'string' }, fromDate: { type: 'string' }, toDate: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query', 'entity'] },
};
