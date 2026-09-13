'use client';

import { useEffect, useState, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ThinkingPanelProps {
  isLoading: boolean;
  thoughts?: string;
  toolCalls?: any[]; // We will refine this type later
}

export function ThinkingPanel({ isLoading, thoughts, toolCalls }: ThinkingPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      startRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    } else if (startRef.current) {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }
  }, [isLoading]);

  // Auto-collapse if there are no more active tool calls/thoughts and we are no longer loading
  // For now, we'll let the user toggle it or keep it open while loading.
  
  if (!isLoading) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full mb-4 border rounded-xl bg-white shadow-sm"
    >
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {!isLoading && <div className="w-2 h-2 rounded-full bg-green-500" />}
          {isLoading ? `Thinking... ${elapsed}s` : `Thought for ${elapsed}s`}
        </div>
        <CollapsibleTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="sr-only">Toggle thinking panel</span>
        </CollapsibleTrigger>
      </div>
      
      <CollapsibleContent>
        <div className="px-4 pb-1">
          <div className="h-px bg-border" />
        </div>
        <ScrollArea className="max-h-60 p-4 text-sm">
          {thoughts && (
            <div className="mb-4 whitespace-pre-wrap">
              {thoughts}
            </div>
          )}
          
          {toolCalls && toolCalls.length > 0 && (
            <div className="space-y-2.5">
              {toolCalls.map((toolCall, index) => {
                const range = toolCall.args?.range ?? toolCall.result?.range ?? toolCall.result?.output?.range;
                const rangeLabel = range === '1d' ? 'past 24 hours' : range === '7d' ? 'past 7 days' : range === '15d' ? 'past 15 days' : range === '30d' ? 'past 30 days' : range ? `past ${range}` : '';
                let label = '';
                let detail = '';
                if (toolCall.toolName === 'execute_volume_query') {
                  const qs: string[] = toolCall.args?.queries ?? [];
                  const ents = Array.from(new Set(qs.map((q: string) => (q.match(/"([^"]+)"/)?.[1] ?? q).trim()).filter(Boolean))).slice(0,2);
                  label = ents.length ? `Searching Instagram for ${ents.join(' & ')}` : 'Searching Instagram';
                  detail = rangeLabel ? ` · ${rangeLabel}` : '';
                } else if (toolCall.toolName === 'execute_pipeline') {
                  const ents = toolCall.args?.entities ?? toolCall.result?.entities ?? [];
                  label = ents.length ? `Running PR analysis for ${ents.slice(0,2).join(', ')}` : 'Running PR analysis';
                  detail = rangeLabel ? ` · ${rangeLabel}` : '';
                } else if (toolCall.toolName === 'ask_user_for_confirmation') {
                  const ents = toolCall.args?.entities ?? [];
                  label = ents.length ? `Confirming analysis for ${ents.slice(0,2).join(', ')}` : 'Confirming analysis';
                  detail = rangeLabel ? ` · ${rangeLabel}` : '';
                } else {
                  label = toolCall.toolName.replace(/_/g, ' ');
                }
                const done = !!(toolCall.result || toolCall.rawState === 'output-available');
                return (
                <div key={index} className="flex gap-3 items-start rounded-lg border bg-muted/20 px-3 py-2.5">
                  <div className={`mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center ${done ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {done ? <span className="text-[11px]">✓</span> : <Search className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1 leading-5">
                    <div className="text-[13px] font-medium text-foreground">{label}<span className="font-normal text-muted-foreground">{detail}</span></div>
                    {thoughts && index === 0 && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{thoughts.slice(0,120)}</div>}
                  </div>
                </div>
                );
              })}
            </div>
          )}
          
          {isLoading && !thoughts && (!toolCalls || toolCalls.length === 0) && (
            <div className="flex items-center space-x-2 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            </div>
          )}
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
