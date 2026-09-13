import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';
import { analyzeEntity } from '@/lib/services/analyzeEntity';
import { webMentionsAdapter, fetchSerperQueries } from '@/lib/adapters/webMentions';
import { classifyIntent, Intent } from '@/lib/services/classifyIntent';
import { prisma } from '@/lib/db';
import { isQuotaError, quotaMessage } from '@/lib/quota';

const MAX_STEPS = 5;

function getTextFromUIMessage(m: any): string {
  if (m.parts?.length) return m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.map((c: any) => c.text || '').join('\n');
  return '';
}

// --- System prompt, fixed ---
function buildSystemPrompt(intentHint?: Intent, classifiedEntities?: string[], classifiedRange?: string): string {
  const base = `You are Trubetix — a sharp, senior PR intelligence analyst.

VOICE: Quick, confident, a little dry — never salesy, never hype. Banned words/phrases: "undisputed," "bulletproof," "flying blind," "game-changing," "precise and instant," and any winking/exclamation-heavy sign-off. You sound like a competent analyst texting a colleague, not a product pitching itself.
EMOJI: Max 1 per reply, only when it genuinely adds tone. Never on data points or scores. Default to none.
LENGTH: If the answer is one line, give one line. Don't pad with filler paragraphs.

HONESTY ABOUT YOUR OWN LIMITS: If you can't do something right now, say the real reason in plain words ("I can only get that by running a quick search — want me to?"). Never invent a technical-sounding excuse ("tools are disconnected," "offline," "not currently available") unless it is literally true. A made-up excuse is worse than an honest limitation.

DON'T RE-PITCH: If the user already declined a full analysis, or already said they just want a quick answer, do not repeat the same offer again in your next reply. Either answer with what the lightweight tool gives you, or state the limitation once, plainly, and stop — don't loop the same pitch a second time.

CAPABILITIES: You analyze PR health via real web data (GNews for news, Serper for social/web mentions) and deterministic scoring. You CAN generate PDFs — every completed analysis renders a Download PDF button in the UI automatically. Never say you can't.
MEMORY: Full in-chat history.
TRUTH: Never invent scores or counts. Only present real tool output.
RENDER: Never output raw HTML, never output "<a href" or "Download PDF Report" button code — the UI renders the PDF button automatically. Do NOT emit any download link HTML in your text.`;

  if (intentHint === 'casual_chat') {
    return base + `\n\nROUTING: This is a casual conversation. Respond naturally and helpfully. Do NOT call any analysis tools. If they ask what you can do, mention PR analysis, reputation scoring, and PDF reports — in one line, not a pitch.`;
  }

  if (intentHint === 'ambiguous') {
    return base + `\n\nROUTING: The user's intent is ambiguous — they might want a quick factual answer or a full analysis. Ask them directly in one short line, e.g. "Want me to just answer that, or run a full analysis with a score?" Do NOT call any analysis tools yet. Once they answer, respect it — don't re-ask this on the next message.`;
  }

  if (intentHint === 'volume_query') {
    return base + `\n\nROUTING: The user wants a quick factual answer about mention volume or activity — NOT a full analysis.
RULE: Call execute_volume_query directly, with no confirmation step first. Build EXACTLY 1 query per entity: \`site:instagram.com "Entity"\`. If 2 entities, 2 queries max. Do NOT add /reel/ or /p/ variants.
AFTER TOOL: You MUST output ZERO text. Do not write any sentence, disclaimer, or count. The UI card renders the entire answer. Any text you output will be hidden and wasted. Just call the tool and stop.
Do NOT call ask_user_for_confirmation or execute_pipeline.`;
  }

  if (intentHint === 'pdf_generation') {
    return base + `\n\nROUTING: The user is explicitly asking for a PDF report. Check the conversation history — if a completed analysis exists, tell them the download button is available in the analysis card above, in one line. If no analysis has been run yet, ask which entity they want analyzed first. Do NOT auto-run the pipeline. PDF generation is always a separate, explicit ask.`;
  }

  // full_analysis — default tool-enabled flow
  return base + `\n\nROUTING: The user wants a full PR analysis.
RULE: You MUST call ask_user_for_confirmation with entities=[${classifiedEntities?.map(e => `"${e}"`).join(',') || '...'}] and range ${classifiedRange || '7d'} (default 7d if not specified). Do NOT ask in plain text — use the tool UI (1d/7d/15d/30d tabs). Only greet in text when user says hi/hello with no entities.
SINGLE-CONFIRM: Call ask_user_for_confirmation ONCE, then on result if not cancelled IMMEDIATELY call execute_pipeline with EXACT range. Do not ask again. Respect 1d/7d/15d/30d.
PDF: NEVER auto-generate a PDF. The download button appears in the UI automatically, but the user must explicitly ask you to generate one. Do not offer, suggest, or trigger PDF generation unless the user literally requests it.`;
}

// --- Tool definitions (unchanged interface) ---
function buildTools(chatId: string | undefined) {
  return {
    ask_user_for_confirmation: tool({
      description: 'Extracts entities and range',
      inputSchema: z.object({ entities: z.array(z.string()), range: z.enum(['1d', '7d', '15d', '30d']) }),
    }),
    execute_pipeline: tool({
      description: 'Runs PR pipeline',
      inputSchema: z.object({ entities: z.array(z.string()), range: z.enum(['1d', '7d', '15d', '30d']) }),
      execute: async (args: { entities: string[]; range: '1d' | '7d' | '15d' | '30d' }) => {
        const { entities, range } = args;
        try {
          const results = await Promise.all(entities.map((entity) => analyzeEntity(entity, range)));
          const payload = { status: 'success' as const, entities, range, results };
          if (chatId) {
            try {
              const parts: any[] = [{ type: 'tool-execute_pipeline', toolCallId: `persist-${Date.now()}`, state: 'output-available', input: { entities, range }, output: payload }];
              await prisma.message.create({ data: { chatId, role: 'assistant', content: `Analysis for ${entities.join(', ')} — ${results[0]?.label ?? ''} ${results[0]?.compositeScore ?? ''}/100`, parts } });
              await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
            } catch { }
          }
          return payload;
        } catch (e: any) {
          if (e?.isQuota || isQuotaError(e).hit) { const retryAfter = e?.retryAfter ?? isQuotaError(e).retryAfter; return { status: 'quota_exceeded', entities, range, results: [], error: quotaMessage(retryAfter), retryAfter } as any; }
          return { status: 'error', entities, range, results: [], error: e?.message ?? 'Pipeline failed' } as any;
        }
      },
    }),
    execute_volume_query: tool({
      description: 'Fetches post counts via Google Search. Provide EXACTLY 1 query per entity as site:instagram.com "Entity" (no /reel/ or /p/ suffix). For 2 entities, send 2 queries. Keep it minimal.',
      inputSchema: z.object({ queries: z.array(z.string()), range: z.enum(['1d', '7d', '15d', '30d']) }),
      execute: async (args: { queries: string[]; range: '1d' | '7d' | '15d' | '30d' }) => {
        const { queries, range } = args;
        try {
          const results = await fetchSerperQueries(queries, range);
          const payload = {
             status: 'success' as const,
             range,
             results: results.map(r => ({
               query: r.query,
               count: r.mentions.length,
               mentions: r.mentions.slice(0, 5),
               searchInformation: r.searchInformation,
               topMentions: r.mentions.slice(0, 5),
               error: r.error
             }))
          };
          if (chatId) {
            try {
              const parts: any[] = [{ type: 'tool-execute_volume_query', toolCallId: `vol-persist-${Date.now()}`, state: 'output-available', input: { queries, range }, output: payload }];
              await prisma.message.create({ data: { chatId, role: 'assistant', content: '', parts } });
              await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
            } catch {}
          }
          return payload;
        } catch (e: any) {
          return { status: 'error', error: e?.message ?? 'Search failed' };
        }
      }
    }),
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages: any[] = body.messages ?? [];
  let chatId: string | undefined = body.chatId;
  const deepThinking: boolean = !!body.deepThinking;

  // --- Chat ID creation/lookup (unchanged) ---
  if (!chatId && messages?.length) {
    const firstUser = messages.find((m: any) => m.role === 'user');
    const title = (getTextFromUIMessage(firstUser) || 'New chat').slice(0, 80);
    try { const chat = await prisma.chat.create({ data: { title: title || 'New chat' } }); chatId = chat.id; } catch { }
  } else if (chatId) {
    try {
      const exists = await prisma.chat.findUnique({ where: { id: chatId } });
      if (!exists) { const firstUser = messages.find((m: any) => m.role === 'user'); const title = (getTextFromUIMessage(firstUser) || 'New chat').slice(0, 80); const chat = await prisma.chat.create({ data: { id: chatId, title: title || 'New chat' } }); chatId = chat.id; }
    } catch { }
  }

  // --- Intent classification ---
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const lastUserText = lastUserMsg ? getTextFromUIMessage(lastUserMsg) : '';

  // Skip classification if there's a pending tool call (mid-flow confirmation)
  const hasPendingTool = messages.some((m: any) =>
    (m.parts ?? []).some((p: any) =>
      p.type === 'tool-ask_user_for_confirmation' && (p.state === 'call' || p.state === 'input-available' || p.state === 'output-available')
    )
  );

  let intentHint: Intent = 'full_analysis'; // default
  let classifiedEntities: string[] = [];
  let classifiedRange: string | undefined;

  if (!hasPendingTool && messages.length > 0) {
    try {
      const formattedMessages = messages.map((m: any) => ({
        role: m.role,
        content: getTextFromUIMessage(m)
      })).filter((m) => m.content.trim().length > 0);

      const classification = await classifyIntent(formattedMessages);
      intentHint = classification.intent;
      classifiedEntities = classification.entities;
      classifiedRange = classification.range;
    } catch (e) {
      console.warn('Intent classification failed, defaulting to full_analysis:', e);
    }
  }

  // Determine whether to include tools
  let selectedTools: Record<string, any> | undefined = undefined;
  if (hasPendingTool || intentHint === 'full_analysis') {
    const allTools = buildTools(chatId);
    selectedTools = {
      ask_user_for_confirmation: allTools.ask_user_for_confirmation,
      execute_pipeline: allTools.execute_pipeline,
    };
  } else if (intentHint === 'volume_query') {
    const allTools = buildTools(chatId);
    selectedTools = {
      execute_volume_query: allTools.execute_volume_query,
    };
  }

  const modelsToTry = ['models/gemini-3.6-flash', 'models/gemini-2.5-flash'];
  let lastErr: any;
  for (let i = 0; i < modelsToTry.length; i++) {
    const modelId = modelsToTry[i];
    try {
      const result = streamText({
        model: google(modelId),
        messages: await convertToModelMessages(messages ?? []),
        ...(deepThinking ? ({ providerOptions: { google: { thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } } } as any } as any) : {}),
        system: buildSystemPrompt(hasPendingTool ? 'full_analysis' : intentHint, classifiedEntities, classifiedRange),
        ...(selectedTools ? { tools: selectedTools } : {}),
        stopWhen: stepCountIs(MAX_STEPS),
        onFinish: async ({ isAborted, response }: any) => {
          if (isAborted || !chatId) return;
          try {
            const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
            if (lastUser) { const userText = getTextFromUIMessage(lastUser); if (userText) { const lastSaved = await prisma.message.findFirst({ where: { chatId }, orderBy: { createdAt: 'desc' } }); const isDup = lastSaved?.role === 'user' && lastSaved?.content === userText; if (!isDup) await prisma.message.create({ data: { chatId, role: 'user', content: userText, parts: lastUser.parts ?? undefined } }); } }
            const rms: any[] = response?.messages ?? [];
            for (const rm of rms) { if (rm.role !== 'assistant') continue; const parts = (rm as any).parts ?? (rm as any).content ?? []; const textContent = getTextFromUIMessage(rm as any) || (typeof rm.content === 'string' ? rm.content : ''); const hasTools = parts?.some((p: any) => p.type?.startsWith('tool-')); if (!textContent && !hasTools) continue; const exists = await prisma.message.findFirst({ where: { chatId, content: textContent || 'Analysis complete' }, orderBy: { createdAt: 'desc' } }); if (exists && hasTools) continue; await prisma.message.create({ data: { chatId, role: 'assistant', content: textContent || 'Analysis complete', parts } }); }
            if (rms.length > 0) await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
          } catch (e) { console.error('Failed to save chat', e); }
        },
      });
      const response = result.toUIMessageStreamResponse();
      if (chatId) response.headers.set('X-Chat-Id', chatId);
      return response;
    } catch (e: any) {
      lastErr = e;
      const q = isQuotaError(e);
      if (q.hit && i < modelsToTry.length - 1) { console.warn(`Quota hit on ${modelId}, trying ${modelsToTry[i + 1]}`); continue; }
      if (q.hit) return new Response(JSON.stringify({ error: quotaMessage(q.retryAfter), retryAfter: q.retryAfter, code: 'QUOTA_EXCEEDED' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      console.error('chat route error', e);
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
  const q = isQuotaError(lastErr);
  if (q.hit) return new Response(JSON.stringify({ error: quotaMessage(q.retryAfter), retryAfter: q.retryAfter, code: 'QUOTA_EXCEEDED' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ error: 'Something went wrong.', code: 'INTERNAL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
