import { NormalizedMention, ScoreResult } from './types';

export function calculateScore(mentions: NormalizedMention[], range: "1d"|"7d"|"15d"|"30d"): ScoreResult {
  if (mentions.length === 0) {
    return {
      compositeScore: 50,
      label: 'Mixed',
      breakdown: { sentimentScore: 50, volumeScore: 0, trendScore: 50, authorityWeight: 50 },
      topMentions: []
    };
  }

  // 1. Sentiment Score (incorporating authority weight as per prompt, but also separating it)
  let weightedPositive = 0;
  let weightedNegative = 0;
  let totalWeight = 0;
  
  let authorityScoreTotal = 0;

  mentions.forEach(m => {
    const weight = m.sourceAuthority === 'tier1' ? 3 : m.sourceAuthority === 'tier2' ? 2 : 1;
    totalWeight += weight;
    authorityScoreTotal += (weight / 3) * 100; // 100 for tier1, 66 for tier2, 33 for tier3
    
    if (m.sentiment === 'positive') weightedPositive += weight;
    if (m.sentiment === 'negative') weightedNegative += weight;
  });

  // -100 to 100 -> normalized to 0-100
  const rawSentiment = totalWeight > 0 ? ((weightedPositive - weightedNegative) / totalWeight) * 100 : 0;
  const sentimentScore = (rawSentiment + 100) / 2;
  
  const authorityWeight = mentions.length > 0 ? authorityScoreTotal / mentions.length : 0;

  // 2. Volume Score
  const expectedBaseline = range === '1d' ? 5 : range === '7d' ? 20 : range === '15d' ? 35 : 50;
  const volumeScore = Math.min(100, (mentions.length / expectedBaseline) * 100);

  // 3. Trend Score
  // Sort mentions by date
  const sorted = [...mentions].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const midPoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midPoint);
  const secondHalf = sorted.slice(midPoint);

  const getNegativity = (half: NormalizedMention[]) => {
    if (half.length === 0) return 0;
    return half.filter(m => m.sentiment === 'negative').length / half.length;
  };

  const firstHalfNegativity = getNegativity(firstHalf);
  const secondHalfNegativity = getNegativity(secondHalf);
  
  // If negativity is rising, trend score drops.
  // 50 is neutral. If it rises from 0 to 1, score is 0. If it falls from 1 to 0, score is 100.
  const negativityDelta = secondHalfNegativity - firstHalfNegativity; // -1 to 1
  const trendScore = 50 - (negativityDelta * 50);

  // 4. Composite Score
  const compositeScore = Math.round(
    (sentimentScore * 0.4) +
    (volumeScore * 0.2) +
    (trendScore * 0.2) +
    (authorityWeight * 0.2)
  );

  let label: ScoreResult['label'] = 'Mixed';
  if (compositeScore >= 80) label = 'Excellent';
  else if (compositeScore >= 60) label = 'Good';
  else if (compositeScore >= 40) label = 'Mixed';
  else if (compositeScore >= 20) label = 'Poor';
  else label = 'Crisis';

  return {
    compositeScore,
    label,
    breakdown: {
      sentimentScore: Math.round(sentimentScore),
      volumeScore: Math.round(volumeScore),
      trendScore: Math.round(trendScore),
      authorityWeight: Math.round(authorityWeight)
    },
    topMentions: sorted.reverse().slice(0, 5) // Top 5 most recent
  };
}
