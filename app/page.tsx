'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Languages, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatWelcome } from '@/components/chat/ChatWelcome';

export default function Home() {
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deepThinking, setDeepThinking] = useState(false);
  const deepThinkingRef = useRef(false);
  const [showExtendedThinking, setShowExtendedThinking] = useState(false);

  const fetchChats = async () => {
    try {
      const r = await fetch('/api/chats');
      if (r.ok) setChats(await r.json());
    } catch { }
  };

  useEffect(() => {
    fetchChats();
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('activeChatId') : null;
      if (saved) {
        setActiveChatId(saved);
        activeChatIdRef.current = saved;
        (async () => {
          try {
            const r = await fetch(`/api/chats/${saved}`);
            if (r.ok) {
              const dbMessages: any[] = await r.json();
              const uiMessages = dbMessages.map((m: any) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                parts: m.parts ?? [{ type: 'text', text: m.content }],
                content: m.content,
              }));
              setMessages(uiMessages as any);
            }
          } catch {}
        })();
      }
    } catch {}
  }, []);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    try { if (activeChatId) localStorage.setItem('activeChatId', activeChatId); else localStorage.removeItem('activeChatId'); } catch {}
  }, [activeChatId]);

  useEffect(() => {
    deepThinkingRef.current = deepThinking;
  }, [deepThinking]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        fetch: async (url: any, options: any) => {
          let body: any = {};
          try {
            body = JSON.parse((options?.body as string) || '{}');
          } catch { }
          body.chatId = activeChatIdRef.current;
          body.deepThinking = deepThinkingRef.current;
          const res = await fetch(url as string, {
            ...options,
            body: JSON.stringify(body),
          } as any);
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error ?? `Request failed (${res.status})`);
          }
          const newId = res.headers.get('X-Chat-Id');
          if (newId && !activeChatIdRef.current) {
            activeChatIdRef.current = newId;
            setActiveChatId(newId);
          }
          setTimeout(fetchChats, 500);
          setTimeout(fetchChats, 2500);
          return res;
        },
      } as any),
    []
  );

  const chat = useChat({
    transport,
    onError: (err: any) => {
      console.error('chat error', err);
    },
  } as any);

  const { messages, sendMessage, status, setMessages, addToolResult, addToolOutput, error } = chat as any;

  const isLoading = status === 'streaming' || status === 'submitted';
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' as any });
  }, [messages, isLoading]);

  useEffect(() => {
    if (deepThinking && isLoading) {
      setShowExtendedThinking(true);
    } else if (!isLoading && showExtendedThinking) {
      const t = setTimeout(() => setShowExtendedThinking(false), 2200);
      return () => clearTimeout(t);
    }
  }, [isLoading, deepThinking, showExtendedThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const pending: any = messages
      .flatMap((m: any) => m.parts ?? [])
      .find((p: any) => p.type === 'tool-ask_user_for_confirmation' && (p.state === 'call' || p.state === 'input-available'));
    if (pending) {
      const toolCallId = pending.toolCallId;
      const cancelPayload = { entities: pending.input?.entities ?? pending.args?.entities ?? [], range: pending.input?.range ?? pending.args?.range ?? '7d', cancelled: true };
      try { (addToolOutput as any)?.({ toolCallId, output: cancelPayload }); } catch { }
      try { (addToolResult as any)?.({ toolCallId, result: cancelPayload }); } catch { }
      try { (addToolResult as any)?.(toolCallId, cancelPayload); } catch { }
    }
    sendMessage({ text: input });
    setInput('');
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    activeChatIdRef.current = null;
    setMessages([]);
  };

  const handleSelectChat = async (id: string) => {
    setActiveChatId(id);
    activeChatIdRef.current = id;
    try {
      const r = await fetch(`/api/chats/${id}`);
      if (!r.ok) return;
      const dbMessages: any[] = await r.json();
      const uiMessages = dbMessages.map((m: any) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        parts: m.parts ?? [{ type: 'text', text: m.content }],
        content: m.content,
      }));
      setMessages(uiMessages as any);
    } catch { }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      const r = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (!r.ok) return;
      setChats((prev: any[]) => prev.filter((c) => c.id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        activeChatIdRef.current = null;
        setMessages([]);
      }
    } catch { }
  };

  return (
    <div className="flex h-[100dvh] h-screen w-full overflow-hidden bg-[#F8F7FA] font-sans">
      <div className="flex h-full w-full overflow-hidden">
        {sidebarOpen && (
          <AppSidebar
            onClose={() => setSidebarOpen(false)}
            onNewChat={handleNewChat}
            chats={chats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onDeleteChat={handleDeleteChat}
          />
        )}
        <div className="flex flex-1 flex-col overflow-hidden bg-white">
          <AppHeader sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-white">
              {error && (
                <div className="mx-auto max-w-[780px] px-4 pt-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">We hit a temporary limit</div>
                    <div className="text-sm text-amber-800 mt-1">{(error as any)?.message ?? 'Gemini quota exceeded (20/day free). Please retry in ~45s or try a smaller date range.'}</div>
                  </div>
                </div>
              )}
              {messages.length === 0 ? (
                <ChatWelcome
                  input={input}
                  onInputChange={setInput}
                  onSubmit={handleSubmit}
                  onPromptClick={(t) => sendMessage({ text: t })}
                  isLoading={isLoading}
                  deepThinking={deepThinking}
                  onDeepThinkingChange={setDeepThinking}
                />
              ) : (
                <div className="mx-auto max-w-[780px] space-y-4 px-4 py-6 md:px-6">
                  {messages.map((m: any, idx: number) => (
                    <ChatMessage
                      key={m.id}
                      message={m as any}
                      isLoading={isLoading && idx === messages.length - 1}
                      addToolResult={(toolCallId: string, result: any) => {
                        try {
                          try { (addToolOutput as any)?.({ toolCallId, output: result }); } catch { }
                          try { (addToolResult as any)?.({ toolCallId, result }); } catch { }
                          try { (addToolResult as any)?.({ toolCallId, output: result }); } catch { }
                        } catch (e) {
                          console.error('addToolResult error:', e);
                        }
                      }}
                    />
                  ))}
                  {(isLoading || showExtendedThinking) && (
                    <div className="flex items-center gap-2 px-4 text-[13px] text-[#9CA3AF]">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-[#A78BFA]" />
                      {deepThinking || showExtendedThinking ? 'Thinking deeper...' : 'Thinking...'}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
            {messages.length > 0 && (
              <div className="bg-white p-4">
                <ChatInput value={input} onChange={setInput} onSubmit={handleSubmit} isLoading={isLoading} variant="compact" deepThinking={deepThinking} onDeepThinkingChange={setDeepThinking} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
