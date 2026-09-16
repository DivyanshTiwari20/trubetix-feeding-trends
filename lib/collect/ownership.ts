import type { NormalizedSocialContent, ContentOwnership } from '../types';

function handleFromEntity(entity: string): string {
  return entity.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isHandlePath(pathname: string, handle: string): boolean {
  const p = pathname.toLowerCase();
  return p === `/${handle}` || p === `/${handle}/` || p.startsWith(`/${handle}/`) || p.startsWith(`/${handle}?`);
}

export function classifyOwnership(url: string, entity: string, handleHint?: string): ContentOwnership {
  const handle = (handleHint || handleFromEntity(entity)).toLowerCase();
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase() + u.search.toLowerCase();
    const lower = url.toLowerCase();
    if (lower.includes('fan') && lower.includes(handle)) return 'fan';
    if (host.includes('instagram.com')) {
      if (isHandlePath(u.pathname, handle)) return 'owned';
      return 'unknown';
    }
    if (host.includes('x.com') || host.includes('twitter.com')) {
      if (isHandlePath(u.pathname, handle)) return 'owned';
      return 'earned';
    }
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (path.includes(`/@${handle}`) || path.includes(`/${handle}`)) return 'owned';
      return 'earned';
    }
    if (host.includes('reddit.com')) return 'earned';
    if (host.includes('linkedin.com')) {
      if (path.includes(`/in/${handle}`) || path.includes(`/company/${handle}`)) return 'owned';
      return 'earned';
    }
    return 'unknown';
  } catch { return 'unknown'; }
}

export function enrichOwnership(contents: NormalizedSocialContent[], entity: string, handleHint?: string): NormalizedSocialContent[] {
  const handle = (handleHint || handleFromEntity(entity)).toLowerCase();
  return contents.map(c => {
    const o = classifyOwnership(c.url, entity, handle);
    return { ...c, ownership: o, authorHandle: o==='owned' ? handle : c.authorHandle };
  });
}
