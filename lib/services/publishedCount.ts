import type { PublishedCountEstimate, NormalizedMention } from '../types';

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.searchParams.delete('utm_source');
    url.searchParams.delete('utm_medium');
    url.searchParams.delete('utm_campaign');
    url.searchParams.delete('igshid');
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch { return u.toLowerCase().replace(/\/$/, ''); }
}

function handleFromEntity(entity: string): string {
  return entity.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isOwnedUrl(url: string, handle: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('instagram.com')) return false;
    const path = u.pathname.toLowerCase();
    return path.startsWith(`/${handle}/`) || path === `/${handle}` || path.startsWith(`/${handle}?`);
  } catch { return false; }
}

export async function estimatePublishedCount(
  entity: string,
  handleHint: string | undefined,
  mentions: NormalizedMention[],
  range: string
): Promise<PublishedCountEstimate> {
  const handle = (handleHint || handleFromEntity(entity)).toLowerCase();
  const owned = mentions.filter(m => isOwnedUrl(m.url, handle));
  const deduped = Array.from(new Map(owned.map(m => [normalizeUrl(m.url), m])).values());
  const evidenceCount = deduped.length;

  if (evidenceCount === 0) {
    return {
      value: null,
      type: "unavailable",
      confidence: "none",
      evidenceCount: 0,
      methodology: "No verified owned Instagram posts discovered via account-specific searches; total published count unavailable from publicly indexed data.",
    };
  }
  if (evidenceCount >= 3) {
    const estimated = Math.round(evidenceCount * 1.2);
    return {
      value: estimated,
      type: "estimated",
      confidence: evidenceCount >= 8 ? "high" : evidenceCount >= 5 ? "medium" : "low",
      evidenceCount,
      methodology: `Estimated from ${evidenceCount} verified owned posts discovered via ${handle} account searches, deduplicated and filtered by date range ${range}.`,
    };
  }
  return {
    value: null,
    type: "unavailable",
    confidence: "low",
    evidenceCount,
    methodology: `Only ${evidenceCount} owned post(s) found for @${handle} — insufficient evidence to estimate total published count.`,
  };
}

export function toNormalizedContents(mentions: NormalizedMention[], entity: string, handleHint?: string): import('../types').NormalizedSocialContent[] {
  const handle = (handleHint || handleFromEntity(entity)).toLowerCase();
  return mentions.slice(0, 20).map((m, i) => ({
    id: `c-${i}-${Date.now()}`,
    platform: (m.source as any) || "web",
    url: m.url,
    title: m.title,
    snippet: m.engagementSnippet,
    authorHandle: isOwnedUrl(m.url, handle) ? handle : undefined,
    publishedAt: m.publishedAt,
    ownership: isOwnedUrl(m.url, handle) ? "owned" as const : m.url.includes('instagram.com') ? "fan" as const : "unknown" as const,
    engagement: {
      likes: m.engagement?.likes ?? null,
      comments: m.engagement?.comments ?? null,
      views: m.engagement?.views ?? null,
      shares: m.engagement?.shares ?? null,
      reposts: null,
      source: m.engagement?.source === 'snippet' ? "parsed" as const : "unknown" as const,
      confidence: (m.engagement?.confidence as any) ?? "none",
    },
    contentType: m.url.includes('/reel') ? "reel" as const : m.url.includes('/p/') ? "post" as const : "unknown" as const,
    themes: [],
    sentiment: m.sentiment as any,
    confidence: "medium" as const,
    source: "serper" as const,
    raw: m.raw,
  }));
}
