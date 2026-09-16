import { generateText } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';
import { SignalAdapter, AdapterResult, NormalizedMention } from '../types';

const mentionSchema = z.object({ title: z.string(), url: z.string().url(), publishedAt: z.string() });

async function fetchGNews(entity: string, range: string): Promise<NormalizedMention[] | null> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return null;
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '15d' ? 15 : 30;
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0,10);
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(entity)}&from=${from}&lang=en&max=10&apikey=${key}`;
  try {
    const r = await fetch(url);
    if (!r.ok) { console.warn('GNews error', await r.text()); return null; }
    const j: any = await r.json();
    const articles: any[] = j.articles ?? [];
    return articles.slice(0,10).map((a:any) => ({
      source: 'news',
      title: a.title as string,
      url: a.url as string,
      publishedAt: a.publishedAt as string,
      raw: a,
    })).filter((m: any) => { try { new URL(m.url); return true; } catch { return false; }});
  } catch(e){ console.warn('GNews fetch failed',e); return null; }
}

export const newsAdapter: SignalAdapter = {
  name: 'news',
  isConfigured: () => !!process.env.GEMINI_API_KEY || !!process.env.GNEWS_API_KEY,
  fetchSignal: async (entity: string, range: string): Promise<AdapterResult> => {
    const gnews = await fetchGNews(entity, range);
    if (gnews && gnews.length > 0) return { status: 'ok', mentions: gnews };

    try {
      const res: any = await generateText({
        model: google('models/gemini-3.5-flash-lite'),
        providerOptions: { google: { useSearchGrounding: true } } as any,
        prompt: `Search the web for recent news about "${entity}" from the past ${range}. List 5-10 headlines with publisher and date.`,
      });

      const chunks: any[] = res.providerMetadata?.google?.groundingMetadata?.groundingChunks
        ?? res.providerMetadata?.google?.groundingMetadata?.groundingSupports
        ?? (res as any).groundingMetadata?.groundingChunks
        ?? [];

      const mentions: NormalizedMention[] = [];
      const seen = new Set<string>();

      const sources: { title:string; url:string }[] = [];
      for (const c of chunks) {
        const web = c.web ?? c;
        if (web?.uri && web?.title) sources.push({ title: web.title, url: web.uri });
        if (web?.url && web?.title) sources.push({ title: web.title, url: web.url });
      }

      for (const s of sources) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        try { new URL(s.url); } catch { continue; }
        mentions.push({ source: 'news', title: s.title.slice(0,160), url: s.url, publishedAt: new Date().toISOString(), raw: s as any });
        if (mentions.length >= 8) break;
      }

      if (mentions.length > 0) return { status: 'ok', mentions };

      const text: string = res.text ?? '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as unknown[];
          const fallback: NormalizedMention[] = [];
          for (const item of parsed) {
            const r = mentionSchema.safeParse(item);
            if (r.success) {
              try { new URL(r.data.url); fallback.push({ source:'news', title:r.data.title, url:r.data.url, publishedAt:r.data.publishedAt, raw:item as any }); } catch {}
            }
          }
          if (fallback.length > 0) return { status:'ok', mentions: fallback };
        } catch {}
      }

      return { status: 'ok', mentions: [] };
    } catch (error) {
      console.error('Error fetching news:', error);
      return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error fetching news' };
    }
  },
};
