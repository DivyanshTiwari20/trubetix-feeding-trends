'use client';
import type { Narrative } from '@/lib/types';
export function NarrativeBar({ narratives }: { narratives: Narrative[] }) {
  if (!narratives.length) return <div className="text-sm text-muted-foreground">No distinct narratives in this window.</div>;
  return (
    <div className="space-y-2">
      {narratives.slice(0,5).map(n=>(
        <div key={n.name} className="flex items-center gap-3">
          <span className="text-xs flex-1 truncate">{n.name}</span>
          <span className="text-xs text-muted-foreground">{n.volume} • {n.percentage}%</span>
        </div>
      ))}
    </div>
  );
}
