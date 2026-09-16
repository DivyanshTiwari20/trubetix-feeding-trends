'use client';

import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { AnalysisReport } from '@/components/pdf/AnalysisReport';
import { ScoreResult, Analysis } from '@/lib/types';
import { Download, FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PdfDownloadButtonProps {
  entity: string;
  result?: ScoreResult;
  analysis?: Analysis;
  range: string;
}

export function PdfDownloadButton({ entity, result, analysis, range }: PdfDownloadButtonProps) {
  const [pageCount, setPageCount] = useState(2);
  const [generating, setGenerating] = useState(false);

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      const blob = await pdf(
        <AnalysisReport
          entity={entity}
          result={result}
          analysisObj={analysis}
          range={range}
          pageCount={pageCount}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity.replace(/\s+/g, '_')}_PR_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [entity, result, analysis, range, pageCount]);

  return (
    <div className="flex items-center gap-2 mt-4">
      {/* Page count selector using Portal-based Select to avoid clipping */}
      <Select value={pageCount.toString()} onValueChange={(val) => setPageCount(parseInt(val ?? '2'))}>
        <SelectTrigger className="h-8 border-[#EDE8FF] bg-white text-xs font-medium text-[#374151] hover:bg-[#F8F7FA] focus:ring-0">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[#7C3AED]" />
            <SelectValue placeholder="Pages" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Summary (1 page)</SelectItem>
          <SelectItem value="2">Full dossier (3 pages)</SelectItem>
        </SelectContent>
      </Select>

      {/* Download button */}
      <Button
        onClick={handleDownload}
        disabled={generating}
        variant="outline"
        size="sm"
        className="gap-1.5 border-[#EDE8FF] text-[#7C3AED] hover:bg-[#F8F7FA]"
      >
        <Download className="h-3.5 w-3.5" />
        {generating ? 'Generating...' : 'Download PDF'}
      </Button>
    </div>
  );
}
