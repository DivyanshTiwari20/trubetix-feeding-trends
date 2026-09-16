'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Heart, MessageCircle, Eye, Share2 } from 'lucide-react';
import type { NormalizedMention } from '@/lib/types';
function fmt(n: number|null|undefined){ if(n==null) return '—'; if(n>=1000000) return `${(n/1000000).toFixed(1)}M`; if(n>=1000) return `${(n/1000).toFixed(1)}K`; return String(n); }
export function SocialPostCard({ post }: { post: NormalizedMention }) {
  const plat = post.source ?? 'web';
  const likes = post.engagement?.likes;
  const comments = post.engagement?.comments;
  const views = post.engagement?.views;
  const shares = post.engagement?.shares;
  const sentTone = post.sentiment==='positive'?'bg-green-100 text-green-700 border-green-200':post.sentiment==='negative'?'bg-red-100 text-red-700 border-red-200':'bg-zinc-100 text-zinc-700';
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="capitalize rounded-full">{plat}</Badge>
          <span className="text-muted-foreground">{new Date(post.publishedAt).toLocaleDateString()}</span>
          {post.sentiment ? <Badge variant="outline" className={`ml-auto capitalize ${sentTone}`}>{post.sentiment}</Badge> : null}
        </div>
        <div className="text-sm font-medium leading-6 line-clamp-3">{post.title}</div>
        {post.engagementSnippet ? <div className="text-xs text-muted-foreground line-clamp-2">{post.engagementSnippet.slice(0,180)}</div> : null}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{fmt(likes)}</span>
          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{fmt(comments)}</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{fmt(views)}</span>
          <span className="inline-flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />{fmt(shares)}</span>
        </div>
        <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#7C3AED] hover:underline">Open source <ExternalLink className="h-3 w-3" /></a>
      </CardContent>
    </Card>
  );
}
