import { generateObject } from 'ai';
import { google } from '../google';
import { z } from 'zod';

export type QuestionIntent =
  | 'publishing_count'
  | 'narrative'
  | 'sentiment'
  | 'public_conversation'
  | 'brand_fit'
  | 'comparison'
  | 'engagement'
  | 'recommendations'
  | 'general_intel';

export interface ResolvedQuestion {
  entity: string | null;
  entities: string[];
  entityType: string;
  platforms: string[];
  range: '1d' | '7d' | '15d' | '30d';
  intents: QuestionIntent[];
  wantsPublishingCount: boolean;
  wantsNarrative: boolean;
  wantsPublicConversation: boolean;
  wantsSentiment: boolean;
  wantsBrandFit: boolean;
  wantsComparison: boolean;
  wantsEngagement: boolean;
  needsAudienceSources: boolean;
  output: 'brief' | 'chat';
  originalQuestion: string;
}

const schema = z.object({
  entity: z.string().nullable(),
  entities: z.array(z.string()).default([]),
  entityType: z.string().default('person'),
  platforms: z.array(z.string()).default([]),
  range: z.enum(['1d', '7d', '15d', '30d']).default('7d'),
  intents: z.array(z.enum(['publishing_count','narrative','sentiment','public_conversation','brand_fit','comparison','engagement','recommendations','general_intel'])).default(['general_intel']),
});

export async function resolveQuestion(userText: string, context?: { entity?: string; range?: string; platforms?: string[] }): Promise<ResolvedQuestion> {
  const ctxLine = context?.entity ? `Prior: entity="${context.entity}" range=${context.range} platforms=${context.platforms?.join(',')}` : 'No prior context';
  try {
    const { object } = await generateObject({
      model: google('models/gemini-3.5-flash-lite'),
      schema,
      prompt: `Resolve intelligence question. ${ctxLine}
User: "${userText}"
Rules:
- entity/entities: person/brand/org/product. Resolve pronouns (his/her/it) from context.
- platforms: instagram→["instagram"], x/twitter→["x"], reddit→["reddit"], youtube→["youtube"], linkedin→["linkedin"], news/web→["news"]. "on Instagram" means ["instagram"] only. "overall on internet" means ["all"]. If NO platform mentioned at all (e.g. "how many posts about X"), return platforms=[] — triggers DEEP collection across ALL platforms (Instagram, Reddit, X, YouTube, LinkedIn). Do NOT default to ["reddit","x"] alone; Instagram must be included. Only use ["reddit","x"] if user explicitly says "on Reddit and Twitter".
- range: today→1d, week→7d, 15d, month→30d, default 7d.
- intents: detect what user WANTS (can be multiple):
  publishing_count = "how many posts / volume / how popular by volume / total posts"
  narrative = "what is narrative / story / going on / image / reputation / buzz"
  public_conversation = "what are people saying / audience / public / comments / reddit / discussion"
  sentiment = "is it good/bad / positive/negative / how is sentiment"
  brand_fit = "good fit for brand / should we collaborate / sponsorship"
  comparison = "compare X vs Y"
  engagement = "likes / views / comments / engagement"
  general_intel = fallback
- "what people were talking about him in last 7 days, is it good or bad, is he popular" → intents ["public_conversation","sentiment","narrative","publishing_count"] + platforms [] + range 7d (all platforms deep)
- A question can have MULTIPLE intents.
Return JSON.`,
    });
    let entities = object.entities?.length ? object.entities : (object.entity ? [object.entity] : []);
    if (!entities.length && context?.entity) entities = [context.entity];
    let platforms = object.platforms ?? [];
    if (!platforms.length && context?.platforms?.length) platforms = context.platforms;
    const range = object.range ?? (context?.range as any) ?? '7d';
    const intents = object.intents?.length ? object.intents as QuestionIntent[] : ['general_intel' as QuestionIntent];
    const wantsPublishingCount = intents.includes('publishing_count');
    const wantsNarrative = intents.includes('narrative') || intents.includes('general_intel');
    const wantsPublicConversation = intents.includes('public_conversation');
    const wantsSentiment = intents.includes('sentiment');
    const wantsBrandFit = intents.includes('brand_fit');
    const wantsComparison = intents.includes('comparison') || entities.length > 1;
    const wantsEngagement = intents.includes('engagement');
    const needsAudienceSources = wantsPublicConversation || wantsBrandFit || wantsNarrative;
    return {
      entity: entities[0] ?? null,
      entities,
      entityType: object.entityType ?? 'person',
      platforms,
      range,
      intents,
      wantsPublishingCount,
      wantsNarrative,
      wantsPublicConversation,
      wantsSentiment,
      wantsBrandFit,
      wantsComparison,
      wantsEngagement,
      needsAudienceSources,
      output: 'brief',
      originalQuestion: userText,
    };
  } catch {
    const fallbackEntity = context?.entity ?? null;
    return {
      entity: fallbackEntity,
      entities: fallbackEntity ? [fallbackEntity] : [],
      entityType: 'general',
      platforms: context?.platforms ?? [],
      range: (context?.range as any) ?? '7d',
      intents: ['general_intel'],
      wantsPublishingCount: /how many posts|posts.*made|publishing/i.test(userText),
      wantsNarrative: /narrative|story|image|reputation|brand image|perception|going on/i.test(userText),
      wantsPublicConversation: /people saying|audience|public.*saying|comments|discussion/i.test(userText),
      wantsSentiment: /sentiment|positive.*negative/i.test(userText),
      wantsBrandFit: /brand fit|good fit|collab|sponsor/i.test(userText),
      wantsComparison: /compare|vs\b|versus/i.test(userText),
      wantsEngagement: /likes|views|engagement|comments/i.test(userText),
      needsAudienceSources: false,
      output: 'brief',
      originalQuestion: userText,
    };
  }
}
