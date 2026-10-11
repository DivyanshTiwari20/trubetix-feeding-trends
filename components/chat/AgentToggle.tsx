'use client';

import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Header toggle for the agent research path. Reads/writes /api/agent
// (runtime override; resets to the AGENT_ENABLED env default on restart).
export function AgentToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/agent')
      .then((r) => r.json())
      .then((j) => setEnabled(!!j.enabled))
      .catch(() => setEnabled(false));
  }, []);

  async function flip() {
    if (enabled === null || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const j = await r.json();
      setEnabled(!!j.enabled);
    } catch {
      // keep previous state on network failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={flip}
      disabled={enabled === null || busy}
      title={enabled ? 'Agent research ON — click to use legacy pipeline' : 'Agent research OFF — click to use agent pipeline'}
      className="hidden border-[#EDE8FF] bg-white py-2 text-[13px] font-medium text-[#374151] shadow-sm hover:bg-[#F9F7FF] md:flex"
    >
      <Bot className="h-4 w-4" />
      Agent
      <Badge variant={enabled ? 'default' : 'secondary'}>{enabled === null ? '…' : enabled ? 'On' : 'Off'}</Badge>
    </Button>
  );
}
