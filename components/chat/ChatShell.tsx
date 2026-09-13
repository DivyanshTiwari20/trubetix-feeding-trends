'use client';


import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp } from 'lucide-react';

interface ChatShellProps {
  messages: any[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  addToolResult: (toolCallId: string, result: any) => void;
}

export function ChatShell({ messages, input, handleInputChange, handleSubmit, isLoading, addToolResult }: ChatShellProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto border rounded-xl overflow-hidden bg-background">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground mt-20">
            <h2 className="text-xl font-semibold mb-2">Welcome to Trubetix</h2>
            <p>Enter an entity name (e.g. "Jackie Chan") to run a PR analysis.</p>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((m, index) => (
              <ChatMessage 
                key={m.id} 
                message={m} 
                isLoading={isLoading && index === messages.length - 1} 
                addToolResult={addToolResult}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-4 bg-background border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 p-3 rounded-md border bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={input}
            placeholder="Type an entity name to analyze..."
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="p-3 w-12 h-12">
            <ArrowUp className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
