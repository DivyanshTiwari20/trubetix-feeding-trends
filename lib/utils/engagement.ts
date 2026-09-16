import type { ParsedEngagement } from '../types';

function parseCompactNum(s: string): number | null {
  const m = s.trim().match(/^([\d,.]+)\s*([kKmMbB]?)$/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n)) return null;
  const suffix = m[2].toLowerCase();
  if (suffix === 'k') return Math.round(n * 1000);
  if (suffix === 'm') return Math.round(n * 1000000);
  if (suffix === 'b') return Math.round(n * 1000000000);
  return Math.round(n);
}

export function parseEngagement(snippet?: string | null): ParsedEngagement {
  if (!snippet) return { raw: null, likes: null, comments: null, shares: null, views: null, confidence: 'none', source: 'none' };
  const raw = snippet;
  const cleaned = snippet.replace(/[\u00a0\u2000-\u200b]/g, ' ');
  const lower = cleaned.toLowerCase();
  let likes: number | null = null;
  let comments: number | null = null;
  let shares: number | null = null;
  let views: number | null = null;
  let confidence: ParsedEngagement['confidence'] = 'none';
  const patterns: [RegExp, keyof ParsedEngagement][] = [
    [/([\d,.]+\s*[kmb]?)\s*likes?/i, 'likes'],
    [/([\d,.]+\s*[kmb]?)\s*comments?/i, 'comments'],
    [/([\d,.]+\s*[kmb]?)\s*(shares?|reposts?|retweets?)/i, 'shares'],
    [/([\d,.]+\s*[kmb]?)\s*views?/i, 'views'],
    [/([\d,.]+\s*[kmb]?)\s*upvotes?/i, 'likes'],
    [/♥\s*([\d,.]+\s*[kmb]?)/i, 'likes'],
  ];
  for (const [re, key] of patterns) {
    const m = cleaned.match(re) ?? lower.match(re);
    if (m) {
      const v = parseCompactNum(m[1]);
      if (v !== null) {
        const cur = ({ likes, comments, shares, views } as any)[key];
        if (cur == null || v > cur) ( { likes, comments, shares, views } as any)[key] = v;
        confidence = 'medium';
      }
    }
  }
  const compactFallback = cleaned.match(/([\d,.]+\s*[kmb])\s*[·•|]/i);
  if (likes == null && compactFallback) {
    const v = parseCompactNum(compactFallback[1]);
    if (v != null && v >= 10) { likes = v; confidence = 'low'; }
  }
  if (confidence === 'medium') {
    const hasExplicit = /likes|comments|shares|views|upvotes|reposts|♥/i.test(cleaned);
    if (hasExplicit) confidence = 'high';
  }
  return { raw, likes, comments, shares, views, confidence, source: confidence === 'none' ? 'none' : 'snippet' };
}
