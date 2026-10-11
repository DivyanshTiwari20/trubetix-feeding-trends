import { describe, expect, it, beforeEach } from 'vitest';
import { isAgentEnabled } from '../routeAdapter';
import { agentFlagSource, setAgentRuntimeOverride } from '../flag';

beforeEach(() => { delete process.env.AGENT_ENABLED; setAgentRuntimeOverride(null); });

describe('feature flag', () => {
  it('defaults OFF so the legacy pipeline runs unchanged', () => {
    expect(isAgentEnabled()).toBe(false);
  });
  it.each(['on', '1', 'true', 'ON'])('enables agent path for %s', (v) => {
    process.env.AGENT_ENABLED = v;
    expect(isAgentEnabled()).toBe(true);
  });
  it.each(['off', '0', 'false', ''])('keeps legacy path for %s', (v) => {
    process.env.AGENT_ENABLED = v;
    expect(isAgentEnabled()).toBe(false);
  });
  it('runtime override (UI toggle) beats env off', () => {
    setAgentRuntimeOverride(true);
    expect(isAgentEnabled()).toBe(true);
    expect(agentFlagSource()).toBe('runtime');
  });
  it('runtime override (UI toggle) beats env on', () => {
    process.env.AGENT_ENABLED = 'on';
    setAgentRuntimeOverride(false);
    expect(isAgentEnabled()).toBe(false);
  });
  it('clearing the override falls back to env', () => {
    setAgentRuntimeOverride(true);
    setAgentRuntimeOverride(null);
    expect(isAgentEnabled()).toBe(false);
    expect(agentFlagSource()).toBe('env');
  });
});
