import { useState, useEffect, useRef, useCallback } from 'react';
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
  GripVertical,
  LayoutGrid,
  Maximize2
} from 'lucide-react';

export default function App() {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedConcept, setSelectedConcept] = useState('specialty-coffee');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [compareCell, setCompareCell] = useState(null);
  const [activeCompareSlot, setActiveCompareSlot] = useState('A'); // 'A' | 'B'

  // Layout Width State — allows decreasing total map area and adjusting sidebar
  const [sidebarWidth, setSidebarWidth] = useState(500); // default 500px for a well-balanced layout
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarDragStartX = useRef(0);
  const sidebarStartWidth = useRef(500);

  // Live Point Query State
  const [livePoint, setLivePoint] = useState(null);
  const [livePointData, setLivePointData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [mapFlyTarget, setMapFlyTarget] = useState(null);

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

  // When selected cell changes (in non-compare mode), load its details
  useEffect(() => {
    if (!compareMode) {
      if (selectedCell?.id && !selectedCell.venues) {
        loadCell(selectedCell.id);
        setLivePoint(null);
        setLivePointData(null);
      } else if (!selectedCell) {
        clearDetail();
      }
    }
  }, [selectedCell?.id, selectedConcept, compareMode, loadCell, clearDetail]);

  // Handle selecting Location A in Compare Mode (loads venues & taste tags)
  const handleSelectCompareA = async (cell) => {
    if (!cell) {
      setSelectedCell(null);
      return;
    }
    let full = { ...cell };
    if (full.id && (!full.venues?.length || !full.tags?.length)) {
      try {
        const { fetchCellDetail: fetchDetailApi } = await import('./api/client');
        const detail = await fetchDetailApi(full.id, selectedConcept);
        full = { ...full, ...detail };
      } catch (e) {
        console.warn('Could not load cell A detail:', e);
      }
    }
    setSelectedCell(full);
  };

  // Handle selecting Location B in Compare Mode (loads venues & taste tags)
  const handleSelectCompareB = async (cell) => {
    if (!cell) {
      setCompareCell(null);
      return;
    }
    let full = { ...cell };
    if (full.id && (!full.venues?.length || !full.tags?.length)) {
      try {
        const { fetchCellDetail: fetchDetailApi } = await import('./api/client');
        const detail = await fetchDetailApi(full.id, selectedConcept);
        full = { ...full, ...detail };
      } catch (e) {
        console.warn('Could not load cell B detail:', e);
      }
    }
    setCompareCell(full);
  };

  // Handle cell click on map
  const handleCellClick = async (cellProps) => {
    if (compareMode) {
      // Determine which compare slot to fill
      const targetSlot = !selectedCell ? 'A' : !compareCell ? 'B' : activeCompareSlot;

      // Fetch complete details (venues, tags) for this cell
      let fullProps = { ...cellProps };
      try {
        const { fetchCellDetail: fetchDetailApi } = await import('./api/client');
        const detail = await fetchDetailApi(cellProps.id || cellProps.cell_id, selectedConcept);
        fullProps = { ...fullProps, ...detail };
      } catch (e) {
        console.warn('Could not load cell detail:', e);
      }

      if (targetSlot === 'A') {
        setSelectedCell(fullProps);
        setActiveCompareSlot('B');
      } else {
        setCompareCell(fullProps);
        setActiveCompareSlot('A');
      }
    } else {
      setSelectedCell(cellProps);
      setLivePoint(null);
      setLivePointData(null);
    }
  };

  // Handle click on any coordinate on map (Live Point Query)
  const handleLivePointClick = async ({ lat, lon }) => {
    const targetSlot = compareMode ? (!selectedCell ? 'A' : !compareCell ? 'B' : activeCompareSlot) : null;
    setLiveLoading(true);

    try {
      const res = await liveQuery(lat, lon, selectedConcept, 1.5);
      const pointData = {
        id: `live_${lat.toFixed(4)}_${lon.toFixed(4)}`,
        lat,
        lon,
        label: res.label || `Live (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
        suburb: res.suburb,
        city: res.city,
        landmarks: res.landmarks || [],
        gap: res.gap,
        demand: res.demand,
        supply: res.supply,
        confidence: res.confidence,
        venues: res.venues || [],
        taste_tags: res.taste_tags || [],
      };

      if (compareMode) {
        if (targetSlot === 'A') {
          setSelectedCell(pointData);
          setActiveCompareSlot('B');
        } else {
          setCompareCell(pointData);
          setActiveCompareSlot('A');
        }
      } else {
        setLivePoint(pointData);
        setLivePointData(res);
        setSelectedCell(null);
        setCompareCell(null);
      }
    } catch (err) {
      console.error('Live query error:', err);
    } finally {
      setLiveLoading(false);
    }
  };

  // Drag handler for sidebar width (allows adjusting map vs sidebar proportion)
  const handleSidebarMouseDown = useCallback((e) => {
    setIsResizingSidebar(true);
    sidebarDragStartX.current = e.clientX;
    sidebarStartWidth.current = sidebarWidth;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - sidebarDragStartX.current;
      const minW = 360;
      const maxW = Math.max(500, window.innerWidth * 0.65);
      const newWidth = Math.max(minW, Math.min(maxW, sidebarStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  // Find top opportunity cell
  const topOpportunity = geojson?.features?.reduce((prev, curr) => {
    const prevGap = prev?.properties?.gap ?? -1;
    const currGap = curr?.properties?.gap ?? -1;
    return currGap > prevGap ? curr : prev;
  }, null);

  // Extract all ranked cells for comparison
  const allCellsList = (geojson?.features || [])
    .map((f) => ({
      id: f.properties?.id || f.properties?.cell_id,
      label: f.properties?.label,
      gap: f.properties?.gap,
      demand: f.properties?.demand,
      supply: f.properties?.supply,
      lat: f.properties?.lat,
      lon: f.properties?.lon,
    }))
    .filter((c) => c.label)
    .sort((a, b) => (b.gap || 0) - (a.gap || 0));

  const venueMarkers = livePointData?.venues || cellData?.venues || [];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 select-none">
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
              <span>Top Opportunity: <strong>{topOpportunity.properties.label}</strong> (Gap: {topOpportunity.properties.gap.toFixed(2)})</span>
            </div>
          )}

          {/* Layout Proportion Presets to easily decrease map dominance */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setSidebarWidth(Math.round(window.innerWidth * 0.48))}
              title="Balanced 50/50 View"
              className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                Math.abs(sidebarWidth - window.innerWidth * 0.48) < 60
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Balanced View
            </button>
            <button
              onClick={() => setSidebarWidth(Math.round(window.innerWidth * 0.60))}
              title="Analytics Focus (Compact Map)"
              className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                sidebarWidth >= window.innerWidth * 0.58
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Analytics Focus
            </button>
            <button
              onClick={() => setSidebarWidth(380)}
              title="Map Focus"
              className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                sidebarWidth <= 400
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Map Focus
            </button>
          </div>

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
              const nextMode = !compareMode;
              setCompareMode(nextMode);
              if (nextMode) {
                if (livePoint && !selectedCell) {
                  setSelectedCell({
                    id: livePoint.id,
                    lat: livePoint.lat,
                    lon: livePoint.lon,
                    label: livePoint.label,
                    gap: livePoint.gap,
                    demand: livePoint.demand,
                    supply: livePoint.supply,
                    confidence: livePoint.confidence,
                    venues: livePointData?.venues || livePoint.venues || [],
                    taste_tags: livePointData?.taste_tags || livePoint.taste_tags || [],
                  });
                  setLivePoint(null);
                  setLivePointData(null);
                  setActiveCompareSlot('B');
                } else if (selectedCell) {
                  setActiveCompareSlot('B');
                } else {
                  setActiveCompareSlot('A');
                }
              } else {
                setCompareCell(null);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer border ${
              compareMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Compare Mode</span>
            {compareMode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />}
          </button>
        </div>
      </header>

      {/* Main Content: Sidebar + Resizer + Map */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar — width is adjustable, decreasing the total map area */}
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-sm overflow-hidden"
        >
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

            {/* Concept Selection with Search & Custom Concept Creation */}
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
              {/* Compare Mode View */}
              {compareMode ? (
                <CompareView
                  cellA={selectedCell}
                  cellB={compareCell}
                  conceptId={selectedConcept}
                  city={selectedCity}
                  allCells={allCellsList}
                  onSelectCellA={handleSelectCompareA}
                  onSelectCellB={handleSelectCompareB}
                  activeSlot={activeCompareSlot}
                  onSelectSlot={setActiveCompareSlot}
                  onFlyTo={(lat, lon) => {
                    setMapFlyTarget({ lat, lon, time: Date.now() });
                  }}
                  onClose={() => {
                    setCompareMode(false);
                    setCompareCell(null);
                  }}
                />
              ) : livePoint ? (
                /* Live Point Result */
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
                  <h4 className="text-xs font-semibold text-slate-800">Interactive Location Intelligence</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    • <strong>Click colored hexagons</strong> to see pointers, coverage boundaries, and demand breakdown.<br />
                    • <strong>Click ANY point on the map</strong> to evaluate a custom location in real time with Qloo.<br />
                    • Turn on <strong>Compare Mode</strong> to evaluate two locations side-by-side.
                  </p>
                  <div className="pt-2">
                    <Legend />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Assistant at bottom of sidebar — adjustable height with presets */}
          <div className="border-t border-slate-200 p-2.5 bg-slate-50/80 shrink-0">
            <ChatBox
              cellId={
                selectedCell?.id ||
                (livePoint ? `coord_${livePoint.lat.toFixed(4)}_${livePoint.lon.toFixed(4)}` : undefined)
              }
              conceptId={selectedConcept}
              city={selectedCity}
              locationData={
                livePointData
                  ? { ...livePointData, lat: livePoint?.lat, lon: livePoint?.lon, label: livePoint?.label }
                  : selectedCell || cellData
              }
            />
          </div>
        </aside>

        {/* Draggable Vertical Splitter between Sidebar and Map */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className={`w-2 hover:w-2.5 bg-slate-200 hover:bg-indigo-400 cursor-col-resize z-20 flex items-center justify-center transition-colors ${
            isResizingSidebar ? 'bg-indigo-600 w-2.5' : ''
          }`}
          title="Drag left/right to adjust map and sidebar sizes"
        >
          <GripVertical className="h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Map Container — reduced and balanced */}
        <main className="flex-1 relative overflow-hidden bg-slate-200">
          <GapMap
            city={selectedCity}
            geojson={geojson}
            selectedCellId={selectedCell?.id}
            selectedCell={selectedCell}
            compareCell={compareCell}
            compareMode={compareMode}
            venueMarkers={venueMarkers}
            livePoint={livePoint}
            mapFlyTarget={mapFlyTarget}
            onCellClick={handleCellClick}
            onLivePointClick={handleLivePointClick}
          />

          {/* Floating Instructions Pill */}
          <div className="absolute top-3 left-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md border border-slate-200 text-xs text-slate-700 flex items-center gap-2 pointer-events-none z-10">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping inline-block" />
            <span className="font-semibold text-slate-800">
              {compareMode ? 'Dual Compare Active' : 'Live Map Active'}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              {compareMode
                ? 'Select 2 locations to compare metrics'
                : 'Click any hex or point to drop pointer & view area'}
            </span>
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
