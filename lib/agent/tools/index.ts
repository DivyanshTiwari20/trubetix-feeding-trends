import type { EvidenceItem, ToolCallRequest, ToolResult } from '../types';
import { LIMITS } from '../limits';
import { EvidenceStore, canonicalUrl } from '../evidence';
import { cacheGet, cacheSet } from '../cache';
import { webSearchSchema, execWebSearch, webSearchDecl } from './webSearch';
import { newsSearchSchema, execNewsSearch, newsSearchDecl } from './newsSearch';
import { instagramSearchSchema, execInstagramSearch, instagramSearchDecl } from './instagramSearch';
import { fetchPageSchema, execFetchPage, fetchPageDecl } from './fetchPage';
import { priorSchema, execPriorSearch, priorDecl } from './searchPriorAnalyses';

export const TOOL_DECLARATIONS = [webSearchDecl, newsSearchDecl, instagramSearchDecl, fetchPageDecl, priorDecl];

export function getToolDeclarations() { return TOOL_DECLARATIONS; }

export interface ExecCtx {
  range: '1d' | '7d' | '15d' | '30d';
  aliases: string[];
  store: EvidenceStore;
  seenCalls: Set<string>;
  fetchPageCount: number;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { kind: 'timeout' })), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (/timed out|5\d\d|upstream/i.test(msg)) {
      await new Promise(r => setTimeout(r, 500));
      return fn();
    }
    throw e;
  }
}

export async function executeTool(name: string, rawArgs: Record<string, unknown>, ctx: ExecCtx): Promise<ToolResult> {
  // Duplicate identical call guard.
  const canonArgs = JSON.stringify(rawArgs, Object.keys(rawArgs).sort());
  const seenKey = `${name}:${canonArgs}`;
  if (ctx.seenCalls.has(seenKey)) {
    return { tool: name, ok: true, items: [], summary: 'Duplicate call — use existing evidence.', fromCache: true };
  }
  ctx.seenCalls.add(seenKey);

  // Cache lookup (prior-analyses never cached).
  if (name !== 'fetch_page') {
    const hit = cacheGet<EvidenceItem[]>(name, rawArgs);
    if (hit) {
      const { added, duplicates } = ctx.store.addAll(hit);
      return { tool: name, ok: true, items: hit.slice(0, LIMITS.maxItemsToModelPerCall), summary: `Cache hit: ${hit.length} results, ${added} new, ${duplicates} duplicates.`, fromCache: true };
    }
  }

  try {
    if (name === 'web_search') {
      const parsed = webSearchSchema.safeParse(rawArgs);
      if (!parsed.success) return badInput(name, parsed.error.message);
      const r = await withTimeout(retryOnce(() => execWebSearch(parsed.data, ctx)), LIMITS.perToolTimeoutMs, 'web_search');
      return finalize(name, r.items, r.error, ctx, rawArgs);
    }
    if (name === 'news_search') {
      const parsed = newsSearchSchema.safeParse(rawArgs);
      if (!parsed.success) return badInput(name, parsed.error.message);
      const r = await withTimeout(retryOnce(() => execNewsSearch(parsed.data, ctx)), LIMITS.perToolTimeoutMs, 'news_search');
      return finalize(name, r.items, r.error, ctx, rawArgs);
    }
    if (name === 'instagram_search') {
      const parsed = instagramSearchSchema.safeParse(rawArgs);
      if (!parsed.success) return badInput(name, parsed.error.message);
      const r = await withTimeout(retryOnce(() => execInstagramSearch(parsed.data, ctx)), LIMITS.perToolTimeoutMs, 'instagram_search');
      return finalize(name, r.items, r.error, ctx, rawArgs);
    }
    if (name === 'fetch_page') {
      if (ctx.fetchPageCount >= LIMITS.maxFetchPageCalls) {
        return { tool: name, ok: false, items: [], summary: 'fetch_page budget exhausted (2/request).', error: { kind: 'bad_input', message: 'fetch_page used twice already.' } };
      }
      const parsed = fetchPageSchema.safeParse(rawArgs);
      if (!parsed.success) return badInput(name, parsed.error.message);
      ctx.fetchPageCount++;
      const inStore = (url: string) => {
        const key = canonicalUrl(url);
        for (const it of ctx.store.items.values()) {
          if (it.url && canonicalUrl(it.url) === key) return it;
        }
        return null;
      };
      const r = await withTimeout(execFetchPage(parsed.data, { inStore }), LIMITS.fetchPageTimeoutMs, 'fetch_page');
      if (!r.item) return { tool: name, ok: false, items: [], summary: `fetch_page failed: ${r.error?.message}`, error: r.error as ToolResult['error'] };
      ctx.store.addAll([r.item]);
      cacheSet(name, rawArgs, [r.item]);
      return { tool: name, ok: true, items: [r.item], summary: 'Fetched 1 page, expanded snippet.' };
    }
    if (name === 'search_prior_analyses') {
      const parsed = priorSchema.safeParse(rawArgs);
      if (!parsed.success) return badInput(name, parsed.error.message);
      const r = await withTimeout(execPriorSearch(parsed.data, ctx), LIMITS.perToolTimeoutMs, 'search_prior_analyses');
      if (r.items.length) ctx.store.addAll(r.items);
      return { tool: name, ok: true, items: r.items.slice(0, LIMITS.maxItemsToModelPerCall), summary: r.summary };
    }
    return { tool: name, ok: false, items: [], summary: `Unknown tool "${name}".`, error: { kind: 'bad_input', message: `Unknown tool "${name}". Available: web_search, news_search, instagram_search, fetch_page, search_prior_analyses.` } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Tool failed';
    if (/timed out/i.test(msg)) return { tool: name, ok: false, items: [], summary: `${name}: timeout.`, error: { kind: 'timeout', message: msg } };
    return { tool: name, ok: false, items: [], summary: `${name}: ${msg}`, error: { kind: 'upstream', message: msg } };
  }
}

function badInput(name: string, message: string): ToolResult {
  return { tool: name, ok: false, items: [], summary: `Invalid args for ${name}: ${message}`, error: { kind: 'bad_input', message } };
}

function finalize(
  name: string,
  items: EvidenceItem[],
  error: { kind: 'rate_limit' | 'timeout' | 'upstream' | 'empty'; message: string } | undefined,
  ctx: ExecCtx,
  rawArgs: Record<string, unknown>,
): ToolResult {
  const capped = items.slice(0, 10);
  const { added, duplicates } = ctx.store.addAll(capped);
  if (name !== 'fetch_page' && capped.length) cacheSet(name, rawArgs, capped);
  const inRange = capped.filter(i => i.freshness === 'in_range').length;
  const shown = capped.slice(0, LIMITS.maxItemsToModelPerCall);
  if (error?.kind === 'rate_limit') {
    return { tool: name, ok: false, items: shown, summary: `${name}: rate-limited (${error.message}).`, error: { kind: 'rate_limit', message: error.message } };
  }
  if (error?.kind === 'empty' || !capped.length) {
    return { tool: name, ok: true, items: [], summary: `${name}: 0 results (empty).`, error: { kind: 'empty', message: error?.message ?? 'Empty.' } };
  }
  return { tool: name, ok: true, items: shown, summary: `${capped.length} results, ${added} new, ${duplicates} duplicates, ${inRange} in date range.` };
}

export function validateToolCall(req: ToolCallRequest): { ok: boolean; message?: string } {
  const known = ['web_search', 'news_search', 'instagram_search', 'fetch_page', 'search_prior_analyses'];
  if (!known.includes(req.name)) return { ok: false, message: `Unknown tool ${req.name}` };
  return { ok: true };
}
