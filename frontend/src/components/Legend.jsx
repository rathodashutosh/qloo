/**
 * Color legend for gap scores — horizontal gradient bar.
 */
export default function Legend() {
  return (
    <div className="px-1">
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
        <span>Saturated</span>
        <span>Opportunity</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(to right, #94A3B8 0%, #FBBF24 30%, #10B981 60%, #059669 100%)',
          }}
        />
        {/* Value markers */}
        <div className="absolute inset-0 flex items-end justify-between px-0.5">
          <Tick value="0" />
          <Tick value="0.3" />
          <Tick value="0.6" />
          <Tick value="1.0" />
        </div>
      </div>
      <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
        <span>0</span>
        <span>0.3</span>
        <span>0.6</span>
        <span>1.0</span>
      </div>
    </div>
  );
}

function Tick() {
  return (
    <div className="w-px h-1.5 bg-white/60" />
  );
}
