'use client';
export function PlatformBreakdown({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([k,v])=>(
        <div key={k} className="flex items-center gap-3">
          <span className="text-xs w-24 capitalize">{k}</span>
          <div className="flex-1 h-2 bg-[#F3F0FF] rounded overflow-hidden"><div className="h-2 bg-[#7C3AED] rounded" style={{ width: `${(v/max)*100}%` }} /></div>
          <span className="text-xs w-8 text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}
