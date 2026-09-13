import { generateText } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';
import { SignalAdapter, AdapterResult, NormalizedMention } from '../types';

export const SOCIAL_PLATFORMS = [
  { id: 'reddit', label: 'Reddit', site: 'reddit.com' },
  { id: 'twitter', label: 'X/Twitter', site: 'x.com' },
  { id: 'instagram', label: 'Instagram', site: 'instagram.com' },
  { id: 'youtube', label: 'YouTube', site: 'youtube.com' },
  { id: 'linkedin', label: 'LinkedIn', site: 'linkedin.com' },
] as const;

const mentionSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
});

export const webMentionsAdapter: SignalAdapter = {
  name: 'webMentions',
  isConfigured: () => !!process.env.GEMINI_API_KEY,
  fetchSignal: async (entity: string, range: string): Promise<AdapterResult> => {
    try {
      const siteFilter = SOCIAL_PLATFORMS.map(p => `site:${p.site}`).join(' OR ');
      const { text } = await generateText({
        model: google('models/gemini-3.5-flash'),
        providerOptions: { google: { useSearchGrounding: true, thinkingConfig: { includeThoughts: false, thinkingBudget: 0 } } } as any,
        prompt: `Search for social/web mentions about "${entity}" from past ${range} on (${siteFilter}).
Find 5-8 real posts/mentions. Return ONLY JSON array with title, url (must be real valid URL from those domains), publishedAt (ISO 8601). No markdown fences. Example: [{"title":"Post title","url":"https://reddit.com/r/...","publishedAt":"2026-09-01T00:00:00Z"}]`,
      });
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) return { status: 'ok', mentions: [] };
      const parsed = JSON.parse(m[0]) as unknown[];
      const mentions: NormalizedMention[] = [];
      for (const item of parsed) {
        const r = mentionSchema.safeParse(item);
        if (r.success) mentions.push({ source: 'web', title: r.data.title, url: r.data.url, publishedAt: r.data.publishedAt, raw: item as Record<string, unknown> });
      }
      return { status: 'ok', mentions };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'webMentions error' };
    }
  },
};
