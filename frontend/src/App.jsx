import { useState, useEffect } from 'react';
import GapMap from './components/GapMap';
import CityPicker from './components/CityPicker';
import ConceptPicker from './components/ConceptPicker';
import CellDetail from './components/CellDetail';
import CompareView from './components/CompareView';
import LivePointDetail from './components/LivePointDetail';
import ChatBox from './components/ChatBox';
import Legend from './components/Legend';
import ApiKeyModal from './components/ApiKeyModal';
import useMapData from './hooks/useMapData';
import useCellDetail from './hooks/useCellDetail';
import { fetchKeyStatus, liveQuery } from './api/client';
import { DEFAULT_CITY } from './utils/constants';
import {
  Compass,
  Columns,
  Layers,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Target,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedConcept, setSelectedConcept] = useState('specialty-coffee');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [compareCell, setCompareCell] = useState(null);

  // Live Point Query State
  const [liveMode, setLiveMode] = useState(true);
  const [livePoint, setLivePoint] = useState(null);
  const [livePointData, setLivePointData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);

  // API Key Management Modal State
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyStatus, setKeyStatus] = useState(null);

  // Load geojson data for the heatmap
  const { geojson, loading: mapLoading, reload: reloadMap } = useMapData(selectedCity, selectedConcept);

  // Load detailed data for selected cell
  const { cellData, loading: detailLoading, loadCell, clear: clearDetail } = useCellDetail(selectedConcept);

  // Check key status on startup
  useEffect(() => {
    fetchKeyStatus()
      .then(setKeyStatus)
      .catch(console.error);
  }, []);

  // When selected cell changes, load its details
  useEffect(() => {
    if (selectedCell?.id) {
      loadCell(selectedCell.id);
      setLivePoint(null);
      setLivePointData(null);
    } else {
      clearDetail();
    }
  }, [selectedCell?.id, selectedConcept, loadCell, clearDetail]);

  // Handle cell click on map
  const handleCellClick = (cellProps) => {
    if (compareMode) {
      if (!selectedCell) {
        setSelectedCell(cellProps);
      } else if (!compareCell && cellProps.id !== selectedCell.id) {
        setCompareCell(cellProps);
      } else {
        setCompareCell(cellProps);
      }
    } else {
      setSelectedCell(cellProps);
      setLivePoint(null);
      setLivePointData(null);
    }
  };

  // Handle click on any coordinate on map (Live Point Query)
  const handleLivePointClick = async ({ lat, lon }) => {
    setLivePoint({ lat, lon, label: `Live (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
    setSelectedCell(null);
    setCompareCell(null);
    setLiveLoading(true);

    try {
      const res = await liveQuery(lat, lon, selectedConcept, 1.5);
      setLivePointData(res);
    } catch (err) {
      console.error('Live query error:', err);
    } finally {
      setLiveLoading(false);
    }
  };

  // Find top opportunity cell
  const topOpportunity = geojson?.features?.reduce((prev, curr) => {
    const prevGap = prev?.properties?.gap ?? -1;
    const currGap = curr?.properties?.gap ?? -1;
    return currGap > prevGap ? curr : prev;
  }, null);

  const venueMarkers = livePointData?.venues || cellData?.venues || [];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Taste-Gap Finder</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Qloo Hackathon
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Location intelligence engine: where high taste demand meets low venue supply
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {topOpportunity && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs border border-emerald-200 font-medium">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>Top Area: <strong>{topOpportunity.properties.label}</strong> (Gap: {topOpportunity.properties.gap.toFixed(2)})</span>
            </div>
          )}

          {/* Qloo Key Status Button */}
          <button
            onClick={() => setKeyModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
              keyStatus?.qloo_configured
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-xs'
            }`}
          >
            {keyStatus?.qloo_configured ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Qloo Key: {keyStatus.qloo_key_preview}</span>
              </>
            ) : (
              <>
                <Key className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                <span>Upload / Enter Qloo Key</span>
              </>
            )}
          </button>

          {/* Compare Mode Toggle */}
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) setCompareCell(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer border ${
              compareMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compare Mode</span>
            {compareMode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />}
          </button>
        </div>
      </header>

      {/* Main Content: Sidebar + Map */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-sm overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto flex-1 sidebar-scroll">
            {/* City Selection */}
            <CityPicker
              selectedCity={selectedCity}
              onCitySelect={(city) => {
                setSelectedCity(city);
                setSelectedCell(null);
                setCompareCell(null);
                setLivePoint(null);
                setLivePointData(null);
              }}
            />

            {/* Concept Selection */}
            <ConceptPicker
              selectedConcept={selectedConcept}
              onConceptSelect={(conceptId) => {
                setSelectedConcept(conceptId);
                setSelectedCell(null);
                setCompareCell(null);
                if (livePoint) {
                  handleLivePointClick(livePoint);
                }
              }}
            />

            <div className="border-t border-slate-200 pt-3">
              {/* Live Point Result */}
              {livePoint ? (
                <LivePointDetail
                  data={livePointData}
                  loading={liveLoading}
                  conceptId={selectedConcept}
                  city={selectedCity}
                  hasQlooKey={Boolean(keyStatus?.qloo_configured)}
                  onOpenKeyModal={() => setKeyModalOpen(true)}
                  onClose={() => {
                    setLivePoint(null);
                    setLivePointData(null);
                  }}
                />
              ) : compareMode ? (
                /* Compare Mode View */
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-800 flex items-center justify-between">
                    <span>
                      {selectedCell && compareCell
                        ? 'Two areas selected for comparison'
                        : selectedCell
                        ? 'Select a 2nd area on the map'
                        : 'Select 1st area on the map'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCell(null);
                        setCompareCell(null);
                      }}
                      className="text-[11px] underline text-indigo-600 hover:text-indigo-900 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  {selectedCell && compareCell ? (
                    <CompareView
                      cellA={selectedCell}
                      cellB={compareCell}
                      onClose={() => setCompareMode(false)}
                    />
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      <Columns className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      Click any two hex cells on the map to compare market opportunity side-by-side.
                    </div>
                  )}
                </div>
              ) : selectedCell ? (
                /* Selected Cell Details */
                <CellDetail
                  cell={cellData || selectedCell}
                  conceptId={selectedConcept}
                  city={selectedCity}
                  loading={detailLoading}
                  onClose={() => setSelectedCell(null)}
                />
              ) : (
                /* Empty state guide */
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mx-auto">
                    <Target className="h-5 w-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800">Interactive Opportunity Map</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    • <strong>Click colored hexagons</strong> to inspect neighborhood demand & saturation.<br />
                    • <strong>Click ANY point on the map</strong> to run a live Qloo coordinate query.
                  </p>
                  <div className="pt-2">
                    <Legend />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Assistant at bottom of sidebar */}
          <div className="border-t border-slate-200 p-3 bg-slate-50/70 shrink-0">
            <ChatBox
              cellId={selectedCell?.id || (livePoint ? `coord_${livePoint.lat.toFixed(4)}` : undefined)}
              conceptId={selectedConcept}
              city={selectedCity}
            />
          </div>
        </aside>

        {/* Map Container */}
        <main className="flex-1 relative overflow-hidden bg-slate-200">
          <GapMap
            city={selectedCity}
            geojson={geojson}
            selectedCellId={selectedCell?.id}
            venueMarkers={venueMarkers}
            livePoint={livePoint}
            onCellClick={handleCellClick}
            onLivePointClick={handleLivePointClick}
          />

          {/* Floating Instructions Pill */}
          <div className="absolute top-3 left-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md border border-slate-200 text-xs text-slate-700 flex items-center gap-2 pointer-events-none z-10">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping inline-block" />
            <span className="font-semibold text-slate-800">Live Map Active</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">Click any hex or point to query Qloo</span>
          </div>

          {/* Floating Map Legend (bottom-right) */}
          <div className="absolute bottom-6 right-4 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 w-56 z-10">
            <p className="text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-600" />
              Opportunity Gap Scale
            </p>
            <Legend />
          </div>
        </main>
      </div>

      {/* Key Management Modal */}
      <ApiKeyModal
        isOpen={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        onKeysUpdated={(status) => {
          setKeyStatus(status);
          reloadMap();
        }}
      />
    </div>
  );
}
