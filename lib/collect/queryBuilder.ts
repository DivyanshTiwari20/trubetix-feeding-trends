import type { Platform } from '../types';

export interface PlatformQuery {
  platform: string;
  query: string;
}

const QUERY_TEMPLATES: Record<string, string[]> = {
  instagram: ['site:instagram.com "{e}"', 'site:instagram.com/p "{e}"', 'site:instagram.com/reel "{e}"'],
  twitter: ['site:x.com "{e}"', 'site:twitter.com "{e}"'],
  x: ['site:x.com "{e}"', 'site:twitter.com "{e}"'],
  reddit: ['site:reddit.com "{e}"', 'site:reddit.com/r "{e}"'],
  youtube: ['site:youtube.com "{e}"', 'site:youtube.com/watch "{e}"'],
  linkedin: ['site:linkedin.com "{e}"', 'site:linkedin.com/posts "{e}"'],
  news: ['"{e}"'],
  web: ['"{e}"'],
};

function sanitizeEntity(entity: string): string {
  return entity.trim().replace(/"/g, '').slice(0, 80);
}

export function buildQueries(entity: string, platform: string, range: string): PlatformQuery[] {
  const e = sanitizeEntity(entity);
  const p = platform.toLowerCase();
  if (p === 'all') {
    return (['instagram','x','reddit','youtube','linkedin'] as const).flatMap(pl =>
      (QUERY_TEMPLATES[pl] ?? [`site:${pl}.com "{e}"`]).map(q => ({ platform: pl, query: q.replace('{e}', e) }))
    );
  }
  const templates = QUERY_TEMPLATES[p] ?? [`"${e}"`];
  return templates.map(q => ({ platform: p, query: q.replace('{e}', e) }));
}

export function buildQueriesForPlatforms(entity: string, platforms: string[]): PlatformQuery[] {
  if (!platforms.length || platforms.includes('all')) return buildQueries(entity, 'all', '7d');
  const seen = new Set<string>();
  const out: PlatformQuery[] = [];
  for (const p of platforms) {
    const qs = buildQueries(entity, p, '7d');
    for (const qq of qs) {
      if (!seen.has(qq.query)) { seen.add(qq.query); out.push(qq); }
    }
  }
  return out;
}

export function isNewsPlatform(platforms: string[]): boolean {
  if (!platforms.length) return false;
  return platforms.some(p => ['news','web'].includes(p.toLowerCase()));
}
