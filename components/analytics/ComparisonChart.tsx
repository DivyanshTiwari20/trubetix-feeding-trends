'use client';
export function ComparisonChart({ deltas }: { deltas: { mentionsGrowth:number|null; sentimentDelta:number|null; negativeDelta:number|null } }) {
  const rows = [
    { k:'Mentions growth', v:deltas.mentionsGrowth },
    { k:'Positive shift', v:deltas.sentimentDelta },
    { k:'Negative shift', v:deltas.negativeDelta },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map(r=>(
        <div key={r.k} className="rounded border p-3 text-center">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{r.k}</div>
          <div className="text-lg font-bold">{r.v == null ? '—' : `${r.v>0?'+':''}${r.v}%`}</div>
        </div>
      ))}
    </div>
  );
}
