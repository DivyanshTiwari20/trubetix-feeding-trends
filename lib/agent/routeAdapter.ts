import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { prisma } from '../db';
import { runAgent } from './controller';

// Single source of truth for the flag (env + UI-toggle runtime override).
export { isAgentEnabled, setAgentRuntimeOverride, agentFlagSource } from './flag';

function getText(m: { parts?: { type?: string; text?: string }[]; content?: unknown }): string {
  if (m.parts?.length) return m.parts.filter(p => p.type === 'text').map(p => (p.text ?? '')).join('\n');
  if (typeof m.content === 'string') return m.content;
  return '';
}

/**
 * Agent path for POST /api/chat. Runs plan → loop → synthesis silently,
 * then streams ONLY the final synthesis text plus a tool-execute_pipeline
 * part carrying `analyses` so the existing UI (ChatMessage cards) renders
 * unchanged. Throws on failure so the route can fall back to legacy.
 */
export async function handleAgentChat(req: Request, body: { messages?: unknown[]; chatId?: string }): Promise<Response> {
  const messages = (body.messages ?? []) as { role: string; parts?: { type?: string; text?: string }[]; content?: unknown }[];
  const chatId = body.chatId as string | undefined;
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const question = (lastUser ? getText(lastUser) : '').trim() || 'general chat';
  const history = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant'))
    .slice(-8)
    .map(m => ({ role: m.role, content: getText(m).slice(0, 500) }))
    .filter(m => m.content.trim().length > 0);

  const result = await runAgent({ question, history });
  const toolCallId = `agent-${Date.now().toString(36)}`;
  const first = result.analyses[0];
  const toolOutput = {
    status: 'success' as const,
    entities: result.analyses.map(a => a.entity),
    range: first?.range ?? '7d',
    platforms: first?.platforms ?? [],
    question,
    analyses: result.analyses,
  };
  const parts = [
    { type: 'text', text: result.text },
    { type: 'tool-execute_pipeline', toolCallId, state: 'output-available', input: { entities: toolOutput.entities, range: toolOutput.range, platforms: toolOutput.platforms, question }, output: toolOutput },
  ];

  // Persist like the legacy onEnd handler so history/DB behavior is unchanged.
  if (chatId) {
    try {
      await prisma.message.create({ data: { chatId, role: 'assistant', content: result.text.slice(0, 4000) || 'Analysis complete', parts: parts as never } });
      await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    } catch (e) {
      console.error('agent persist failed', e);
    }
  }

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const textId = 'agent-text-0';
      writer.write({ type: 'text-start', id: textId });
      // Stream in small slices to preserve streaming UX.
      const chunkSize = 400;
      for (let i = 0; i < result.text.length; i += chunkSize) {
        writer.write({ type: 'text-delta', id: textId, delta: result.text.slice(i, i + chunkSize) });
      }
      writer.write({ type: 'text-end', id: textId });
      writer.write({ type: 'tool-input-start', toolCallId, toolName: 'execute_pipeline' });
      writer.write({ type: 'tool-input-available', toolCallId, toolName: 'execute_pipeline', input: { entities: toolOutput.entities, range: toolOutput.range, platforms: toolOutput.platforms, question } });
      writer.write({ type: 'tool-output-available', toolCallId, output: toolOutput });
    },
  });
  const response = createUIMessageStreamResponse({ stream });
  if (chatId) response.headers.set('X-Chat-Id', chatId);
  return response;
}
