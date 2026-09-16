'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';

const PLATFORMS = ['instagram','x','reddit','youtube','linkedin','news','all'] as const;
const RANGES = ['1d','7d','15d','30d'] as const;

export default function InspectPage(){
  const [entity,setEntity]=useState('Samay Raina');
  const [platform,setPlatform]=useState<string>('instagram');
  const [range,setRange]=useState<string>('7d');
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState<any>(null);
  const [err,setErr]=useState<string|null>(null);

  async function run(){
    setLoading(true); setErr(null);
    try{
      const r=await fetch('/api/collect',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ entity, platform, range })});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error ?? 'Failed');
      setData(j);
    }catch(e:any){ setErr(e.message); }
    finally{ setLoading(false);}
  }

  return (
    <div className="min-h-screen bg-[#F8F7FA] p-6">
      <div className="mx-auto max-w-[1100px] space-y-4">
        <h1 className="text-xl font-semibold">Data Inspection — /api/collect</h1>
        <p className="text-sm text-muted-foreground">Verify exactly what the backend collects: platform-scoped queries, dedup, ownership, counts. Published count only from verified owned URLs.</p>
        <Card className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Entity</label>
            <input value={entity} onChange={e=>setEntity(e.target.value)} className="h-9 rounded border px-3 text-sm w-[260px]" placeholder="e.g. Samay Raina" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Platform</label>
            <select value={platform} onChange={e=>setPlatform(e.target.value)} className="h-9 rounded border px-2 text-sm">
              {PLATFORMS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Range</label>
            <select value={range} onChange={e=>setRange(e.target.value)} className="h-9 rounded border px-2 text-sm">
              {RANGES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button onClick={run} disabled={loading || !entity.trim()}>{loading?'Collecting…':'Collect'}</Button>
          <div className="text-xs text-muted-foreground">POST /api/collect {"{entity, platform, range}"} → JSON</div>
        </Card>

        {err && <Alert className="border-red-200 bg-red-50 text-red-800">{err}</Alert>}

        {data && (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><div className="text-xs text-muted-foreground">Entity</div><div className="font-medium">{data.entity}</div></div>
              <div><div className="text-xs text-muted-foreground">Platform</div><Badge variant="secondary">{data.platform}</Badge></div>
              <div><div className="text-xs text-muted-foreground">Range</div><Badge>{data.range}</Badge></div>
              <div><div className="text-xs text-muted-foreground">Confidence</div><Badge variant="outline">{data.dataQuality?.confidence}</Badge></div>
              <div><div className="text-xs text-muted-foreground">Indexed (raw)</div><div className="text-lg font-semibold">{data.indexedResultCount}</div><div className="text-xs text-muted-foreground">search results total</div></div>
              <div><div className="text-xs text-muted-foreground">Analyzed (dedup + date-filtered)</div><div className="text-lg font-semibold">{data.analyzedContentCount}</div><div className="text-xs text-muted-foreground">unique valid items</div></div>
              <div><div className="text-xs text-muted-foreground">Third-party mentions</div><div className="text-lg font-semibold">{data.thirdPartyMentionCount}</div></div>
              <div>
                <div className="text-xs text-muted-foreground">Published (owned)</div>
                <div className="text-lg font-semibold">{data.publishedCount?.value ?? '—'} <span className="text-xs font-normal">({data.publishedCount?.type})</span></div>
                <div className="text-xs text-muted-foreground">{data.publishedCount?.methodology}</div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium mb-2">Queries (platform-scoped, multi-variant)</div>
              <div className="flex flex-wrap gap-2">
                {data.debug?.queries?.map((q:any,i:number)=><Badge key={i} variant="outline" className="font-mono text-xs">{q.platform}: {q.query}</Badge>)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Per-platform raw: {JSON.stringify(data.debug?.perPlatformRaw)} · duplicates removed: {data.debug?.duplicateCount} · raw {data.debug?.rawCount} → dedup {data.debug?.dedupedCount}</div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="p-4 pb-0 text-sm font-medium">Content ({data.content?.length}) — normalized</div>
              <div className="p-4 pt-2 text-xs text-muted-foreground">Each row: url, ownership, contentType, dates, engagement (null≠0), source, confidence. Same URL from 5 queries = 1 row.</div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Likes</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Conf</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.content?.map((c:any,i:number)=>(
                      <TableRow key={c.id}>
                        <TableCell>{i+1}</TableCell>
                        <TableCell><Badge variant="secondary">{c.platform}</Badge></TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs">{c.title ?? '—'}</TableCell>
                        <TableCell className="max-w-[240px] truncate"><a href={c.url} target="_blank" rel="noreferrer" className="text-xs underline">{c.url}</a></TableCell>
                        <TableCell><Badge variant={c.ownership==='owned'?'default':'outline'}>{c.ownership}</Badge></TableCell>
                        <TableCell className="text-xs">{c.contentType}</TableCell>
                        <TableCell className="text-xs">{(() => { try { return c.publishedAt ? new Date(c.publishedAt).toISOString().slice(0,10) : '—'; } catch { return '—'; } })()}</TableCell>
                        <TableCell className="text-xs">{c.engagement?.likes ?? '—'}</TableCell>
                        <TableCell className="text-xs">{c.engagement?.comments ?? '—'}</TableCell>
                        <TableCell className="text-xs">{c.engagement?.views ?? '—'}</TableCell>
                        <TableCell className="text-xs">{c.engagement?.confidence ?? c.confidence}</TableCell>
                      </TableRow>
                    ))}
                    {!data.content?.length && <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">No content discovered for this scope.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium">Limitations & methodology</div>
              <ul className="list-disc pl-5 text-xs text-muted-foreground mt-2 space-y-1">
                {data.dataQuality?.limitations?.map((l:string,i:number)=><li key={i}>{l}</li>)}
                <li>ENGAGEMENT: null = unavailable, never 0. confidence high/medium/low/none from snippet parsing.</li>
                <li>PUBLISHED COUNT: only from owned URLs (path starts with /handle). Insufficient evidence → unavailable, not indexedResultCount.</li>
              </ul>
              <details className="mt-3"><summary className="text-xs cursor-pointer">Raw JSON</summary><pre className="mt-2 overflow-auto bg-muted p-3 rounded text-xs max-h-[400px]">{JSON.stringify(data,null,2)}</pre></details>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
