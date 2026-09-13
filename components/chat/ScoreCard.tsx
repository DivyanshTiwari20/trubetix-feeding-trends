import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScoreResult } from '@/lib/types';
import { ExternalLink } from 'lucide-react';

interface ScoreCardProps {
  entity: string;
  result: ScoreResult;
  range?: string;
}

export function ScoreCard({ entity, result, range }: ScoreCardProps) {
  const rangeLabel = range === '1d' ? '24 Hours' : range === '7d' ? '7 Days' : range === '15d' ? '15 Days' : range === '30d' ? '30 Days' : range;
  const getColorClass = (label: ScoreResult['label']) => {
    switch (label) {
      case 'Excellent': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'Good': return 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30';
      case 'Mixed': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      case 'Poor': return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
      case 'Crisis': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-emerald-500';
    if (score >= 40) return 'bg-yellow-500';
    if (score >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className="w-full my-4 overflow-hidden border-2 border-muted">
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-muted/30 border-b">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-2xl font-bold tracking-tight">{entity}</h3>
            {range && <Badge variant="secondary" className="text-xs font-medium">{rangeLabel}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">PR Analysis Score{range ? ` • ${rangeLabel}` : ''}</p>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="flex flex-col items-end">
            <span className="text-4xl font-black">{result.compositeScore}</span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">/ 100</span>
          </div>
          <Badge className={`text-sm px-3 py-1 ${getColorClass(result.label)}`} variant="outline">
            {result.label}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Overall Health</span>
          </div>
          {/* Custom progress bar to apply specific color */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div 
              className={`h-full ${getProgressColor(result.compositeScore)} transition-all`} 
              style={{ width: `${result.compositeScore}%` }} 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Sentiment</div>
            <div className="text-lg font-semibold">{result.breakdown.sentimentScore}</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Volume</div>
            <div className="text-lg font-semibold">{result.breakdown.volumeScore}</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Trend</div>
            <div className="text-lg font-semibold">{result.breakdown.trendScore}</div>
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Authority</div>
            <div className="text-lg font-semibold">{result.breakdown.authorityWeight}</div>
          </div>
        </div>

        {result.analysis && (
          <div className="mb-8 space-y-4">
            {result.analysis.executiveSummary && (
              <div>
                <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Executive Summary</h4>
                <div className="prose prose-sm max-w-none prose-strong:font-semibold prose-p:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.analysis.executiveSummary}</ReactMarkdown>
                </div>
              </div>
            )}
            {result.analysis.sentimentNarrative && (
              <div>
                <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Sentiment Narrative</h4>
                <div className="prose prose-sm max-w-none prose-strong:font-semibold prose-p:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.analysis.sentimentNarrative}</ReactMarkdown>
                </div>
              </div>
            )}
            {result.analysis.keyThemes?.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Key Themes</h4>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.analysis.keyThemes.map((t) => `- ${t}`).join('\n')}</ReactMarkdown>
                </div>
              </div>
            )}
            {result.analysis.timelineInsights && (
              <div>
                <h4 className="font-semibold mb-2 text-sm uppercase tracking-wider text-muted-foreground">Timeline ({rangeLabel ?? range})</h4>
                <div className="prose prose-sm max-w-none prose-strong:font-semibold">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.analysis.timelineInsights}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {result.topMentions.length > 0 && (
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Top Mentions</h4>
            <div className="space-y-3">
              {result.topMentions.map((mention, i) => (
                <a 
                  key={i} 
                  href={mention.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-3 rounded-md border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium line-clamp-1 flex-1 pr-4">
                      {mention.title}
                    </span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                      {mention.source}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] uppercase font-mono ${mention.sentiment === 'positive' ? 'text-green-500' : mention.sentiment === 'negative' ? 'text-red-500' : ''}`}>
                      {mention.sentiment}
                    </Badge>
                    {mention.sourceAuthority && (
                      <span className="opacity-70">{mention.sourceAuthority}</span>
                    )}
                    <span className="opacity-70 ml-auto">
                      {new Date(mention.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
