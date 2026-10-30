import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { gapToColor, gapLabel, confidenceColor } from '../utils/colors';
import { sendChatMessage } from '../api/client';
import { MapPin, BarChart3, Tag, ArrowRight, Sparkles, Trophy, ArrowLeftRight, CheckCircle2, RotateCcw } from 'lucide-react';

/**
 * CompareView — Advanced side-by-side comparison of any two locations (hex cells or live points).
 */
export default function CompareView({
  locA,
  locB,
  conceptId,
  city,
  onSwap,
  onClear,
  onClose,
}) {
  const [aiVerdict, setAiVerdict] = useState(null);
  const [loadingVerdict, setLoadingVerdict] = useState(false);
  const [verdictError, setVerdictError] = useState(null);

  if (!locA && !locB) return null;

  // Extract metrics safely
  const gapA = Number(locA?.gap ?? locA?.gap_score ?? 0);
  const gapB = Number(locB?.gap ?? locB?.gap_score ?? 0);
  const demandA = Number(locA?.demand ?? 0);
  const demandB = Number(locB?.demand ?? 0);
  const supplyA = Number(locA?.supply ?? 0);
  const supplyB = Number(locB?.supply ?? 0);
  const venueCountA = locA?.venues?.length ?? locA?.venue_count ?? 0;
  const venueCountB = locB?.venues?.length ?? locB?.venue_count ?? 0;
  const labelA = locA?.label || `Location (${locA?.lat?.toFixed(4)}, ${locA?.lon?.toFixed(4)})`;
  const labelB = locB?.label || (locB ? `Location (${locB?.lat?.toFixed(4)}, ${locB?.lon?.toFixed(4)})` : 'Select 2nd location...');

  const gapDiff = Math.abs(gapA - gapB).toFixed(2);
  const overallWinner = gapA > gapB ? 'A' : gapB > gapA ? 'B' : 'Tie';

  const handleGenerateVerdict = async () => {
    if (!locA || !locB || loadingVerdict) return;
    setLoadingVerdict(true);
    setVerdictError(null);

    const comparePrompt = `Compare Location A ("${labelA}", Gap: ${gapA.toFixed(2)}, Demand: ${demandA.toFixed(2)}, Competitors: ${venueCountA}) versus Location B ("${labelB}", Gap: ${gapB.toFixed(2)}, Demand: ${demandB.toFixed(2)}, Competitors: ${venueCountB}) for opening a ${conceptId || 'business'} in ${city || 'this area'}. Provide a decisive head-to-head verdict on which location is strategically superior and why.`;

    const context = {
      city,
      concept_id: conceptId,
      label: `${labelA} vs ${labelB}`,
      demand: Math.max(demandA, demandB),
      supply: Math.min(supplyA, supplyB),
      gap: Math.max(gapA, gapB),
      venues: [...(locA?.venues || []).slice(0, 4), ...(locB?.venues || []).slice(0, 4)],
      landmarks: [labelA, labelB],
      data: `Location A: ${labelA} (Demand: ${demandA.toFixed(2)}, Supply: ${supplyA.toFixed(2)}, Gap: ${gapA.toFixed(2)}, Venues: ${venueCountA})\nLocation B: ${labelB} (Demand: ${demandB.toFixed(2)}, Supply: ${supplyB.toFixed(2)}, Gap: ${gapB.toFixed(2)}, Venues: ${venueCountB})`,
    };

    try {
      const res = await sendChatMessage(comparePrompt, context);
      setAiVerdict(res.response || res.reply || res.message || 'Comparison generated.');
    } catch (err) {
      setVerdictError(err.message || 'Could not generate AI verdict.');
    } finally {
      setLoadingVerdict(false);
    }
  };

  return (
    <div className="space-y-3.5 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
      {/* Header Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          <h3 className="text-xs font-bold text-slate-800 tracking-tight uppercase">
            Head-to-Head Location Comparison
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {onSwap && locA && locB && (
            <button
              onClick={onSwap}
              title="Swap Location A and B"
              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          )}
          {onClear && (
            <button
              onClick={onClear}
              className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-1.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              Reset
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[11px] text-slate-400 hover:text-slate-700 px-1.5 py-0.5 cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>

      {/* Side-by-Side Location Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <LocationCard
          loc={locA}
          tag="A"
          color="#e11d48"
          bgClass="border-rose-200 bg-rose-50/30"
          badgeClass="bg-rose-100 text-rose-800 border-rose-300"
          pinColor="text-rose-600"
          isWinner={overallWinner === 'A' && locB}
        />
        <LocationCard
          loc={locB}
          tag="B"
          color="#059669"
          bgClass="border-emerald-200 bg-emerald-50/30"
          badgeClass="bg-emerald-100 text-emerald-800 border-emerald-300"
          pinColor="text-emerald-600"
          isWinner={overallWinner === 'B' && locA}
        />
      </div>

      {/* Comprehensive Metric Comparison Table */}
      {locA && locB && (
        <div className="bg-white rounded-lg border border-slate-200 p-2.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 pb-1 border-b border-slate-100">
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3 text-indigo-600" />
              Strategic Metric
            </span>
            <div className="flex gap-6 text-[10px] font-mono">
              <span className="text-rose-600 font-bold">Location A</span>
              <span className="text-emerald-600 font-bold">Location B</span>
            </div>
          </div>

          <MetricRow
            label="Net Taste Gap"
            valA={gapA.toFixed(2)}
            valB={gapB.toFixed(2)}
            betterA={gapA > gapB}
            betterB={gapB > gapA}
          />
          <MetricRow
            label="Consumer Taste Demand"
            valA={demandA.toFixed(2)}
            valB={demandB.toFixed(2)}
            betterA={demandA > demandB}
            betterB={demandB > demandA}
          />
          <MetricRow
            label="Venue Supply Saturation"
            valA={supplyA.toFixed(2)}
            valB={supplyB.toFixed(2)}
            betterA={supplyA < supplyB}
            betterB={supplyB < supplyA}
            invertBetter
          />
          <MetricRow
            label="Direct Competitors"
            valA={`${venueCountA} venues`}
            valB={`${venueCountB} venues`}
            betterA={venueCountA < venueCountB}
            betterB={venueCountB < venueCountA}
            invertBetter
          />

          {/* Winner Banner */}
          <div className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 border ${
            overallWinner === 'A'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : overallWinner === 'B'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <Trophy className={`h-4 w-4 shrink-0 ${
              overallWinner === 'A' ? 'text-rose-600' : overallWinner === 'B' ? 'text-emerald-600' : 'text-slate-500'
            }`} />
            <div className="leading-snug">
              <span className="font-bold">
                {overallWinner === 'Tie'
                  ? 'Both locations offer comparable market viability.'
                  : `Location ${overallWinner} is the stronger expansion candidate!`}
              </span>
              {overallWinner !== 'Tie' && (
                <span className="text-[11px] block text-slate-600">
                  Holds a +{gapDiff} higher net gap score with {overallWinner === 'A' ? venueCountA : venueCountB} direct competitors.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Comparative Verdict Trigger */}
      {locA && locB && (
        <div className="space-y-2">
          {!aiVerdict ? (
            <button
              onClick={handleGenerateVerdict}
              disabled={loadingVerdict}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{loadingVerdict ? 'Analyzing Head-to-Head Data...' : 'Generate AI Comparative Verdict'}</span>
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-indigo-200 p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 pb-1 border-b border-indigo-100">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  AI Comparative Verdict
                </span>
                <button
                  onClick={() => setAiVerdict(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="prose prose-xs prose-slate text-xs leading-relaxed max-w-none">
                <ReactMarkdown>{aiVerdict}</ReactMarkdown>
              </div>
            </div>
          )}

          {verdictError && (
            <p className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
              {verdictError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LocationCard({ loc, tag, color, bgClass, badgeClass, pinColor, isWinner }) {
  if (!loc) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-3 bg-white text-center flex flex-col items-center justify-center min-h-[140px] text-slate-400">
        <MapPin className="h-5 w-5 mb-1 text-slate-300" />
        <span className="text-xs font-semibold text-slate-500">Location {tag}</span>
        <span className="text-[10px] text-slate-400 mt-1">Click any point or hex on the map</span>
      </div>
    );
  }

  const gap = Number(loc.gap ?? loc.gap_score ?? 0);
  const demand = Number(loc.demand ?? 0);
  const supply = Number(loc.supply ?? 0);
  const label = loc.label || `Location (${loc.lat?.toFixed(3)}, ${loc.lon?.toFixed(3)})`;

  return (
    <div className={`rounded-lg border p-2.5 bg-white space-y-2 relative shadow-2xs ${bgClass}`}>
      {isWinner && (
        <span className="absolute -top-2 -right-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
          <Trophy className="h-2.5 w-2.5" /> Best Pick
        </span>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeClass}`}>
          Pin {tag}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">
          {loc.lat?.toFixed(3)}, {loc.lon?.toFixed(3)}
        </span>
      </div>

      <p className="text-xs font-bold text-slate-800 truncate" title={label}>
        {label}
      </p>

      {/* Gap Score Badge */}
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-xs"
          style={{ backgroundColor: gapToColor(gap) }}
        >
          {gap.toFixed(2)}
        </div>
        <div>
          <p className="text-[10px] text-slate-500 leading-tight">{gapLabel(gap)}</p>
          <span className="text-[9px] text-slate-400">Demand: {demand.toFixed(2)}</span>
        </div>
      </div>

      {/* Micro Bars */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-[9px] text-slate-500">
          <span>Demand</span>
          <span className="font-semibold text-emerald-600">{demand.toFixed(2)}</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(demand * 100, 100)}%` }} />
        </div>

        <div className="flex justify-between text-[9px] text-slate-500">
          <span>Saturation</span>
          <span className="font-semibold text-rose-500">{supply.toFixed(2)}</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(supply * 100, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, valA, valB, betterA, betterB, invertBetter }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-600 text-[11px]">{label}</span>
      <div className="flex gap-6 font-mono text-[11px]">
        <span className={`w-14 text-right font-medium ${betterA ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>
          {valA} {betterA && '✓'}
        </span>
        <span className={`w-14 text-right font-medium ${betterB ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>
          {valB} {betterB && '✓'}
        </span>
      </div>
    </div>
  );
}
