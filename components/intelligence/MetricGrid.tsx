'use client';
import { Card, CardContent } from '@/components/ui/card';
export function MetricGrid({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it)=>(
        <Card key={it.label} className="bg-muted/30">
          <CardContent className="p-4">
            <div className="text-[11px] tracking-widest uppercase text-muted-foreground font-semibold">{it.label}</div>
            <div className="text-xl font-bold mt-1">{it.value}</div>
            {it.sub ? <div className="text-xs text-muted-foreground mt-1">{it.sub}</div> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
