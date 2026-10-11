/**
 * Agent feature flag with a runtime override.
 *
 * Resolution order: in-memory runtime override (set via the UI toggle,
 * POST /api/agent) wins; otherwise falls back to the AGENT_ENABLED env var
 * (default off). The override lives in module scope, so it resets to the env
 * default on server restart/redeploy — env remains the deploy-time default.
 */
let runtimeOverride: boolean | null = null;

export function setAgentRuntimeOverride(v: boolean | null): void {
  runtimeOverride = v;
}

export function agentFlagSource(): 'runtime' | 'env' {
  return runtimeOverride !== null ? 'runtime' : 'env';
}

export function isAgentEnabled(): boolean {
  if (runtimeOverride !== null) return runtimeOverride;
  const v = (process.env.AGENT_ENABLED ?? 'off').toLowerCase();
  return v === 'on' || v === '1' || v === 'true';
}
