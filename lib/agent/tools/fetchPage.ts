import { z } from 'zod';
import { LIMITS } from '../limits';
import type { EvidenceItem } from '../types';
import { hostOf } from './normalize';

export const fetchPageSchema = z.object({
  url: z.string().url().max(500),
  reason: z.string().min(5).max(300),
});

export type FetchPageArgs = z.infer<typeof fetchPageSchema>;

function isBlockedUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return 'Invalid URL.'; }
  if (!['http:', 'https:'].includes(u.protocol)) return 'Only http(s) URLs allowed.';
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return 'Internal hosts blocked.';
  // Block private IPv4 ranges + link-local.
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [parseInt(v4[1]), parseInt(v4[2])];
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return 'Private IP blocked.';
  }
  if (host.includes('instagram.com') || host.includes('x.com') || host === 'twitter.com') return 'Social pages that block scraping are not fetched; use snippet evidence.';
  return null;
}

function extractMainText(html: string): string {
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  t = t.replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  return t.replace(/&(nbsp|amp|lt|gt|quot);/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function execFetchPage(
  args: FetchPageArgs,
  ctx: { inStore: (url: string) => EvidenceItem | null; timeoutMs?: number },
): Promise<{ item: EvidenceItem | null; error?: { kind: 'bad_input' | 'upstream' | 'timeout'; message: string } }> {
  const blocked = isBlockedUrl(args.url);
  if (blocked) return { item: null, error: { kind: 'bad_input', message: blocked } };
  const src = ctx.inStore(args.url);
  if (!src) return { item: null, error: { kind: 'bad_input', message: 'URL not in EvidenceStore; fetch_page only reads URLs already found by search.' } };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ctx.timeoutMs ?? LIMITS.fetchPageTimeoutMs);
  try {
    const res = await fetch(args.url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'TrubetixAgent/1.0' } });
    if (!res.ok) return { item: null, error: { kind: 'upstream', message: `Fetch failed (${res.status}). Keeping snippet-level evidence.` } };
    const ct = res.headers.get('content-type') ?? '';
    if (ct && !/text\/html/i.test(ct)) return { item: null, error: { kind: 'upstream', message: `Non-HTML content (${ct}). Keeping snippet-level evidence.` } };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 1500000) return { item: null, error: { kind: 'upstream', message: 'Page too large. Keeping snippet-level evidence.' } };
    const html = new TextDecoder().decode(buf);
    const text = extractMainText(html).slice(0, LIMITS.maxFetchPageChars);
    if (!text) return { item: null, error: { kind: 'upstream', message: 'No readable text extracted. Keeping snippet-level evidence.' } };
    return { item: { ...src, snippet: text, tool: 'fetch_page', query: args.reason, retrievedAt: new Date().toISOString(), source: hostOf(args.url) || src.source } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fetch failed';
    const kind = /abort/i.test(msg) ? 'timeout' : 'upstream';
    return { item: null, error: { kind: kind as 'timeout', message: `${msg}. Keeping snippet-level evidence.` } };
  } finally {
    clearTimeout(timer);
  }
}

export const fetchPageDecl = {
  name: 'fetch_page',
  description: 'Read the main text of one URL already in evidence when a snippet is insufficient (high-impact claim or contradiction). Max twice per request. Never for Instagram/X.',
  parameters: { type: 'object', properties: { url: { type: 'string' }, reason: { type: 'string' } }, required: ['url', 'reason'] },
};
