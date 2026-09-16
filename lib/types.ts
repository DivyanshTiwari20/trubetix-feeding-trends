export interface SignalAdapter {
  name: string;
  isConfigured(): boolean;
  fetchSignal(entity: string, range: "1d" | "7d" | "15d" | "30d", options?: { platform?: string }): Promise<AdapterResult>;
}

export type AdapterResult =
  | { status: "ok"; mentions: NormalizedMention[] }
  | { status: "coming_soon" }
  | { status: "error"; message: string };

export type Platform = "instagram" | "x" | "youtube" | "reddit" | "linkedin" | "news" | "web" | "all";
export type ContentOwnership = "owned" | "earned" | "fan" | "repost" | "unknown";
export type DataConfidence = "high" | "medium" | "low" | "none";

export interface ParsedEngagement {
  raw: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  confidence: DataConfidence;
  source: 'snippet' | 'none';
}
export interface Engagement {
  likes: number | null;
  comments: number | null;
  views: number | null;
  shares: number | null;
  reposts: number | null;
  source: "direct" | "parsed" | "unknown";
  confidence: DataConfidence;
}
export interface PublishedCountEstimate {
  value: number | null;
  type: "exact" | "estimated" | "unavailable";
  confidence: DataConfidence;
  evidenceCount: number;
  methodology: string;
}
export interface NormalizedSocialContent {
  id: string;
  platform: Platform;
  url: string;
  title?: string;
  snippet?: string;
  authorName?: string;
  authorHandle?: string;
  publishedAt?: string | null;
  ownership: ContentOwnership;
  engagement: Engagement;
  contentType: "post" | "reel" | "video" | "story" | "tweet" | "reply" | "article" | "unknown";
  themes: string[];
  sentiment?: "positive" | "neutral" | "negative" | "mixed";
  confidence: DataConfidence;
  source: "serper" | "serpapi" | "gnews" | "other";
  raw?: unknown;
}
export interface AnalysisScope {
  entity: string;
  platform: Platform;
  range: "1d" | "7d" | "15d" | "30d";
  analysisType: "overall_pr" | "social" | "news" | "volume" | "engagement" | "narrative" | "sentiment" | "publishing_activity";
  requestedMetrics: string[];
}

export interface NormalizedMention {
  source: string;
  title: string;
  url: string;
  publishedAt: string; // ISO date
  sentiment?: "positive" | "negative" | "neutral" | "mixed";
  sourceAuthority?: "tier1" | "tier2" | "tier3";
  engagementSnippet?: string;
  engagement?: ParsedEngagement;
  raw: Record<string, unknown>;
}

export interface SocialPost {
  id: string;
  platform: string;
  postId: string;
  url: string;
  author?: { handle?: string; name?: string } | null;
  publishedAt: string;
  title: string;
  text?: string;
  engagement: ParsedEngagement;
  raw: Record<string, unknown>;
}

export interface SocialComment {
  id: string;
  platform: string;
  commentId: string;
  postId: string;
  text: string;
  publishedAt: string;
  likes: number | null;
  replies?: number | null;
  author?: { handle?: string; name?: string } | null;
  sentiment?: "positive" | "negative" | "neutral" | "mixed";
  topics?: string[];
  narrative?: string;
  emotion?: string;
  intent?: string;
  raw: Record<string, unknown>;
}

export interface Narrative {
  name: string;
  volume: number;
  percentage: number;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  engagement: number | null;
  momentum?: "rising" | "stable" | "falling" | "unknown";
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

export interface MetricSnapshot {
  totalMentions: number;
  indexedCount: number;
  mentionsByPlatform: Record<string, number>;
  newsCount: number;
  sentimentCounts: { positive: number; neutral: number; negative: number; mixed: number; total: number };
  sentimentPct: { positive: number; neutral: number; negative: number; mixed: number };
  engagementWeighted?: { positive: number; neutral: number; negative: number } | null;
  avgEngagement?: number | null;
  topEngaged?: NormalizedMention[];
  coverage: Record<string, 'high' | 'moderate' | 'low' | 'none'>;
}

export interface EntityProfile {
  type: string;
  weights: Record<string, number>;
}

export interface VisualizationSpec {
  id: string;
  type: 'metric' | 'donut' | 'bar' | 'line' | 'area' | 'table' | 'timeline' | 'comparison';
  title: string;
  description?: string;
  data: unknown;
  metric?: string;
  source?: string;
}

export interface TrendSnapshot { period: '1d'|'7d'|'15d'|'30d'; postsByDay: Record<string,number>; totalPosts: number; sentimentPct?: { positive:number; neutral:number; negative:number }; deltaVsPrev?: { postsGrowth:number|null; sentimentDelta:number|null } | null }
export interface OrganicSignal { label: 'organic'|'mixed'|'review'; confidence: DataConfidence; reason: string; botScore: number | null }
export interface SovEntry { entity: string; posts: number; share: number; dominantPlatform?: string }
export type QuestionIntent = 'publishing_count' | 'narrative' | 'sentiment' | 'public_conversation' | 'brand_fit' | 'comparison' | 'engagement' | 'recommendations' | 'general_intel';
export interface QuestionBrief {
  directAnswer: string;
  overallNarrative: string;
  keyThemes: { title: string; explanation: string; sentiment: 'positive'|'neutral'|'negative'|'mixed' }[];
  publicConversation: string | null;
  overallImage: string | null;
  sentimentSummary: string | null;
  brandFit: { assessment: string; positives: string[]; risks: string[]; considerations: string[] } | null;
  comparisonNote: string | null;
  engagementNote: string | null;
}
export interface Analysis {
  id: string;
  entity: string;
  entityType: string;
  range: '1d' | '7d' | '15d' | '30d';
  platforms: string[];
  scope?: AnalysisScope;
  question?: string;
  intents?: QuestionIntent[];
  brief?: QuestionBrief;
  overview: string;
  prHealth?: { score: number; label: ScoreResult['label']; drivers: { sentiment: number; visibility: number; engagement: number; risk: number; momentum: number }; note: string; methodologyVersion?: string };
  metrics: MetricSnapshot;
  sentiment: { counts: MetricSnapshot['sentimentCounts']; pct: MetricSnapshot['sentimentPct']; engagementWeighted: MetricSnapshot['engagementWeighted']; content?: { positive:number; neutral:number; negative:number }; audience?: { positive:number; neutral:number; negative:number } | null };
  narratives: Narrative[];
  risks: string[];
  recommendations: string[];
  platformsData: Record<string, unknown>;
  topMentions: NormalizedMention[];
  topStories: NormalizedMention[];
  visualizations: VisualizationSpec[];
  dataQuality: { coverage: string; indexedCount: number; confidence: 'high' | 'medium' | 'low'; limitations: string[] };
  generatedAt: string;
  expiresAt: string;
  activity?: { discoveredCount: number; postsByDay: Record<string, number>; postingFrequency: number | null; periodDays: number };
  trend?: TrendSnapshot;
  organicSignal?: OrganicSignal;
  sov?: SovEntry[];
  amplifiers?: { platform: string; domain: string; count: number; topUrl: string; topTitle: string }[];
  engagementSummary?: { totalLikes: number | null; avgLikes: number | null; totalComments: number | null; observable: boolean };
  publishedCount?: PublishedCountEstimate;
  indexedResultCount?: number;
  totalEstimatedPosts?: number | null;
  analyzedContentCount?: number;
  thirdPartyMentionCount?: number;
  coverage?: { status: "complete" | "good" | "partial" | "limited" | "unavailable"; confidence: DataConfidence; methodology: string };
  normalizedContents?: NormalizedSocialContent[];
}

export interface Dossier {
  identity: { displayName: string; aliases: string[]; category: string; bio: string };
  officialProfiles: { platform: string; handle: string; url: string; verified: boolean; followers?: string }[];
  searchPresence: { summary: string; visibility: string; resultCount: string };
  mediaQuality: string;
  mediaSentiment: { distribution: string; narrative: string };
  mediaSOV: { estimatedSOV: string; volumeNote: string };
  socialProfiles: { platform: string; handle: string; url: string; metrics: string }[];
  socialSentiment: string;
  topTopics: string[];
  topNarratives: string[];
  narrativeMomentum: string;
  keyMessages: string[];
  messagePullThrough: string;
  topJournalists: { name: string; outlet: string }[];
  topInfluencers: { name: string; platform: string; note: string }[];
  audienceSignals: string[];
  competitorBenchmark: { name: string; note: string }[];
  reputationRisks: string[];
  crisisTimeline: { date: string; event: string; sentiment: string }[];
  searchReputation: string;
  aiVisibility: string;
  reputationGaps: string[];
  prOpportunities: string[];
  strategicRecommendations: string[];
  measurementKPI: { kpi: string; target: string; cadence: string }[];
}

export interface ScoreResult {
  compositeScore: number;
  label: "Excellent" | "Good" | "Mixed" | "Poor" | "Crisis";
  breakdown: { sentimentScore: number; volumeScore: number; trendScore: number; authorityWeight: number };
  topMentions: NormalizedMention[];
  analysis?: { executiveSummary: string; sentimentNarrative: string; keyThemes: string[]; risks: string[]; opportunities: string[]; recommendations: string[]; timelineInsights: string; sourceAnalysis: string };
  dossier?: Dossier;
  stats?: { positive: number; negative: number; neutral: number; tier1: number; tier2: number; tier3: number; total: number };
}
