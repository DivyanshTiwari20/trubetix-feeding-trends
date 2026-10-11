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
  priorityPlatforms: ['instagram'],
  initialQueries: [],
  notes: '',
};

describe('response contract (UI backward compat)', () => {
  it('AgentResult analyses match the Analysis shape the UI renders', async () => {
    const r = await runAgent({ question: 'Acme on Instagram?' }, {
      planCall: async () => plan,
      loopCall: async () => null,
      synthCall: async () => 'Acme had approximately 0 posts on instagram in the last 7d.',
    });
    expect(typeof r.text).toBe('string');
    expect(Array.isArray(r.analyses)).toBe(true);
    const a = r.analyses[0];
    // Fields consumed by QuestionBriefView / IntelligenceDashboard / ChatMessage:
    expect(a.entity).toBe('Acme');
    expect(a.range).toBe('7d');
    expect(Array.isArray(a.platforms)).toBe(true);
    expect(a.brief?.directAnswer).toBeTruthy();
    expect(a.metrics).toHaveProperty('sentimentPct');
    expect(a.engagementSummary).toHaveProperty('totalLikes');
    expect(Array.isArray(a.topMentions)).toBe(true);
    expect(a.dataQuality).toHaveProperty('indexedCount');
    // Tool output envelope the route streams:
    const envelope = { status: 'success', entities: r.analyses.map(x => x.entity), range: a.range, platforms: a.platforms, question: 'q', analyses: r.analyses };
    expect(envelope.analyses.length).toBeGreaterThan(0);
  });
});
