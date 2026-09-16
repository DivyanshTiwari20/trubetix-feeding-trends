import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { collectNormalizedData } from '@/lib/collect/collector';

const schema = z.object({
  entity: z.string().min(1).max(120),
  platform: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  range: z.enum(['1d','7d','15d','30d']).optional(),
  handleHint: z.string().optional(),
});

function resolvePlatforms(body: any): string[] {
  if (Array.isArray(body.platforms) && body.platforms.length) return body.platforms.map((p:string)=>p.toLowerCase());
  if (typeof body.platform === 'string' && body.platform.trim()) {
    const v = body.platform.toLowerCase().trim();
    if (v==='all' || v==='overall' || v==='overall_pr') return ['all'];
    return [v];
  }
  return [];
}

export async function POST(req: NextRequest) {
  try {
    const j = await req.json();
    const parsed = schema.safeParse(j);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    const platforms = resolvePlatforms(j);
    const range = (parsed.data.range ?? '7d') as '1d'|'7d'|'15d'|'30d';
    const result = await collectNormalizedData({ entity: parsed.data.entity, platforms, range, handleHint: parsed.data.handleHint });
    return NextResponse.json(result, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'Collect failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entity = searchParams.get('entity') ?? '';
  if (!entity) return NextResponse.json({ error: 'entity query param required' }, { status: 400 });
  const platform = searchParams.get('platform') ?? searchParams.get('platforms') ?? '';
  const range = (searchParams.get('range') as any) ?? '7d';
  const platforms = platform ? platform.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [];
  try {
    const result = await collectNormalizedData({ entity, platforms, range: range as any });
    return NextResponse.json(result, { status: 200 });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? 'Collect failed' }, { status: 500 });
  }
}
