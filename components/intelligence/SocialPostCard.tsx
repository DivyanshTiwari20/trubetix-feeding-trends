'use client';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import type { NormalizedMention } from '@/lib/types';

function fmtCompact(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1000000) return `${parseFloat((n / 1000000).toFixed(1))}M`;
  if (n >= 1000) return `${parseFloat((n / 1000).toFixed(1))}K`;
  return String(n);
}

function thumbnailFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const candidates = [r.imageUrl, r.thumbnail, r.image, r.thumbnailUrl, r.ogImage];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('http')) return c;
    if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>;
      if (typeof o.url === 'string' && o.url.startsWith('http')) return o.url;
      if (typeof o.src === 'string' && o.src.startsWith('http')) return o.src;
    }
  }
  return null;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 28 ? `${u.pathname.slice(0, 28)}…` : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return url.slice(0, 48);
  }
}

export function SocialPostCard({ post }: { post: NormalizedMention }) {
  const plat = (post.source ?? 'web').toLowerCase();
  const platLabel = plat === 'x' ? 'X' : plat.charAt(0).toUpperCase() + plat.slice(1);
  const likes = fmtCompact(post.engagement?.likes);
  const date = (() => {
    try {
      const d = new Date(post.publishedAt);
      return isNaN(d.getTime()) ? null : d.toLocaleDateString();
    } catch {
      return null;
    }
  })();
  const thumb = thumbnailFromRaw(post.raw);
  const headerMeta = [platLabel, likes ? `${likes} likes` : null, date].filter(Boolean).join('  ·  ');

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-muted-foreground">{headerMeta}</div>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-[15px] font-medium leading-6 text-[#1a0dab] hover:underline line-clamp-2"
            >
              {post.title || shortUrl(post.url)}
            </a>
            {post.engagementSnippet ? (
              <div className="mt-1 text-[13px] leading-5 text-[#4d5156] line-clamp-2">
                {post.engagementSnippet.slice(0, 220)}
              </div>
            ) : null}
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 flex items-center gap-1 text-xs text-[#202124]"
            >
              <span className="truncate">{shortUrl(post.url)}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          </div>
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-[72px] w-[96px] shrink-0 rounded-md border object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-[72px] w-[96px] shrink-0 items-center justify-center rounded-md border bg-muted/40 px-2 text-center text-[11px] text-muted-foreground">
              No preview
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
