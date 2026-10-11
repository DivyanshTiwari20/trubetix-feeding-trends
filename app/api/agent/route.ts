import { NextResponse } from 'next/server';
import { z } from 'zod';
import { agentFlagSource, isAgentEnabled, setAgentRuntimeOverride } from '@/lib/agent/flag';

// UI-toggle backing store for the agent flag. Unprotected like the rest of
// the local app — before any public deploy this falls under the access gate
// required in AGENTS.md ("Before deploying anywhere with a public URL").

export async function GET() {
  return NextResponse.json({ enabled: isAgentEnabled(), source: agentFlagSource() });
}

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input: expected { enabled: boolean }' }, { status: 400 });
  }
  setAgentRuntimeOverride(parsed.data.enabled);
  return NextResponse.json({ enabled: isAgentEnabled(), source: agentFlagSource() });
}

// Clear the runtime override → fall back to the AGENT_ENABLED env default.
export async function DELETE() {
  setAgentRuntimeOverride(null);
  return NextResponse.json({ enabled: isAgentEnabled(), source: agentFlagSource() });
}
