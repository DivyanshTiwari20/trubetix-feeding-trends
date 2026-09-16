import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AnalysisFormProps {
  initialEntities: string[];
  initialRange: string;
  initialPlatforms?: string[];
  onConfirm: (entities: string[], range: string, platforms?: string[]) => void;
  onCancel?: () => void;
}

export function AnalysisForm({ initialEntities, initialRange, initialPlatforms, onConfirm, onCancel }: AnalysisFormProps) {
  const [range, setRange] = useState(initialRange || '7d');
  const [platforms, setPlatforms] = useState<string[]>(initialPlatforms ?? []);
  const opts = [
    { id: 'instagram', label: 'Instagram' },
    { id: 'twitter', label: 'X' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'reddit', label: 'Reddit' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'news', label: 'News' },
  ];
  const toggle = (id: string) => setPlatforms(prev => prev.includes(id) ? prev.filter(p=>p!==id) : [...prev, id]);

  return (
    <Card className="w-full my-4 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Confirm Analysis Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-2 text-muted-foreground">Detected Entities</div>
          <div className="flex flex-wrap gap-2">
            {initialEntities.map((entity, i) => (
              <Badge key={i} variant="secondary" className="text-sm">
                {entity}
              </Badge>
            ))}
          </div>
        </div>
        
        <div>
          <div className="text-sm font-medium mb-2 text-muted-foreground">Time Range</div>
          <Tabs value={range} onValueChange={setRange} className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="1d">1 Day</TabsTrigger>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="15d">15 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div>
          <div className="text-sm font-medium mb-2 text-muted-foreground">Platforms {platforms.length===0 ? <span className="text-amber-600 font-normal">— select one or leave empty for overall</span> : null}</div>
          <div className="flex flex-wrap gap-2">
            {opts.map(o => (
              <Badge key={o.id} variant={platforms.includes(o.id) ? 'default' : 'outline'} className="capitalize cursor-pointer" onClick={()=>toggle(o.id)}>{o.label}</Badge>
            ))}
            <Badge variant={platforms.length===0 ? 'secondary' : 'outline'} className="cursor-pointer" onClick={()=>setPlatforms([])}>Overall</Badge>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button onClick={() => onConfirm(initialEntities, range, platforms)} className="flex-1">
          Run Analysis
        </Button>
      </CardFooter>
    </Card>
  );
}
