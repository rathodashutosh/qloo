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
import GeeModal from './components/GeeModal';
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
  RefreshCw,
  Satellite,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export default function App() {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_CITY);
  const [selectedConcept, setSelectedConcept] = useState('specialty-coffee');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [compareCell, setCompareCell] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Layout ratio state: '50-50' (50% Map / 50% Analytics), '40-60' (40% Map / 60% Analytics), '60-40' (60% Map / 40% Analytics)
  const [layoutSplit, setLayoutSplit] = useState('50-50');

  // Live Point Query State
  const [liveMode, setLiveMode] = useState(true);
  const [livePoint, setLivePoint] = useState(null);
  const [livePointData, setLivePointData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);

  // Compare Live Point B State
  const [compareLivePoint, setCompareLivePoint] = useState(null);
  const [compareLivePointData, setCompareLivePointData] = useState(null);
  const [compareLiveLoading, setCompareLiveLoading] = useState(false);

  // API Key Management Modal State
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyStatus, setKeyStatus] = useState(null);

  // Google Earth Engine Modal & Layer State
  const [geeModalOpen, setGeeModalOpen] = useState(false);
  const [currentBasemap, setCurrentBasemap] = useState('esriStreet');

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
      if (!selectedCell && !livePoint) {
        setSelectedCell(cellProps);
      } else if (!compareCell && !compareLivePoint) {
        setCompareCell(cellProps);
      } else {
        // Update second location
        setCompareCell(cellProps);
        setCompareLivePoint(null);
        setCompareLivePointData(null);
      }
    } else {
      setSelectedCell(cellProps);
      setLivePoint(null);
      setLivePointData(null);
      setCompareCell(null);
      setCompareLivePoint(null);
      setCompareLivePointData(null);
    }
  };

  // Handle click on any coordinate on map (Live Point Query)
  const handleLivePointClick = async ({ lat, lon }) => {
    if (compareMode) {
      if (!selectedCell && !livePoint) {
        // Set Location A
        setLivePoint({ lat, lon, label: `Live Point A (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
        setSelectedCell(null);
        setLiveLoading(true);
        try {
          const res = await liveQuery(lat, lon, selectedConcept, 1.5);
          setLivePointData(res);
        } catch (err) {
          console.error('Live query error:', err);
        } finally {
          setLiveLoading(false);
        }
      } else {
        // Set Location B
        setCompareLivePoint({ lat, lon, label: `Live Point B (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
        setCompareCell(null);
        setCompareLiveLoading(true);
        try {
          const res = await liveQuery(lat, lon, selectedConcept, 1.5);
          setCompareLivePointData(res);
        } catch (err) {
          console.error('Compare live query error:', err);
        } finally {
          setCompareLiveLoading(false);
        }
      }
    } else {
      setLivePoint({ lat, lon, label: `Live Point (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
      setSelectedCell(null);
      setCompareCell(null);
      setCompareLivePoint(null);
      setCompareLivePointData(null);
      setLiveLoading(true);

      try {
        const res = await liveQuery(lat, lon, selectedConcept, 1.5);
        setLivePointData(res);
      } catch (err) {
        console.error('Live query error:', err);
      } finally {
        setLiveLoading(false);
      }
    }
  };

  // Clear all selections
  const handleClearSelections = () => {
    setSelectedCell(null);
    setLivePoint(null);
    setLivePointData(null);
    setCompareCell(null);
    setCompareLivePoint(null);
    setCompareLivePointData(null);
  };

  // Swap Location A and B in Compare Mode
  const handleSwapCompare = () => {
    const prevCell = selectedCell;
    const prevLive = livePoint;
    const prevLiveData = livePointData;

    setSelectedCell(compareCell);
    setLivePoint(compareLivePoint);
    setLivePointData(compareLivePointData);

    setCompareCell(prevCell);
    setCompareLivePoint(prevLive);
    setCompareLivePointData(prevLiveData);
  };

  // Find top opportunity cell
  const topOpportunity = geojson?.features?.reduce((prev, curr) => {
    const prevGap = prev?.properties?.gap ?? -1;
    const currGap = curr?.properties?.gap ?? -1;
    return currGap > prevGap ? curr : prev;
  }, null);

  const venueMarkers = livePointData?.venues || cellData?.venues || [];

  // Determine Location A & B objects for map markers and catchment circles
  const primaryLocation = selectedCell
    ? {
        lat: Number(selectedCell.lat),
        lon: Number(selectedCell.lon),
        label: selectedCell.label || `Cell ${selectedCell.id}`,
      }
    : livePoint
    ? {
        lat: Number(livePoint.lat),
        lon: Number(livePoint.lon),
        label: livePoint.label || 'Location A',
      }
    : null;

  const compareLocation = compareCell
    ? {
        lat: Number(compareCell.lat),
        lon: Number(compareCell.lon),
        label: compareCell.label || `Cell ${compareCell.id}`,
      }
    : compareLivePoint
    ? {
        lat: Number(compareLivePoint.lat),
        lon: Number(compareLivePoint.lon),
        label: compareLivePoint.label || 'Location B',
      }
    : null;

  // Compare objects for CompareView
  const locAData = selectedCell ? (cellData || selectedCell) : livePointData;
  const locBData = compareCell ? compareCell : compareLivePointData;

  // Sidebar width class based on layoutSplit
  const sidebarWidthClass = layoutSplit === '50-50'
    ? 'w-1/2 min-w-[460px]'
    : layoutSplit === '40-60'
    ? 'w-[60%] min-w-[520px]'
    : 'w-[40%] min-w-[400px]';

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
            <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs border border-emerald-200 font-medium">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>Top Area: <strong>{topOpportunity.properties.label}</strong> (Gap: {topOpportunity.properties.gap.toFixed(2)})</span>
            </div>
          )}

          {/* Screen Split Layout Switcher (Decreases Map Area) */}
          <div className="hidden lg:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setLayoutSplit('50-50')}
              title="Balanced: 50% Map / 50% Analytics"
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                layoutSplit === '50-50'
                  ? 'bg-white shadow-2xs font-bold text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚖️ 50:50 Balanced
            </button>
            <button
              onClick={() => setLayoutSplit('40-60')}
              title="Analytics Focus: 40% Map / 60% Analytics"
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                layoutSplit === '40-60'
                  ? 'bg-white shadow-2xs font-bold text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 40% Map (More Data)
            </button>
            <button
              onClick={() => setLayoutSplit('60-40')}
              title="Map Focus: 60% Map / 40% Analytics"
              className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                layoutSplit === '60-40'
                  ? 'bg-white shadow-2xs font-bold text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗺️ 60% Map
            </button>
          </div>

          {/* Google Earth Engine Button */}
          <button
            onClick={() => setGeeModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold shadow-xs transition-all border border-slate-700 cursor-pointer"
          >
            <Satellite className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">Earth Engine</span>
            <span className="text-[10px] bg-sky-500/30 text-sky-200 px-1.5 py-0.2 rounded font-mono">
              Sentinel-1
            </span>
          </button>

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

          {/* Toggle Sidebar Layout */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Show Analytics Panel" : "Maximize Map to 100%"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? (
              <>
                <PanelLeftOpen className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Show Analytics</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden sm:inline">Maximize Map</span>
              </>
            )}
          </button>

          {/* Compare Mode Toggle */}
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) {
                setCompareCell(null);
                setCompareLivePoint(null);
                setCompareLivePointData(null);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer border ${
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

      {/* Main Content: Sidebar (Analytics) + Map */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar (Configurable Width: 50%, 60%, or 40%) */}
        <aside
          className={`${
            sidebarCollapsed ? 'hidden' : sidebarWidthClass
          } bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-sm overflow-hidden transition-all duration-200`}
        >
          <div className="p-4 space-y-4 overflow-y-auto flex-1 sidebar-scroll">
            {/* City Selection */}
            <CityPicker
              selectedCity={selectedCity}
              onCitySelect={(city) => {
                setSelectedCity(city);
                handleClearSelections();
              }}
            />

            {/* Concept Selection (Searchable + Custom Concept Entry) */}
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
              {/* Compare Mode Active */}
              {compareMode ? (
                <div className="space-y-3">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 text-xs text-indigo-800 flex items-center justify-between">
                    <span className="font-medium">
                      {locAData && locBData
                        ? 'Two locations ready for comparison'
                        : locAData
                        ? '📍 Location A set. Click anywhere on the map to set Location B.'
                        : '📍 Click anywhere on the map or hex grid to set Location A.'}
                    </span>
                    {(locAData || locBData) && (
                      <button
                        onClick={handleClearSelections}
                        className="text-[11px] underline text-indigo-600 hover:text-indigo-900 cursor-pointer ml-2 shrink-0"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {locAData || locBData ? (
                    <CompareView
                      locA={locAData}
                      locB={locBData}
                      conceptId={selectedConcept}
                      city={selectedCity}
                      onSwap={handleSwapCompare}
                      onClear={handleClearSelections}
                      onClose={() => setCompareMode(false)}
                    />
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-xs space-y-2">
                      <Columns className="h-8 w-8 mx-auto text-slate-300" />
                      <p className="font-medium text-slate-600">Select any two locations</p>
                      <p className="text-[11px] text-slate-400">
                        Click any two points or hex cells on the map to compare demand, saturation, competitor density, and get an AI verdict.
                      </p>
                    </div>
                  )}
                </div>
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
                /* Selected Hex Cell Details */
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
                  <h4 className="text-xs font-bold text-slate-800">Spatial Intelligence Map</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    • <strong>Click colored hexagons</strong> to inspect demand & saturation.<br />
                    • <strong>Click ANY point on the map</strong> to run a live Qloo coordinate query with animated pointer and 1.5 km catchment radius.<br />
                    • <strong>Toggle Compare Mode</strong> to evaluate two locations side-by-side.
                  </p>
                  <div className="pt-2">
                    <Legend />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vertically Adjustable Chat Assistant at bottom of sidebar */}
          <div className="border-t border-slate-200 p-3 bg-slate-50/70 shrink-0">
            <ChatBox
              cellId={selectedCell?.id || (livePoint ? `coord_${livePoint.lat.toFixed(4)}_${livePoint.lon.toFixed(4)}` : undefined)}
              conceptId={selectedConcept}
              city={selectedCity}
              selectedCell={selectedCell}
              livePointData={livePointData}
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
            selectedLocation={primaryLocation}
            compareLocation={compareLocation}
            onCellClick={handleCellClick}
            onLivePointClick={handleLivePointClick}
            onOpenGeeModal={() => setGeeModalOpen(true)}
            currentBasemap={currentBasemap}
            onBasemapChange={setCurrentBasemap}
          />

          {/* Floating Button to Re-open Sidebar when collapsed */}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute top-3 left-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-200 text-xs text-slate-800 font-semibold flex items-center gap-2 hover:bg-white transition-all cursor-pointer z-20"
            >
              <PanelLeftOpen className="h-4 w-4 text-indigo-600" />
              <span>Show Analytics</span>
            </button>
          )}

          {/* Floating Instructions Pill */}
          <div className={`absolute top-3 ${sidebarCollapsed ? 'left-48' : 'left-4'} bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md border border-slate-200 text-xs text-slate-700 flex items-center gap-2 pointer-events-none z-10 transition-all`}>
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping inline-block" />
            <span className="font-semibold text-slate-800">
              {compareMode ? 'Compare Mode Active' : 'Live Spatial Grid'}
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              {compareMode
                ? (locAData && !locBData ? 'Click 2nd spot to compare' : 'Click any two locations')
                : 'Click any location to drop pointer & view 1.5 km catchment'}
            </span>
          </div>

          {/* Floating Basemap Quick-Switcher */}
          <div className="absolute top-3 right-16 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 hidden md:flex items-center gap-1 z-10 text-xs">
            <button
              onClick={() => setCurrentBasemap('esriStreet')}
              title="Cartographic Street Network"
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentBasemap === 'esriStreet'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🗺️ Streets
            </button>
            <button
              onClick={() => setCurrentBasemap('geeSentinel1')}
              title="Copernicus Sentinel-1 SAR Radar"
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentBasemap === 'geeSentinel1'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🛰️ Sentinel-1
            </button>
            <button
              onClick={() => setCurrentBasemap('geeViirs')}
              title="VIIRS Nocturnal Luminosity / Night Lights"
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentBasemap === 'geeViirs'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🌃 Night Lights
            </button>
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

      {/* Google Earth Engine Modal */}
      <GeeModal
        isOpen={geeModalOpen}
        onClose={() => setGeeModalOpen(false)}
        activeLayerId={currentBasemap}
        onLayerSelect={(layerId) => {
          setCurrentBasemap(layerId);
        }}
      />

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
