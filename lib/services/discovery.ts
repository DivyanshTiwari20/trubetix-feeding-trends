import { newsAdapter } from '../adapters/news';
import { webMentionsAdapter } from '../adapters/webMentions';
import type { NormalizedMention } from '../types';
import { parseEngagement } from '../utils/engagement';

export async function searchNews(entity: string, range: string): Promise<NormalizedMention[]> {
  const r = await newsAdapter.fetchSignal(entity, range as any);
  if (r.status !== 'ok') return [];
  return r.mentions.map(m => ({ ...m, engagement: parseEngagement(m.engagementSnippet ?? null) }));
}

export async function searchWebMentions(entity: string, range: string, platforms?: string[]): Promise<NormalizedMention[]> {
  if (platforms?.length) {
    const results: NormalizedMention[] = [];
    for (const p of platforms) {
      const r = await webMentionsAdapter.fetchSignal(entity, range as any, { platform: p });
      if (r.status === 'ok') results.push(...r.mentions);
    }
    return results.map(m => ({ ...m, engagement: parseEngagement(m.engagementSnippet ?? null) }));
  }
  const r = await webMentionsAdapter.fetchSignal(entity, range as any);
  if (r.status !== 'ok') return [];
  return r.mentions.map(m => ({ ...m, engagement: parseEngagement(m.engagementSnippet ?? null) }));
}

export async function discoverSocialPosts(entity: string, range: string, platforms?: string[]): Promise<NormalizedMention[]> {
  return searchWebMentions(entity, range, platforms);
}
