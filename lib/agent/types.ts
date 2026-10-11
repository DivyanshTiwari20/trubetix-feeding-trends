export type AgentPlatform = 'web' | 'news' | 'instagram' | 'x' | 'reddit' | 'youtube' | 'other';

export interface EvidenceItem {
  id: string;
  entity: string;
  platform: AgentPlatform;
  source: string;
  url: string | null;
  title: string | null;
  publishedAt: string | null;
  snippet: string;
  metrics?: { likes?: number; comments?: number; views?: number; shares?: number };
  tool: string;
  query: string;
  relevance: number;
  sourceQuality: 'high' | 'medium' | 'low' | 'unknown';
  freshness: 'in_range' | 'out_of_range' | 'unknown';
  retrievedAt: string;
}

export type ToolErrorKind = 'rate_limit' | 'timeout' | 'upstream' | 'bad_input' | 'empty';

export interface ToolResult {
  tool: string;
  ok: boolean;
  items: EvidenceItem[];
  summary: string;
  error?: { kind: ToolErrorKind; message: string };
  fromCache?: boolean;
}

export interface AgentPlanEntity { name: string; type: string; aliases: string[] }
export interface AgentPlan {
  entities: AgentPlanEntity[];
  intent: 'profile' | 'sentiment' | 'narrative' | 'comparison' | 'product_perception' | 'event' | 'other';
  timeRange: { from: string | null; to: string | null; label: string; range: '1d' | '7d' | '15d' | '30d' };
  priorityPlatforms: string[];
  initialQueries: { tool: string; args: Record<string, unknown> }[];
  notes: string;
}

export interface AgentRequest {
  question: string;
  history?: { role: string; content: string }[];
  entities?: string[];
  range?: '1d' | '7d' | '15d' | '30d';
  platforms?: string[];
}

export interface AgentResult {
  text: string;
  // Adapted to existing UI: full Analysis objects rendered by IntelligenceDashboard.
  analyses: import('../types').Analysis[];
  insufficientEvidence: boolean;
  meta: {
    iterations: number;
    toolCalls: { tool: string; ok: boolean; fromCache?: boolean }[];
    itemsRetained: number;
    cacheHits: number;
    stoppedBy: string | null;
    usedFallback?: boolean;
  };
}

export interface CoverageStatus {
  inRange: number;
  total: number;
  distinctSources: number;
  platforms: string[];
  newest: string | null;
  oldest: string | null;
  saturated: boolean;
  perEntity: Record<string, number>;
}

export interface ToolCallRequest { name: string; args: Record<string, unknown> }
