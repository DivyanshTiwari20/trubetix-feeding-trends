'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
export function DataCoverageCard({ indexedCount, coverage, platforms }: { indexedCount: number; coverage: string; platforms: string[] }) {
  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-2"><CardTitle className="text-sm tracking-widest uppercase">Data Coverage</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {platforms.map(p=> <Badge key={p} variant="secondary" className="capitalize rounded-full">{p}</Badge>)}
        </div>
        <div className="text-sm"><span className="font-semibold">{indexedCount}</span> posts discovered <span className="text-muted-foreground">• Coverage: {coverage||'Partial'} • Not a complete platform census</span></div>
        <Alert>
          <AlertDescription className="text-xs">Based on publicly indexed/searchable data via Serper/GNews. If complete platform data unavailable, counts represent discovered results only.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
