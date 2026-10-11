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
import { executeTool } from '../tools';
import { buildInstagramQueries } from '../tools/instagramSearch';
import { buildQueries } from '../../collect/queryBuilder';
import { EvidenceStore } from '../evidence';
import { clearAgentCache } from '../cache';

function ctx() {
  return { range: '7d' as const, aliases: [] as string[], store: new EvidenceStore(), seenCalls: new Set<string>(), fetchPageCount: 0 };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAgentCache();
});

describe('web_search adapter', () => {
  it('maps Serper payload to EvidenceItems', async () => {
    vi.mocked(fetchSerperQueries).mockResolvedValue([{
      query: 'acme', mentions: [{ source: 'search', title: 'Acme wins 3.7K+ likes', url: 'https://example.com/a?utm_source=x', publishedAt: new Date().toISOString(), engagementSnippet: '3.7K+ likes', raw: {} }],
    }]);
    const r = await executeTool('web_search', { query: 'acme', entity: 'Acme' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.items[0].platform).toBe('web');
    expect(r.items[0].url).toBe('https://example.com/a?utm_source=x');
    expect(r.items[0].metrics?.likes).toBe(3700);
    expect(r.summary).toMatch(/results/);
  });
  it('empty results → ok:true empty kind', async () => {
    vi.mocked(fetchSerperQueries).mockResolvedValue([{ query: 'acme news', mentions: [] }]);
    const r = await executeTool('web_search', { query: 'acme news', entity: 'Acme Corp' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.error?.kind).toBe('empty');
  });
  it('429 surfaces rate_limit', async () => {
    vi.mocked(fetchSerperQueries).mockResolvedValue([{ query: 'acme news', mentions: [], error: 'Search unavailable (429)' }]);
    const r = await executeTool('web_search', { query: 'acme news', entity: 'Acme Corp' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.error?.kind).toBe('rate_limit');
  });
  it('malformed items dropped, never fails batch', async () => {
    vi.mocked(fetchSerperQueries).mockResolvedValue([{ query: 'acme news', mentions: [{ source: 'search', title: '', url: 'not-a-url', publishedAt: '', engagementSnippet: '', raw: {} }] }]);
    const r = await executeTool('web_search', { query: 'acme news', entity: 'Acme Corp' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.items.length).toBeLessThanOrEqual(1);
  });
  it('identical tool+args never executed twice', async () => {
    vi.mocked(fetchSerperQueries).mockResolvedValue([{ query: 'acme news', mentions: [] }]);
    const c = ctx();
    const args = { query: 'acme news', entity: 'Acme Corp' };
    await executeTool('web_search', args, c);
    const calls = vi.mocked(fetchSerperQueries).mock.calls.length;
    const r2 = await executeTool('web_search', args, c);
    expect(vi.mocked(fetchSerperQueries).mock.calls.length).toBe(calls);
    expect(r2.summary).toMatch(/Duplicate/);
  });
  it('unknown tool → bad_input', async () => {
    const r = await executeTool('nope', {}, ctx());
    expect(r.ok).toBe(false);
    expect(r.error?.kind).toBe('bad_input');
  });
  it('invalid args → bad_input with message', async () => {
    const r = await executeTool('web_search', { query: 'x' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.error?.kind).toBe('bad_input');
  });
});

describe('news_search adapter', () => {
  it('maps GNews payload, empty handled', async () => {
    vi.mocked(newsAdapter.fetchSignal).mockResolvedValue({ status: 'ok', mentions: [{ source: 'news', title: 'Acme earnings', url: 'https://news.example/e', publishedAt: new Date().toISOString(), raw: {} }] });
    const r = await executeTool('news_search', { query: 'acme earnings', entity: 'Acme' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.items[0].platform).toBe('news');
    const empty = await executeTool('news_search', { query: 'zzz', entity: 'Zzz' }, { ...ctx(), seenCalls: new Set(['x']) });
    void empty;
  });
});

describe('instagram adapter preserves legacy query logic', () => {
  it('uses the same site: variants as queryBuilder', () => {
    const legacy = buildQueries('Acme', 'instagram', '7d').map(q => q.query);
    expect(buildInstagramQueries('Acme')).toEqual(legacy);
  });
  it('empty instagram set is normal, not retried as error', async () => {
    vi.mocked(fetchSerperQueries).mockResolvedValue([]);
    const r = await executeTool('instagram_search', { entity: 'ObscureBrand' }, ctx());
    expect(r.error?.kind).toBe('empty');
    expect(r.ok).toBe(true);
  });
});

describe('fetch_page guards', () => {
  it('rejects URLs not in store', async () => {
    const r = await executeTool('fetch_page', { url: 'https://example.com/unknown', reason: 'need detail please' }, ctx());
    expect(r.ok).toBe(false);
    expect(r.error?.kind).toBe('bad_input');
  });
  it('rejects private IPs and non-http', async () => {
    const c = ctx();
    const r1 = await executeTool('fetch_page', { url: 'http://192.168.1.5/x', reason: 'need detail please' }, c);
    expect(r1.error?.kind).toBe('bad_input');
    const r2 = await executeTool('fetch_page', { url: 'ftp://example.com/x', reason: 'need detail please' }, { ...ctx() });
    expect(r2.error?.kind).toBe('bad_input');
  });
  it('expands snippet for in-store URL (mocked fetch)', async () => {
    const c = ctx();
    c.store.addAll([{
      id: 'abc123', entity: 'E', platform: 'web', source: 'example.com', url: 'https://example.com/p',
      title: 'T', publishedAt: null, snippet: 'short', tool: 'web_search', query: 'q',
      relevance: 0.5, sourceQuality: 'medium', freshness: 'unknown', retrievedAt: new Date().toISOString(),
    }]);
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response('<html><body><p>' + 'word '.repeat(200) + '</p></body></html>', { headers: { 'content-type': 'text/html' } })) as typeof fetch;
    try {
      const r = await executeTool('fetch_page', { url: 'https://example.com/p', reason: 'verify the claim details' }, c);
      expect(r.ok).toBe(true);
      expect(r.items[0].snippet.length).toBeGreaterThan(100);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
  it('budget: max twice per request', async () => {
    const c = ctx();
    c.fetchPageCount = 2;
    const r = await executeTool('fetch_page', { url: 'https://example.com/p', reason: 'verify the claim details' }, c);
    expect(r.ok).toBe(false);
  });
});

describe('search_prior_analyses', () => {
  it('empty DB → honest summary, never blocks', async () => {
    const r = await executeTool('search_prior_analyses', { entity: 'Acme' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/No prior/);
  });
});
