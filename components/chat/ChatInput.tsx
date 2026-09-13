'use client';

import { useRef, useEffect } from 'react';
import { Plus, ArrowUp, Brain, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  variant?: 'hero' | 'compact';
  deepThinking?: boolean;
  onDeepThinkingChange?: (v: boolean) => void;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, variant = 'compact', deepThinking, onDeepThinkingChange }: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const isExpanded = value.length > 40 || value.includes('\n') || value.includes('\t') || (value.match(/  /g) !== null);

  if (isExpanded) {
    return (
      <form onSubmit={onSubmit} className={variant === 'hero' ? 'w-full max-w-[720px]' : 'mx-auto flex w-full max-w-[780px]'}>
        <div className="w-full rounded-[20px] border border-[#EDE8FF] bg-white p-3 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <div className="relative">
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ask anything"
              rows={3}
              onKeyDown={handleKeyDown}
              className="min-h-[80px] max-h-[200px] w-full resize-none bg-transparent pr-8 text-[14px] leading-6 text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none"
            />
            <button type="button" className="absolute right-0 top-0 p-1 text-[#9CA3AF] hover:text-[#6B7280]">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon-sm" className="h-8 w-8 shrink-0 rounded-full hover:bg-[#F8F7FA]">
              <Plus className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDeepThinkingChange?.(!deepThinking)}
                className={cn(
                  'h-8 gap-1.5 rounded-full px-3 text-[13px] font-medium',
                  deepThinking ? 'bg-[#F0EBFF] text-[#6D28D9] hover:bg-[#EBE5FF]' : 'text-[#6B7280] hover:bg-[#F8F7FA]'
                )}
              >
                <Brain className="h-4 w-4" /> Think
              </Button>
              <Button
                type="submit"
                size="icon-sm"
                disabled={!value.trim() || isLoading}
                className="h-8 w-8 shrink-0 rounded-full bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  if (variant === 'hero') {
    return (
      <form onSubmit={onSubmit} className="w-full max-w-[720px]">
        <div className="flex items-center gap-1 rounded-full border border-[#EDE8FF] bg-white px-2 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 rounded-full hover:bg-[#F8F7FA]">
            <Plus className="h-5 w-5" />
          </Button>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ask anything"
            rows={1}
            onKeyDown={handleKeyDown}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-5 placeholder:text-[#9CA3AF] focus:outline-none overflow-hidden"
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDeepThinkingChange?.(!deepThinking)}
              className={cn(
                'h-8 gap-1.5 rounded-full px-3 text-[13px] font-medium',
                deepThinking ? 'bg-[#F0EBFF] text-[#6D28D9] hover:bg-[#EBE5FF]' : 'text-[#6B7280] hover:bg-[#F8F7FA]'
              )}
            >
              <Brain className="h-5 w-5" /> Think
            </Button>
            <Button
              type="submit"
              size="icon-sm"
              disabled={!value.trim() || isLoading}
              className="shrink-0 rounded-full bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-[780px] items-center gap-1 rounded-full border border-[#EDE8FF] bg-white px-2 py-2 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
      <Button type="button" variant="ghost" size="icon-sm" className="shrink-0 rounded-full hover:bg-[#F8F7FA]">
        <Plus className="h-5 w-5" />
      </Button>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask anything"
        rows={1}
        onKeyDown={handleKeyDown}
        className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-5 placeholder:text-[#9CA3AF] focus:outline-none overflow-hidden"
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDeepThinkingChange?.(!deepThinking)}
          className={cn(
            'h-8 gap-1.5 rounded-full px-3 text-[13px] font-medium',
            deepThinking ? 'bg-[#F0EBFF] text-[#6D28D9] hover:bg-[#EBE5FF]' : 'text-[#6B7280] hover:bg-[#F8F7FA]'
          )}
        >
          <Brain className="h-5 w-5" /> Think
        </Button>
        <Button
          type="submit"
          size="icon-sm"
          disabled={!value.trim() || isLoading}
          className="shrink-0 rounded-full bg-[#3B82F6] text-white hover:bg-[#2563EB] disabled:opacity-50"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}
