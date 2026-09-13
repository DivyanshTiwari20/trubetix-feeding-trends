'use client';

import { useEffect, useState, useRef } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
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
  
  if (!isLoading && !thoughts && (!toolCalls || toolCalls.length === 0)) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full mb-4 border rounded-md bg-muted/30"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {!isLoading && <div className="w-2 h-2 rounded-full bg-green-500" />}
          {isLoading ? `Thinking... ${elapsed}s` : `Thought for ${elapsed}s`}
        </div>
        <CollapsibleTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="sr-only">Toggle thinking panel</span>
        </CollapsibleTrigger>
      </div>
      
      <CollapsibleContent>
        <ScrollArea className="max-h-60 p-4 font-mono text-sm text-muted-foreground">
          {thoughts && (
            <div className="mb-4 whitespace-pre-wrap">
              {thoughts}
            </div>
          )}
          
          {toolCalls && toolCalls.length > 0 && (
            <div className="space-y-2">
              {toolCalls.map((toolCall, index) => {
                const confirmedRange = toolCall.result?.range ?? toolCall.result?.output?.range;
                const displayArgs = confirmedRange ? { ...toolCall.args, range: `${toolCall.args?.range} → confirmed: ${confirmedRange}` } : toolCall.args;
                return (
                <div key={index} className="flex gap-2 items-start">
                  <div className="text-primary/70">{'>'}</div>
                  <div>
                    <span className="font-semibold">{toolCall.toolName}</span>
                    {displayArgs && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {JSON.stringify(displayArgs)}
                      </span>
                    )}
                    {toolCall.result && toolCall.toolName === 'ask_user_for_confirmation' && (
                      <span className="text-green-600 ml-2 text-xs">→ {JSON.stringify(toolCall.result)}</span>
                    )}
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
