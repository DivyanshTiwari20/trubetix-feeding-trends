'use client';
export function SentimentDonut({ pct }: { pct: { positive:number; neutral:number; negative:number; mixed:number } }) {
  const segs = [
    { label: 'Positive', v: pct.positive, color: '#16a34a' },
    { label: 'Neutral', v: pct.neutral, color: '#6b7280' },
    { label: 'Negative', v: pct.negative, color: '#dc2626' },
    { label: 'Mixed', v: pct.mixed, color: '#a16207' },
  ].filter(s=>s.v>0);
  if (!segs.length) return <div className="text-sm text-muted-foreground">No sentiment data</div>;
  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-1.5">
        {segs.map(s=>(
          <div key={s.label} className="h-2 rounded" style={{ width: `${Math.max(12, s.v*2)}px`, background: s.color }} title={`${s.label} ${s.v}%`} />
        ))}
      </div>
      <div className="text-xs flex gap-3">
        {segs.map(s=><span key={s.label} style={{color:s.color}}>{s.label} {s.v}%</span>)}
      </div>
    </div>
  );
}
