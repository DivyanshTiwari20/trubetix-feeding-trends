'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NormalizedMention } from '@/lib/types';

function extractEntity(query: string): string {
  const m = query.match(/"([^"]+)"/);
  if (m) return m[1];
  return query.replace(/site:[^\s]+/gi, '').replace(/^"|"$/g, '').trim() || query;
}
function handleFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    if (['p','reel','reels','explore','stories','tv','tags'].includes(parts[0].toLowerCase())) return null;
    if (u.hostname.includes('instagram') && parts[0]) return parts[0];
    if (u.hostname.includes('reddit') && parts[0] === 'r' && parts[1]) return `r/${parts[1]}`;
    if ((u.hostname.includes('x.com') || u.hostname.includes('twitter.com')) && parts[0]) return parts[0];
    return null;
  } catch { return null; }
}
function rawHandle(m: NormalizedMention): string | null {
  const h = handleFromUrl(m.url);
  if (h) return h;
  const src = (m.raw as any)?.source as string | undefined;
  if (src?.includes('·')) { const c = src.split('·').pop()?.trim() ?? ''; if (c && !['p','reel'].includes(c.toLowerCase())) return c.replace(/^@/,''); }
  const dl = (m.raw as any)?.displayed_link as string | undefined;
  if (dl) { const mm = dl.match(/instagram\.com\/([a-z0-9._]+)/i); if (mm && !['p','reel'].includes(mm[1].toLowerCase())) return mm[1]; }
  return null;
}
function engagementLabel(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/([\d.,]+K?\+?\s*(likes|views|comments|upvotes|followers))/i);
  return m ? m[0] : null;
}
function thumbUrl(m: NormalizedMention): string | null {
  const r: any = m.raw;
  return r?.thumbnail ?? r?.image ?? r?.imageUrl ?? null;
}

export function VolumeResults({ results, range }: {
  results: { query: string; mentions: NormalizedMention[]; searchInformation?: { totalResults?: number }; error?: string }[];
  range: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const rangeLabel = range === '1d' ? 'last 24 hours' : range === '7d' ? 'last 7 days' : range === '15d' ? 'last 15 days' : 'last 30 days';

  const grouped = new Map<string, { entity: string; siteLabel: string; mentions: NormalizedMention[]; totalEst: number }>();
  for (const g of results) {
    const entity = extractEntity(g.query);
    const key = entity.toLowerCase();
    const siteLabel = g.query.includes('instagram') ? 'Instagram' : g.query.includes('reddit') ? 'Reddit' : g.query.includes('x.com') || g.query.includes('twitter') ? 'X' : 'Web';
    const est = g.searchInformation?.totalResults ?? g.mentions.length;
    if (!grouped.has(key)) grouped.set(key, { entity, siteLabel, mentions: [], totalEst: est });
    const e = grouped.get(key)!;
    const seen = new Set(e.mentions.map(m => m.url));
    for (const m of g.mentions) if (!seen.has(m.url)) { e.mentions.push(m); seen.add(m.url); }
    e.totalEst = Math.max(e.totalEst, est);
  }
  const groups = Array.from(grouped.values());
  const totalEstOverall = groups.reduce((a, g) => a + g.totalEst, 0);
  const primaryEntity = groups[0]?.entity ?? extractEntity(results[0]?.query ?? '');

  return (
    <div className="w-full my-2 space-y-3">
      <div className="text-[14px] leading-6 text-[#1F2937]">
        <span className="font-semibold">{primaryEntity}</span> — about <span className="font-semibold">~{totalEstOverall.toLocaleString()} posts</span> in the {rangeLabel} on Instagram. Showing top {Math.min(5, groups.reduce((a,g)=>a+g.mentions.length,0))} below — tap to open.
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="divide-y">
          {groups.map((grp, gi) => {
            const visible = showAll ? grp.mentions : grp.mentions.slice(0, 5);
            return (
              <div key={gi} className="px-4 py-3 space-y-3">
                {visible.map((m, idx) => {
                  const handle = rawHandle(m);
                  const eng = engagementLabel(m.engagementSnippet) ?? engagementLabel((m.raw as any)?.displayed_link);
                  const thumb = thumbUrl(m);
                  const isVideo = m.url.includes('/reel');
                  return (
                    <a key={idx} href={m.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3 rounded-xl border bg-white hover:bg-muted/40 transition-colors p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{handle ? `@${handle}` : grp.siteLabel}</span>
                          {eng && <><span>·</span><span>{eng}</span></>}
                        </div>
                        <div className="mt-1 text-[14px] font-medium leading-5 text-[#1A0DAB] group-hover:underline line-clamp-2">{m.title}</div>
                        {m.engagementSnippet && <div className="mt-1 text-[13px] leading-5 text-[#4D5156] line-clamp-2">{m.engagementSnippet}</div>}
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          <span className="truncate">{m.url}</span><ExternalLink className="h-3 w-3 shrink-0" />
                        </div>
                      </div>
                      <div className="hidden sm:flex h-[88px] w-[112px] shrink-0 rounded-lg bg-muted border overflow-hidden items-center justify-center relative">
                        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <span className="text-[11px] text-muted-foreground">No preview</span>}
                        {isVideo && thumb && <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">▶ 0:08</span>}
                      </div>
                    </a>
                  );
                })}
                {grp.mentions.length > 5 && (
                  <div className="flex justify-center pt-1">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={() => setShowAll(v => !v)}>
                      {showAll ? 'Show less' : `Show more — ${grp.mentions.length - 5} more`}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
