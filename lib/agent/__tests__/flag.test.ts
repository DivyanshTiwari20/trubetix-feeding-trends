import { describe, expect, it, beforeEach } from 'vitest';
import { isAgentEnabled } from '../routeAdapter';

beforeEach(() => { delete process.env.AGENT_ENABLED; });

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
});
