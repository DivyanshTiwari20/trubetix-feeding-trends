import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AnalysisFormProps {
  initialEntities: string[];
  initialRange: string;
  onConfirm: (entities: string[], range: string) => void;
  onCancel?: () => void;
}

export function AnalysisForm({ initialEntities, initialRange, onConfirm, onCancel }: AnalysisFormProps) {
  const [range, setRange] = useState(initialRange || '7d');

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
        
        {/* We will add PlatformSelector here later in Phase 2 */}
      </CardContent>
      <CardFooter className="flex gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button onClick={() => onConfirm(initialEntities, range)} className="flex-1">
          Run Analysis
        </Button>
      </CardFooter>
    </Card>
  );
}
