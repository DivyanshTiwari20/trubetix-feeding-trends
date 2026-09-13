export interface SignalAdapter {
  name: string;
  isConfigured(): boolean;
  fetchSignal(entity: string, range: "1d" | "7d" | "15d" | "30d", options?: { platform?: string }): Promise<AdapterResult>;
}

export type AdapterResult =
  | { status: "ok"; mentions: NormalizedMention[] }
  | { status: "coming_soon" }
  | { status: "error"; message: string };

export interface NormalizedMention {
  source: string;
  title: string;
  url: string;
  publishedAt: string; // ISO date
  sentiment?: "positive" | "negative" | "neutral";
  sourceAuthority?: "tier1" | "tier2" | "tier3";
  engagementSnippet?: string;
  raw: Record<string, unknown>;
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
