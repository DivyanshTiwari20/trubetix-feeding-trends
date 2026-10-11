import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../adapters/webMentions', () => ({
  fetchSerperQueries: vi.fn(),
}));
vi.mock('../../adapters/news', () => ({
  newsAdapter: { fetchSignal: vi.fn() },
}));
vi.mock('../../db', () => ({
  prisma: { chat: { findMany: vi.fn(async () => []) } },
}));

import { fetchSerperQueries } from '../../adapters/webMentions';
import { newsAdapter } from '../../adapters/news';
import { runAgent } from '../controller';
import { clearAgentCache } from '../cache';
import type { AgentPlan } from '../types';

beforeEach(() => { clearAgentCache(); vi.clearAllMocks(); });

function mention(entity: string, i: number, platform: string, host: string) {
  return {
    source: platform, title: `${entity} story angle ${i} sparks fan debate online`,
    url: `https://${host}/story-${entity.toLowerCase().replace(/\s+/g, '-')}-${i}`,
    publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
    engagementSnippet: `${(i + 1) * 120} likes, ${i * 9} comments`,
    raw: {},
  };
}

function mockFor(entity: string, hosts: string[]) {
  vi.mocked(fetchSerperQueries).mockImplementation(async (queries: string[]) =>
    queries.map((q, qi) => ({
      query: q,
      mentions: [0, 1, 2].map(i => mention(entity, qi * 3 + i, 'search', hosts[(qi + i) % hosts.length])),
    })),
  );
  vi.mocked(newsAdapter.fetchSignal).mockImplementation(async (ent: string) => ({
    status: 'ok' as const,
    mentions: [0, 1].map(i => mention(ent, i, 'news', `news-outlet-${i}.com`)),
  }));
}

function report(name: string, meta: { iterations: number; toolCalls: { tool: string; ok: boolean; fromCache?: boolean }[]; itemsRetained: number; cacheHits: number; stoppedBy: string | null }) {
  const paid = meta.toolCalls.filter(t => !t.fromCache).length;
  const geminiCalls = 1 + meta.iterations + 1; // plan + loop turns + synthesis
  // Rough cost: Flash-class ~$0.075/1M input + $0.30/1M output tokens; loop turns ~2k in/0.3k out, synth ~8k in/0.6k out.
  const est = ((geminiCalls * 2500) / 1e6) * 0.075 + ((meta.iterations * 300 + 600) / 1e6) * 0.3;
  console.log(`[smoke] ${name}: iters=${meta.iterations} paidCalls=${paid} cacheHits=${meta.cacheHits} items=${meta.itemsRetained} stopped=${meta.stoppedBy} geminiCalls≈${geminiCalls} estCost≈$${est.toFixed(4)}`);
}

describe('smoke (mocked network)', () => {
  it('celebrity 7-day analysis', async () => {
    mockFor('Samay Raina', ['instagram.com', 'reddit.com', 'x.com']);
    const plan: AgentPlan = {
      entities: [{ name: 'Samay Raina', type: 'celebrity', aliases: ['samay'] }],
      intent: 'sentiment', timeRange: { from: null, to: null, label: 'last 7 days', range: '7d' },
      priorityPlatforms: ['instagram', 'news'], initialQueries: [], notes: '',
    };
    let turns = 0;
    const r = await runAgent({ question: 'Samay Raina last 7 days on Instagram?' }, {
      planCall: async () => plan,
      loopCall: async () => (++turns === 1
        ? [{ name: 'instagram_search', args: { entity: 'Samay Raina' } }, { name: 'news_search', args: { query: 'Samay Raina shows', entity: 'Samay Raina' } }]
        : null),
      synthCall: async () => 'Samay Raina had approximately 900 posts on instagram in the last 7d. Conversation is fan-driven and positive.',
    });
    report('celebrity 7-day', r.meta);
    expect(r.insufficientEvidence).toBe(false);
    expect(r.analyses).toHaveLength(1);
  });

  it('product perception (iPhone)', async () => {
    mockFor('iPhone', ['reddit.com', 'youtube.com', 'techcrunch.com']);
    const plan: AgentPlan = {
      entities: [{ name: 'iPhone', type: 'product', aliases: ['iPhone 17'] }],
      intent: 'product_perception', timeRange: { from: null, to: null, label: 'last 7 days', range: '7d' },
      priorityPlatforms: [], initialQueries: [], notes: '',
    };
    let turns = 0;
    const r = await runAgent({ question: 'What do people think of iPhone camera?' }, {
      planCall: async () => plan,
      loopCall: async () => (++turns === 1
        ? [{ name: 'web_search', args: { query: 'iPhone camera review opinion', entity: 'iPhone' } }]
        : null),
      synthCall: async () => 'iPhone camera perception is broadly positive across reviews and forums.',
    });
    report('product perception', r.meta);
    expect(r.insufficientEvidence).toBe(false);
  });

  it('Adidas vs Nike comparison', async () => {
    mockFor('Adidas', ['instagram.com', 'news-outlet-0.com']);
    const plan: AgentPlan = {
      entities: [{ name: 'Adidas', type: 'brand', aliases: [] }, { name: 'Nike', type: 'brand', aliases: [] }],
      intent: 'comparison', timeRange: { from: null, to: null, label: 'last 7 days', range: '7d' },
      priorityPlatforms: ['instagram'], initialQueries: [], notes: '',
    };
    let turns = 0;
    const r = await runAgent({ question: 'Adidas vs Nike' }, {
      planCall: async () => plan,
      loopCall: async () => (++turns === 1
        ? [{ name: 'instagram_search', args: { entity: 'Adidas' } }, { name: 'instagram_search', args: { entity: 'Nike' } }]
        : null),
      synthCall: async () => 'Adidas leads on indexed Instagram volume this window; Nike close on engagement.',
    });
    report('comparison', r.meta);
    expect(r.analyses.map(a => a.entity).sort()).toEqual(['Adidas', 'Nike']);
  });
});
