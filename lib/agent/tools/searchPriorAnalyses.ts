import { z } from 'zod';
import { prisma } from '../../db';
import { toEvidenceItems } from './normalize';
import type { EvidenceItem } from '../types';

export const priorSchema = z.object({
  entity: z.string().min(1).max(120),
  maxAgeDays: z.number().int().min(1).max(90).optional(),
});

export type PriorArgs = z.infer<typeof priorSchema>;

function textOf(m: { content?: unknown; parts?: unknown }): string {
  if (typeof m.content === 'string' && m.content.trim()) return m.content.slice(0, 400);
  try {
    const parts = (m as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      const t = parts.filter((p) => (p as { type?: string }).type === 'text').map((p) => (p as { text?: string }).text ?? '').join('\n');
      if (t.trim()) return t.slice(0, 400);
    }
  } catch { /* ignore */ }
  return '';
}

export async function execPriorSearch(args: PriorArgs, ctx: { range: '1d' | '7d' | '15d' | '30d'; aliases: string[] }): Promise<{ items: EvidenceItem[]; summary: string }> {
  const maxAge = args.maxAgeDays ?? 14;
  const since = new Date(Date.now() - maxAge * 86400000);
  const needle = args.entity.toLowerCase();
  try {
    const chats = await prisma.chat.findMany({
      where: { updatedAt: { gte: since } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 30 } },
    });
    const hits: { title: string; url: string; snippet: string | null; publishedAt: string | null; source: string | null }[] = [];
    let newest: string | null = null;
    for (const c of chats) {
      const blob = c.messages.map(m => `${m.role}: ${textOf(m)}`).join('\n').toLowerCase();
      if (!blob.includes(needle)) continue;
      const asst = [...c.messages].reverse().find(m => m.role === 'assistant' && textOf(m).length > 40);
      if (!asst) continue;
      newest = newest ?? c.updatedAt.toISOString();
      hits.push({
        title: c.title?.slice(0, 160) ?? `Prior analysis: ${args.entity}`,
        url: `prior://chat/${c.id}`,
        snippet: textOf(asst),
        publishedAt: c.updatedAt.toISOString(),
        source: 'prior-analysis',
      });
      if (hits.length >= 5) break;
    }
    if (!hits.length) return { items: [], summary: `No prior analyses for "${args.entity}" in last ${maxAge}d.` };
    const items = toEvidenceItems({
      hits, entity: args.entity, entityAliases: ctx.aliases, platform: 'other',
      tool: 'search_prior_analyses', query: `prior:${args.entity}`, range: ctx.range, isPrior: true, priorDate: newest?.slice(0, 10) ?? null,
    });
    return { items, summary: `Found ${items.length} prior analyse(s) for "${args.entity}" (newest ${newest?.slice(0, 10) ?? '?'}). Secondary evidence.` };
  } catch (e) {
    console.warn('search_prior_analyses DB error', e);
    return { items: [], summary: 'Prior-analysis lookup unavailable (DB error); continuing without it.' };
  }
}

export const priorDecl = {
  name: 'search_prior_analyses',
  description: 'Retrieve previous Trubetix chat analyses for the same entity (cheap, no API cost). Secondary evidence. Use first for repeats/comparisons. Not for last-24h breaking events.',
  parameters: { type: 'object', properties: { entity: { type: 'string' }, maxAgeDays: { type: 'number' } }, required: ['entity'] },
};
