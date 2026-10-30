import { useState, useMemo } from 'react';
import { gapToColor, gapLabel, confidenceColor } from '../utils/colors';
import { generateReport } from '../api/client';
import LoadingSpinner, { SkeletonCard } from './LoadingSpinner';
import ReportPanel from './ReportPanel';
import { MapPin, BarChart3, Tag, Store, FileText, X, Search } from 'lucide-react';

/**
 * CellDetail — side panel showing demand/supply bars, tags, venues, and report.
 */
export default function CellDetail({ cell, conceptId, city, loading, onClose }) {
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [venueSearch, setVenueSearch] = useState('');

  const gap = cell?.gap ?? cell?.gap_score ?? 0;
  const demand = cell?.demand ?? 0;
  const supply = cell?.supply ?? 0;
  const confidence = cell?.confidence || 'medium';
  const tags = cell?.tags || cell?.taste_tags || [];
  const venues = cell?.venues || cell?.nearby_venues || [];

  const filteredVenues = useMemo(() => {
    if (!venueSearch.trim()) return venues;
    const q = venueSearch.toLowerCase();
    return venues.filter((v) => {
      const name = typeof v === 'string' ? v : v?.name || '';
      return name.toLowerCase().includes(q);
    });
  }, [venues, venueSearch]);

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
      </div>
    );
  }

  if (!cell) return null;

  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const data = await generateReport(cell.id, conceptId, city, {
        label: cell.label,
        demand: cell.demand,
        supply: cell.supply,
        gap: cell.gap ?? cell.gap_score,
        confidence: cell.confidence,
        taste_tags: cell.tags || cell.taste_tags,
        venues: cell.venues || cell.nearby_venues,
      });
      setReport(data);
    } catch (err) {
      setReportError(err.message || 'Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-indigo-500" />
            {cell.label || `Cell ${cell.id}`}
          </h3>
          {(cell.lat || cell.lon) && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              {Number(cell.lat).toFixed(4)}, {Number(cell.lon).toFixed(4)}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Gap Score */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-xl text-white font-bold text-xl shadow-sm"
          style={{ backgroundColor: gapToColor(gap) }}
        >
          {gap.toFixed(2)}
        </div>
        <div>
          <p className="text-xs text-slate-500">Gap Score</p>
          <p className="text-sm font-semibold text-slate-700">{gapLabel(gap)}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${confidenceColor(confidence)}`}>
            {confidence} confidence
          </span>
        </div>
      </div>

      {/* Demand / Supply Bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-600">Demand vs Supply</span>
        </div>
        <BarRow label="Demand" value={demand} color="bg-emerald-500" />
        <BarRow label="Supply" value={supply} color="bg-rose-400" />
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-600">Taste Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-medium"
              >
                {typeof tag === 'string' ? tag : tag.name || tag.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Venues */}
      {venues.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              <Store className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-600">Nearby Venues ({venues.length})</span>
            </div>
            {venues.length > 5 && (
              <span className="text-[10px] text-slate-400">
                {filteredVenues.length} shown
              </span>
            )}
          </div>

          {/* Quick Search */}
          {venues.length > 5 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md">
              <Search className="h-3 w-3 text-slate-400 shrink-0" />
              <input
                type="text"
                value={venueSearch}
                onChange={(e) => setVenueSearch(e.target.value)}
                placeholder="Filter venues..."
                className="w-full text-[11px] bg-transparent outline-none text-slate-700 placeholder-slate-400"
              />
              {venueSearch && (
                <button onClick={() => setVenueSearch('')} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <ul className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {filteredVenues.length === 0 ? (
              <li className="text-[11px] text-slate-400 italic text-center py-2">
                No matching venues found
              </li>
            ) : (
              filteredVenues.map((venue, i) => (
                <li
                  key={i}
                  className="text-xs text-slate-600 flex items-center justify-between gap-1.5 py-1 px-2 rounded bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="truncate">{typeof venue === 'string' ? venue : venue.name || 'Unknown venue'}</span>
                  </div>
                  {typeof venue === 'object' && venue.distance_km !== undefined && venue.distance_km !== null && (
                    <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded font-mono shrink-0">
                      {venue.distance_km} km
                    </span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Generate Report */}
      {!report && (
        <button
          onClick={handleGenerateReport}
          disabled={reportLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
        >
          <FileText className="h-4 w-4" />
          {reportLoading ? 'Generating...' : 'Generate Report'}
        </button>
      )}

      {reportLoading && <LoadingSpinner message="Generating AI report..." />}
      {reportError && (
        <div className="text-xs text-red-500 bg-red-50 rounded-lg p-3">{reportError}</div>
      )}
      {report && <ReportPanel report={report} />}
    </div>
  );
}

function BarRow({ label, value, color }) {
  const maxVal = 1;
  const pct = Math.min((value / maxVal) * 100, 100);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
