export const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 30 * 60 * 1000);

export function cacheKey(entity: string, platforms: string[], range: string): string {
  return `${entity.trim().toLowerCase()}|${[...platforms].sort().join(',')}|${range}`;
}
