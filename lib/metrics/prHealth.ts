import type { MetricSnapshot } from '../types';
import { getPlatformWeight } from '../config/entityProfiles';

export interface HealthDrivers { sentiment: number; visibility: number; engagement: number; risk: number; momentum: number; }

export function computePrHealth(metrics: MetricSnapshot, entityType?: string, momentumPct?: number): { score: number; label: 'Excellent'|'Good'|'Mixed'|'Poor'|'Crisis'; drivers: HealthDrivers; note: string } {
  const pos = metrics.sentimentPct.positive ?? 0;
  const neg = metrics.sentimentPct.negative ?? 0;
  const sentiment = Math.max(0, Math.min(100, 50 + (pos - neg) * 0.7));
  const expected: Record<string, number> = { '1d': 5, '7d': 20, '15d': 35, '30d': 50 };
  const approxRange = Object.keys(metrics.mentionsByPlatform).length ? '7d' : '7d';
  const baseline = expected[approxRange] ?? 20;
  let visibility = Math.min(100, (metrics.indexedCount / baseline) * 100);
  let weightedCount = 0, totalWeight = 0;
  for (const [plat,cnt] of Object.entries(metrics.mentionsByPlatform)) {
    const w = getPlatformWeight(entityType, plat);
    weightedCount += cnt * w;
    totalWeight += cnt;
  }
  if (totalWeight) visibility = Math.min(100, visibility * (weightedCount / totalWeight));
  const engagement = metrics.avgEngagement != null ? Math.min(100, Math.log10(metrics.avgEngagement + 10) * 25) : 50;
  const risk = Math.max(0, Math.min(100, 100 - neg * 1.2 - (metrics.mentionsByPlatform['news'] ? 0 : 5)));
  const momentum = momentumPct != null ? Math.max(0, Math.min(100, 50 + momentumPct * 2)) : 50;

  const score = Math.round(sentiment * 0.35 + visibility * 0.2 + engagement * 0.15 + risk * 0.15 + momentum * 0.15);
  let label: 'Excellent'|'Good'|'Mixed'|'Poor'|'Crisis' = 'Mixed';
  if (score >= 80) label = 'Excellent';
  else if (score >= 60) label = 'Good';
  else if (score >= 40) label = 'Mixed';
  else if (score >= 20) label = 'Poor';
  else label = 'Crisis';
  return { score, label, drivers: { sentiment: Math.round(sentiment), visibility: Math.round(visibility), engagement: Math.round(engagement), risk: Math.round(risk), momentum: Math.round(momentum) }, note: 'Analytical index (0-100) based on observable indexed mentions, not a census of public opinion.' };
}
