import { NextRequest, NextResponse } from 'next/server';
import { collectNormalizedData } from '@/lib/collect/collector';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entity = searchParams.get('entity') ?? '';
  if (!entity) return NextResponse.json({ error: 'entity required' }, { status: 400 });
  const platforms = (searchParams.get('platforms') ?? searchParams.get('platform') ?? '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const range = (searchParams.get('range') as any) ?? '7d';
  try {
    const r = await collectNormalizedData({ entity, platforms, range: range as any });
    return NextResponse.json(r, { status: 200 });
  } catch (e:any) { return NextResponse.json({ error: e?.message ?? 'Social fetch failed' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const j = await req.json().catch(()=>({}));
  const entity = j.entity ?? '';
  if (!entity) return NextResponse.json({ error: 'entity required' }, { status: 400 });
  const platforms: string[] = Array.isArray(j.platforms) ? j.platforms : j.platform ? [j.platform] : [];
  const range = j.range ?? '7d';
  try {
    const r = await collectNormalizedData({ entity, platforms: platforms.map(p=>String(p).toLowerCase()), range: range as any });
    return NextResponse.json(r, { status: 200 });
  } catch (e:any) { return NextResponse.json({ error: e?.message ?? 'Social fetch failed' }, { status: 500 }); }
}
