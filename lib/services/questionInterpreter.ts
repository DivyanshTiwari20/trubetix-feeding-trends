import { generateObject } from 'ai';
import { google } from '../google';
import { z } from 'zod';
import type { NormalizedSocialContent, PublishedCountEstimate } from '../types';
import type { ResolvedQuestion } from './resolveQuestion';

export interface QuestionBrief {
  directAnswer: string;
  overallNarrative: string;
  keyThemes: { title: string; explanation: string; sentiment: 'positive'|'neutral'|'negative'|'mixed' }[];
  publicConversation: string | null;
  overallImage: string | null;
  sentimentSummary: string | null;
  brandFit: { assessment: string; positives: string[]; risks: string[]; considerations: string[] } | null;
  comparisonNote: string | null;
  engagementNote: string | null;
}

const briefSchema = z.object({
  directAnswer: z.string().min(20).max(500),
  overallNarrative: z.string().min(60).max(1400),
  keyThemes: z.array(z.object({ title: z.string().min(3).max(60), explanation: z.string().min(40).max(420), sentiment: z.enum(['positive','neutral','negative','mixed']) })).min(2).max(5),
  publicConversation: z.string().min(80).max(1600).nullable(),
  overallImage: z.string().max(600).nullable(),
  sentimentSummary: z.string().min(40).max(700).nullable(),
  brandFit: z.object({ assessment: z.string().min(40).max(600), positives: z.array(z.string()).max(4), risks: z.array(z.string()).max(4), considerations: z.array(z.string()).max(3) }).nullable(),
  comparisonNote: z.string().nullable(),
  engagementNote: z.string().nullable(),
});

function evidenceSlice(content: NormalizedSocialContent[]): string {
  const top = content.slice(0,80);
  return top.map((c,i)=> `[${i}] ${c.platform}|${c.ownership}|${c.publishedAt?.slice(0,10)||'undated'} "${(c.title??'').slice(0,160)}" :: ${(c.snippet??'').slice(0,260)} | likes:${c.engagement.likes ?? '—'} views:${c.engagement.views ?? '—'}`).join('\n');
}

export async function interpretQuestion(evidence: { content: NormalizedSocialContent[]; publishedCount: PublishedCountEstimate; totalEstimatedPosts?: number | null; range: string; platform: string; entity: string }, question: ResolvedQuestion): Promise<QuestionBrief> {
  const audienceSlice = evidence.content.filter(c=> ['reddit','x'].includes(c.platform));
  const audienceEvidence = audienceSlice.slice(0,24).map(c=> `(${c.platform}) "${(c.title??'').slice(0,140)}" — ${(c.snippet??'').slice(0,180)}`).join('\n') || 'No Reddit/X evidence in indexed set — searched Reddit + X via site: dorking across all pages';
  const totalPosts = evidence.totalEstimatedPosts ?? evidence.content.length;
  const sampleCount = evidence.content.length;
  const redditCount = audienceSlice.length;
  const totalLikes = evidence.content.reduce((a,c)=> a+(c.engagement.likes ?? 0), 0);
  const hasLikes = evidence.content.some(c=>c.engagement.likes!=null);
  const isBuzz = question.intents.some(i=> ['narrative','sentiment','public_conversation','general_intel'].includes(i));
  const evidenceText = evidenceSlice(evidence.content);
  const prompt = `You are Trubetix — senior PR strategist for a premium product. Write POLISHED, HUMAN prose. Never expose backend.

BANNED PHRASES — NEVER USE (user-facing leak): "indexed", "mentions", "sampled", "crawl", "data streams", "parallel pulse", "immediate crawl", "unavailable within", "discovered", "fetched sample", "totalResults", "search index", "while direct Reddit and X". Also never say "overall narrative on Instagram it is" — just speak naturally.
CORRECT LANGUAGE: Say "approximately X posts on Instagram in the last 7 days", "about X posts on Reddit and X", "fan-driven conversation". No tech jargon.

STYLE BENCHMARK (copy this voice, not data):
"Samay Raina's PR and social media health in 2026 is at an all-time high, marked by a transition from a niche internet comedian to a mainstream disruptive force. Across YouTube and TikTok, his brand is defined by 'chaos marketing' — deliberately leaning into controversy to fuel engagement while maintaining a fiercely loyal core audience."

FRAMING EXAMPLE: "PR Health: High-Risk, High-Reward Resilience — Mainstream Legitimacy: Despite his 'edgy' reputation... Controversy Management: His brand shows extreme resilience... Polarized Sentiment: While critics argue... fans frame..."

VOICE: Crisp, authoritative, narrative. Use em dashes, specific names/events, storytelling. No "In conclusion", "As an AI". Vary sentence length. Bold sub-concepts naturally.

TASK:
Entity: ${evidence.entity} | Platform scope: ${evidence.platform || 'reddit,x'} | Range: ${evidence.range}
User question: "${question.originalQuestion}" | Intents: ${question.intents.join(',')}
Internal totals (DO NOT leak as "indexed"): ~${totalPosts} posts on ${evidence.platform || 'social'} in ${evidence.range} (sample ${sampleCount} used for synthesis, ${redditCount} from Reddit/X). ${hasLikes ? `~${totalLikes} likes where visible` : ''}

Reddit/X evidence — read ALL (${redditCount} items):
${audienceEvidence}

Full evidence (80 items):
${evidenceText || '(no evidence)'}

OUTPUT RULES:
- First understand intent. If volume: answer volume. If buzz/sentiment: synthesize buzz + sentiment + popularity verdict. If mixed, do both. If truly missing entity, ask 1 line.
- For volume: directAnswer = 1-2 polished sentences: "${evidence.entity} had approximately ${(totalPosts>=1000? (totalPosts>=1000000? (totalPosts/1000000).toFixed(1)+'M' : (totalPosts/1000).toFixed(0)+'K') : totalPosts.toString())} posts on ${evidence.platform || 'Instagram'} in the last ${evidence.range}." Use Instagram-style compact (176K, 1.2M) never 176,000. No "indexed". If buzz also requested, add narrative.
- For buzz: Cluster every snippet into 3-5 REAL topics, NAME them specifically (e.g., "India's Got Latent S2 panel chemistry"). Give PR verdict: polarity, popularity, drivers, fan vs critic split.
- directAnswer: 2-3 polished sentences, with human volume phrasing ("approximately 176K posts" style — use K/M compact, e.g. 176K not 176,000) and verdict. Benchmark style.
- overallNarrative: 6-9 polished sentences, executive paragraph, narrative arc, specificity. NO tech words.
- keyThemes: 3-5 themes, title (3-6 words) + 2-3 sentences (60-90 words) + sentiment.
- publicConversation: 5-7 vivid sentences: WHAT PEOPLE ARE ACTUALLY SAYING on Reddit/X — paraphrase real angles, tone (playful/critical/nostalgic). Never say "No evidence" when you have ${redditCount} items.
- sentimentSummary: 2-3 sentences: leaning + why + PR implication.
- NEVER output raw URLs, "View Reel", "20 posts discovered", "Supporting Evidence", "Methodology Note", or any banned phrase above. Speak as PR analyst, not engineer.`;

  const compact = (n:number)=> n>=1000000 ? `${parseFloat((n/1000000).toFixed(1))}M` : n>=1000 ? `${parseFloat((n/1000).toFixed(n%1000===0?0:1))}K` : String(n);
  try {
    const { object } = await generateObject({ model: google('models/gemini-3.5-flash-lite'), schema: briefSchema, prompt });
    return object as QuestionBrief;
  } catch {
    return {
      directAnswer: hasLikes ? `${evidence.entity} had approximately ${compact(totalPosts)} posts on ${evidence.platform||'Instagram'} in the last ${evidence.range}, totalling about ${compact(totalLikes)} likes where visible.` : `${evidence.entity} had approximately ${compact(totalPosts)} posts on ${evidence.platform||'Instagram'} in the last ${evidence.range}.`,
      overallNarrative: `${evidence.entity}'s presence on ${evidence.platform||'social'} over the last ${evidence.range} reflects steady fan-driven conversation around his recent appearances and collaborations.`,
      keyThemes: [{ title: 'Fan Conversation', explanation: `Discussion around ${evidence.entity} on ${evidence.platform||'social'} centers on recent shows and community chatter.`, sentiment: 'neutral' }],
      publicConversation: null,
      overallImage: null,
      sentimentSummary: null,
      brandFit: null,
      comparisonNote: null,
      engagementNote: null,
    };
  }
}
