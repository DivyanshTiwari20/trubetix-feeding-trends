import { generateObject } from 'ai';
import { google } from '../google';
import { z } from 'zod';

export interface ResolvedRequest {
  entity: string | null;
  entityType: string;
  platforms: string[];
  range: '1d' | '7d' | '15d' | '30d';
  metrics: string[];
  needsComments: boolean;
  needsComparison: boolean;
  compareWith?: '1d' | '7d' | '15d' | '30d';
  output: 'chat' | 'dashboard' | 'pdf';
  reuseAllowed: boolean;
  needsRefresh?: boolean;
}

const schema = z.object({
  entity: z.string().nullable(),
  entityType: z.string().default('general'),
  platforms: z.array(z.string()).default([]),
  range: z.enum(['1d','7d','15d','30d']).default('7d'),
  metrics: z.array(z.string()).default([]),
  needsComments: z.boolean().default(false),
  needsComparison: z.boolean().default(false),
  compareWith: z.enum(['1d','7d','15d','30d']).optional(),
  output: z.enum(['chat','dashboard','pdf']).default('chat'),
});

export async function resolveRequest(userText: string, context?: { entity?: string; range?: string; platforms?: string[] }): Promise<ResolvedRequest> {
  const ctxLine = context?.entity ? `Prior context: entity="${context.entity}" range=${context.range} platforms=${context.platforms?.join(',')}` : 'No prior context';
  try {
    const { object } = await generateObject({
      model: google('models/gemini-3.5-flash-lite'),
      schema,
      prompt: `Resolve PR intelligence request. ${ctxLine}\nUser: "${userText}"\nRules: entity can be person/brand/org. If pronoun (his/her/it/that) and context exists, reuse context entity. Platforms: detect instagram/x/twitter/reddit/youtube/linkedin/news. Range: today→1d, week→7d, 15d, month→30d, default 7d. needsComments true if user asks "what people say/comments/conversation". needsComparison true if "compare/versus last week/month". output pdf only if explicitly asks pdf/export/download. Return JSON.`,
    });
    if (!object.entity && context?.entity) object.entity = context.entity;
    if (object.platforms.length === 0 && context?.platforms?.length) object.platforms = context.platforms;
    return { ...object, entityType: object.entityType ?? 'general', reuseAllowed: true } as ResolvedRequest;
  } catch {
    return { entity: context?.entity ?? null, entityType: 'general', platforms: context?.platforms ?? [], range: (context?.range as any) ?? '7d', metrics: [], needsComments: false, needsComparison: false, output: 'chat', reuseAllowed: true };
  }
}
