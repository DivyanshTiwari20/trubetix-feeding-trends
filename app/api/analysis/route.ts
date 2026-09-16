import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { collectNormalizedData } from '@/lib/collect/collector';
import { buildAnalysis } from '@/lib/services/buildAnalysis';

const schema = z.object({ entity: z.string().min(1).max(120), platforms: z.array(z.string()).optional(), platform: z.string().optional(), range: z.enum(['1d','7d','15d','30d']).optional() });

function toPlatforms(j:any): string[] {
  if (Array.isArray(j.platforms)) return j.platforms.map((p:string)=>p.toLowerCase());
  if (typeof j.platform==='string' && j.platform.trim()) return j.platform.toLowerCase().split(',').map((s:string)=>s.trim()).filter(Boolean);
  return [];
}

export async function POST(req: NextRequest){
  const j = await req.json().catch(()=>({}));
  const p = schema.safeParse(j);
  if (!p.success) return NextResponse.json({ error:'Invalid input', details: p.error.flatten() }, { status:400 });
  const platforms = toPlatforms(j);
  const range = (p.data.range ?? '7d') as '1d'|'7d'|'15d'|'30d';
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get('view') ?? j.view;
    if (view==='collect') {
      const r = await collectNormalizedData({ entity: p.data.entity, platforms, range });
      return NextResponse.json(r);
    }
    const analysis = await buildAnalysis(p.data.entity, range, platforms);
    return NextResponse.json(analysis);
  } catch(e:any){ return NextResponse.json({ error:e?.message??'Analysis failed'},{status:500}); }
}

export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const entity = searchParams.get('entity') ?? '';
  if(!entity) return NextResponse.json({ error:'entity required'},{status:400});
  const platforms = (searchParams.get('platforms') ?? searchParams.get('platform') ?? '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  const range = (searchParams.get('range') as any) ?? '7d';
  const view = searchParams.get('view');
  try{
    if(view==='collect'){ const r=await collectNormalizedData({entity, platforms, range: range as any}); return NextResponse.json(r); }
    const analysis = await buildAnalysis(entity, range as any, platforms);
    return NextResponse.json(analysis);
  }catch(e:any){ return NextResponse.json({ error:e?.message??'Analysis failed'},{status:500}); }
}
