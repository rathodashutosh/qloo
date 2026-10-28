import { gapToColor, gapLabel, confidenceColor } from '../utils/colors';
import { MapPin, BarChart3, Tag, ArrowRight } from 'lucide-react';

/**
 * CompareView — side-by-side comparison of two cells.
 */
export default function CompareView({ cellA, cellB, onClose }) {
  if (!cellA || !cellB) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Compare Cells</h3>
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
        >
          Exit Compare
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CompareColumn cell={cellA} label="Cell A" />
        <CompareColumn cell={cellB} label="Cell B" />
      </div>

      {/* Winner Summary */}
      <CompareWinner cellA={cellA} cellB={cellB} />
    </div>
  );
}

function CompareColumn({ cell, label }) {
  const gap = cell.gap ?? cell.gap_score ?? 0;
  const demand = cell.demand ?? 0;
  const supply = cell.supply ?? 0;
  const confidence = cell.confidence || 'medium';
  const tags = cell.tags || cell.taste_tags || [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium uppercase">
        <MapPin className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xs font-semibold text-slate-700 truncate">
        {cell.label || `Cell ${cell.id}`}
      </p>

      {/* Gap Score */}
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: gapToColor(gap) }}
        >
          {gap.toFixed(1)}
        </div>
        <div>
          <p className="text-[10px] text-slate-400">{gapLabel(gap)}</p>
          <span
            className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${confidenceColor(confidence)}`}
          >
            {confidence}
          </span>
        </div>
      </div>

      {/* Bars */}
      <div className="space-y-1">
        <MiniBar label="Demand" value={demand} color="bg-emerald-500" />
        <MiniBar label="Supply" value={supply} color="bg-rose-400" />
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 4).map((tag, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px]"
            >
              {typeof tag === 'string' ? tag : tag.name}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="text-[9px] text-slate-400">+{tags.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

function MiniBar({ label, value, color }) {
  const pct = Math.min(value * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{label}</span>
        <span>{typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CompareWinner({ cellA, cellB }) {
  const gapA = cellA.gap ?? cellA.gap_score ?? 0;
  const gapB = cellB.gap ?? cellB.gap_score ?? 0;
  const demandA = cellA.demand ?? 0;
  const demandB = cellB.demand ?? 0;

  const metrics = [
    {
      label: 'Higher Gap',
      winner: gapA > gapB ? 'A' : gapB > gapA ? 'B' : 'Tie',
      icon: '📊',
    },
    {
      label: 'Higher Demand',
      winner: demandA > demandB ? 'A' : demandB > demandA ? 'B' : 'Tie',
      icon: '📈',
    },
  ];

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        <ArrowRight className="h-3 w-3" />
        Comparison
      </p>
      {metrics.map((m, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-slate-600">
            {m.icon} {m.label}
          </span>
          <span
            className={`font-semibold ${
              m.winner === 'A'
                ? 'text-indigo-600'
                : m.winner === 'B'
                ? 'text-emerald-600'
                : 'text-slate-400'
            }`}
          >
            {m.winner === 'Tie' ? 'Tie' : `Cell ${m.winner}`}
          </span>
        </div>
      ))}
    </div>
  );
}
