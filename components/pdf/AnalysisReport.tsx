'use client';
import { Document, Page, Text, View, StyleSheet, Link } from '@react-pdf/renderer';
import { ScoreResult, Analysis } from '@/lib/types';

const PURPLE = '#7C3AED';
const INK = '#111827';
const MUTED = '#6b7280';
const LIGHT = '#f9fafb';
const BORDER = '#e5e7eb';

const s = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 44,
    paddingLeft: 48,
    paddingRight: 48,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: INK,
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: `1 solid ${BORDER}`,
    paddingBottom: 8,
    marginBottom: 18,
  },
  brand: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: 0.6, textTransform: 'uppercase' as any },
  headerMeta: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  headerRight: { fontSize: 7, color: MUTED, textAlign: 'right' as const, marginTop: 1 },
  coverTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: INK, lineHeight: 1.1, letterSpacing: -0.5 },
  coverCategory: { fontSize: 8.5, color: MUTED, marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase' as any },
  summary: { fontSize: 10.5, color: '#1f2937', lineHeight: 1.6, marginTop: 10 },
  bio: { fontSize: 8.5, color: MUTED, lineHeight: 1.5, marginTop: 8, fontFamily: 'Helvetica-Oblique' },
  scoreRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
    paddingTop: 12,
    borderTop: `1 solid ${BORDER}`,
  },
  scoreMain: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreNum: { fontSize: 22, fontFamily: 'Helvetica-Bold', lineHeight: 1 },
  scoreLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' as any, letterSpacing: 0.5 },
  scoreMeta: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  metricGrid: { flexDirection: 'row', gap: 16, marginTop: 12, marginBottom: 8 },
  metricLabel: { fontSize: 7, color: MUTED, letterSpacing: 0.5, textTransform: 'uppercase' as any, fontFamily: 'Helvetica-Bold' },
  metricValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 2 },
  metricSub: { fontSize: 7, color: MUTED, marginTop: 1 },
  h1: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 22, marginBottom: 6, letterSpacing: -0.3, lineHeight: 1.2 },
  h2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 18, marginBottom: 6, lineHeight: 1.25 },
  h3: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#1f2937', marginTop: 12, marginBottom: 4 },
  divider: { height: 1, backgroundColor: BORDER, marginTop: 2, marginBottom: 8 },
  para: { fontSize: 10.5, color: '#1f2937', lineHeight: 1.65, marginBottom: 7 },
  small: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },
  bulletRow: { flexDirection: 'row', gap: 7, marginBottom: 4, paddingLeft: 2 },
  bulletDot: { width: 10, fontSize: 10.5, lineHeight: 1.65, color: MUTED, textAlign: 'center' as const },
  bulletText: { flex: 1, fontSize: 10.5, color: '#1f2937', lineHeight: 1.6 },
  kvRow: { flexDirection: 'row', gap: 12, marginBottom: 5 },
  kvKey: { width: 96, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.4, textTransform: 'uppercase' as any, paddingTop: 1.5 },
  kvVal: { flex: 1, fontSize: 9.5, color: INK, lineHeight: 1.5 },
  kvValMuted: { fontSize: 9.5, color: '#1f2937', lineHeight: 1.5 },
  tableWrap: { marginTop: 8, marginBottom: 10, border: `1 solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' as any },
  tableHead: { flexDirection: 'row', backgroundColor: LIGHT, borderBottom: `1 solid ${BORDER}`, paddingVertical: 6, paddingHorizontal: 8, gap: 8, alignItems: 'center' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.4, textTransform: 'uppercase' as any },
  tr: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, gap: 8, alignItems: 'flex-start', borderBottom: `1 solid #f3f4f6`, minHeight: 28 },
  trAlt: { backgroundColor: '#fcfcfd' },
  tdTitle: { fontSize: 9, color: INK, lineHeight: 1.45 },
  tdMeta: { fontSize: 7, color: MUTED, marginTop: 3, lineHeight: 1.35 },
  tdSmall: { fontSize: 8.5, color: MUTED, textAlign: 'center' as const },
  tdSmallLeft: { fontSize: 8.5, color: MUTED, textAlign: 'left' as const },
  tdBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3, textTransform: 'uppercase' as any, paddingVertical: 2, paddingHorizontal: 5, borderRadius: 3, textAlign: 'center' as const },
  link: { color: '#4f46e5', textDecoration: 'none' as any },
  linkSubtle: { color: INK, textDecoration: 'none' as any },
  footer: {
    position: 'absolute' as any,
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1 solid ${BORDER}`,
    paddingTop: 6,
    fontSize: 7,
    color: MUTED,
  },
  sectionWrap: { marginBottom: 2 },
  keepTogether: {},
  pos: { color: '#15803d' },
  neg: { color: '#dc2626' },
  neu: { color: MUTED },
});

function lc(l: string) {
  switch (l) {
    case 'Excellent': return '#15803d';
    case 'Good': return '#16a34a';
    case 'Mixed': return '#a16207';
    case 'Poor': return '#ea580c';
    case 'Crisis': return '#dc2626';
    default: return MUTED;
  }
}
const brk = (u: string) => u.replace(/\//g, '/\u200B').replace(/-/g, '-\u200B').replace(/\./g, '.\u200B');

function parseInline(text: string): any[] {
  if (!text) return [];
  const parts: any[] = [];
  const re = /(\*\*\*.*?\*\*\*)|(\*\*.*?\*\*)|(\*.*?\*)|(\[.*?\]\(.*?\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index), s: {} });
    const tok = m[0];
    if (tok.startsWith('***')) parts.push({ t: tok.slice(3, -3), s: { bold: true, italic: true } });
    else if (tok.startsWith('**')) parts.push({ t: tok.slice(2, -2), s: { bold: true } });
    else if (tok.startsWith('*')) parts.push({ t: tok.slice(1, -1), s: { italic: true } });
    else if (tok.startsWith('[')) {
      const lm = tok.match(/\[(.*?)\]\((.*?)\)/);
      if (lm) parts.push({ t: lm[1], s: { link: lm[2] } });
      else parts.push({ t: tok, s: {} });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push({ t: text.slice(last), s: {} });
  return parts;
}

const Inline = ({ text, style }: any) => {
  const segs = parseInline(text);
  return (
    <Text style={style}>
      {segs.map((seg, i) => {
        if (seg.s.link) return <Link key={i} src={seg.s.link} style={s.link}>{seg.t}</Link>;
        if (seg.s.bold && seg.s.italic) return <Text key={i} style={{ fontFamily: 'Helvetica-BoldOblique' }}>{seg.t}</Text>;
        if (seg.s.bold) return <Text key={i} style={{ fontFamily: 'Helvetica-Bold' }}>{seg.t}</Text>;
        if (seg.s.italic) return <Text key={i} style={{ fontFamily: 'Helvetica-Oblique' }}>{seg.t}</Text>;
        return <Text key={i}>{seg.t}</Text>;
      })}
    </Text>
  );
};

const Para = ({ children }: any) => {
  if (!children || String(children).trim() === '') return null;
  const raw = String(children);
  const paragraphs = raw.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <>
      {paragraphs.map((p, i) => {
        const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines.every((l) => l.startsWith('- ') || l.startsWith('• ') || l.startsWith('› '))) {
          return (
            <View key={i} style={{ marginBottom: 6 }}>
              {lines.map((l, j) => (
                <View key={j} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <View style={{ flex: 1 }}>
                    <Inline text={l.replace(/^[-•›]\s*/, '')} style={s.bulletText} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        const inlineText = lines.join(' ');
        return (
          <View key={i} style={{ marginBottom: 7 }}>
            <Inline text={inlineText} style={s.para} />
          </View>
        );
      })}
    </>
  );
};

const Section = ({ title, subtitle, children }: any) => (
  <View style={s.sectionWrap} wrap={false}>
    <Text style={s.h1}>{title}</Text>
    {subtitle ? <Text style={s.small}>{subtitle}</Text> : null}
    <View style={s.divider} />
    <View>{children}</View>
  </View>
);

const Sub = ({ title, children }: any) => (
  <View wrap={false} style={{ marginBottom: 2 }}>
    <Text style={s.h2}>{title}</Text>
    {children}
  </View>
);

const Bullet = ({ children, icon = '•' }: any) => {
  if (!children || String(children).trim() === '') return null;
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Inline text={String(children)} style={s.bulletText} />
      </View>
    </View>
  );
};

export function AnalysisReport({ entity, result, range, pageCount, analysisObj }: { entity: string; result?: ScoreResult; range: string; pageCount: number; analysisObj?: Analysis }) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const rl = range === '1d' ? '24 Hours' : range === '7d' ? '7 Days' : range === '15d' ? '15 Days' : range === '30d' ? '30 Days' : range;
  const eff: ScoreResult | null = result ?? (analysisObj ? ({
    compositeScore: analysisObj.prHealth?.score ?? 50,
    label: (analysisObj.prHealth?.label ?? 'Mixed') as any,
    breakdown: { sentimentScore: analysisObj.prHealth?.drivers.sentiment ?? 50, volumeScore: analysisObj.prHealth?.drivers.visibility ?? 50, trendScore: analysisObj.prHealth?.drivers.momentum ?? 50, authorityWeight: analysisObj.prHealth?.drivers.engagement ?? 50 },
    topMentions: analysisObj.topMentions,
    analysis: { executiveSummary: analysisObj.overview, sentimentNarrative: analysisObj.dataQuality.limitations.join(' '), keyThemes: analysisObj.narratives.map(n=>n.name), risks: analysisObj.risks, opportunities: [], recommendations: analysisObj.recommendations, timelineInsights: '', sourceAnalysis: '' },
    dossier: undefined,
    stats: { positive: analysisObj.metrics.sentimentCounts.positive, negative: analysisObj.metrics.sentimentCounts.negative, neutral: analysisObj.metrics.sentimentCounts.neutral, tier1: 0, tier2: 0, tier3: 0, total: analysisObj.metrics.indexedCount },
  } as ScoreResult) : null);
  if (!eff) return null as any;
  const r = eff;
  const a = r.analysis;
  const d = r.dossier;
  const st = r.stats;
  const analysisMeta = analysisObj;

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View style={s.header} fixed>
          <View>
            <Text style={s.brand}>TRUBETIX</Text>
            <Text style={s.headerMeta}>PR Intelligence Report • {rl} • {now}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.headerRight}>trubetix.ai</Text>
            <Text style={s.headerRight}>Confidential</Text>
          </View>
        </View>

        <View style={{ marginBottom: 2 }}>
          <Text style={s.coverCategory}>{d?.identity.category ?? 'Entity Profile'} • {st?.total ?? r.topMentions.length} signals • {rl}</Text>
          <Text style={s.coverTitle}>{d?.identity.displayName ?? entity}</Text>
          {d?.identity.aliases?.length ? <Text style={[s.small, { marginTop: 4 }]}>Also known as — {d.identity.aliases.join(' • ')}</Text> : null}
          <View style={{ marginTop: 10 }}>
            <Para>{a?.executiveSummary ?? d?.mediaSentiment.narrative ?? `PR health is ${r.label} at ${r.compositeScore}/100 over ${rl}. This briefing synthesizes media quality, sentiment, share of voice and social signals into a concise, evidence-linked assessment.`}</Para>
          </View>
          {d?.identity.bio ? (
            <View style={{ marginTop: 4, paddingLeft: 10, borderLeft: `2 solid ${BORDER}` }}>
              <Inline text={d.identity.bio} style={s.bio} />
            </View>
          ) : null}
        </View>

        <View style={s.scoreRow}>
          <View style={{ flex: 1 }}>
            <View style={s.scoreMain}>
              <Text style={[s.scoreNum, { color: lc(r.label) }]}>{r.compositeScore}</Text>
              <Text style={[s.scoreLabel, { color: lc(r.label) }]}>{r.label}</Text>
              <Text style={s.scoreMeta}>/ 100 • {rl}</Text>
            </View>
            <Text style={[s.small, { marginTop: 4 }]}>Composite — weighted sentiment 40% • volume 20% • trend 20% • authority 20%</Text>
          </View>
          <View style={{ width: 108, alignItems: 'flex-end' }}>
            <Text style={[s.small, { fontFamily: 'Helvetica-Bold', color: INK }]}>Overall Health</Text>
            <View style={{ width: 108, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
              <View style={{ width: `${r.compositeScore}%`, height: 4, backgroundColor: lc(r.label) }} />
            </View>
          </View>
        </View>

        <View style={s.metricGrid}>
          {[
            { k: 'Sentiment', v: r.breakdown.sentimentScore, sub: 'weighted' },
            { k: 'Volume', v: r.breakdown.volumeScore, sub: `vs baseline` },
            { k: 'Trend', v: r.breakdown.trendScore, sub: 'momentum' },
            { k: 'Authority', v: r.breakdown.authorityWeight, sub: 'tier mix' },
          ].map((m) => (
            <View key={m.k} style={{ flex: 1 }}>
              <Text style={s.metricLabel}>{m.k}</Text>
              <Text style={s.metricValue}>{m.v}</Text>
              <Text style={s.metricSub}>{m.sub}</Text>
            </View>
          ))}
        </View>
        {st ? (
          <Text style={[s.small, { marginTop: 2 }]}>
            Tier mix: {st.tier1} T1 • {st.tier2} T2 • {st.tier3} T3 • Signals: {st.positive} pos / {st.negative} neg / {st.neutral} neu
            {d?.mediaQuality ? ` • ${d.mediaQuality.slice(0, 120)}` : a?.sourceAnalysis ? ` • ${a.sourceAnalysis.slice(0, 120)}` : ''}
          </Text>
        ) : null}

        <Section title="Identity & Official Presence" subtitle="Verified profiles and search footprint">
          {d ? (
            <View>
              <View style={s.kvRow}>
                <Text style={s.kvKey}>Primary</Text>
                <View style={{ flex: 1 }}><Inline text={`${d.identity.displayName} — ${d.identity.category}`} style={s.kvVal} /></View>
              </View>
              {d.identity.aliases?.length ? (
                <View style={s.kvRow}>
                  <Text style={s.kvKey}>Aliases</Text>
                  <View style={{ flex: 1 }}><Text style={s.kvValMuted}>{d.identity.aliases.join(' • ')}</Text></View>
                </View>
              ) : null}
              {d.officialProfiles?.length ? (
                <View style={{ marginTop: 6 }}>
                  {d.officialProfiles.map((p, i) => (
                    <View key={i} style={s.kvRow}>
                      <Text style={s.kvKey}>{p.platform}</Text>
                      <View style={{ flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' as any }}>
                        <Link src={p.url} style={[s.kvVal, s.link]}>{p.handle}{p.verified ? '  ✓' : ''}</Link>
                        {p.followers ? <Text style={[s.small, { marginTop: 1 }]}>• {p.followers}</Text> : null}
                        <Text style={[s.small, { color: MUTED }]}> {p.url}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.small}>No verified handles surfaced via search grounding for this window.</Text>
              )}
              <View style={{ marginTop: 10 }}>
                <Text style={s.h3}>Search presence</Text>
                <Para>{d.searchPresence.summary}</Para>
                <View style={s.kvRow}><Text style={s.kvKey}>Visibility</Text><View style={{ flex: 1 }}><Inline text={d.searchPresence.visibility} style={s.kvValMuted} /></View></View>
                <View style={s.kvRow}><Text style={s.kvKey}>Results</Text><Text style={s.kvValMuted}>{d.searchPresence.resultCount}</Text></View>
                <Text style={[s.h3, { marginTop: 10 }]}>Page-one reputation</Text>
                <Para>{d.searchReputation}</Para>
              </View>
            </View>
          ) : (
            <Para>Profiles and search presence evaluated via Gemini site-restricted search. No dossier object was generated for this run — see coverage sample and mentions for raw evidence.</Para>
          )}
        </Section>

        <Section title="Media Intelligence" subtitle="Quality, sentiment and share of voice">
          <Sub title="Media quality">
            <Para>{d?.mediaQuality ?? a?.sourceAnalysis ?? 'Media quality assessment via grounded headlines and authority weighting.'}</Para>
          </Sub>
          <Sub title="Sentiment">
            <Para>{d?.mediaSentiment.distribution ?? ''}</Para>
            <Para>{d?.mediaSentiment.narrative ?? a?.sentimentNarrative ?? 'Sentiment narrative synthesizes tier-weighted headline classifications.'}</Para>
          </Sub>
          <Sub title="Share of voice">
            <Para>{d?.mediaSOV.volumeNote ?? `Volume score ${r.breakdown.volumeScore}/100 versus baseline (1d:5 • 7d:20 • 15d:35 • 30d:50).`}</Para>
            {d?.mediaSOV.estimatedSOV ? (
              <View style={s.kvRow}><Text style={s.kvKey}>Est. SOV</Text><View style={{ flex: 1 }}><Inline text={d.mediaSOV.estimatedSOV} style={s.kvValMuted} /></View></View>
            ) : null}
          </Sub>
          <Sub title="Coverage sample">
            <View style={s.tableWrap}>
              <View style={s.tableHead}>
                <Text style={[s.th, { width: 16 }]}>#</Text>
                <Text style={[s.th, { flex: 1 }]}>Headline — Source</Text>
                <Text style={[s.th, { width: 52, textAlign: 'center' as const }]}>Sentiment</Text>
                <Text style={[s.th, { width: 36, textAlign: 'center' as const }]}>Tier</Text>
                <Text style={[s.th, { width: 56, textAlign: 'right' as const }]}>Date</Text>
              </View>
              {r.topMentions.slice(0, 8).map((m, i) => (
                <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]} wrap>
                  <Text style={[s.tdSmallLeft, { width: 16, paddingTop: 1 }]}>{i + 1}</Text>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 6, flexDirection: 'column' as any }}>
                    <Link src={m.url} style={[s.tdTitle, s.linkSubtle]}>{m.title}</Link>
                    <Text style={s.tdMeta}>{m.source} • {brk(m.url)}</Text>
                  </View>
                  <View style={{ width: 52, alignItems: 'flex-start', paddingTop: 1 }}>
                    <Text style={[s.tdBadge, m.sentiment === 'positive' ? { backgroundColor: '#dcfce7', color: '#15803d' } : m.sentiment === 'negative' ? { backgroundColor: '#fee2e2', color: '#dc2626' } : { backgroundColor: '#f3f4f6', color: MUTED }]}>{m.sentiment}</Text>
                  </View>
                  <Text style={[s.tdSmall, { width: 36, paddingTop: 1 }]}>{m.sourceAuthority ?? '—'}</Text>
                  <Text style={[s.tdSmall, { width: 56, textAlign: 'right' as const, paddingTop: 1 }]}>{new Date(m.publishedAt).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
            {r.topMentions.length > 8 ? <Text style={s.small}>{r.topMentions.length - 8} additional mentions in evidence section.</Text> : null}
          </Sub>
        </Section>

        <Section title="Narratives & Momentum" subtitle="Topics, narratives and timeline">
          {d ? (
            <View>
              <Text style={s.h3}>Top topics</Text>
              {d.topTopics.map((t, i) => (
                <Bullet key={i}>{t}</Bullet>
              ))}
              <Text style={s.h3}>Key narratives</Text>
              {d.topNarratives.map((n, i) => (
                <Bullet key={i} icon="›">{n}</Bullet>
              ))}
              {d.narrativeMomentum ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={s.h3}>Momentum</Text>
                  <Para>{d.narrativeMomentum}</Para>
                </View>
              ) : null}
              {a?.timelineInsights ? (
                <View style={{ marginTop: 6 }}>
                  <Text style={s.h3}>Timeline insight • {rl}</Text>
                  <Para>{a.timelineInsights}</Para>
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              {a?.keyThemes?.length ? <View><Text style={s.h3}>Key themes</Text>{a.keyThemes.map((t, i) => <Bullet key={i}>{t}</Bullet>)}</View> : null}
              <Para>{a?.timelineInsights ?? 'Narrative and topic extraction via grounded analysis.'}</Para>
            </View>
          )}
        </Section>

        <Section title="Social & Audience" subtitle="Handles, sentiment and audience signals">
          {d?.socialProfiles?.length ? (
            <View>
              <Text style={s.h3}>Social profiles</Text>
              {d.socialProfiles.map((p, i) => (
                <View key={i} style={s.kvRow}>
                  <Text style={s.kvKey}>{p.platform}</Text>
                  <View style={{ flex: 1 }}>
                    <Link src={p.url} style={s.link}>{p.handle}</Link>
                    <Text style={[s.small, { marginTop: 1 }]}>{p.metrics}</Text>
                    <Text style={[s.small, { color: MUTED }]}>{p.url}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.small}>No verified social handles surfaced for this window.</Text>
          )}
          <View style={{ marginTop: 8 }}>
            <Text style={s.h3}>Social sentiment</Text>
            <Para>{d?.socialSentiment ?? 'Synthesized from webMentions adapter (site: x.com, reddit.com, instagram.com, youtube.com, linkedin.com).'}</Para>
          </View>
          {d?.audienceSignals?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={s.h3}>Audience signals</Text>
              {d.audienceSignals.map((a, i) => <Bullet key={i}>{a}</Bullet>)}
            </View>
          ) : null}
          {d?.keyMessages?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={s.h3}>Key messages • Pull-through</Text>
              {d.keyMessages.map((k, i) => <Bullet key={i} icon={`${i + 1}.`}>{k}</Bullet>)}
              {d.messagePullThrough ? <View style={{ marginTop: 6 }}><Para>{d.messagePullThrough}</Para></View> : null}
            </View>
          ) : null}
        </Section>

        <Section title="Actors & Benchmark" subtitle="Journalists, influencers and peers">
          {d?.topJournalists?.length || d?.topInfluencers?.length ? (
            <View>
              {d.topJournalists?.length ? (
                <View>
                  <Text style={s.h3}>Journalists</Text>
                  {d.topJournalists.map((j, i) => <Bullet key={i}>{j.name} — {j.outlet}</Bullet>)}
                </View>
              ) : null}
              {d.topInfluencers?.length ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={s.h3}>Influencers</Text>
                  {d.topInfluencers.map((inf, i) => <Bullet key={i}>{inf.name} ({inf.platform}) — {inf.note}</Bullet>)}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={s.small}>No distinct journalist or influencer clusters identified in this window.</Text>
          )}
          {d?.competitorBenchmark?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={s.h3}>Benchmark</Text>
              {d.competitorBenchmark.map((c, i) => <Bullet key={i}>{c.name} — {c.note}</Bullet>)}
            </View>
          ) : null}
          {d?.aiVisibility ? (
            <View style={{ marginTop: 8 }}>
              <Text style={s.h3}>AI visibility</Text>
              <Para>{d.aiVisibility}</Para>
            </View>
          ) : null}
        </Section>

        <Section title="Risk & Opportunity" subtitle="Risks, timeline, gaps and opportunities">
          {d?.reputationRisks?.length || a?.risks?.length ? (
            <View>
              <Text style={s.h3}>Reputation risks</Text>
              {(d?.reputationRisks ?? a?.risks ?? []).map((r, i) => <Bullet key={i} icon="⚠">{r}</Bullet>)}
            </View>
          ) : null}
          {d?.crisisTimeline?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={s.h3}>Crisis timeline</Text>
              {d.crisisTimeline.map((c, i) => (
                <View key={i} style={s.kvRow} wrap={false}>
                  <Text style={[s.kvKey, { width: 110 }]}>{c.date} • {c.sentiment}</Text>
                  <View style={{ flex: 1 }}><Inline text={c.event} style={s.kvValMuted} /></View>
                </View>
              ))}
            </View>
          ) : null}
          {d?.reputationGaps?.length ? (
            <View style={{ marginTop: 8 }}>
              <Text style={s.h3}>Reputation gaps</Text>
              {d.reputationGaps.map((g, i) => <Bullet key={i}>{g}</Bullet>)}
            </View>
          ) : null}
          <View style={{ marginTop: 8 }}>
            <Text style={s.h3}>Opportunities</Text>
            {(d?.prOpportunities ?? a?.opportunities ?? []).map((o, i) => <Bullet key={i} icon="↗">{o}</Bullet>)}
          </View>
        </Section>

        <Section title="Strategy & Measurement" subtitle="Recommendations and KPI framework">
          <Text style={s.h3}>Strategic recommendations</Text>
          {(d?.strategicRecommendations ?? a?.recommendations ?? []).map((r, i) => <Bullet key={i} icon={`${i + 1}.`}>{r}</Bullet>)}
          {d?.measurementKPI?.length ? (
            <View style={{ marginTop: 10 }}>
              <Text style={s.h3}>Measurement framework</Text>
              <View style={s.tableWrap}>
                <View style={s.tableHead}>
                  <Text style={[s.th, { flex: 1 }]}>KPI</Text>
                  <Text style={[s.th, { flex: 1 }]}>Target</Text>
                  <Text style={[s.th, { width: 70, textAlign: 'center' as const }]}>Cadence</Text>
                </View>
                {d.measurementKPI.map((k, i) => (
                  <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]} wrap={false}>
                    <View style={{ flex: 1, paddingRight: 6 }}><Inline text={k.kpi} style={[s.tdTitle, { fontSize: 9 }]} /></View>
                    <View style={{ flex: 1, paddingRight: 6 }}><Inline text={k.target} style={s.tdTitle} /></View>
                    <Text style={[s.tdSmall, { width: 70 }]}>{k.cadence}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ marginTop: 14, padding: 10, backgroundColor: LIGHT, borderRadius: 4, border: `1 solid ${BORDER}` }}>
            <Text style={[s.small, { fontFamily: 'Helvetica-Bold', color: INK, fontSize: 8 }]}>Methodology</Text>
            <Text style={[s.small, { marginTop: 4 }]}>Score = 0.4·sentiment + 0.2·volume + 0.2·trend + 0.2·authority. Sentiment is tier-weighted (T1×3, T2×2, T3×1). Volume versus baseline 1d:5 · 7d:20 · 15d:35 · 30d:50. Sources via GNews + Google Search grounding. No scraping. Every mention Zod-validated; one malformed mention is dropped, never fails the pipeline.</Text>
            <Text style={[s.small, { marginTop: 6, fontFamily: 'Helvetica-Oblique' }]}>Disclaimer: Automated briefing generated from web signals; not professional advice. Verify critical claims before external publication.</Text>
          </View>
        </Section>

        <Section title="Evidence — Sources" subtitle={`${r.topMentions.length} records • all URLs validated and clickable`}>
          <View style={s.tableWrap}>
            <View style={s.tableHead}>
              <Text style={[s.th, { width: 16 }]}>#</Text>
              <Text style={[s.th, { flex: 1 }]}>Headline — Source</Text>
              <Text style={[s.th, { width: 52, textAlign: 'center' as const }]}>Sentiment</Text>
              <Text style={[s.th, { width: 36, textAlign: 'center' as const }]}>Tier</Text>
              <Text style={[s.th, { width: 56, textAlign: 'right' as const }]}>Date</Text>
            </View>
            {r.topMentions.map((m, i) => (
              <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]} wrap>
                <Text style={[s.tdSmallLeft, { width: 16, paddingTop: 1 }]}>{i + 1}</Text>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 6, flexDirection: 'column' as any }}>
                  <Link src={m.url} style={[s.tdTitle, s.linkSubtle]}>{m.title}</Link>
                  <Text style={s.tdMeta}>{m.source} • {brk(m.url)}</Text>
                </View>
                <View style={{ width: 52, alignItems: 'flex-start', paddingTop: 1 }}>
                  <Text style={[s.tdBadge, m.sentiment === 'positive' ? { backgroundColor: '#dcfce7', color: '#15803d' } : m.sentiment === 'negative' ? { backgroundColor: '#fee2e2', color: '#dc2626' } : { backgroundColor: '#f3f4f6', color: MUTED }]}>{m.sentiment ?? 'neutral'}</Text>
                </View>
                <Text style={[s.tdSmall, { width: 36, paddingTop: 1 }]}>{m.sourceAuthority ?? '—'}</Text>
                <Text style={[s.tdSmall, { width: 56, textAlign: 'right' as const, paddingTop: 1 }]}>{new Date(m.publishedAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
          {r.topMentions.length === 0 ? <Text style={s.small}>No mentions surfaced for this range. Try a broader window (7d or 30d).</Text> : null}
        </Section>

        <View style={s.footer} fixed>
          <Text>Trubetix • Gemini Search grounding + GNews • No scraping • Zod-validated</Text>
          <Text render={({ pageNumber, totalPages }: any) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
