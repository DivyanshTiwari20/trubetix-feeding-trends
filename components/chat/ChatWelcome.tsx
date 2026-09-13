'use client';

import { Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { ChatInput } from './ChatInput';

interface ChatWelcomeProps {
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPromptClick: (text: string) => void;
  isLoading?: boolean;
  deepThinking?: boolean;
  onDeepThinkingChange?: (v: boolean) => void;
}

export function ChatWelcome({ input, onInputChange, onSubmit, isLoading, deepThinking, onDeepThinkingChange }: ChatWelcomeProps) {
  return (
    <div className="flex min-h-full flex-col items-center px-6 pb-8 pt-10 md:pt-16">
      <div className="mb-2 flex items-center justify-center">
        <Loader />
      </div>
      <div className="text-center">
        <div className="bg-gradient-to-r from-[#C4B5FD] to-[#A78BFA] bg-clip-text text-[18px] font-medium text-transparent">
          Hello, Yash
        </div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-[#0B0B0F] md:text-[28px]">
          How can I assist you today?
        </h1>
      </div>
      <div className="mt-8 w-full max-w-[720px]">
        <ChatInput value={input} onChange={onInputChange} onSubmit={onSubmit} isLoading={isLoading} variant="hero" deepThinking={deepThinking} onDeepThinkingChange={onDeepThinkingChange} />
      </div>
    </div>
  );
}
