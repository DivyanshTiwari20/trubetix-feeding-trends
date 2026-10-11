import { describe, expect, it } from 'vitest';
import { EvidenceStore, canonicalUrl, evidenceIdFor, freshnessFor, scoreRelevance, scoreSourceQuality } from '../evidence';
import type { EvidenceItem } from '../types';

function item(partial: Partial<EvidenceItem> & { id: string }): EvidenceItem {
  return {
    entity: 'Acme', platform: 'web', source: 'example.com', url: 'https://example.com/a',
    title: 'Acme launches product', publishedAt: new Date().toISOString(), snippet: 'Acme launches product today',
    tool: 'web_search', query: 'acme', relevance: 0.5, sourceQuality: 'medium',
    freshness: 'in_range', retrievedAt: new Date().toISOString(), ...partial,
  };
}

describe('canonicalUrl', () => {
  it('strips tracking params, www, fragment, case', () => {
    expect(canonicalUrl('https://WWW.Example.com/a?utm_source=x&fbclid=1&q=1#frag')).toBe('https://example.com/a?q=1');
  });
  it('stable hash for same canonical url', () => {
    expect(evidenceIdFor('https://example.com/a?utm_source=x', 's', 't', null))
      .toBe(evidenceIdFor('https://example.com/a', 's', 't', null));
  });
});

describe('scoring', () => {
  it('entity in title > snippet > absent', () => {
    const base = { snippet: 'nothing', entityNames: ['acme'], freshness: 'in_range' as const, quality: 'medium' as const, hasMetricsOrDate: false, isPrior: false };
    const t = scoreRelevance({ ...base, title: 'Acme wins big', snippet: 'x' });
    const s = scoreRelevance({ ...base, title: 'Other news', snippet: 'about acme here' });
    const a = scoreRelevance({ ...base, title: 'Other news', snippet: 'nothing' });
    expect(t).toBeGreaterThan(s);
    expect(s).toBeGreaterThan(a);
  });
  it('prior items down-weighted', () => {
    const base = { title: 'Acme wins', snippet: 'x', entityNames: ['acme'], freshness: 'in_range' as const, quality: 'medium' as const, hasMetricsOrDate: false };
    expect(scoreRelevance({ ...base, isPrior: true })).toBeLessThan(scoreRelevance({ ...base, isPrior: false }));
  });
  it('source quality map deterministic', () => {
    expect(scoreSourceQuality('reuters.com')).toBe('high');
    expect(scoreSourceQuality('techcrunch.com')).toBe('medium');
    expect(scoreSourceQuality('randomblog.xyz')).toBe('unknown');
  });
  it('freshness flags out-of-range, keeps unknown', () => {
    expect(freshnessFor(new Date(Date.now() - 60 * 86400000).toISOString(), '7d')).toBe('out_of_range');
    expect(freshnessFor(null, '7d')).toBe('unknown');
    expect(freshnessFor(new Date().toISOString(), '7d')).toBe('in_range');
  });
});

describe('EvidenceStore dedupe', () => {
  it('drops canonical-url duplicates and reports counts', () => {
    const s = new EvidenceStore();
    const r = s.addAll([
      item({ id: 'a', url: 'https://example.com/a?utm_source=x' }),
      item({ id: 'a', url: 'https://example.com/a' }),
    ]);
    // same id → second is duplicate
    expect(r.added).toBe(1);
    expect(r.duplicates).toBe(1);
  });
  it('collapses syndicated same-title items within 48h keeping higher quality', () => {
    const s = new EvidenceStore();
    const now = new Date().toISOString();
    s.addAll([item({ id: 'low', url: 'https://blog.example/low-story-about-acme-launch-event-today', title: 'Acme launches major product line expansion today worldwide', sourceQuality: 'low', publishedAt: now })]);
    s.addAll([item({ id: 'high', url: 'https://reuters.com/other-acme-launch-event-today-story', title: 'Acme launches major product line expansion today worldwide', sourceQuality: 'high', publishedAt: now })]);
    expect(s.items.has('low')).toBe(false);
    expect(s.items.has('high')).toBe(true);
  });
  it('evicts lowest relevance over cap', () => {
    const s = new EvidenceStore();
    const many = Array.from({ length: 65 }, (_, i) => item({ id: `id-${i}`, url: `https://example.com/${i}`, title: `Unique story number ${i} about Acme launch event`, relevance: i / 100 }));
    s.addAll(many);
    expect(s.items.size).toBeLessThanOrEqual(60);
    expect(s.items.has('id-64')).toBe(true);
    expect(s.items.has('id-0')).toBe(false);
  });
});
