import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, FileText, Sparkles, TrendingUp, Download } from 'lucide-react';

/**
 * ReportPanel — renders an LLM-generated brief with structured data and Markdown.
 */
export default function ReportPanel({ report }) {
  const [copied, setCopied] = useState(false);

  if (!report) return null;

  const text = report.report_text || report.report || report.text || report.summary || '';
  const structured = report.structured_data || {};

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Opportunity_Brief_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-white shadow-sm overflow-hidden mt-3">
      {/* Report Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
          <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
          AI Opportunity Brief
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownload}
            title="Download brief as Markdown file"
            className="flex items-center gap-1 px-2 py-1 rounded bg-white text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs font-medium transition-colors cursor-pointer"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white text-[11px] text-indigo-600 hover:text-indigo-800 border border-indigo-200 shadow-2xs font-medium transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Narrative Body */}
      <div className="p-3.5 prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed max-h-96 overflow-y-auto sidebar-scroll">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>

      {/* Verifiable Ground-Truth Data footer */}
      {structured.gap !== undefined && (
        <div className="bg-slate-50 border-t border-slate-100 px-3.5 py-2 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-slate-600 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-indigo-500" />
            Underlying Data:
          </span>
          <span>Demand: <strong>{Number(structured.demand).toFixed(2)}</strong></span>
          <span>Supply: <strong>{Number(structured.supply).toFixed(2)}</strong></span>
          <span>Gap: <strong>{Number(structured.gap).toFixed(2)}</strong></span>
          <span className="capitalize">Confidence: <strong>{structured.confidence}</strong></span>
        </div>
      )}
    </div>
  );
}
