'use client';

import { PROMPT_CARDS } from '@/lib/config';

interface PromptCardsProps {
  onSelect: (text: string) => void;
}

export function PromptCards({ onSelect }: PromptCardsProps) {
  return (
    <div className="grid w-full max-w-[720px] grid-cols-1 gap-4 md:grid-cols-3">
      {PROMPT_CARDS.map(({ icon: Icon, title, desc }) => (
        <button
          key={title}
          onClick={() => onSelect(desc)}
          className="rounded-2xl border border-[#F0EEFF] bg-[#FCFCFD] p-5 text-left hover:bg-white hover:shadow-sm"
        >
          <Icon className="h-4 w-4 text-[#6B7280]" />
          <div className="mt-10 text-[13px] font-semibold text-[#111827]">{title}</div>
          <div className="mt-1 line-clamp-2 text-[12px] leading-4 text-[#9CA3AF]">{desc}</div>
        </button>
      ))}
    </div>
  );
}
