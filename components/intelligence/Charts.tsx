'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
const COLORS: Record<string,string> = { positive:'#16a34a', neutral:'#6b7280', negative:'#dc2626', mixed:'#a16207' };
export function SentimentChart({ pct }: { pct: { positive:number; neutral:number; negative:number; mixed:number } }) {
  const data = [
    { name:'Positive', value:pct.positive, fill:COLORS.positive },
    { name:'Neutral', value:pct.neutral, fill:COLORS.neutral },
    { name:'Negative', value:pct.negative, fill:COLORS.negative },
    ...(pct.mixed?[{name:'Mixed', value:pct.mixed, fill:COLORS.mixed}]:[]),
  ].filter(d=>d.value>0);
  if(!data.length) return <div className="text-sm text-muted-foreground">No sentiment data</div>;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm tracking-widest uppercase">Sentiment Distribution</CardTitle></CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2}>
              {data.map((e,i)=><Cell key={i} fill={e.fill} />)}
            </Pie>
            <Tooltip formatter={(v:any)=>`${v}%`} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 text-xs mt-2">
          {data.map(d=><span key={d.name} style={{color:d.fill}}>{d.name} {d.value}%</span>)}
        </div>
      </CardContent>
    </Card>
  );
}
export function PostingActivityChart({ byDay }: { byDay: Record<string,number> }) {
  const data = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([d,v])=>({ date: d.slice(5), posts: v }));
  if(!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm tracking-widest uppercase">Posting Activity</CardTitle></CardHeader>
      <CardContent className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="date" tick={{fontSize:11}} />
            <YAxis allowDecimals={false} tick={{fontSize:11}} />
            <Tooltip />
            <Bar dataKey="posts" fill="#7C3AED" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
export function EngagementChart({ posts }: { posts: { title:string; likes:number|null; }[] }) {
  const data = posts.slice(0,6).map((p,i)=>({ name: `Post ${i+1}`, likes: p.likes ?? 0, title: p.title.slice(0,24) }));
  if(!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm tracking-widest uppercase">Top Posts by Engagement</CardTitle></CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{fontSize:11}} />
            <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={56} />
            <Tooltip formatter={(v:any)=> v===0?'—':String(v)} />
            <Bar dataKey="likes" fill="#0ea5e9" radius={[0,6,6,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
export function NarrativeChartWrap({ narratives }: { narratives: { name:string; percentage:number }[] }) {
  const data = narratives.slice(0,6).map(n=>({ name: n.name.slice(0,18), value: n.percentage }));
  if(!data.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm tracking-widest uppercase">Conversation Narratives</CardTitle></CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{fontSize:10}} interval={0} angle={-14} textAnchor="end" height={50} />
            <YAxis tickFormatter={(v)=>`${v}%`} tick={{fontSize:11}} />
            <Tooltip formatter={(v:any)=>`${v}%`} />
            <Bar dataKey="value" fill="#a78bfa" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
