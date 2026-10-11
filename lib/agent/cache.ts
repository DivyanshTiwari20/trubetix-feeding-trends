// In-process LRU tool-result cache with per-tool TTLs (spec Phase 9 fallback).
// Key = tool + normalized args hash (lowercase entity/query, date range rounded to day).

import { createHash } from 'crypto';

const TTL: Record<string, number> = {
  news_search: 30 * 60 * 1000,
  web_search: 6 * 3600000,
  instagram_search: 6 * 3600000,
  fetch_page: 24 * 3600000,
};

function normArgs(args: Record<string, unknown>): string {
  const canon: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    canon[k] = typeof v === 'string' ? v.toLowerCase().trim() : v;
  }
  return JSON.stringify(canon);
}

export function cacheKeyFor(tool: string, args: Record<string, unknown>): string {
  return `${tool}:${createHash('sha256').update(normArgs(args)).digest('hex').slice(0, 24)}`;
}

interface Entry { value: unknown; expiresAt: number }

const store = new Map<string, Entry>();
const MAX_ENTRIES = 500;

export function cacheGet<T>(tool: string, args: Record<string, unknown>): T | null {
  if (tool === 'search_prior_analyses') return null; // DB read, never cached
  const k = cacheKeyFor(tool, args);
  const e = store.get(k);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { store.delete(k); return null; }
  return e.value as T;
}

export function cacheSet(tool: string, args: Record<string, unknown>, value: unknown): void {
  if (tool === 'search_prior_analyses') return;
  if (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(cacheKeyFor(tool, args), { value, expiresAt: Date.now() + (TTL[tool] ?? 3600000) });
}

export function clearAgentCache(): void { store.clear(); }
