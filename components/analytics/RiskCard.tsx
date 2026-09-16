'use client';
export function RiskCard({ risks }: { risks: string[] }) {
  if (!risks.length) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="text-sm font-semibold text-amber-900">Risks</div>
      <ul className="mt-2 list-disc pl-5 text-sm text-amber-900 space-y-1">{risks.slice(0,4).map((r,i)=><li key={i}>{r}</li>)}</ul>
    </div>
  );
}
