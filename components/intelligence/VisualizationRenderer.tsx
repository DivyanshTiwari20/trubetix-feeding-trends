'use client';
import type { VisualizationSpec } from '@/lib/types';
import { SentimentChart, PostingActivityChart, EngagementChart, NarrativeChartWrap } from './Charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
function ComparisonBar({ data, title }: { data: { name:string; posts:number }[]; title:string }) {
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm tracking-widest uppercase">{title}</CardTitle></CardHeader>
      <CardContent className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{fontSize:11}} interval={0} />
            <YAxis tick={{fontSize:11}} tickFormatter={(v)=> v>=1000?`${(v/1000).toFixed(0)}K`:String(v)} />
            <Tooltip formatter={(v:any)=> Number(v).toLocaleString()} />
            <Bar dataKey="posts" fill="#7C3AED" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
export function VisualizationRenderer({ visualization }: { visualization: VisualizationSpec }) {
  const { type, title, data } = visualization as any;
  if (type==='donut' && title.includes('Sentiment')) return <SentimentChart pct={data as any} />;
  if (type==='bar' && title.includes('Platform')) return <Card><CardContent className="p-4 text-sm">Platform breakdown (see table)</CardContent></Card>;
  if (type==='bar' && title.includes('Narrative')) return <NarrativeChartWrap narratives={data as any} />;
  if (type==='comparison' || title.includes('Head-to-Head')) return <ComparisonBar data={data} title={title} />;
  if (type==='bar' && title.includes('Hashtag')) return <ComparisonBar data={data} title={title} />;
  if (type==='metric') return <Card><CardContent className="p-4 text-sm font-medium">{title}: {JSON.stringify(data).slice(0,120)}</CardContent></Card>;
  return <Card><CardContent className="p-4 text-sm text-muted-foreground">{title} — {type}</CardContent></Card>;
}
