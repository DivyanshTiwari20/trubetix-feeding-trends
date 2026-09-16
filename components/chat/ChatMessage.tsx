import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ThinkingPanel } from './ThinkingPanel';
import { AnalysisForm } from './AnalysisForm';
import { ScoreCard } from './ScoreCard';
import { VolumeResults } from './VolumeResults';
import { PdfDownloadButton } from '../pdf/PdfDownloadButton';
import { Copy, Check } from 'lucide-react';
import { IntelligenceDashboard } from '../intelligence/IntelligenceDashboard';
import { ComparisonView } from '../intelligence/ComparisonView';

interface ChatMessageProps {
  message: any;
  isLoading?: boolean;
  addToolResult?: (toolCallId: string, result: any) => void;
}

export function ChatMessage({ message, isLoading, addToolResult }: ChatMessageProps) {
  const [copiedUser, setCopiedUser] = useState(false);
  const isAi = message.role === 'assistant';
  const parts: any[] = message.parts ?? [];

  const toolParts: any[] = parts.filter((p: any) => p.type?.startsWith('tool-') || p.type === 'dynamic-tool');
  const legacyTools: any[] = message.toolInvocations ?? [];
  const toolInvocations = toolParts.length > 0
    ? toolParts.map((p: any) => ({
        toolName: p.type === 'dynamic-tool' ? p.toolName : p.type.replace('tool-', ''),
        toolCallId: p.toolCallId,
        state: p.state?.includes('output') || p.state === 'output-available' ? 'result' : p.state,
        args: p.input ?? p.args,
        result: p.output ?? p.result,
        rawState: p.state,
      }))
    : legacyTools;

  const hasVolumeSuccess = toolInvocations.some((t: any) => t.toolName === 'execute_volume_query' && (t.state === 'result' || t.rawState === 'output-available') && t.result?.status === 'success');
  const hasToolCalls = toolInvocations.length > 0;

  const hasPipeline = toolInvocations.some(t=> t.toolName==='execute_pipeline' && (t.state==='result' || t.rawState==='output-available') && t.result?.analyses?.length);
  const rawText = hasVolumeSuccess || hasPipeline ? '' : (parts.length > 0
    ? parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n\n')
    : (message.content ?? ''));
  const textContent = rawText
    .replace(/<a[\s\S]*?<\/a>/gi, '')
    .replace(/📥\s*Download PDF Report[\s\S]*?$/i, '')
    .replace(/Download Report\s*\n?Get the complete raw dossier[\s\S]*/i, '')
    .replace(/Direct Answer[\s\S]*/i, '')
    .replace(/Total Posts[\s\S]*/i, '')
    .replace(/Supporting Evidence[\s\S]*/i, '')
    .replace(/Methodology Note[\s\S]*/i, '')
    .replace(/javascript:void\(0\)[^<]*/gi, '')
    .replace(/\(Google-indexed estimate, not Meta internal exact\)/gi, '')
    .replace(/\(Google-indexed[^)]*\)/gi, '')
    .replace(/were indexed on Instagram/gi, 'were found on Instagram')
    .replace(/\bindexed\b/gi, 'found')
    .replace(/In the last[^]*?tap to verify\.?/gi, '')
    .trim();

  const reasoningParts = parts.filter((p: any) => p.type === 'reasoning');
  const thoughts = reasoningParts.length > 0
    ? reasoningParts.map((p: any) => p.text ?? p.reasoning ?? '').join('\n\n')
    : undefined;

  if (!isAi) {
    const handleCopyUser = async () => {
      try { await navigator.clipboard.writeText(textContent || message.content || ''); setCopiedUser(true); setTimeout(()=>setCopiedUser(false), 1400); } catch {}
    };
    return (
      <div className="flex justify-end px-2 py-1.5 group/user">
        <div className="flex flex-col items-end gap-1 max-w-[75%]">
          <div className="rounded-[22px] bg-[#E8F0FE] px-5 py-2.5">
            {textContent && <div className="whitespace-pre-wrap text-[14px] leading-6 text-[#1F2937]">{textContent || message.content}</div>}
            {!textContent && message.content && <div className="whitespace-pre-wrap text-[14px] leading-6 text-[#1F2937]">{message.content}</div>}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover/user:opacity-100 transition-opacity pr-1">
            <button onClick={handleCopyUser} aria-label="Copy" className="h-7 w-7 rounded-full bg-white border shadow-sm flex items-center justify-center hover:bg-muted">
              {copiedUser ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-[48rem] flex-col gap-3 px-6 py-6')}>
      <div className="mb-1 text-sm font-medium">
        <span className="text-[#7C3AED]">Trubetix AI</span>
      </div>
      
      {isLoading && (thoughts || hasToolCalls) && (
        <ThinkingPanel
          isLoading={isLoading || false}
          thoughts={thoughts}
          toolCalls={toolInvocations}
        />
      )}

      {/* Data-first: tool dashboards before long text */}
      {toolInvocations.length ? null : textContent && (
        <div className="prose prose-base dark:prose-invert max-w-none prose-p:my-3 prose-p:leading-7 prose-p:text-[15px] prose-p:text-[#1F2937] prose-strong:font-bold prose-strong:text-[#111827] prose-headings:font-semibold prose-headings:text-[#111827] prose-h2:text-[18px] prose-h3:text-[16px] prose-li:my-1 prose-li:text-[15px] prose-li:leading-7 prose-ul:my-3 prose-a:text-[#7C3AED] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
        </div>
      )}

      {!hasToolCalls && textContent && /which companies|which brands|what time range|1d.*7d.*30d|1d.*7d.*15d/i.test(textContent) && addToolResult && (
        <AnalysisForm
          initialEntities={[]}
          initialRange="7d"
          onConfirm={(entities, range) => addToolResult(`fallback-${Date.now()}`, { entities, range })}
          onCancel={() => addToolResult(`fallback-${Date.now()}`, { entities: [], range: '7d', cancelled: true })}
        />
      )}

      {toolInvocations.map((toolInvocation: any, tIdx: number) => {
        const { toolName, toolCallId, state, args, result, rawState } = toolInvocation;
        const uniqueKey = `${message.id ?? 'msg'}-${toolCallId}-${tIdx}`;
        const isResult = state === 'result' || rawState === 'output-available' || rawState === 'output-error';

        if (toolName === 'execute_pipeline') {
          if (!isResult) {
            return (
              <div key={uniqueKey} className="w-full">
                <div className="rounded-lg border bg-white p-4 flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" /> Searching {args?.platforms?.join(', ') || 'indexed'} posts for {args?.entities?.join(', ') ?? 'entity'} ({args?.range ?? '7d'})…
                </div>
              </div>
            );
          }
          if (result?.status === 'quota_exceeded' || result?.status === 'error') {
            return (
              <div key={uniqueKey} className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">{result.status === 'quota_exceeded' ? 'Gemini quota hit — try again shortly' : 'Analysis failed'}</div>
                <div className="mt-1 text-sm text-amber-800">{result.error ?? 'Pipeline failed. Please retry.'}</div>
                {result.retryAfter && <div className="mt-2 text-xs text-amber-700">Retry after: {result.retryAfter} • Free tier is 20 requests/day per model.</div>}
                <div className="mt-2 text-xs text-muted-foreground">Tip: try a 1-day window or wait {result.retryAfter ?? 'a minute'} — cached results will be served.</div>
              </div>
            );
          }
          const analyses: any[] = result?.analyses ?? [];
          if (analyses.length) {
            const showPdf = analyses.some((a:any)=> (a.intents??[]).includes('pdf_generation') || (a.question??'').toLowerCase().includes('pdf'));
            const isComparison = analyses.length >= 2 && (analyses[0]?.intents?.includes('comparison') || (result?.question??'').toLowerCase().includes(' vs ') || (result?.question??'').toLowerCase().includes('compare'));
            if (isComparison) {
              return (
                <div key={uniqueKey} className="w-full">
                  <ComparisonView analyses={analyses} />
                  {showPdf && <div className="flex justify-end mt-3"><PdfDownloadButton entity={analyses[0].entity} analysis={analyses[0]} range={analyses[0].range} /></div>}
                </div>
              );
            }
            return (
              <div key={uniqueKey} className="w-full space-y-6">
                {analyses.map((a:any, idx:number)=>(
                  <div key={`${toolCallId}-${idx}`} className="space-y-3">
                    <IntelligenceDashboard analysis={a} />
                    {showPdf && <div className="flex justify-end"><PdfDownloadButton entity={a.entity} analysis={a} range={a.range} /></div>}
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div key={uniqueKey} className="w-full space-y-4">
              {result?.results?.map((res: any, idx: number) => (
                <div key={`${toolCallId}-${idx}`}>
                  <ScoreCard entity={args?.entities?.[idx] ?? result?.entities?.[idx] ?? 'Unknown'} result={res} range={args?.range ?? result?.range ?? '7d'} />
                </div>
              ))}
              {analyses.length === 0 && result?.results?.length === 0 ? <div className="text-sm text-muted-foreground">Analysis complete — no signals in window. Try broader range.</div> : null}
            </div>
          );
        }

        if (isResult && toolName === 'execute_volume_query') {
          if (result?.status === 'error') {
            return <div key={uniqueKey} className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{result.error ?? 'Volume query failed.'}</div>;
          }
          const volResults = result?.results ?? [];
          const volRange = args?.range ?? result?.range ?? '7d';
          if (volResults.length === 0) return <div key={uniqueKey} className="w-full rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">No volume results returned.</div>;
          return <div key={uniqueKey} className="w-full"><VolumeResults results={volResults} range={volRange} /></div>;
        }

        if (isResult && (toolName === 'aggregate_social_metrics' || toolName === 'discover_social_posts' || toolName === 'search_web_mentions' || toolName === 'search_news')) {
          return null;
        }
        if (isResult && toolName === 'compare_periods') {
          const deltas = result?.deltas ?? result;
          const cur = result?.current;
          const prev = result?.previous;
          return (
            <div key={uniqueKey} className="w-full space-y-3">
              <div className="text-sm font-semibold">Period Comparison — deterministic</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded border p-2"><div className="text-[11px] uppercase tracking-widest text-muted-foreground">Mentions growth</div><div className="text-sm font-bold">{deltas?.mentionsGrowth == null ? '—' : `${deltas.mentionsGrowth>0?'+':''}${deltas.mentionsGrowth}%`}</div></div>
                <div className="rounded border p-2"><div className="text-[11px] uppercase tracking-widest text-muted-foreground">Positive shift</div><div className="text-sm font-bold">{deltas?.sentimentDelta == null ? '—' : `${deltas.sentimentDelta>0?'+':''}${deltas.sentimentDelta}%`}</div></div>
                <div className="rounded border p-2"><div className="text-[11px] uppercase tracking-widest text-muted-foreground">Negative shift</div><div className="text-sm font-bold">{deltas?.negativeDelta == null ? '—' : `${deltas.negativeDelta>0?'+':''}${deltas.negativeDelta}%`}</div></div>
              </div>
              {cur && prev ? <div className="text-xs text-muted-foreground">Current {cur.indexedCount} indexed • Previous {prev.indexedCount} indexed • {deltas?.engagementDelta != null ? `Engagement ${deltas.engagementDelta}%` : 'Engagement unavailable'}</div> : null}
              <div className="text-xs text-muted-foreground">Gemini explains drivers; numbers are backend-calculated.</div>
            </div>
          );
        }
        if (isResult && toolName === 'get_cached_analysis') {
          if (result?.hit) return <div key={uniqueKey} className="w-full"><IntelligenceDashboard analysis={result.analysis} /><div className="text-xs text-muted-foreground mt-2">Served from cache (30m TTL) — refresh if you need latest.</div></div>;
          return null;
        }
        if (isResult) {
          return null;
        }

        if (toolName === 'ask_user_for_confirmation') {
          const isCompleted = isResult;
          if (isCompleted) {
            const conf = result as any;
            if (conf?.cancelled) return <div key={uniqueKey} className="w-full rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Cancelled — ask again to start a new scan.</div>;
            return (
              <div key={uniqueKey} className="w-full">
                <div className="rounded-lg border bg-white p-3 flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-pulse" /> Searching for {(result as any)?.entities?.join(', ') ?? args?.entities?.join(', ') ?? 'entity'} · {(result as any)?.range ?? args?.range ?? '7d'} {(result as any)?.platforms?.length ? `· ${(result as any).platforms.join(', ')}` : ''}…
                </div>
              </div>
            );
          }
          return (
            <AnalysisForm
              key={uniqueKey}
              initialEntities={args?.entities ?? []}
              initialRange={args?.range ?? '7d'}
              initialPlatforms={args?.platforms ?? []}
              onConfirm={(entities, range, platforms) => {
                if (addToolResult) {
                  addToolResult(toolCallId, { entities, range, platforms: platforms ?? args?.platforms ?? [] });
                }
              }}
              onCancel={() => {
                if (addToolResult) {
                  addToolResult(toolCallId, { entities: args?.entities ?? [], range: args?.range ?? '7d', platforms: args?.platforms ?? [], cancelled: true });
                }
              }}
            />
          );
        }

        return null;
      })}
      {toolInvocations.length > 0 && textContent && !hasPipeline && (
        <div className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-6 prose-p:text-sm prose-p:text-[#374151] mt-4 border-t pt-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
        </div>
      )}

    </div>
  );
}
