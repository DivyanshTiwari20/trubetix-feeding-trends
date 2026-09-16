import { generateObject } from 'ai';
import { google } from '../google';
import { z } from 'zod';
import type { NormalizedMention, Narrative } from '../types';

const sentimentSchema = z.object({
  classifications: z.array(z.object({
    id: z.number(),
    sentiment: z.enum(['positive','negative','neutral','mixed']),
    confidence: z.enum(['high','medium','low']),
    reason: z.string().optional(),
  })),
  narratives: z.array(z.object({
    name: z.string(),
    volume: z.number(),
    percentage: z.number(),
    sentiment: z.enum(['positive','negative','neutral','mixed']),
    confidence: z.enum(['high','medium','low']),
    evidence: z.array(z.string()).max(3),
  })).max(6),
});

export async function analyzeConversation(mentions: NormalizedMention[], entity: string): Promise<{ classifications: Map<number, { sentiment: 'positive'|'negative'|'neutral'|'mixed'; confidence: string }>; narratives: Narrative[] }> {
  if (mentions.length === 0) return { classifications: new Map(), narratives: [] };
  const payload = mentions.slice(0, 30).map((m,i) => ({ id:i, title:m.title, snippet:m.engagementSnippet ?? '', source:m.source }));
  try {
    const { object } = await generateObject({
      model: google('models/gemini-3.5-flash-lite'),
      schema: sentimentSchema,
      prompt: `Classify sentiment for "${entity}" meaningfully. Use title+snippet+source context.
Rules: "announces new special" with positive framing is positive, not neutral; "fans praise" is positive; informational without valence is neutral; criticism/controversy is negative; mixed only if truly bivalent. Confidence high if clear, low if sarcasm/ambiguous. If evidence insufficient, mark low confidence. Also cluster into 1-6 evidence-backed narratives (career, controversy, appearance etc but don't invent). Each narrative needs volume, % of conversation, sentiment, confidence, 1-3 evidence ids. Payload: ${JSON.stringify(payload)}`,
    });
    const map = new Map(object.classifications.map(c => [c.id, { sentiment: c.sentiment, confidence: c.confidence } as const]));
    const narratives: Narrative[] = object.narratives.map(n => ({
      name: n.name, volume: n.volume, percentage: n.percentage, sentiment: n.sentiment, engagement: null, momentum: 'unknown' as const, confidence: n.confidence, evidence: n.evidence,
    }));
    return { classifications: map, narratives };
  } catch {
    return { classifications: new Map(), narratives: [] };
  }
}
