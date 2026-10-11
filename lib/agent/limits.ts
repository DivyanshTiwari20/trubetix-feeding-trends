function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const LIMITS = {
  maxIterations: envInt('AGENT_MAX_ITERATIONS', 5),
  maxToolCalls: envInt('AGENT_MAX_TOOL_CALLS', 10),
  maxToolCallsComparison: envInt('AGENT_MAX_TOOL_CALLS_COMPARISON', 14),
  maxToolsPerIteration: 3,
  maxItemsToModelPerCall: 8,
  maxEvidenceRetained: 60,
  maxSynthesisItems: 30,
  maxSynthesisItemsPerEntity: 20,
  maxSnippetStored: 400,
  maxSnippetShown: 200,
  maxFetchPageCalls: 2,
  maxFetchPageChars: 3000,
  maxConsecutiveFailures: 3,
  perToolTimeoutMs: 12000,
  fetchPageTimeoutMs: 10000,
  wallClockBudgetMs: 45000,
};

export const LOOP_MODEL = process.env.AGENT_LOOP_MODEL ?? 'models/gemini-3.5-flash-lite';
export const SYNTH_MODEL = process.env.AGENT_SYNTH_MODEL ?? 'models/gemini-3.5-flash-lite';
export const AGENT_ENABLED = (process.env.AGENT_ENABLED ?? 'off').toLowerCase() === 'on' || process.env.AGENT_ENABLED === '1' || process.env.AGENT_ENABLED === 'true';
