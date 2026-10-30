import { useState } from 'react';
import { gapToColor, gapLabel, confidenceColor } from '../utils/colors';
import { generateReport } from '../api/client';
import LoadingSpinner from './LoadingSpinner';
import ReportPanel from './ReportPanel';
import { MapPin, Target, BarChart3, Tag, Store, FileText, X, Sparkles, Key } from 'lucide-react';

export default function LivePointDetail({
  data,
  loading,
  conceptId,
  city,
  hasQlooKey,
  onOpenKeyModal,
  onClose,
}) {
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-pink-200 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-pink-700">
          <Target className="h-4 w-4 text-pink-500 animate-spin" />
          <span>Querying Live Qloo Taste Signals...</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Fetching real-time affinity and local OSM venue saturation for clicked coordinates.
        </p>
        <LoadingSpinner message="Calculating Live Gap Score..." />
      </div>
    );
  }

  if (!data) return null;

  const gap = data.gap ?? 0;
  const demand = data.demand ?? 0;
  const supply = data.supply ?? 0;
  const confidence = data.confidence || 'medium';
  const tags = data.taste_tags || [];
  const venues = data.venues || [];

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await generateReport(`live_${data.lat.toFixed(4)}_${data.lon.toFixed(4)}`, conceptId, city);
      setReport(res);
    } catch (err) {
      setReportError(err.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-pink-200 p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping inline-block" />
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              {data.label || 'Live Coordinate Analysis'}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            {data.lat.toFixed(5)}, {data.lon.toFixed(5)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Landmarks if available */}
      {data.landmarks && data.landmarks.length > 0 && (
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="h-3 w-3 text-rose-500" />
            Nearby Corridors & Landmarks
          </span>
          <div className="flex flex-wrap gap-1">
            {data.landmarks.map((lm, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-700 rounded text-[10px]">
                {lm}
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasQlooKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 flex items-center justify-between">
          <span>Qloo Key not configured yet</span>
          <button
            onClick={onOpenKeyModal}
            className="font-semibold underline text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
          >
            <Key className="h-3 w-3" />
            Add Key
          </button>
        </div>
      )}

      {/* Gap Score Pill */}
      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg shadow-sm shrink-0"
          style={{ backgroundColor: gapToColor(gap) }}
        >
          {gap.toFixed(2)}
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-medium">Real-Time Gap Score</p>
          <p className="text-xs font-bold text-slate-800">{gapLabel(gap)}</p>
          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${confidenceColor(confidence)}`}>
            {confidence} confidence
          </span>
        </div>
      </div>

      {/* Demand & Supply */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Live Qloo Taste Demand:</span>
          <strong className="text-emerald-700">{demand.toFixed(2)}</strong>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(demand * 100, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1">
          <span className="text-slate-500">Live OSM Venue Saturation:</span>
          <strong className="text-rose-700">{supply.toFixed(2)} ({data.venue_count} venues)</strong>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(supply * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Taste Tags */}
      {tags.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
            <Tag className="h-3 w-3 text-indigo-500" />
            Live Taste Signals
          </span>
          <div className="flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-medium"
              >
                {typeof t === 'string' ? t : t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Venues */}
      {venues.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
            <Store className="h-3 w-3 text-slate-400" />
            Detected Competitor Venues ({venues.length})
          </span>
          <ul className="space-y-1 max-h-36 overflow-y-auto pr-1 sidebar-scroll">
            {venues.map((v, i) => (
              <li
                key={i}
                className="text-[11px] text-slate-700 py-1 px-2 rounded bg-slate-50 flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="truncate font-medium">{v.name || 'Local Venue'}</span>
                </div>
                {v.distance_km !== undefined && v.distance_km !== null && (
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {v.distance_km} km
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generate brief */}
      {!report && (
        <button
          onClick={handleGenerateReport}
          disabled={reportLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-indigo-600 text-white text-xs font-semibold rounded-lg hover:opacity-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {reportLoading ? 'Generating Brief...' : 'Generate Location Brief'}
        </button>
      )}

      {reportLoading && <LoadingSpinner message="Synthesizing location intelligence..." />}
      {reportError && (
        <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg">{reportError}</div>
      )}
      {report && <ReportPanel report={report} />}
    </div>
  );
}
