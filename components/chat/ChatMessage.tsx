import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { ThinkingPanel } from './ThinkingPanel';
import { AnalysisForm } from './AnalysisForm';
import { ScoreCard } from './ScoreCard';
import { PdfDownloadButton } from '../pdf/PdfDownloadButton';

interface ChatMessageProps {
  message: any;
  isLoading?: boolean;
  addToolResult?: (toolCallId: string, result: any) => void;
}

export function ChatMessage({ message, isLoading, addToolResult }: ChatMessageProps) {
  const isAi = message.role === 'assistant';
  const parts: any[] = message.parts ?? [];

  const rawText = parts.length > 0
    ? parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n\n')
    : (message.content ?? '');
  const textContent = rawText
    .replace(/<a[\s\S]*?<\/a>/gi, '')
    .replace(/📥\s*Download PDF Report[\s\S]*?$/i, '')
    .replace(/Download Report\s*\n?Get the complete raw dossier[\s\S]*/i, '')
    .replace(/javascript:void\(0\)[^<]*/gi, '')
    .trim();

  const reasoningParts = parts.filter((p: any) => p.type === 'reasoning');
  const thoughts = reasoningParts.length > 0
    ? reasoningParts.map((p: any) => p.text ?? p.reasoning ?? '').join('\n\n')
    : undefined;

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

  const hasToolCalls = toolInvocations.length > 0;

  if (!isAi) {
    return (
      <div className="flex justify-end px-2 py-1.5">
        <div className="max-w-[75%] rounded-[22px] bg-[#E8F0FE] px-5 py-2.5">
          {textContent && <div className="whitespace-pre-wrap text-[14px] leading-6 text-[#1F2937]">{textContent}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-[48rem] flex-col gap-3 px-6 py-6')}>
      <div className="mb-1 text-sm font-medium">
        <span className="text-[#7C3AED]">Trubetix AI</span>
      </div>
      
      {(isLoading || thoughts || hasToolCalls) && (
        <ThinkingPanel
          isLoading={isLoading || false}
          thoughts={thoughts}
          toolCalls={toolInvocations}
        />
      )}

      {textContent && (
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

      {toolInvocations.map((toolInvocation: any) => {
        const { toolName, toolCallId, state, args, result, rawState } = toolInvocation;
        const isResult = state === 'result' || rawState === 'output-available' || rawState === 'output-error';

        if (isResult && toolName === 'execute_pipeline') {
          if (result?.status === 'quota_exceeded' || result?.status === 'error') {
            return (
              <div key={toolCallId} className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">{result.status === 'quota_exceeded' ? 'Gemini quota hit — try again shortly' : 'Analysis failed'}</div>
                <div className="mt-1 text-sm text-amber-800">{result.error ?? 'Pipeline failed. Please retry.'}</div>
                {result.retryAfter && <div className="mt-2 text-xs text-amber-700">Retry after: {result.retryAfter} • Free tier is 20 requests/day per model.</div>}
                <div className="mt-2 text-xs text-muted-foreground">Tip: try a 1-day window or wait {result.retryAfter ?? 'a minute'} — cached results will be served.</div>
              </div>
            );
          }
          return (
            <div key={toolCallId} className="w-full">
              {result?.results?.map((res: any, idx: number) => (
                <div key={`${toolCallId}-${idx}`}>
                  <ScoreCard entity={args?.entities?.[idx] ?? result?.entities?.[idx] ?? 'Unknown'} result={res} range={args?.range ?? result?.range ?? '7d'} />
                  <div className="flex justify-end mt-2">
                    <PdfDownloadButton
                      entity={args?.entities?.[idx] ?? result?.entities?.[idx] ?? 'Unknown'}
                      result={res}
                      range={args?.range ?? result?.range ?? '7d'}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (isResult) {
          return null;
        }

        if (toolName === 'ask_user_for_confirmation') {
          const isCompleted = isResult;
          if (isCompleted) return null;
          return (
            <AnalysisForm
              key={toolCallId}
              initialEntities={args?.entities ?? []}
              initialRange={args?.range ?? '7d'}
              onConfirm={(entities, range) => {
                if (addToolResult) {
                  addToolResult(toolCallId, { entities, range });
                }
              }}
              onCancel={() => {
                if (addToolResult) {
                  addToolResult(toolCallId, { entities: args?.entities ?? [], range: args?.range ?? '7d', cancelled: true });
                }
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
