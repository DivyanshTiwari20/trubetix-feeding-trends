import type { NormalizedMention, MetricSnapshot } from '../types';

export function aggregateMetrics(mentions: NormalizedMention[], newsCount: number): MetricSnapshot {
  const totalMentions = mentions.length;
  const indexedCount = totalMentions;
  const mentionsByPlatform: Record<string, number> = {};
  let positive = 0, neutral = 0, negative = 0, mixed = 0;
  let likesSum = 0, likesN = 0;
  const topEngaged = [...mentions].sort((a,b) => (b.engagement?.likes ?? -1) - (a.engagement?.likes ?? -1)).slice(0,5);

  for (const m of mentions) {
    const src = m.source ?? 'unknown';
    mentionsByPlatform[src] = (mentionsByPlatform[src] ?? 0) + 1;
    if (m.sentiment === 'positive') positive++;
    else if (m.sentiment === 'negative') negative++;
    else if (m.sentiment === 'mixed') mixed++;
    else neutral++;
    if (m.engagement?.likes != null) { likesSum += m.engagement.likes; likesN++; }
  }
  const total = positive + neutral + negative + mixed;
  const pct = total ? { positive: Math.round(positive/total*100), neutral: Math.round(neutral/total*100), negative: Math.round(negative/total*100), mixed: Math.round(mixed/total*100) } : { positive:0, neutral:0, negative:0, mixed:0 };
  const coverage: MetricSnapshot['coverage'] = {};
  for (const [k,v] of Object.entries(mentionsByPlatform)) coverage[k] = v >= 8 ? 'high' : v >=3 ? 'moderate' : v>0 ? 'low' : 'none';

  return {
    totalMentions, indexedCount, mentionsByPlatform, newsCount,
    sentimentCounts: { positive, neutral, negative, mixed, total },
    sentimentPct: pct,
    engagementWeighted: null,
    avgEngagement: likesN ? Math.round(likesSum / likesN) : null,
    topEngaged,
    coverage,
  };
}
