'use client';

import { useState } from 'react';
import { Plus, PanelLeft, LogOut, MessageSquare, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';

interface AppSidebarProps {
  onClose: () => void;
  onNewChat: () => void;
  chats: any[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat?: (id: string) => void;
}

export function AppSidebar({ onClose, onNewChat, chats, activeChatId, onSelectChat, onDeleteChat }: AppSidebarProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-[#EDE8FF] bg-[#F8F7FA] md:flex">
      <div className="flex h-[64px] items-center justify-between px-4">
        <div className="flex items-center gap-1.5">
          <Loader size={36} />
          <span className="text-[16px] font-semibold tracking-tight text-[#111827]">Trubetix</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} className="hover:bg-black/5">
          <PanelLeft className="h-4 w-4 text-[#6B7280]" />
        </Button>
      </div>

      <div className="px-3">
        <Button
          onClick={onNewChat}
          className="flex h-10 w-full justify-center gap-2 bg-[#0B0B0F] text-[13px] font-medium text-white shadow-sm hover:bg-black"
        >
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pt-6">
        {chats.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#9CA3AF]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <p className="mt-3 text-[13px] text-[#9CA3AF]">No chats yet</p>
            <p className="text-[12px] text-[#9CA3AF]/70">Your conversations will appear here</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">Chats</div>
            <div className="space-y-1">
              {chats.map((c: any) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-1 rounded-lg border px-2 py-0.5 ${
                    activeChatId === c.id ? 'bg-[#E8F0FE] border-[#D4E2FA]' : 'bg-transparent border-transparent hover:bg-[#E8F0FE] hover:border-[#D4E2FA]/60'
                  }`}
                >
                  <button
                    onClick={() => onSelectChat(c.id)}
                    title={c.title}
                    className="min-w-0 flex-1 truncate rounded-md px-1 py-1 text-left text-[13px] leading-5 text-[#111827]"
                  >
                    {c.title}
                  </button>
                  {confirmId === c.id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmId(null)}
                        className="h-6 w-6 hover:bg-black/5"
                        aria-label="Cancel delete"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => {
                          onDeleteChat?.(c.id);
                          setConfirmId(null);
                        }}
                        className="h-6 w-6"
                        aria-label="Confirm delete"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(c.id);
                      }}
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-50 hover:text-red-600 data-[visible=true]:opacity-100"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[#E9E5FF]/60 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-3 shadow-sm">
          <img src="https://i.pravatar.cc/100?img=12" alt="avatar" className="h-8 w-8 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-none text-[#111827]">Emerson Sterling</div>
            <div className="truncate text-[11px] text-[#9CA3AF]">sterlingr@gmail.com</div>
          </div>
          <Button variant="ghost" size="icon-xs" className="shrink-0">
            <LogOut className="h-4 w-4 text-[#9CA3AF]" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
