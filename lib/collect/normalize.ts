import type { NormalizedMention, NormalizedSocialContent, Platform, ContentOwnership, DataConfidence, Engagement } from '../types';
import { parseEngagement } from '../utils/engagement';

const TRACKING_PARAMS = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','igshid','igsh','fbclid','gclid','fb_action_ids','fb_action_types','fb_source','fb_ref','dclid','msclkid','yclid','_hsenc','_hsmi','mkt_tok','mc_cid','mc_eid','vero_conv','vero_id','wickedid']);

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.has(k) || k.startsWith('utm_')) u.searchParams.delete(k);
    u.hash = '';
    let s = u.toString().replace(/\/$/, '');
    return s.toLowerCase();
  } catch { return raw.trim().replace(/\/$/, '').toLowerCase(); }
}

export function dedupeMentions(mentions: NormalizedMention[]): { deduped: NormalizedMention[]; duplicateCount: number } {
  const map = new Map<string, NormalizedMention>();
  let dups = 0;
  for (const m of mentions) {
    const key = normalizeUrl(m.url);
    if (!map.has(key)) map.set(key, m);
    else {
      dups++;
      const existing = map.get(key)!;
      if ((m.title?.length ?? 0) > (existing.title?.length ?? 0)) map.set(key, m);
    }
  }
  const contentMap = new Map<string, NormalizedMention>();
  for (const m of [...map.values()]) {
    const contentKey = `${m.title.trim().toLowerCase().slice(0,120)}|${normalizeUrl(m.url).slice(0,80)}`;
    if (!contentMap.has(contentKey)) contentMap.set(contentKey, m);
    else dups++;
  }
  return { deduped: [...contentMap.values()], duplicateCount: dups };
}

export function parseDateSafe(raw?: string | null): { iso: string | null; confidence: DataConfidence } {
  if (!raw) return { iso: null, confidence: 'none' };
  const lower = raw.toLowerCase();
  const now = Date.now();
  const ago = lower.match(/(\d+)\s*(hour|day|week|month)s?\s*ago/);
  if (ago) {
    const n = parseInt(ago[1],10);
    const unit = ago[2];
    const ms = unit.startsWith('hour') ? n*3600000 : unit.startsWith('day') ? n*86400000 : unit.startsWith('week') ? n*7*86400000 : n*30*86400000;
    return { iso: new Date(now - ms).toISOString(), confidence: 'low' };
  }
  const t = Date.parse(raw);
  if (!isNaN(t)) return { iso: new Date(t).toISOString(), confidence: 'medium' };
  return { iso: null, confidence: 'none' };
}

export function isWithinRange(iso: string | null, range: '1d'|'7d'|'15d'|'30d'): boolean {
  if (!iso) return true;
  const days = range==='1d'?1:range==='7d'?7:range==='15d'?15:30;
  const cutoff = Date.now() - days*86400000 - 2*3600000;
  const t = Date.parse(iso);
  if (isNaN(t)) return true;
  return t >= cutoff;
}

export function engagementFromSnippet(snippet?: string | null, title?: string | null): Engagement {
  const p = parseEngagement(snippet ?? null);
  if (p.likes == null && title) {
    const tp = parseEngagement(title);
    if (tp.likes != null) return { likes: tp.likes, comments: tp.comments ?? p.comments, views: tp.views ?? p.views, shares: tp.shares ?? p.shares ?? null, reposts: null, source: tp.source === 'snippet' ? 'parsed' : 'unknown', confidence: tp.confidence };
  }
  return { likes: p.likes, comments: p.comments, views: p.views, shares: p.shares ?? null, reposts: null, source: p.source === 'snippet' ? 'parsed' : 'unknown', confidence: p.confidence };
}

export function platformFromUrl(url: string, fallback: string): Platform {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('instagram.com')) return 'instagram';
    if (h.includes('x.com') || h.includes('twitter.com')) return 'x';
    if (h.includes('reddit.com')) return 'reddit';
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('linkedin.com')) return 'linkedin';
  } catch {}
  const f = fallback.toLowerCase();
  if (['instagram','x','twitter','reddit','youtube','linkedin','news','web','all'].includes(f)) return (f==='twitter'?'x':f) as Platform;
  return 'web';
}

export function contentTypeFromUrl(url: string, platform: string): NormalizedSocialContent['contentType'] {
  const u = url.toLowerCase();
  if (platform==='instagram') { if (u.includes('/reel')) return 'reel'; if (u.includes('/p/')) return 'post'; return 'post'; }
  if (platform==='youtube') return 'video';
  if (platform==='x' || platform==='twitter') return 'tweet';
  if (platform==='linkedin' && u.includes('/posts')) return 'post';
  return 'unknown';
}

export function toNormalizedContent(mention: NormalizedMention, entity: string, idx: number): NormalizedSocialContent {
  const platform = platformFromUrl(mention.url, mention.source);
  return {
    id: `c-${idx}-${Date.now()}-${normalizeUrl(mention.url).slice(-8)}`,
    platform,
    url: mention.url,
    title: mention.title,
    snippet: mention.engagementSnippet ?? undefined,
    authorName: undefined,
    authorHandle: undefined,
    publishedAt: mention.publishedAt ?? null,
    ownership: 'unknown',
    engagement: engagementFromSnippet(mention.engagementSnippet ?? null, mention.title ?? null),
    contentType: contentTypeFromUrl(mention.url, platform),
    themes: [],
    sentiment: mention.sentiment as any,
    confidence: 'medium',
    source: 'serper',
    raw: mention.raw,
  };
}
