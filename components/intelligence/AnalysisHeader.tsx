'use client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
export function AnalysisHeader({ entity, platform, range }: { entity: string; platform?: string; range: string }) {
  const rl = range === '1d' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : range === '15d' ? 'Last 15 Days' : range === '30d' ? 'Last 30 Days' : range;
  const plat = platform ? platform : 'Cross-platform';
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight uppercase">{entity}</h2>
        <span className="text-xs text-muted-foreground hidden md:block">Intelligence · {new Date().toLocaleDateString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="rounded-full">{plat}</Badge>
        <span className="text-muted-foreground text-xs">·</span>
        <Badge variant="outline" className="rounded-full">{rl}</Badge>
      </div>
      <Separator />
    </div>
  );
}
