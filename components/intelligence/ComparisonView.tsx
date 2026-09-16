'use client';
import type { Analysis } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

function fmt(n:number){ if(n>=1000000) return `${parseFloat((n/1000000).toFixed(1))}M`; if(n>=1000) return `${parseFloat((n/1000).toFixed(n%1000===0?0:1))}K`; return String(n); }

export function ComparisonView({ analyses }: { analyses: Analysis[] }) {
  const range = analyses[0]?.range ?? '7d';
  const platforms = analyses[0]?.platforms.join(', ') ?? '';
  const data = analyses.map(a=> ({ name: a.entity, posts: a.totalEstimatedPosts ?? a.analyzedContentCount ?? 0, likes: a.engagementSummary?.totalLikes ?? 0 }));
  const sorted = [...data].sort((x,y)=> y.posts - x.posts);
  const leader = sorted[0];
  const verdict = analyses[0]?.brief?.comparisonNote ?? (leader ? `${leader.name} leads the conversation this window.` : '');
  const colors = ['#7C3AED','#0EA5E9','#10B981','#F59E0B'];

  return (
    <div className="w-full max-w-[760px] space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Comparison</Badge>
        <Badge variant="outline">{range}</Badge>
        <Badge variant="outline" className="capitalize">{platforms}</Badge>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-[#F8F7FF] to-white overflow-hidden">
        <CardHeader className="pb-2"><CardTitle className="text-[11px] tracking-widest uppercase font-semibold text-[#7C3AED]">Head-to-Head · {analyses.map(a=>a.entity).join(' vs ')} · {range}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {analyses.map((a,i)=> (
              <div key={`${a.entity}-${a.id ?? i}`} className="rounded-xl border bg-white p-4">
                <div className="text-sm font-bold text-[#111827]">{a.entity}</div>
                <div className="text-2xl font-bold mt-1">{fmt(a.totalEstimatedPosts ?? a.analyzedContentCount ?? 0)} <span className="text-sm font-normal text-muted-foreground">posts</span></div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.brief?.directAnswer?.slice(0,120)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{top: 20, right: 10, left: 10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{fontSize:12, fontWeight:600}} interval={0} />
                <YAxis tick={{fontSize:11}} tickFormatter={(v)=> fmt(v as number)} domain={[0, 'auto']} allowDecimals={false} />
                <Tooltip formatter={(v:any)=> `${fmt(v as number)} posts`} />
                <Bar dataKey="posts" radius={[8,8,0,0]} label={{position:'top', formatter:(v:any)=> fmt(v as number), fill:'#111827', fontSize:12, fontWeight:700}}>
                  {data.map((_,i)=>(<Cell key={i} fill={colors[i%colors.length]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm leading-6 mt-3 text-[#1F2937]">{verdict}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {analyses.map((a,i)=> (
          <Card key={`${a.entity}-narrative-${a.id ?? i}`} className="border">
            <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold">{a.entity} — Narrative</CardTitle></CardHeader>
            <CardContent className="text-sm leading-6 text-[#1F2937] space-y-2">
              <p>{a.brief?.overallNarrative}</p>
              {a.brief?.sentimentSummary && <p className="text-muted-foreground"><span className="font-semibold text-foreground">Sentiment:</span> {a.brief.sentimentSummary}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
