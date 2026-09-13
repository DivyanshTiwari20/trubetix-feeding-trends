import { google } from './google';
export const PRIMARY_MODEL = 'models/gemini-3.5-flash';
export const FALLBACK_MODELS = ['models/gemini-2.0-flash', 'models/gemini-1.5-flash', 'models/gemini-1.5-flash-8b'];
export function getModels() { return [PRIMARY_MODEL, ...FALLBACK_MODELS].map(m => google(m)); }
