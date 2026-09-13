import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';
import { analyzeEntity } from '@/lib/services/analyzeEntity';
import { prisma } from '@/lib/db';
import { isQuotaError, quotaMessage } from '@/lib/quota';
const MAX_STEPS = 5;
function getTextFromUIMessage(m: any): string {
  if (m.parts?.length) return m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.map((c: any) => c.text || '').join('\n');
  return '';
}
export async function POST(req: Request) {
  const body = await req.json();
  const messages: any[] = body.messages ?? [];
  let chatId: string | undefined = body.chatId;
  const deepThinking: boolean = !!body.deepThinking;
  if (!chatId && messages?.length) {
    const firstUser = messages.find((m: any) => m.role === 'user');
    const title = (getTextFromUIMessage(firstUser) || 'New chat').slice(0, 80);
    try { const chat = await prisma.chat.create({ data: { title: title || 'New chat' } }); chatId = chat.id; } catch {}
  } else if (chatId) {
    try {
      const exists = await prisma.chat.findUnique({ where: { id: chatId } });
      if (!exists) { const firstUser = messages.find((m: any) => m.role === 'user'); const title = (getTextFromUIMessage(firstUser) || 'New chat').slice(0, 80); const chat = await prisma.chat.create({ data: { id: chatId, title: title || 'New chat' } }); chatId = chat.id; }
    } catch {}
  }
  const modelsToTry = ['models/gemini-3.5-flash','models/gemini-2.0-flash','models/gemini-1.5-flash'];
  let lastErr:any;
  for (let i=0;i<modelsToTry.length;i++) {
    const modelId = modelsToTry[i];
    try {
      const result = streamText({
        model: google(modelId),
        messages: await convertToModelMessages(messages ?? []),
        ...(deepThinking ? ({ providerOptions: { google: { thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } } } as any } as any) : {}),
        system: `You are Trubetix — senior PR analyst AI. Single GEMINI_API_KEY only. All data via Gemini Search grounding + GNews, deterministic scoring in code.
CAPABILITIES: You analyze PR health via real web data. You CAN generate PDFs — every analysis renders a Download PDF button. Never say you can't.
MEMORY: Full in-chat history.
RULE: When user mentions ANY brand/company/person to analyze (e.g. "PR analysis of Tanmay", "health of X"), you MUST call ask_user_for_confirmation with entities=[...] and range (default 7d if not specified). Do NOT ask in plain text — use the tool UI (1d/7d/15d/30d tabs). Only greet in text when user says hi/hello with no entities.
SINGLE-CONFIRM: Call ask_user_for_confirmation ONCE, then on result if not cancelled IMMEDIATELY call execute_pipeline with EXACT range. Do not ask again. Respect 1d/7d/15d/30d.
TRUTH: Never invent scores. Only present pipeline data.
STYLE: Short, to the point, no fluff. Be a little witty 😏, use emoji sparingly only when it adds vibe (max 1-2 per reply). Sound like a smart, confident analyst — crisp, clever, helpful.
RENDER: Never output raw HTML, never output "<a href" or "Download PDF Report" button code — the UI renders the PDF button automatically via the pipeline. Do NOT emit any download link HTML in your text.`,
        tools: {
          ask_user_for_confirmation: tool({ description: 'Extracts entities and range', inputSchema: z.object({ entities: z.array(z.string()), range: z.enum(['1d','7d','15d','30d']) }) }),
          execute_pipeline: tool({
            description: 'Runs PR pipeline', inputSchema: z.object({ entities: z.array(z.string()), range: z.enum(['1d','7d','15d','30d']) }),
            execute: async (args: { entities: string[]; range: '1d'|'7d'|'15d'|'30d' }) => {
              const { entities, range } = args;
              try {
                const results = await Promise.all(entities.map((entity) => analyzeEntity(entity, range)));
                const payload = { status: 'success' as const, entities, range, results };
                if (chatId) {
                  try {
                    const parts: any[] = [{ type: 'tool-execute_pipeline', toolCallId: `persist-${Date.now()}`, state: 'output-available', input: { entities, range }, output: payload }];
                    await prisma.message.create({ data: { chatId, role: 'assistant', content: `Analysis for ${entities.join(', ')} — ${results[0]?.label ?? ''} ${results[0]?.compositeScore ?? ''}/100`, parts } });
                    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
                  } catch {}
                }
                return payload;
              } catch (e: any) {
                if (e?.isQuota || isQuotaError(e).hit) { const retryAfter = e?.retryAfter ?? isQuotaError(e).retryAfter; return { status: 'quota_exceeded', entities, range, results: [], error: quotaMessage(retryAfter), retryAfter } as any; }
                return { status: 'error', entities, range, results: [], error: e?.message ?? 'Pipeline failed' } as any;
              }
            },
          }),
        },
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
      if (q.hit && i < modelsToTry.length - 1) { console.warn(`Quota hit on ${modelId}, trying ${modelsToTry[i+1]}`); continue; }
      if (q.hit) return new Response(JSON.stringify({ error: quotaMessage(q.retryAfter), retryAfter: q.retryAfter, code: 'QUOTA_EXCEEDED' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      console.error('chat route error', e);
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
  const q = isQuotaError(lastErr);
  if (q.hit) return new Response(JSON.stringify({ error: quotaMessage(q.retryAfter), retryAfter: q.retryAfter, code: 'QUOTA_EXCEEDED' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ error: 'Something went wrong.', code: 'INTERNAL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
