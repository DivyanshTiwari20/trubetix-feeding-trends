'use client';
import { Separator } from '@/components/ui/separator';
export function AnalysisSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-widest uppercase">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      <Separator />
      <div>{children}</div>
    </div>
  );
}
