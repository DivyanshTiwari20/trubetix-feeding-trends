import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../adapters/webMentions', () => ({
  fetchSerperQueries: vi.fn(async (queries: string[]) => queries.map(q => ({ query: q, mentions: [] }))),
}));
vi.mock('../../adapters/news', () => ({
  newsAdapter: { fetchSignal: vi.fn(async () => ({ status: 'ok', mentions: [] })) },
}));
vi.mock('../../db', () => ({
  prisma: { chat: { findMany: vi.fn(async () => []) } },
}));

import { runAgent } from '../controller';
import { clearAgentCache } from '../cache';
import type { AgentPlan } from '../types';

beforeEach(() => { clearAgentCache(); });

const plan: AgentPlan = {
  entities: [{ name: 'Acme', type: 'brand', aliases: [] }],
  intent: 'sentiment',
  timeRange: { from: null, to: null, label: 'last 7 days', range: '7d' },
  priorityPlatforms: ['news'],
  initialQueries: [],
  notes: '',
};

function synth(text = 'Acme had a good week. Coverage positive.') {
  return async () => text;
}

describe('controller loop limits', () => {
  it('stops when model returns no calls', async () => {
    let loops = 0;
    const r = await runAgent({ question: 'how is Acme?' }, {
      planCall: async () => plan,
      loopCall: async () => { loops++; return null; },
      synthCall: synth(),
    });
    expect(loops).toBe(1);
    expect(r.insufficientEvidence).toBe(true); // zero evidence → honest path
    expect(r.meta.stoppedBy).toBe('zero_evidence');
  });

  it('stops at max iterations', async () => {
    const { fetchSerperQueries } = await import('../../adapters/webMentions');
    vi.mocked(fetchSerperQueries).mockImplementation(async (queries: string[]) => queries.map(q => ({
      query: q,
      mentions: [{ source: 'search', title: `Acme story ${q}`, url: `https://example.com/${encodeURIComponent(q)}`, publishedAt: new Date().toISOString(), engagementSnippet: '100 likes', raw: {} }],
    })));
    const r = await runAgent({ question: 'qq' }, {
      planCall: async () => plan,
      loopCall: async () => [{ name: 'web_search', args: { query: `acme story ${Math.random()}`, entity: 'Acme' } }],
      synthCall: synth('done'),
    });
    // initial prior-analyses call + loop; loopCall keeps returning calls
    expect(r.meta.iterations).toBeLessThanOrEqual(5);
    expect(['max_iterations', 'max_tool_calls', 'sufficient_and_saturated'].includes(r.meta.stoppedBy ?? '')).toBe(true);
  });

  it('stops after 3 consecutive failures', async () => {
    const { fetchSerperQueries } = await import('../../adapters/webMentions');
    vi.mocked(fetchSerperQueries).mockImplementation(async (queries: string[]) => queries.map(q => ({ query: q, mentions: [] })));
    let n = 0;
    const r = await runAgent({ question: 'qq' }, {
      planCall: async () => plan,
      loopCall: async () => [{ name: 'web_search', args: { query: `empty search ${n++}`, entity: 'Acme' } }],
      synthCall: synth(),
    });
    expect(r.meta.stoppedBy).toBe('consecutive_failures');
  });

  it('plan fallback on malformed plan', async () => {
    const r = await runAgent({ question: 'Acme overview please' }, {
      planCall: async () => { throw new Error('bad json'); },
      loopCall: async () => null,
      synthCall: synth(),
    });
    expect(r.insufficientEvidence).toBe(true);
    expect(r.text).toContain('Acme overview please'.slice(0, 20));
  });

  it('zero-evidence path is honest, no fabricated claims', async () => {
    const r = await runAgent({ question: 'ZzzUnknown brand?' }, {
      planCall: async () => ({ ...plan, entities: [{ name: 'ZzzUnknown', type: 'brand', aliases: [] }] }),
      loopCall: async () => null,
      synthCall: synth(),
    });
    expect(r.insufficientEvidence).toBe(true);
    expect(r.text).toMatch(/couldn't find sufficient evidence/i);
  });

  it('comparison keeps balanced per-entity evidence', async () => {
    const cmp: AgentPlan = { ...plan, entities: [{ name: 'Adidas', type: 'brand', aliases: [] }, { name: 'Nike', type: 'brand', aliases: [] }], intent: 'comparison' };
    const { EvidenceStore } = await import('../evidence');
    void EvidenceStore;
    const r = await runAgent({ question: 'Adidas vs Nike' }, {
      planCall: async () => cmp,
      loopCall: async () => null,
      synthCall: synth('Adidas leads vs Nike.'),
    });
    // zero evidence → one analysis per entity, honest flag
    expect(r.analyses.length).toBe(2);
    expect(r.analyses.map(a => a.entity).sort()).toEqual(['Adidas', 'Nike']);
  });

  it('loopCall throwing proceeds to synthesis/fallback without crashing', async () => {
    const r = await runAgent({ question: 'q' }, {
      planCall: async () => plan,
      loopCall: async () => { throw new Error('gemini down'); },
      synthCall: synth(),
    });
    expect(r.meta.stoppedBy).toBe('consecutive_failures');
  });

  it('wall-clock budget forces stop (short budget via many slow loopCalls)', async () => {
    vi.useFakeTimers?.();
    const r = await runAgent({ question: 'q' }, {
      planCall: async () => plan,
      loopCall: async () => null,
      synthCall: synth(),
    });
    expect(r.meta.iterations).toBeLessThanOrEqual(5);
    vi.useRealTimers?.();
  });
});
