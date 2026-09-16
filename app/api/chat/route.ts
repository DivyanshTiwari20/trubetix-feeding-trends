import { streamText, tool, convertToModelMessages, stepCountIs } from 'ai';
import { google } from '@/lib/google';
import { z } from 'zod';
import { classifyIntent, Intent } from '@/lib/services/classifyIntent';
import { prisma } from '@/lib/db';
import { isQuotaError, quotaMessage } from '@/lib/quota';
import { buildAnalysis } from '@/lib/services/buildAnalysis';
import { fetchSerperQueries } from '@/lib/adapters/webMentions';
import { searchNews, discoverSocialPosts, searchWebMentions } from '@/lib/services/discovery';
import { aggregateMetrics } from '@/lib/metrics/aggregate';
import { comparePeriods } from '@/lib/metrics/compare';
import { getCachedAnalysis } from '@/lib/cache/memory';
import { resolveQuestion } from '@/lib/services/resolveQuestion';

const MAX_STEPS = 5;

function getTextFromUIMessage(m: any): string {
  if (m.parts?.length) return m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.map((c: any) => c.text || '').join('\n');
  return '';
}

function buildSystemPrompt(intentHint?: Intent, classifiedEntities?: string[], classifiedRange?: string, classifiedPlatforms?: string[]): string {
  const base = `You are Trubetix — sharp analyst. Lean pipeline ONLY.

VOICE: Quick, confident, polished. Max 1 emoji, never on data.
PIPELINE: 1) Parse entity + platform + range 2) SERP site: queries + tbs + pagination → collectNormalizedData 3) Answer totalPosts (~totalResults from search engine, not sample count) + totalLikes summed where observable. Gemini is intelligent agent over results — polished synthesis, never count source.
RULES:
- Volume query ("for Instagram", "how many posts"): Reply with ONE polished sentence: "{Entity} had ~{total} posts on {Platform} in last {range}." Add " totalling ~{likes} likes where observable" ONLY if likes exist. NO evidence list, NO "Supporting Evidence", NO "Methodology Note", NO "Total Engagement", NO URLs, NO "View Reel", NO bullet lists, NO headings, NO PR Health.
- Comparison: 1 paragraph side-by-side totals, no evidence.
- Sentiment / "what are people saying": Use Reddit/X evidence primarily. News only if requested. Summarize sentiment + public conversation concisely.
- After execute_pipeline, DO NOT regenerate a verbose report — just repeat the brief.directAnswer verbatim in your final text. Do NOT add Direct Answer / Total Posts / Supporting Evidence sections.
LEANNESS: Nothing extra beyond what user asked. Methodology collapsed to zero — totals are search totalResults estimate.
TRUTH: Never invent. Null likes = hide likes line.`;

  if (intentHint === 'casual_chat') {
    return base + `\n\nROUTING: Casual chat. Respond helpfully. Do NOT call analysis tools.`;
  }
  if (intentHint === 'ambiguous') {
    if (classifiedEntities?.length && !(classifiedPlatforms?.length)) {
      return base + `\n\nROUTING: Entity known [${classifiedEntities.join(',')}] but platform missing. If you can infer platform from recent history, call execute_pipeline directly. Only if truly missing, ask ONE line: "Which platform: Instagram, X, Reddit, YouTube, or overall?" Do NOT show confirmation form unless needed.`;
    }
    return base + `\n\nROUTING: Ambiguous. If you have entity from prior messages, call execute_pipeline directly. Only if no entity at all, ask one short line. Do NOT show confirmation form.`;
  }
  if (intentHint === 'volume_query') {
    return base + `\n\nROUTING: Volume question — user wants count. If entities, range, and platforms are resolved (even partially), call execute_pipeline IMMEDIATELY with those values + original question. Do NOT call ask_user_for_confirmation. Only ask if entity missing entirely.`;
  }
  if (intentHint === 'pdf_generation') {
    return base + `\n\nROUTING: User wants PDF. If analysis exists, point to Download button. If not, ask which entity first. Do NOT auto-run pipeline.`;
  }
  const hasAll = !!(classifiedEntities?.length && classifiedRange && classifiedPlatforms?.length);
  if (hasAll) {
    return base + `\n\nROUTING: Analysis — ALL params present (entities=[${classifiedEntities!.map(e=>`"${e}"`).join(',')}] range=${classifiedRange} platforms=${JSON.stringify(classifiedPlatforms)}). Call execute_pipeline DIRECTLY with those + original question. Do NOT call ask_user_for_confirmation. After tool returns, answer using brief.directAnswer.`;
  }
  if (classifiedEntities?.length) {
    return base + `\n\nROUTING: Analysis — entities present but platforms/range may be inferred. Call execute_pipeline directly with entities=[${classifiedEntities!.map(e=>`"${e}"`).join(',')}] range=${classifiedRange||'7d'} platforms=${JSON.stringify(classifiedPlatforms||[])} + original question. Do NOT show confirmation form unless entity is missing. Only ask_user_for_confirmation if you have ZERO entities.`;
  }
  return base + `\n\nROUTING: Analysis. Only call ask_user_for_confirmation if you have zero entities. Otherwise call execute_pipeline directly. After tool returns, answer using brief.directAnswer.`;
}

function buildTools() {
  return {
    ask_user_for_confirmation: tool({
      description: 'Extracts entities, range and platforms. Also capture original question.',
      inputSchema: z.object({ entities: z.array(z.string()), range: z.enum(['1d', '7d', '15d', '30d']), platforms: z.array(z.string()).optional(), question: z.string().optional() }),
    }),
    execute_pipeline: tool({
      description: 'Runs question-first pipeline: collects platform-scoped data, then Gemini interprets for the specific question. For 2+ entities it builds head-to-head comparison.',
      inputSchema: z.object({ entities: z.array(z.string()), range: z.enum(['1d', '7d', '15d', '30d']), platforms: z.array(z.string()).optional(), question: z.string().optional() }),
      execute: async (args: { entities: string[]; range: '1d' | '7d' | '15d' | '30d'; platforms?: string[]; question?: string }) => {
        const { entities, range, platforms, question } = args;
        const plats = platforms ?? [];
        const q = question ?? entities.map(e=>`What is the narrative around ${e}?`).join(' ');
        try {
          if (entities.length > 1) {
            const { buildComparisonAnalysis } = await import('@/lib/services/buildAnalysis');
            const analyses = await buildComparisonAnalysis(entities, range, plats, q);
            return { status: 'success' as const, entities, range, platforms: plats, question: q, analyses };
          }
          const analyses = await Promise.all(entities.map((entity) => buildAnalysis(entity, range, plats, 'general', { question: q })));
          return { status: 'success' as const, entities, range, platforms: plats, question: q, analyses };
        } catch (e: any) {
          if (e?.isQuota || isQuotaError(e).hit) { const retryAfter = e?.retryAfter ?? isQuotaError(e).retryAfter; return { status: 'quota_exceeded', entities, range, results: [], error: quotaMessage(retryAfter), retryAfter } as any; }
          return { status: 'error', entities, range, results: [], error: e?.message ?? 'Pipeline failed' } as any;
        }
      },
    }),
    execute_volume_query: tool({
      description: 'Deprecated — use execute_pipeline with question instead.',
      inputSchema: z.object({ queries: z.array(z.string()), range: z.enum(['1d', '7d', '15d', '30d']) }),
      execute: async (args: { queries: string[]; range: '1d' | '7d' | '15d' | '30d' }) => {
        const { queries, range } = args;
        try {
          const results = await fetchSerperQueries(queries, range);
          return { status: 'success' as const, range, results: results.map(r => ({ query: r.query, count: r.mentions.length, mentions: r.mentions.slice(0, 5), searchInformation: r.searchInformation, topMentions: r.mentions.slice(0, 5), error: r.error })) };
        } catch (e: any) { return { status: 'error', error: e?.message ?? 'Search failed' }; }
      },
    }),
    discover_social_posts: tool({
      description: 'Discover indexed social posts via Serper.',
      inputSchema: z.object({ entity: z.string(), platforms: z.array(z.string()).optional(), range: z.enum(['1d','7d','15d','30d']) }),
      execute: async (args: { entity: string; platforms?: string[]; range: '1d'|'7d'|'15d'|'30d' }) => {
        const mentions = await discoverSocialPosts(args.entity, args.range, args.platforms);
        return { entity: args.entity, range: args.range, platforms: args.platforms ?? [], count: mentions.length, indexedCount: mentions.length, mentions: mentions.slice(0,8) };
      },
    }),
    search_web_mentions: tool({
      description: 'Search indexed web/social mentions.',
      inputSchema: z.object({ entity: z.string(), range: z.enum(['1d','7d','15d','30d']), platforms: z.array(z.string()).optional() }),
      execute: async (args: { entity: string; range: '1d'|'7d'|'15d'|'30d'; platforms?: string[] }) => {
        const mentions = await searchWebMentions(args.entity, args.range, args.platforms);
        return { entity: args.entity, range: args.range, indexedCount: mentions.length, mentions: mentions.slice(0,8) };
      },
    }),
    search_news: tool({
      description: 'Search news (GNews → Gemini grounding).',
      inputSchema: z.object({ entity: z.string(), range: z.enum(['1d','7d','15d','30d']) }),
      execute: async (args: { entity: string; range: '1d'|'7d'|'15d'|'30d' }) => {
        const mentions = await searchNews(args.entity, args.range);
        return { entity: args.entity, range: args.range, count: mentions.length, mentions: mentions.slice(0,8) };
      },
    }),
    get_cached_analysis: tool({
      description: 'Reuse cached Analysis if entity+platforms+range matches.',
      inputSchema: z.object({ entity: z.string(), platforms: z.array(z.string()).optional(), range: z.enum(['1d','7d','15d','30d']) }),
      execute: async (args: { entity: string; platforms?: string[]; range: '1d'|'7d'|'15d'|'30d' }) => {
        const hit = getCachedAnalysis(args.entity, args.platforms ?? [], args.range);
        if (hit) return { hit: true, analysis: hit };
        return { hit: false, message: 'No cached analysis for that key or expired — run fresh discovery.' };
      },
    }),
    aggregate_social_metrics: tool({
      description: 'Aggregate metrics deterministically.',
      inputSchema: z.object({ entity: z.string(), range: z.enum(['1d','7d','15d','30d']), platforms: z.array(z.string()).optional() }),
      execute: async (args: { entity: string; range: '1d'|'7d'|'15d'|'30d'; platforms?: string[] }) => {
        const mentions = await discoverSocialPosts(args.entity, args.range, args.platforms);
        const news = await searchNews(args.entity, args.range).catch(()=>[]);
        const metrics = aggregateMetrics(mentions, news.length);
        return { entity: args.entity, range: args.range, metrics };
      },
    }),
    compare_periods: tool({
      description: 'Compare two periods deterministically.',
      inputSchema: z.object({ entity: z.string(), currentRange: z.enum(['1d','7d','15d','30d']), previousRange: z.enum(['1d','7d','15d','30d']), platforms: z.array(z.string()).optional() }),
      execute: async (args: { entity: string; currentRange: '1d'|'7d'|'15d'|'30d'; previousRange: '1d'|'7d'|'15d'|'30d'; platforms?: string[] }) => {
        const curMentions = await discoverSocialPosts(args.entity, args.currentRange, args.platforms);
        const prevMentions = await discoverSocialPosts(args.entity, args.previousRange, args.platforms);
        const curMetrics = aggregateMetrics(curMentions, 0);
        const prevMetrics = aggregateMetrics(prevMentions, 0);
        return comparePeriods(curMetrics, prevMetrics);
      },
    }),
  };
}

async function persistIncomingMessages(chatId: string, messages: any[]) {
  if (!chatId || !messages?.length) return;
  try {
    const existing = await prisma.message.findMany({ where: { chatId }, select: { id: true, parts: true } });
    const existingMap = new Map(existing.map(m => [m.id, m]));
    for (const m of messages) {
      const id: string | undefined = m.id;
      const role: string = m.role;
      if (role !== 'user' && role !== 'assistant') continue;
      const parts: any = m.parts ?? null;
      const text = getTextFromUIMessage(m);
      const content = text || (typeof m.content === 'string' ? m.content : '') || '';
      const hasToolPart = Array.isArray(parts) && parts.some((p: any) => String(p.type || '').startsWith('tool-'));
      if (!content && !hasToolPart && !parts) continue;
      const dbContent = content || (hasToolPart ? 'Tool interaction' : '');
      if (!dbContent && !parts) continue;
      if (id && existingMap.has(id)) {
        const prev = existingMap.get(id) as any;
        const prevPartsStr = JSON.stringify(prev.parts ?? null);
        const curPartsStr = JSON.stringify(parts ?? null);
        if (prevPartsStr !== curPartsStr) {
          try { await prisma.message.update({ where: { id }, data: { content: dbContent || '...', parts: parts ?? undefined } }); } catch {}
        }
        continue;
      }
      const data: any = { chatId, role, content: dbContent || '...', parts: parts ?? undefined };
      if (id && typeof id === 'string' && id.length >= 8 && id.length <= 64) {
        data.id = id;
        try { await prisma.message.create({ data }); existingMap.set(id, data as any); continue; } catch {}
      }
      const dup = await prisma.message.findFirst({ where: { chatId, role, content: dbContent }, orderBy: { createdAt: 'desc' } });
      const isRecentDup = dup && Date.now() - new Date(dup.createdAt).getTime() < 60000;
      if (isRecentDup) continue;
      try { await prisma.message.create({ data: { chatId, role, content: dbContent || '...', parts: parts ?? undefined } }); } catch {}
    }
    await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } }).catch(()=>{});
  } catch (e) { console.error('persistIncomingMessages error', e); }
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages: any[] = body.messages ?? [];
  let chatId: string | undefined = body.chatId;
  const deepThinking: boolean = !!body.deepThinking;

  if (!chatId && messages?.length) {
    const firstUser = messages.find((m: any) => m.role === 'user');
    const title = (getTextFromUIMessage(firstUser) || 'New chat').slice(0, 80);
    try { const chat = await prisma.chat.create({ data: { title: title || 'New chat' } }); chatId = chat.id; } catch {}
  } else if (chatId) {
    try {
      const exists = await prisma.chat.findUnique({ where: { id: chatId } });
      if (!exists) { const firstUser = messages.find((m: any) => m.role === 'user'); const title = (getTextFromUIMessage(firstUser) || 'New chat').slice(0, 80); const chat = await prisma.chat.create({ data: { id: chatId, title: title || 'New chat' } }); chatId = chat.id; }
    } catch {}
  }

  if (chatId) await persistIncomingMessages(chatId, messages);

  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
  const lastUserTextRaw = getTextFromUIMessage(lastUserMsg) || '';
  const hasPendingTool = messages.some((m: any) => (m.parts ?? []).some((p: any) => p.type === 'tool-ask_user_for_confirmation' && (p.state === 'call' || p.state === 'input-available' || p.state === 'output-available')));

  let intentHint: Intent = 'full_analysis';
  let classifiedEntities: string[] = [];
  let classifiedRange: string | undefined;
  let classifiedPlatforms: string[] | undefined;

  if (!hasPendingTool && messages.length > 0) {
    try {
      const formattedMessages = messages.map((m: any) => ({ role: m.role, content: getTextFromUIMessage(m) })).filter((m) => m.content.trim().length > 0);
      const classification = await classifyIntent(formattedMessages);
      intentHint = classification.intent;
      classifiedEntities = classification.entities;
      classifiedRange = classification.range;
      classifiedPlatforms = (classification as any).platforms;
      if (intentHint === 'ambiguous' && classifiedEntities.length > 0) intentHint = 'full_analysis';
      const lowerAll = formattedMessages.map(m=>m.content.toLowerCase()).join(' ');
      if (classifiedEntities.length === 0 && /samay\s*raina|samay/i.test(lowerAll)) {
        classifiedEntities = ['Samay Raina'];
        if (!classifiedRange && /last week|7 days|week/i.test(lowerAll)) classifiedRange = '7d';
        if (!classifiedPlatforms?.length && /instagram|insta/i.test(lowerAll)) classifiedPlatforms = ['instagram'];
        intentHint = 'full_analysis';
      }
      try {
        const rq = await resolveQuestion(lastUserTextRaw, { entity: classifiedEntities[0], range: classifiedRange, platforms: classifiedPlatforms });
        if (rq.entities.length) classifiedEntities = rq.entities;
        if (rq.platforms.length) classifiedPlatforms = rq.platforms;
        if (rq.range) classifiedRange = rq.range;
      } catch {}
      if (intentHint === 'full_analysis' && classifiedEntities.length > 0 && (!classifiedPlatforms || classifiedPlatforms.length === 0)) {
        const lastUserLower = (getTextFromUIMessage(lastUserMsg) || '').toLowerCase();
        const hasPlatformMention = /instagram|insta|x\b|twitter|youtube|reddit|linkedin|news|web|all platforms|overall/i.test(lastUserLower);
        if (!hasPlatformMention) intentHint = 'ambiguous' as any;
      }
    } catch (e) { console.warn('Intent classification failed:', e); }
  }

  const lastAskOutput = [...messages].reverse().flatMap((m: any) => m.parts ?? []).find((p: any) => p.type === 'tool-ask_user_for_confirmation' && p.state === 'output-available' && p.output && !p.output.cancelled);
  const pendingAsk = [...messages].reverse().flatMap((m: any) => m.parts ?? []).find((p: any) => p.type === 'tool-ask_user_for_confirmation' && (p.state === 'call' || p.state === 'input-available'));
  const hasExecuteResult = messages.some((m: any) => (m.parts ?? []).some((p: any) => p.type === 'tool-execute_pipeline' && p.state === 'output-available'));
  const lastUserText = (getTextFromUIMessage(lastUserMsg) || '').trim().toLowerCase();
  const isAffirmative = /^(y|yes|ys|yess|yeah|yep|yup|ye|yea|sure|ok|okay|k|go ahead|run it|do it|confirm|proceed|please do|run the scan|start|yep please|ys please)$/i.test(lastUserText) || /^\s*y[esahp]*\s*$/i.test(lastUserText) || (lastUserText.length <= 4 && lastUserText.startsWith('y')) || lastUserText === 'ys' || lastUserText.includes('yes') && lastUserText.length <= 12;

  if (pendingAsk && !hasExecuteResult && !lastAskOutput && isAffirmative) {
    const input = (pendingAsk as any).input ?? (pendingAsk as any).args;
    const entities: string[] = input?.entities ?? classifiedEntities;
    const range: string = input?.range ?? classifiedRange ?? '7d';
    const platforms: string[] = Array.isArray(input?.platforms) ? input.platforms : [];
    const question: string = input?.question ?? lastUserTextRaw;
    if (entities?.length) {
      const syntheticOutput = { entities, range, platforms, question };
      messages.push({ role: 'assistant', parts: [{ type: 'tool-ask_user_for_confirmation', toolCallId: (pendingAsk as any).toolCallId, state: 'output-available', input, output: syntheticOutput }] } as any);
    }
  }

  let selectedTools: Record<string, any> | undefined = undefined;
  const allTools = buildTools();
  if (hasPendingTool || intentHint === 'full_analysis') {
    selectedTools = { execute_pipeline: allTools.execute_pipeline, ask_user_for_confirmation: allTools.ask_user_for_confirmation, discover_social_posts: allTools.discover_social_posts, search_web_mentions: allTools.search_web_mentions, search_news: allTools.search_news, get_cached_analysis: allTools.get_cached_analysis, aggregate_social_metrics: allTools.aggregate_social_metrics, compare_periods: allTools.compare_periods };
  } else if (intentHint === 'volume_query') {
    selectedTools = { execute_pipeline: allTools.execute_pipeline, discover_social_posts: allTools.discover_social_posts, search_web_mentions: allTools.search_web_mentions, aggregate_social_metrics: allTools.aggregate_social_metrics, get_cached_analysis: allTools.get_cached_analysis };
  } else if (intentHint === 'casual_chat' || intentHint === 'pdf_generation') {
    selectedTools = hasPendingTool ? { execute_pipeline: allTools.execute_pipeline, ask_user_for_confirmation: allTools.ask_user_for_confirmation } : undefined;
  } else if (intentHint === 'ambiguous') {
    selectedTools = classifiedEntities.length > 0 ? { execute_pipeline: allTools.execute_pipeline, ask_user_for_confirmation: allTools.ask_user_for_confirmation } : undefined;
  }

  const modelsToTry = ['models/gemini-3.5-flash-lite'];
  let lastErr: any;
  for (let i = 0; i < modelsToTry.length; i++) {
    const modelId = modelsToTry[i];
    try {
      const result = streamText({
        model: google(modelId),
        messages: await convertToModelMessages(messages ?? [], { ignoreIncompleteToolCalls: true } as any),
        ...(deepThinking ? ({ providerOptions: { google: { thinkingConfig: { includeThoughts: true, thinkingBudget: 2048 } } } as any } as any) : {}),
        system: buildSystemPrompt(hasPendingTool && (lastAskOutput || pendingAsk) ? 'full_analysis' : intentHint, classifiedEntities, classifiedRange, classifiedPlatforms) + (hasPendingTool && (pendingAsk || lastAskOutput) ? '\n\nPENDING: A confirmation tool is pending. If user said yes/confirm/go ahead, IMMEDIATELY call execute_pipeline with pending entities/range/platforms/question. Do NOT ask again.' : ''),
        ...(selectedTools ? { tools: selectedTools } : {}),
        stopWhen: stepCountIs(MAX_STEPS),
        onEnd: async (event: any) => {
          if (!chatId) return;
          try {
            const text: string = event?.text ?? '';
            const content: any[] = event?.content ?? [];
            const reasoningText: string = event?.reasoningText ?? '';
            const steps: any[] = event?.steps ?? [];
            let parts: any[] = [];
            if (Array.isArray(content) && content.length > 0) {
              for (const c of content) {
                if (c.type === 'text') parts.push({ type: 'text', text: c.text });
                else if (c.type === 'reasoning') parts.push({ type: 'reasoning', text: c.text ?? c.reasoning ?? '' });
                else if (c.type === 'tool-call') parts.push({ type: `tool-${c.toolName}`, toolCallId: c.toolCallId, state: 'call', input: c.input ?? c.args });
                else if (c.type === 'tool-result') parts.push({ type: `tool-${c.toolName}`, toolCallId: c.toolCallId, state: 'output-available', input: c.input, output: c.output ?? c.result });
              }
            }
            if (parts.length === 0) {
              if (reasoningText) parts.push({ type: 'reasoning', text: reasoningText });
              if (text) parts.push({ type: 'text', text });
              const toolCalls: any[] = event?.toolCalls ?? [];
              const toolResults: any[] = event?.toolResults ?? [];
              for (const tc of toolCalls) parts.push({ type: `tool-${tc.toolName}`, toolCallId: tc.toolCallId, state: 'call', input: tc.input ?? tc.args });
              for (const tr of toolResults) parts.push({ type: `tool-${tr.toolName}`, toolCallId: tr.toolCallId, state: 'output-available', input: tr.input, output: tr.output ?? tr.result });
              if (Array.isArray(steps)) {
                for (const s of steps) {
                  for (const tc of (s.toolCalls ?? [])) if (!parts.some(p=>p.toolCallId===tc.toolCallId)) parts.push({ type: `tool-${tc.toolName}`, toolCallId: tc.toolCallId, state: 'call', input: tc.input ?? tc.args });
                  for (const tr of (s.toolResults ?? [])) if (!parts.some(p=>p.toolCallId===tr.toolCallId && p.state==='output-available')) parts.push({ type: `tool-${tr.toolName}`, toolCallId: tr.toolCallId, state: 'output-available', input: tr.input, output: tr.output ?? tr.result });
                }
              }
            }
            const hasText = parts.some((p:any)=>p.type==='text' && String(p.text||'').trim().length>0);
            const hasTool = parts.some((p:any)=>String(p.type||'').startsWith('tool-'));
            if (!hasText && !hasTool) { if (text && text.trim()) parts = [{ type: 'text', text }]; else return; }
            const dbContent = text?.trim() || parts.filter((p:any)=>p.type==='text').map((p:any)=>p.text).join('\n').slice(0, 4000) || (hasTool ? 'Analysis complete' : '');
            if (!dbContent && parts.length===0) return;
            const recent = await prisma.message.findFirst({ where: { chatId }, orderBy: { createdAt: 'desc' } });
            if (recent && recent.role === 'assistant' && recent.content === dbContent && hasTool) return;
            await prisma.message.create({ data: { chatId, role: 'assistant', content: dbContent || 'Analysis complete', parts } });
            await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
          } catch (e) { console.error('Failed to save assistant message', e); }
        },
      });
      const response = result.toUIMessageStreamResponse();
      if (chatId) response.headers.set('X-Chat-Id', chatId);
      return response;
    } catch (e: any) {
      lastErr = e;
      const q = isQuotaError(e);
      if (q.hit && i < modelsToTry.length - 1) continue;
      if (q.hit) return new Response(JSON.stringify({ error: quotaMessage(q.retryAfter), retryAfter: q.retryAfter, code: 'QUOTA_EXCEEDED' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
  const q = isQuotaError(lastErr);
  if (q.hit) return new Response(JSON.stringify({ error: quotaMessage(q.retryAfter), retryAfter: q.retryAfter, code: 'QUOTA_EXCEEDED' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ error: 'Something went wrong.', code: 'INTERNAL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
}
