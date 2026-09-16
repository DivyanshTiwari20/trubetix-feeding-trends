'use client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
export function PRHealthCard({ score, label, drivers }: { score: number; label: string; drivers?: { sentiment:number; visibility:number; engagement:number; risk:number; momentum:number } }) {
  const tone = score>=80?'text-green-600':score>=60?'text-emerald-600':score>=40?'text-amber-600':score>=20?'text-orange-600':'text-red-600';
  const bar = score>=80?'bg-green-600':score>=60?'bg-emerald-500':score>=40?'bg-amber-500':score>=20?'bg-orange-500':'bg-red-600';
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs tracking-[0.18em] text-muted-foreground font-semibold">PR HEALTH</div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={`text-4xl font-black tracking-tight ${tone}`}>{score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
              <Badge variant="outline" className={`ml-2 ${tone} border-current`}>{label}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Analytical index — observable indexed data only</div>
          </div>
          <div className="hidden md:block text-right text-xs text-muted-foreground">
            <div>Visibility {drivers?.visibility ?? '—'}</div>
            <div>Sentiment {drivers?.sentiment ?? '—'}</div>
            <div>Risk {drivers?.risk ?? '—'}</div>
          </div>
        </div>
        <Progress value={score} className="h-2 mt-4" />
        <div className={`h-2 w-full rounded-full mt-1 ${bar} opacity-20`} style={{ width: `${score}%` }} />
      </CardContent>
    </Card>
  );
}
