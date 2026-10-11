import { createHash } from 'crypto';
import type { CoverageStatus, EvidenceItem } from './types';
import { LIMITS } from './limits';

export function hashId(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const params = new URLSearchParams(u.search);
    for (const k of [...params.keys()]) {
      if (k.startsWith('utm_') || ['fbclid', 'gclid', 'igshid', 'igsh', 'dclid', 'msclkid', 'yclid', '_hsenc', '_hsmi', 'mc_cid', 'mc_eid', 'vero_conv', 'vero_id', 'wickedid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref', 'mkt_tok'].includes(k)) params.delete(k);
    }
    const path = u.pathname.replace(/\/$/, '') || '/';
    const qs = params.toString();
    return `${u.protocol}//${host}${path}${qs ? '?' + qs : ''}`.toLowerCase();
  } catch {
    return raw.trim().replace(/\/$/, '').toLowerCase();
  }
}

export function evidenceIdFor(url: string | null, source: string, title: string | null, date: string | null): string {
  if (url) return hashId(canonicalUrl(url));
  return hashId(`${source}|${title ?? ''}|${date ?? ''}`.toLowerCase());
}

function normTitle(t: string | null): string {
  return (t ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

const HIGH = ['bbc.', 'reuters.', 'apnews.', 'nytimes.', 'theguardian.', 'washingtonpost.', 'bloomberg.', 'ft.com', 'wsj.', 'economist.', 'gov', '.gov', '.edu', 'pib.gov.in'];
const MEDIUM = ['techcrunch', 'theverge', 'wired.', 'forbes.', 'moneycontrol', 'economictimes', 'indiatimes', 'ndtv', 'indianexpress', 'hindustantimes', 'variety.', 'billboard.', 'rollingstone', 'espn', 'sport'];
const LOW = ['blogspot', 'wordpress.', 'content farm', 'aggregator', 'top10', 'buzzfeed', 'listverse'];

export function scoreSourceQuality(hostOrSource: string): 'high' | 'medium' | 'low' | 'unknown' {
  const s = hostOrSource.toLowerCase();
  if (!s) return 'unknown';
  if (HIGH.some(h => s.includes(h))) return 'high';
  if (MEDIUM.some(h => s.includes(h))) return 'medium';
  if (LOW.some(h => s.includes(h))) return 'low';
  if (s.includes('instagram.com') || s.includes('x.com') || s.includes('reddit.com') || s.includes('youtube.com')) return 'medium';
  return 'unknown';
}

export function scoreRelevance(opts: {
  title: string | null; snippet: string; entityNames: string[];
  freshness: EvidenceItem['freshness']; quality: EvidenceItem['sourceQuality'];
  hasMetricsOrDate: boolean; isPrior: boolean;
}): number {
  const t = (opts.title ?? '').toLowerCase();
  const sn = (opts.snippet ?? '').toLowerCase();
  const names = opts.entityNames.map(n => n.toLowerCase()).filter(Boolean);
  let s = 0;
  const inTitle = names.some(n => n && t.includes(n));
  const inSnippet = names.some(n => n && sn.includes(n));
  if (inTitle) s += 0.35;
  else if (inSnippet) s += 0.2;
  if (opts.freshness === 'in_range') s += 0.25;
  else if (opts.freshness === 'unknown') s += 0.1;
  if (opts.quality === 'high') s += 0.25;
  else if (opts.quality === 'medium') s += 0.15;
  else if (opts.quality === 'low') s += 0.05;
  else s += 0.08;
  if (opts.hasMetricsOrDate) s += 0.1;
  if (opts.isPrior) s *= 0.7;
  return Math.max(0, Math.min(1, Math.round(s * 100) / 100));
}

export function freshnessFor(publishedAt: string | null, range: '1d' | '7d' | '15d' | '30d'): EvidenceItem['freshness'] {
  if (!publishedAt) return 'unknown';
  const t = Date.parse(publishedAt);
  if (isNaN(t)) return 'unknown';
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '15d' ? 15 : 30;
  return t >= Date.now() - days * 86400000 - 2 * 3600000 ? 'in_range' : 'out_of_range';
}

export class EvidenceStore {
  items = new Map<string, EvidenceItem>();
  private titleSeen = new Map<string, { at: number; id: string }>();
  lowYieldStreak = 0;

  addAll(incoming: EvidenceItem[]): { added: number; duplicates: number } {
    let added = 0, duplicates = 0;
    for (const it of incoming) {
      if (this.items.has(it.id)) { duplicates++; continue; }
      // Syndicated-news dedupe: same normalized title within 48h → keep higher quality.
      const tk = normTitle(it.title);
      if (tk.length > 20) {
        const prev = this.titleSeen.get(tk);
        const at = it.publishedAt ? Date.parse(it.publishedAt) : NaN;
        if (prev && !isNaN(at)) {
          const prevItem = this.items.get(prev.id);
          const prevAt = prevItem?.publishedAt ? Date.parse(prevItem.publishedAt as string) : NaN;
          if (!isNaN(prevAt) && Math.abs(at - prevAt) < 48 * 3600000) {
            duplicates++;
            const rank = { high: 3, medium: 2, unknown: 1, low: 0 } as const;
            if (rank[it.sourceQuality] > rank[prevItem?.sourceQuality ?? 'unknown']) {
              this.items.delete(prev.id);
              this.items.set(it.id, it);
              this.titleSeen.set(tk, { at, id: it.id });
            }
            continue;
          }
        }
        this.titleSeen.set(tk, { at: isNaN(at) ? Date.now() : at, id: it.id });
      }
      this.items.set(it.id, it);
      added++;
    }
    // Evict lowest relevance first over cap.
    if (this.items.size > LIMITS.maxEvidenceRetained) {
      const sorted = [...this.items.values()].sort((a, b) => a.relevance - b.relevance);
      const over = this.items.size - LIMITS.maxEvidenceRetained;
      for (let i = 0; i < over; i++) this.items.delete(sorted[i].id);
    }
    if (added < 2) this.lowYieldStreak++;
    else this.lowYieldStreak = 0;
    return { added, duplicates };
  }

  ranked(limit = LIMITS.maxSynthesisItems): EvidenceItem[] {
    return [...this.items.values()]
      .sort((a, b) => b.relevance - a.relevance || Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''))
      .slice(0, limit);
  }

  rankedBalanced(entities: string[], perEntity: number): EvidenceItem[] {
    const out: EvidenceItem[] = [];
    for (const e of entities) {
      const items = [...this.items.values()]
        .filter(i => i.entity.toLowerCase() === e.toLowerCase())
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, perEntity);
      out.push(...items);
    }
    return out;
  }

  digestForModel(maxItems = LIMITS.maxItemsToModelPerCall): string {
    const top = this.ranked(maxItems);
    if (!top.length) return '(no evidence yet)';
    return top.map(i => `[${i.id.slice(0, 8)}] ${i.platform} | ${i.source} | ${(i.publishedAt ?? '?').slice(0, 10)} | ${(i.title ?? '(untitled)').slice(0, 90)} | ${(i.snippet ?? '').slice(0, LIMITS.maxSnippetShown)}`).join('\n');
  }

  coverage(range: '1d' | '7d' | '15d' | '30d', entities: string[]): CoverageStatus {
    const all = [...this.items.values()];
    const inRange = all.filter(i => i.freshness === 'in_range').length;
    const sources = new Set(all.map(i => i.source.toLowerCase()));
    const platforms = [...new Set(all.map(i => i.platform))];
    const dates = all.map(i => (i.publishedAt ? Date.parse(i.publishedAt) : NaN)).filter(t => !isNaN(t)).sort((a, b) => a - b);
    const perEntity: Record<string, number> = {};
    for (const e of entities) perEntity[e] = all.filter(i => i.entity.toLowerCase() === e.toLowerCase() && i.freshness !== 'out_of_range').length;
    return {
      inRange, total: all.length, distinctSources: sources.size, platforms,
      newest: dates.length ? new Date(dates[dates.length - 1]).toISOString() : null,
      oldest: dates.length ? new Date(dates[0]).toISOString() : null,
      saturated: this.lowYieldStreak >= 2,
      perEntity,
    };
  }

  coverageLine(range: '1d' | '7d' | '15d' | '30d', entities: string[]): string {
    const c = this.coverage(range, entities);
    return `coverage: ${c.inRange}/${c.total} in-range, ${c.distinctSources} sources, platforms [${c.platforms.join(',') || 'none'}], range ${dates(c)}${c.saturated ? ', SATURATED (last 2 searches <2 new)' : ''}${entities.length > 1 ? `, per-entity ${JSON.stringify(c.perEntity)}` : ''}`;
    function dates(c: CoverageStatus) {
      return `newest ${c.newest?.slice(0, 10) ?? '?'} oldest ${c.oldest?.slice(0, 10) ?? '?'}`;
    }
  }
}

export function isSufficient(store: EvidenceStore, range: '1d' | '7d' | '15d' | '30d', entities: string[], entityType: string): boolean {
  const c = store.coverage(range, entities);
  const perEntityOk = entities.length < 2 || entities.every(e => (c.perEntity[e] ?? 0) >= 4);
  const base = c.inRange >= 6 && c.distinctSources >= 3 && perEntityOk;
  if (!base) return false;
  if (/celebrity|influencer|actor|actress|singer|creator/i.test(entityType)) {
    const plats = c.platforms;
    if (!plats.some(p => ['instagram', 'x', 'reddit', 'youtube'].includes(p))) return false;
  }
  return true;
}
