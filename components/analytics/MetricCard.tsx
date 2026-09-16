'use client';
import { Card } from '@/components/ui/card';
export function MetricCard({ title, value, sub, tone }: { title: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card className="p-4 border-[#EDE8FF]">
      <div className="text-[11px] tracking-widest uppercase text-muted-foreground font-semibold">{title}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: tone }}>{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-1">{sub}</div> : null}
    </Card>
  );
}
