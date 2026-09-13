export function isQuotaError(e: any): { hit: boolean; retryAfter: string } {
  const msg = e?.message ?? e?.responseBody ?? '';
  const txt = typeof msg === 'string' ? msg : JSON.stringify(msg);
  const hit = /quota|RESOURCE_EXHAUSTED|429/i.test(txt) || e?.statusCode === 429;
  const m = txt.match(/retry[^0-9]*([0-9]+)s/i);
  const retryAfter = m ? `${m[1]}s` : 'a few minutes';
  return { hit, retryAfter };
}
export function quotaMessage(retryAfter: string) {
  return `Gemini free quota hit (20 requests/day for gemini-3.5-flash). Retry in ${retryAfter} or upgrade at https://ai.dev/rate-limit. Your data is safe — try again shortly or use a smaller window.`;
}
