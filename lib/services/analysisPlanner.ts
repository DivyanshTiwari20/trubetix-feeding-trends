import type { ResolvedRequest } from './resolveRequest';

export type PlannedTool = 'discoverSocialPosts' | 'searchWebMentions' | 'searchNews' | 'getCachedAnalysis' | 'aggregateSocialMetrics' | 'analyzeConversation' | 'comparePeriods';

export function planAnalysis(req: ResolvedRequest): PlannedTool[] {
  const tools: PlannedTool[] = [];
  if (req.reuseAllowed) tools.push('getCachedAnalysis');
  if (req.needsComparison) tools.push('comparePeriods');
  tools.push('discoverSocialPosts');
  if (req.platforms.includes('news') || req.platforms.length === 0) tools.push('searchNews');
  else tools.push('searchWebMentions');
  tools.push('aggregateSocialMetrics');
  if (req.needsComments) tools.push('analyzeConversation');
  return [...new Set(tools)];
}
