import { generateObject } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';

export type Intent = 'casual_chat' | 'volume_query' | 'full_analysis' | 'pdf_generation' | 'ambiguous';

export interface ClassificationResult {
  intent: Intent;
  confidence: number;
  entities: string[];
  range?: '1d' | '7d' | '15d' | '30d';
}

const classificationSchema = z.object({
  intent: z.enum(['casual_chat', 'volume_query', 'full_analysis', 'pdf_generation']),
  confidence: z.number().min(0).max(1),
  entities: z.array(z.string()),
  range: z.enum(['1d', '7d', '15d', '30d']).optional(),
});

/**
 * 4-way intent classifier. Runs a lightweight Gemini call to classify the
 * user's latest message into one of four intents. Returns 'ambiguous' when
 * the model isn't confident enough to auto-route between volume_query and
 * full_analysis.
 */
export async function classifyIntent(messages: { role: string; content: string }[]): Promise<ClassificationResult> {
  const conversationContext = messages
    .slice(-4) // Look at the last 4 messages for context
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  try {
    const { object } = await generateObject({
      model: google('models/gemini-2.5-flash'),
      providerOptions: { google: { thinkingConfig: { includeThoughts: false, thinkingBudget: 0 } } } as any,
      schema: classificationSchema,
      prompt: `Classify this user message into exactly ONE intent. Be precise.

INTENTS:
- casual_chat: greetings, small talk, general questions NOT about a specific entity's PR/reputation/mentions (e.g. "hi", "how are you", "what can you do?", "explain PR scoring")
- volume_query: a quick factual question about mention counts, post counts, or activity volume for a specific entity on specific platforms (e.g. "how many posts about Tesla on Reddit this week?", "what's the Twitter activity for Apple?"). The user wants a quick number, NOT a full report.
- full_analysis: the user wants a full PR health analysis, reputation check, sentiment score, or detailed dossier for a specific entity (e.g. "analyze PR health of Apple", "what's the reputation of Tesla", "run analysis on Nike", "check sentiment for Google")
- pdf_generation: the user explicitly asks to generate, download, or export a PDF report (e.g. "generate PDF", "download report", "make a PDF", "export the report")

RULES:
- Extract entity names (brand, person, company) into the entities array. Empty if none mentioned.
- Extract time range if mentioned: "today"/"last 24h" → 1d, "this week"/"last 7 days" → 7d, "last 15 days" → 15d, "this month"/"last 30 days" → 30d. Omit if not mentioned.
- Set confidence between 0-1. Be honest — if it could be either volume_query or full_analysis, set confidence below 0.7.
- "tell me about X" or "what about X" without specifying analysis depth → set confidence low (0.5-0.6) for whichever you lean toward.
- "run the analysis" or "do the analysis" (without specifying full/deep vs quick) → set confidence low (0.5-0.6) so it routes to ambiguous.
- If the latest user message is short (e.g. "then do the analysis", "yes", "do it"), LOOK AT THE CONVERSATION HISTORY to extract the entity they are referring to.

Conversation History:
${conversationContext}`,
    });

    // If the model isn't confident between volume_query and full_analysis, return ambiguous
    if (
      (object.intent === 'volume_query' || object.intent === 'full_analysis') &&
      object.confidence < 0.7
    ) {
      return { ...object, intent: 'ambiguous' };
    }

    return object;
  } catch (e) {
    console.warn('Intent classification failed, defaulting to casual_chat:', e instanceof Error ? e.message : e);
    // Safe fallback: treat as casual chat so we never accidentally run the heavy pipeline
    return { intent: 'casual_chat', confidence: 0.5, entities: [] };
  }
}
