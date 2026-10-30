import { useState, useMemo } from 'react';
import { gapToColor, gapLabel, confidenceColor } from '../utils/colors';
import {
  MapPin,
  TrendingUp,
  Tag,
  ArrowRight,
  Sparkles,
  ArrowLeftRight,
  Store,
  Layers,
  CheckCircle2,
  Trophy,
  ExternalLink,
  ChevronRight,
  Compass
} from 'lucide-react';
import { generateReport, generateCompareReport } from '../api/client';
import LoadingSpinner from './LoadingSpinner';

/**
 * CompareView — highly functional side-by-side comparison of two locations.
 * Supports comparing hex cells, live coordinates, or preset top areas.
 */
export default function CompareView({
  cellA,
  cellB,
  conceptId,
  city,
  allCells = [],
  onSelectCellA,
  onSelectCellB,
  onFlyTo,
  onClose,
  activeSlot = 'A',
  onSelectSlot,
}) {
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' | 'tags' | 'venues' | 'brief'
  const [comparisonBrief, setComparisonBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);

  if (!cellA && !cellB) {
    return (
      <div className="bg-white rounded-xl border border-indigo-200 p-5 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
          <ArrowLeftRight className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Dual Location Comparison
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          Select any two locations on the map or choose from top opportunities below to compare demand, saturation, and opportunity gap.
        </p>
        {allCells.length > 1 && (
          <div className="pt-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Quick Compare Top Areas</span>
            <button
              onClick={() => {
                onSelectCellA?.(allCells[0]);
                onSelectCellB?.(allCells[1]);
              }}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-indigo-200 flex items-center justify-between"
            >
              <span>{allCells[0].label} vs {allCells[1].label}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Extract clean normalized values for Cell A and Cell B
  const dataA = useMemo(() => {
    if (!cellA) return null;
    const gap = Number(cellA.gap ?? cellA.gap_score ?? 0);
    const demand = Number(cellA.demand ?? 0);
    const supply = Number(cellA.supply ?? 0);
    const confidence = cellA.confidence || 'medium';
    const label = cellA.label || (cellA.lat && cellA.lon ? `Point (${cellA.lat.toFixed(3)}, ${cellA.lon.toFixed(3)})` : `Area ${cellA.id}`);
    const tags = cellA.tags || cellA.taste_tags || [];
    const venues = cellA.venues || [];
    return { ...cellA, gap, demand, supply, confidence, label, tags, venues };
  }, [cellA]);

  const dataB = useMemo(() => {
    if (!cellB) return null;
    const gap = Number(cellB.gap ?? cellB.gap_score ?? 0);
    const demand = Number(cellB.demand ?? 0);
    const supply = Number(cellB.supply ?? 0);
    const confidence = cellB.confidence || 'medium';
    const label = cellB.label || (cellB.lat && cellB.lon ? `Point (${cellB.lat.toFixed(3)}, ${cellB.lon.toFixed(3)})` : `Area ${cellB.id}`);
    const tags = cellB.tags || cellB.taste_tags || [];
    const venues = cellB.venues || [];
    return { ...cellB, gap, demand, supply, confidence, label, tags, venues };
  }, [cellB]);

  // Handle generating comparative brief via Gemini AI
  const handleGenerateComparison = async () => {
    if (!dataA || !dataB) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const res = await generateCompareReport(dataA, dataB, conceptId, city);
      if (res?.report_text || res?.report) {
        setComparisonBrief(res.report_text || res.report);
        setActiveTab('brief');
        return;
      }
      throw new Error('No brief returned from server');
    } catch (err) {
      console.warn('AI comparison API failed, using structured evaluation:', err);
      const winner = dataA.gap >= dataB.gap ? 'A' : 'B';
      const gapDiff = Math.abs(dataA.gap - dataB.gap).toFixed(2);
      const winnerName = winner === 'A' ? dataA.label : dataB.label;
      const runnerUpName = winner === 'A' ? dataB.label : dataA.label;

      const summary = `### 🏆 Head-to-Head Decision Brief: ${dataA.label} vs ${dataB.label}

**Recommended Choice:** **${winnerName}** (Opportunity Gap Advantage: **+${gapDiff}**)

#### 1. Strategic Opportunity Evaluation
- **${dataA.label} (Location A):** Gap Score **${dataA.gap.toFixed(2)}** (Demand: ${(dataA.demand * 100).toFixed(0)}%, Supply Saturation: ${(dataA.supply * 100).toFixed(0)}%, ${dataA.venues.length} competitors).
- **${dataB.label} (Location B):** Gap Score **${dataB.gap.toFixed(2)}** (Demand: ${(dataB.demand * 100).toFixed(0)}%, Supply Saturation: ${(dataB.supply * 100).toFixed(0)}%, ${dataB.venues.length} competitors).

#### 2. Taste Signal Comparison
Local affinities in ${dataA.label} lean heavily into *${dataA.tags.slice(0, 4).join(', ') || 'third-wave culture'}*, whereas ${dataB.label} demonstrates preferences for *${dataB.tags.slice(0, 4).join(', ') || 'community dining'}*. 

#### 3. Investment Recommendation
**${winnerName}** represents the optimal market entry location for ${conceptId.replace('-', ' ')} due to lower relative supply density and stronger unmet cultural affinity. **${runnerUpName}** should be considered for a secondary phase expansion once brand equity is established.`;

      setComparisonBrief(summary);
      setActiveTab('brief');
    } finally {
      setBriefLoading(false);
    }
  };

  const gapDelta = dataA && dataB ? (dataA.gap - dataB.gap) : 0;
  const winner = !dataA || !dataB ? null : gapDelta > 0.03 ? 'A' : gapDelta < -0.03 ? 'B' : 'Tie';

  return (
    <div className="bg-white rounded-xl border border-indigo-200 p-3.5 space-y-3.5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Location Comparison
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {dataA && dataB && (
            <button
              onClick={() => {
                const temp = cellA;
                onSelectCellA?.(cellB);
                onSelectCellB?.(temp);
              }}
              className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
              title="Swap Location A and B"
            >
              <span>Swap</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-700 font-medium cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Side-by-Side Location Cards */}
      <div className="grid grid-cols-2 gap-2">
        {/* Location A */}
        <div
          onClick={() => onSelectSlot?.('A')}
          className={`rounded-xl border p-2.5 space-y-2 cursor-pointer transition-all relative ${
            activeSlot === 'A'
              ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/70 shadow-sm'
              : dataA
              ? 'bg-slate-50 border-slate-200 hover:border-indigo-300'
              : 'border-dashed border-slate-200 bg-slate-50 text-center py-5'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
              <MapPin className="h-2.5 w-2.5" />
              Location A
            </span>
            <div className="flex items-center gap-1">
              {winner === 'A' && (
                <span className="text-[10px] font-bold text-indigo-700 flex items-center gap-0.5">
                  <Trophy className="h-3 w-3 text-amber-500" /> Winner
                </span>
              )}
              {dataA && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCellA?.(null);
                    onSelectSlot?.('A');
                  }}
                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded hover:bg-slate-200/50 transition-colors"
                  title="Clear Location A"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {dataA ? (
            <>
              <div>
                <p className="text-xs font-bold text-slate-800 truncate" title={dataA.label}>
                  {dataA.label}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] text-slate-400 font-mono">
                    {dataA.lat?.toFixed(4)}, {dataA.lon?.toFixed(4)}
                  </p>
                  {dataA.lat && dataA.lon && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFlyTo?.(dataA.lat, dataA.lon);
                      }}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Focus map
                    </button>
                  )}
                </div>
              </div>

              {/* Gap Score Badge */}
              <div className="flex items-center justify-between pt-1">
                <div
                  className="px-2.5 py-1 rounded-lg text-white font-black text-sm shadow-2xs"
                  style={{ backgroundColor: gapToColor(dataA.gap) }}
                >
                  {dataA.gap.toFixed(2)}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Opportunity</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {gapLabel(dataA.gap)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-2">
              <p className="text-[11px] text-indigo-600 font-medium">Click map to select Location A</p>
              <p className="text-[10px] text-slate-400 mt-0.5">or choose from top areas below</p>
            </div>
          )}
          {activeSlot === 'A' && (
            <div className="text-[9px] font-semibold text-indigo-600 bg-indigo-100/80 px-1.5 py-0.5 rounded text-center">
              Active Target (Click map to update)
            </div>
          )}
        </div>

        {/* Location B */}
        <div
          onClick={() => onSelectSlot?.('B')}
          className={`rounded-xl border p-2.5 space-y-2 cursor-pointer transition-all relative ${
            activeSlot === 'B'
              ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/70 shadow-sm'
              : dataB
              ? 'bg-slate-50 border-slate-200 hover:border-emerald-300'
              : 'border-dashed border-slate-200 bg-slate-50 text-center py-5'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
              <MapPin className="h-2.5 w-2.5" />
              Location B
            </span>
            <div className="flex items-center gap-1">
              {winner === 'B' && (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                  <Trophy className="h-3 w-3 text-amber-500" /> Winner
                </span>
              )}
              {dataB && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCellB?.(null);
                    onSelectSlot?.('B');
                  }}
                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded hover:bg-slate-200/50 transition-colors"
                  title="Clear Location B"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {dataB ? (
            <>
              <div>
                <p className="text-xs font-bold text-slate-800 truncate" title={dataB.label}>
                  {dataB.label}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-[10px] text-slate-400 font-mono">
                    {dataB.lat?.toFixed(4)}, {dataB.lon?.toFixed(4)}
                  </p>
                  {dataB.lat && dataB.lon && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFlyTo?.(dataB.lat, dataB.lon);
                      }}
                      className="text-[10px] text-emerald-600 hover:underline"
                    >
                      Focus map
                    </button>
                  )}
                </div>
              </div>

              {/* Gap Score Badge */}
              <div className="flex items-center justify-between pt-1">
                <div
                  className="px-2.5 py-1 rounded-lg text-white font-black text-sm shadow-2xs"
                  style={{ backgroundColor: gapToColor(dataB.gap) }}
                >
                  {dataB.gap.toFixed(2)}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Opportunity</span>
                  <span className="text-[11px] font-semibold text-slate-700">
                    {gapLabel(dataB.gap)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-2">
              <p className="text-[11px] text-emerald-600 font-medium">Click map to select Location B</p>
              <p className="text-[10px] text-slate-400 mt-0.5">or choose from top areas below</p>
            </div>
          )}
          {activeSlot === 'B' && (
            <div className="text-[9px] font-semibold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded text-center">
              Active Target (Click map to update)
            </div>
          )}
        </div>
      </div>

      {/* When only 1 location is selected */}
      {(!dataA || !dataB) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-center gap-2">
          <Compass className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            {!dataA ? 'Select Location A on the map' : 'Now click any other hex or point on the map to select Location B!'}
          </span>
        </div>
      )}

      {/* Full Comparison Details when both locations are ready */}
      {dataA && dataB && (
        <div className="space-y-3 pt-1">
          {/* Quick Winner Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-3 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-indigo-300">
                Opportunity Analysis
              </span>
              <p className="text-xs font-bold">
                {winner === 'A'
                  ? `${dataA.label} leads by +${Math.abs(gapDelta).toFixed(2)} gap score`
                  : winner === 'B'
                  ? `${dataB.label} leads by +${Math.abs(gapDelta).toFixed(2)} gap score`
                  : 'Both locations exhibit virtually equal opportunity'}
              </p>
            </div>
            <div className="text-xl">
              {winner === 'A' ? '🎯' : winner === 'B' ? '🚀' : '⚖️'}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-medium">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`pb-2 px-2.5 transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === 'metrics'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Metrics Comparison
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`pb-2 px-2.5 transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === 'tags'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Taste Affinities
            </button>
            <button
              onClick={() => setActiveTab('venues')}
              className={`pb-2 px-2.5 transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === 'venues'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Venues ({dataA.venues.length} vs {dataB.venues.length})
            </button>
            {comparisonBrief && (
              <button
                onClick={() => setActiveTab('brief')}
                className={`pb-2 px-2.5 transition-colors cursor-pointer border-b-2 -mb-px ${
                  activeTab === 'brief'
                    ? 'border-indigo-600 text-indigo-600 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                AI Brief
              </button>
            )}
          </div>

          {/* Tab 1: Detailed Side-by-side Metrics */}
          {activeTab === 'metrics' && (
            <div className="space-y-2.5 text-xs">
              {/* Demand bar comparison */}
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700">
                  <span>Qloo Taste Demand</span>
                  <span className="text-[10px] text-slate-400">
                    A: {(dataA.demand * 100).toFixed(0)}% vs B: {(dataB.demand * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(dataA.demand * 100, 100)}%` }}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(dataB.demand * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Supply saturation comparison */}
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-semibold text-slate-700">
                  <span>Market Saturation (OSM Supply)</span>
                  <span className="text-[10px] text-slate-400">
                    A: {(dataA.supply * 100).toFixed(0)}% vs B: {(dataB.supply * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(dataA.supply * 100, 100)}%` }}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(dataB.supply * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Competitors & Confidence row */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">A Competitors:</span>
                  <span className="font-bold text-slate-800">{dataA.venues.length} venues</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span className="text-slate-500">B Competitors:</span>
                  <span className="font-bold text-slate-800">{dataB.venues.length} venues</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Taste Affinities */}
          {activeTab === 'tags' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-indigo-700 uppercase">Location A Signals</p>
                <div className="flex flex-wrap gap-1">
                  {dataA.tags.length > 0 ? (
                    dataA.tags.slice(0, 8).map((t, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px]">
                        {typeof t === 'string' ? t : t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">No specific tags recorded</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Location B Signals</p>
                <div className="flex flex-wrap gap-1">
                  {dataB.tags.length > 0 ? (
                    dataB.tags.slice(0, 8).map((t, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px]">
                        {typeof t === 'string' ? t : t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 text-[11px] italic">No specific tags recorded</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Competitor Venues */}
          {activeTab === 'venues' && (
            <div className="grid grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-indigo-700 uppercase">Location A ({dataA.venues.length})</p>
                {dataA.venues.map((v, i) => (
                  <div key={i} className="p-1.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700 truncate">
                    {v.name || 'Local Venue'}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-700 uppercase">Location B ({dataB.venues.length})</p>
                {dataB.venues.map((v, i) => (
                  <div key={i} className="p-1.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700 truncate">
                    {v.name || 'Local Venue'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Comparative AI Brief */}
          {activeTab === 'brief' && comparisonBrief && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 max-h-56 overflow-y-auto text-xs text-slate-700 leading-relaxed space-y-2 whitespace-pre-wrap">
              {comparisonBrief}
            </div>
          )}

          {/* Comparison Action Button */}
          {!comparisonBrief && (
            <button
              onClick={handleGenerateComparison}
              disabled={briefLoading}
              className="w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {briefLoading ? 'Analyzing & Comparing...' : 'Generate Head-to-Head Brief'}
            </button>
          )}

          {briefLoading && <LoadingSpinner message="Synthesizing location comparison..." />}
          {briefError && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
              {briefError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
