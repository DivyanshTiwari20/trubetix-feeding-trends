'use client';
import type { Analysis } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VisualizationRenderer } from './VisualizationRenderer';

function fmt(n:number|null){ if(n==null) return '—'; if(n>=1000000){ const v=(n/1000000).toFixed(n%1000000===0?0:1); return `${parseFloat(v)}M`; } if(n>=1000){ const v=(n/1000).toFixed(n%1000===0?0:1); return `${parseFloat(v)}K`; } return String(n); }

export function QuestionBriefView({ analysis }: { analysis: Analysis }) {
  const brief = analysis.brief;
  const intents = analysis.intents ?? [];
  const isVolume = intents.includes('publishing_count') && !intents.some(i=> ['narrative','sentiment','public_conversation','brand_fit'].includes(i));
  const isBuzz = intents.some(i=> ['narrative','sentiment','public_conversation','general_intel'].includes(i));
  const wantsNarrative = isBuzz;
  if (!brief) return null;
  const totalPosts = analysis.totalEstimatedPosts ?? analysis.analyzedContentCount ?? analysis.normalizedContents?.length ?? 0;
  const totalLikes = analysis.engagementSummary?.totalLikes;
  const hasLikes = totalLikes != null;
  const platformLabel = analysis.platforms.join(', ');

  return (
    <div className="w-full max-w-[760px] space-y-6">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="capitalize">{platformLabel}</Badge>
        <Badge variant="outline">{analysis.range}</Badge>
        <span className="text-xs text-muted-foreground">· {analysis.entity}</span>
      </div>

      <Card className="border-0 shadow-sm bg-gradient-to-br from-[#F8F7FF] to-white overflow-hidden">
        <CardContent className="p-0">
          <div className="px-6 py-5">
            <div className="text-[11px] tracking-widest uppercase font-semibold text-[#7C3AED]">Total posts · {analysis.entity} · {platformLabel} · {analysis.range}</div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight text-[#111827]">{fmt(totalPosts)}</span>
              <span className="text-sm text-muted-foreground">posts</span>
              {hasLikes && <span className="ml-4 text-sm"><span className="text-muted-foreground">·</span> <span className="font-semibold">{fmt(totalLikes)}</span> <span className="text-muted-foreground">likes</span></span>}
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-[#EDE8FF] overflow-hidden">
              <div className="h-full bg-[#7C3AED] rounded-full" style={{width: '72%'}} />
            </div>
          </div>
          <div className="px-6 pb-5">
            <p className="text-[15px] leading-7 text-[#1F2937]">{brief.directAnswer}</p>
          </div>
        </CardContent>
      </Card>

      {analysis.trend && Object.keys(analysis.trend.postsByDay).length >= 2 && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Trend · Last {analysis.range}</h3>
          <Card className="mt-3"><CardContent className="p-4">
            <div className="flex gap-2 text-xs mb-3">
              <Badge variant="secondary">{fmt(analysis.trend.totalPosts)} total</Badge>
              <Badge variant="outline">{Object.keys(analysis.trend.postsByDay).length} active days</Badge>
              {analysis.trend.sentimentPct && <Badge variant="outline">{analysis.trend.sentimentPct.positive}% positive</Badge>}
            </div>
            <div className="h-[140px] flex items-end gap-1">
              {Object.entries(analysis.trend.postsByDay).sort((a,b)=> a[0].localeCompare(b[0])).slice(-7).map(([d,v])=>{
                const max = Math.max(...Object.values(analysis.trend!.postsByDay));
                const h = max ? Math.max(8, Math.round(v/max*100)) : 8;
                return <div key={d} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-[#7C3AED] rounded-t" style={{height: `${h}%`, minHeight: 8}} /><span className="text-[10px] text-muted-foreground">{d.slice(5)}</span><span className="text-[10px] font-semibold">{v}</span></div>;
              })}
            </div>
          </CardContent></Card>
        </section>
      )}

      {wantsNarrative && brief.overallNarrative && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Overall Narrative</h3>
          <p className="text-[15px] leading-7 mt-3 text-[#1F2937]">{brief.overallNarrative}</p>
          {brief.overallImage && <p className="text-sm leading-6 mt-3 p-3 rounded-lg bg-muted/30 border italic">{brief.overallImage}</p>}
        </section>
      )}

      {wantsNarrative && brief.keyThemes?.length > 0 && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Key Themes</h3>
          <div className="grid gap-3 mt-3">
            {brief.keyThemes.map((t,i)=>(
              <div key={i} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#111827]">{t.title}</span>
                  <Badge variant={t.sentiment==='positive'?'default':t.sentiment==='negative'?'destructive':'outline'} className="capitalize text-[11px]">{t.sentiment}</Badge>
                </div>
                <p className="text-[13px] text-[#4B5563] mt-2 leading-6">{t.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {isBuzz && brief.publicConversation && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">What People Are Talking About</h3>
          <Card className="mt-3 border bg-white"><CardContent className="p-5 text-[15px] leading-7 text-[#1F2937]">{brief.publicConversation}</CardContent></Card>
        </section>
      )}

      {isBuzz && brief.sentimentSummary && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Sentiment</h3>
          <p className="text-[15px] leading-7 mt-3 text-[#1F2937]">{brief.sentimentSummary}</p>
        </section>
      )}

      {analysis.organicSignal && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Organic Check</h3>
          <Card className="mt-3 border"><CardContent className="p-4 flex items-center justify-between">
            <div><Badge variant={analysis.organicSignal.label==='organic'?'default':analysis.organicSignal.label==='mixed'?'secondary':'destructive'} className="capitalize">{analysis.organicSignal.label}</Badge><p className="text-xs text-muted-foreground mt-1">{analysis.organicSignal.reason}</p></div>
            <div className="text-right"><div className="text-sm font-bold">{analysis.organicSignal.botScore}% bot risk</div><div className="text-[11px] text-muted-foreground">{analysis.organicSignal.confidence} confidence</div></div>
          </CardContent></Card>
        </section>
      )}

      {analysis.amplifiers && analysis.amplifiers.length > 0 && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Share of Voice · Amplifiers</h3>
          <Card className="mt-3"><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="text-left p-3">Domain / Platform</th><th className="text-right p-3">Posts</th><th className="text-left p-3">Top title</th></tr></thead>
              <tbody>{analysis.amplifiers.map(a=> (<tr key={a.domain} className="border-t"><td className="p-3"><span className="font-medium">{a.domain}</span> <Badge variant="outline" className="ml-1 text-[10px]">{a.platform}</Badge></td><td className="p-3 text-right font-semibold">{a.count}</td><td className="p-3 text-xs truncate max-w-[220px]">{a.topTitle.slice(0,60)}</td></tr>))}</tbody>
            </table>
          </CardContent></Card>
        </section>
      )}

      {brief.comparisonNote && (
        <section>
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Comparison Verdict</h3>
          <Card className="mt-3 border-l-4 border-l-[#7C3AED]"><CardContent className="p-4 text-sm leading-6">{brief.comparisonNote}</CardContent></Card>
        </section>
      )}

      {analysis.visualizations?.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-[18px] font-bold tracking-tight text-[#111827]">Visual Insight</h3>
          {analysis.visualizations.map((v:any)=> (
            <VisualizationRenderer key={v.id} visualization={v} />
          ))}
        </section>
      )}
    </div>
  );
}
