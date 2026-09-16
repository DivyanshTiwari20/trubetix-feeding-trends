'use client';
import type { Analysis } from '@/lib/types';
import { MetricCard } from './MetricCard';
import { SentimentDonut } from './SentimentDonut';
import { PlatformBreakdown } from './PlatformBreakdown';
import { NarrativeBar } from './NarrativeBar';
import { RiskCard } from './RiskCard';
import { ComparisonChart } from './ComparisonChart';
import { Card } from '@/components/ui/card';

export function AnalysisView({ analysis }: { analysis: Analysis }) {
  if (!analysis.prHealth) return <div className="space-y-4 mt-3"><div className="text-sm text-muted-foreground">Analysis available — PR Health not requested.</div></div>;
  return (
    <div className="space-y-4 mt-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="PR Health" value={`${analysis.prHealth.score}/100`} sub={analysis.prHealth.label} tone={analysis.prHealth.score>=60 ? '#16a34a' : analysis.prHealth.score>=40 ? '#a16207' : '#dc2626'} />
        <MetricCard title="Indexed Mentions" value={analysis.metrics.indexedCount} sub="discovered results only" />
        <MetricCard title="Positive" value={`${analysis.metrics.sentimentPct.positive}%`} sub={`${analysis.metrics.sentimentCounts.positive} pos`} tone="#16a34a" />
        <MetricCard title="Negative" value={`${analysis.metrics.sentimentPct.negative}%`} sub={`${analysis.metrics.sentimentCounts.negative} neg`} tone="#dc2626" />
      </div>
      <Card className="p-4 border-[#EDE8FF]">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Sentiment</div>
        <SentimentDonut pct={analysis.metrics.sentimentPct} />
        <div className="text-[11px] text-muted-foreground mt-2">{analysis.dataQuality.limitations[2]}</div>
      </Card>
      <Card className="p-4 border-[#EDE8FF]">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Platform Breakdown</div>
        <PlatformBreakdown data={analysis.metrics.mentionsByPlatform} />
        <div className="text-[11px] text-muted-foreground mt-2">Coverage: {analysis.dataQuality.coverage} • Confidence {analysis.dataQuality.confidence}</div>
      </Card>
      {analysis.narratives.length ? (
        <Card className="p-4 border-[#EDE8FF]">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Narratives</div>
          <NarrativeBar narratives={analysis.narratives} />
        </Card>
      ) : null}
      <RiskCard risks={analysis.risks} />
      {analysis.metrics.avgEngagement != null || (analysis.metrics.topEngaged && analysis.metrics.topEngaged.length) ? (
        <Card className="p-4 border-[#EDE8FF]">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Engagement</div>
          <div className="text-sm">Avg likes (parsed): {analysis.metrics.avgEngagement ?? '—'} <span className="text-xs text-muted-foreground">• unknown = null, never 0</span></div>
          {analysis.metrics.topEngaged?.length ? (
            <ul className="mt-2 text-xs list-disc pl-4 space-y-1">
              {analysis.metrics.topEngaged.slice(0,3).map((m:any,i:number)=><li key={i} className="truncate">{m.title} — {m.engagement?.likes ?? '—'} likes ({m.engagement?.confidence})</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}
      <Card className="p-3 bg-[#FCFCFD] border-[#EDE8FF]">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Data Quality</div>
        <div className="text-xs text-muted-foreground mt-1">Indexed/discovered: {analysis.dataQuality.indexedCount} • Not a complete platform census</div>
        <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1 space-y-0.5">{analysis.dataQuality.limitations.map((l,i)=><li key={i}>{l}</li>)}</ul>
      </Card>
    </div>
  );
}
export function MiniCompare({ deltas }: { deltas: { mentionsGrowth:number|null; sentimentDelta:number|null; negativeDelta:number|null } }) {
  return <ComparisonChart deltas={deltas} />;
}
