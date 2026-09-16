'use client';
import type { Analysis } from '@/lib/types';
import { AnalysisHeader } from './AnalysisHeader';
import { QuestionBriefView } from './QuestionBriefView';

export function IntelligenceDashboard({ analysis }: { analysis: Analysis }) {
  if (analysis.brief) return <QuestionBriefView analysis={analysis} />;
  const platLabel = analysis.platforms.length===1 ? analysis.platforms[0] : analysis.platforms.includes('instagram') && analysis.platforms.length<=2 ? 'Instagram' : 'Cross-platform';
  return <AnalysisHeader entity={analysis.entity} platform={platLabel} range={analysis.range} />;
}
