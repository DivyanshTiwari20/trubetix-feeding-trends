import { CACHE_TTL_MS, cacheKey } from '../config/cache';
import type { Analysis } from '../types';

const store = new Map<string, { analysis: Analysis; at: number }>();

export function getCachedAnalysis(entity: string, platforms: string[], range: string): Analysis | null {
  const key = cacheKey(entity, platforms, range);
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { store.delete(key); return null; }
  if (hit.analysis.expiresAt && new Date(hit.analysis.expiresAt).getTime() < Date.now()) { store.delete(key); return null; }
  return hit.analysis;
}

export function setCachedAnalysis(analysis: Analysis): void {
  const key = cacheKey(analysis.entity, analysis.platforms, analysis.range);
  store.set(key, { analysis, at: Date.now() });
}

export function clearCache(): void { store.clear(); }
