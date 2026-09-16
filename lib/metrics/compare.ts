import type { MetricSnapshot } from '../types';

export interface Comparison {
  current: MetricSnapshot;
  previous: MetricSnapshot | null;
  deltas: { mentionsGrowth: number | null; sentimentDelta: number | null; negativeDelta: number | null; engagementDelta: number | null };
}

export function comparePeriods(current: MetricSnapshot, previous: MetricSnapshot | null): Comparison {
  if (!previous) return { current, previous: null, deltas: { mentionsGrowth: null, sentimentDelta: null, negativeDelta: null, engagementDelta: null } };
  const mentionsGrowth = previous.indexedCount ? Math.round(((current.indexedCount - previous.indexedCount) / previous.indexedCount) * 100) : null;
  const sentimentDelta = (current.sentimentPct.positive - previous.sentimentPct.positive);
  const negativeDelta = (current.sentimentPct.negative - previous.sentimentPct.negative);
  const engagementDelta = current.avgEngagement != null && previous.avgEngagement != null && previous.avgEngagement !== 0 ? Math.round(((current.avgEngagement - previous.avgEngagement)/ previous.avgEngagement)*100) : null;
  return { current, previous, deltas: { mentionsGrowth, sentimentDelta, negativeDelta, engagementDelta } };
}
