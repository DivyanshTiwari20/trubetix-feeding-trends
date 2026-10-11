import type { EvidenceItem } from '../types';
import { evidenceIdFor, freshnessFor, scoreRelevance, scoreSourceQuality } from '../evidence';
import { LIMITS } from '../limits';
import { parseEngagement } from '../../utils/engagement';

export interface RawHit {
  title: string | null;
  url: string;
  snippet?: string | null;
  publishedAt?: string | null;
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  shares?: number | null;
  source?: string | null;
}

export function toEvidenceItems(opts: {
  hits: RawHit[];
  entity: string;
  entityAliases: string[];
  platform: EvidenceItem['platform'];
  tool: string;
  query: string;
  range: '1d' | '7d' | '15d' | '30d';
  isPrior?: boolean;
  priorDate?: string | null;
}): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const h of opts.hits) {
    let host = '';
    try { host = new URL(h.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { host = (h.source ?? '').toLowerCase(); }
    const quality = scoreSourceQuality(host || h.source || '');
    const freshness = freshnessFor(h.publishedAt ?? null, opts.range);
    const snippet = (h.snippet ?? '').slice(0, LIMITS.maxSnippetStored);
    // Engagement: only when actually retrieved, never inferred.
    const parsed = h.likes != null || h.comments != null ? null : parseEngagement(snippet || h.title);
    const metrics = (h.likes != null || h.comments != null || h.views != null || h.shares != null)
      ? { likes: h.likes ?? undefined, comments: h.comments ?? undefined, views: h.views ?? undefined, shares: h.shares ?? undefined }
      : (parsed && (parsed.likes != null || parsed.comments != null || parsed.views != null)
        ? { likes: parsed.likes ?? undefined, comments: parsed.comments ?? undefined, views: parsed.views ?? undefined, shares: parsed.shares ?? undefined }
        : undefined);
    const relevance = scoreRelevance({
      title: h.title, snippet, entityNames: [opts.entity, ...opts.entityAliases],
      freshness, quality, hasMetricsOrDate: !!(metrics || h.publishedAt), isPrior: !!opts.isPrior,
    });
    out.push({
      id: evidenceIdFor(h.url, host || 'unknown', h.title, h.publishedAt ?? null),
      entity: opts.entity,
      platform: opts.platform,
      source: host || h.source || 'unknown',
      url: h.url,
      title: h.title,
      publishedAt: h.publishedAt ?? null,
      snippet: opts.isPrior ? `[prior analysis from ${opts.priorDate ?? 'earlier'}] ${snippet}` : snippet,
      metrics,
      tool: opts.tool,
      query: opts.query,
      relevance,
      sourceQuality: quality,
      freshness,
      retrievedAt: new Date().toISOString(),
    });
  }
  return out;
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}
