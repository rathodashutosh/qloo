import { useRef, useEffect, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAPS, DEFAULT_BASEMAP, CITIES, circleVertices, hexagonVertices } from '../utils/constants';
import { gapFillColorExpression } from '../utils/colors';
import { Layers, Crosshair, MapPin, ZoomIn, ZoomOut } from 'lucide-react';

const SOURCE_ID = 'hex-cells';
const FILL_LAYER = 'cells-fill';
const OUTLINE_LAYER = 'cells-outline';
const VENUE_SOURCE = 'venues';
const VENUE_LAYER = 'venue-dots';

// Dedicated source and layers for showing the selected area coverage
const SELECTED_AREA_SOURCE = 'selected-area-source';
const SELECTED_AREA_FILL = 'selected-area-fill';
const SELECTED_AREA_OUTLINE = 'selected-area-outline';
const SELECTED_AREA_GLOW = 'selected-area-glow';

/**
 * Creates a custom DOM MapLibre Marker for a pointer.
 */
function createMarkerDom({ label, letter, color = '#4f46e5', pulseColor = 'rgba(79, 70, 229, 0.4)' }) {
  const container = document.createElement('div');
  container.className = 'map-pin-wrapper group';

  // Floating label pill
  if (label) {
    const labelPill = document.createElement('div');
    labelPill.className = 'map-pin-label-pill';
    labelPill.innerText = label;
    container.appendChild(labelPill);
  }

  // Pin body
  const pinBody = document.createElement('div');
  pinBody.className = 'map-pin-body';
  pinBody.innerHTML = `
    <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 44 17 44C17 44 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="${color}"/>
      <path d="M17 2C8.72 2 2 8.72 2 17C2 28.2 17 41.2 17 41.2C17 41.2 32 28.2 32 17C32 8.72 25.28 2 17 2Z" fill="${color}" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="17" cy="17" r="10" fill="#ffffff"/>
      ${
        letter
          ? `<text x="17" y="21.5" font-family="Inter, sans-serif" font-size="12" font-weight="900" fill="${color}" text-anchor="middle">${letter}</text>`
          : `<circle cx="17" cy="17" r="5" fill="${color}"/>`
      }
    </svg>
  `;
  container.appendChild(pinBody);

  // Pulse ring at tip
  const pulseRing = document.createElement('div');
  pulseRing.className = 'map-pin-pulse-ring';
  pulseRing.style.background = pulseColor;
  container.appendChild(pulseRing);

  return container;
}

export default function GapMap({
  city,
  geojson,
  selectedCellId,
  selectedCell,
  compareCell,
  compareMode = false,
  venueMarkers,
  livePoint,
  onCellClick,
  onLivePointClick,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  // Fresh callback refs to eliminate stale closure issues in MapLibre event listeners
  const onCellClickRef = useRef(onCellClick);
  const onLivePointClickRef = useRef(onLivePointClick);

  useEffect(() => {
    onCellClickRef.current = onCellClick;
  }, [onCellClick]);

  useEffect(() => {
    onLivePointClickRef.current = onLivePointClick;
  }, [onLivePointClick]);

  // Markers
  const pointerPrimaryRef = useRef(null);
  const pointerSecondaryRef = useRef(null);

  const [activeBasemap, setActiveBasemap] = useState(DEFAULT_BASEMAP);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);

  // Setup all GeoJSON sources and layers
  const setupDataLayers = useCallback((map, data) => {
    if (!map || !map.isStyleLoaded()) return;

    const currentGeojson = data || geojson || { type: 'FeatureCollection', features: [] };

    // 1. Hex Cells Source
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: currentGeojson,
      });
    } else {
      map.getSource(SOURCE_ID).setData(currentGeojson);
    }

    // 2. Fill Layer (Opportunity Heatmap)
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': gapFillColorExpression,
          'fill-opacity': 0.65,
        },
      });
    }

    // 3. Outline Layer (Hex borders)
    if (!map.getLayer(OUTLINE_LAYER)) {
      map.addLayer({
        id: OUTLINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#0f172a',
          'line-width': 1.6,
          'line-opacity': 0.75,
        },
      });
    }

    // 4. Selected Area Highlight Source & Layers
    if (!map.getSource(SELECTED_AREA_SOURCE)) {
      map.addSource(SELECTED_AREA_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Selected Area Outer Glow
    if (!map.getLayer(SELECTED_AREA_GLOW)) {
      map.addLayer({
        id: SELECTED_AREA_GLOW,
        type: 'line',
        source: SELECTED_AREA_SOURCE,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#6366f1'],
          'line-width': 8,
          'line-opacity': 0.45,
          'line-blur': 4,
        },
      });
    }

    // Selected Area Fill
    if (!map.getLayer(SELECTED_AREA_FILL)) {
      map.addLayer({
        id: SELECTED_AREA_FILL,
        type: 'fill',
        source: SELECTED_AREA_SOURCE,
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#6366f1'],
          'fill-opacity': 0.28,
        },
      });
    }

    // Selected Area Crisp Outline
    if (!map.getLayer(SELECTED_AREA_OUTLINE)) {
      map.addLayer({
        id: SELECTED_AREA_OUTLINE,
        type: 'line',
        source: SELECTED_AREA_SOURCE,
        paint: {
          'line-color': '#ffffff',
          'line-width': 3.2,
          'line-opacity': 0.95,
        },
      });
    }

    // 5. Venue Markers Source & Layer
    if (!map.getSource(VENUE_SOURCE)) {
      map.addSource(VENUE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(VENUE_LAYER)) {
      map.addLayer({
        id: VENUE_LAYER,
        type: 'circle',
        source: VENUE_SOURCE,
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#4f46e5',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, [geojson]);

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const coords = CITIES[city] || CITIES['New York'];
    const basemapConfig = BASEMAPS[activeBasemap] || BASEMAPS.esriStreet;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapConfig.style,
      center: [coords.lng, coords.lat],
      zoom: coords.zoom || 12,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    map.on('load', () => {
      map.resize();
      setupDataLayers(map, geojson);
    });

    // Click on hexagon cell
    map.on('click', FILL_LAYER, (e) => {
      e.originalEvent?.stopPropagation();
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const props = feature.properties;
        onCellClickRef.current?.({
          id: props.id || props.cell_id,
          cell_id: props.cell_id || props.id,
          label: props.label,
          gap: Number(props.gap) || 0,
          demand: Number(props.demand) || 0,
          supply: Number(props.supply) || 0,
          confidence: props.confidence,
          lat: Number(props.lat),
          lon: Number(props.lon),
          radius_km: Number(props.radius_km) || 1.2,
          geometry: feature.geometry,
        });
      }
    });

    // Click on blank map (Live Coordinate Query)
    map.on('click', (e) => {
      const bbox = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6],
      ];
      const features = map.queryRenderedFeatures(bbox, { layers: [FILL_LAYER] });
      if (!features || features.length === 0) {
        onLivePointClickRef.current?.({
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
        });
      }
    });

    // Hover tooltip
    map.on('mouseenter', FILL_LAYER, (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (e.features && e.features.length > 0) {
        const f = e.features[0];
        const gap = Number(f.properties.gap || 0).toFixed(2);
        const label = f.properties.label || `Area ${f.properties.id}`;
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family: Inter, sans-serif; line-height: 1.4; padding: 4px;">
              <strong style="color: #0f172a; font-size: 13px;">${label}</strong><br/>
              <span style="color: #64748b; font-size: 11px;">Opportunity Gap: </span>
              <span style="font-weight: 700; color: #10B981; font-size: 13px;">${gap}</span>
            </div>`
          )
          .addTo(map);
      }
    });

    map.on('mousemove', FILL_LAYER, (e) => {
      if (e.features && e.features.length > 0) {
        popupRef.current.setLngLat(e.lngLat);
      }
    });

    map.on('mouseleave', FILL_LAYER, () => {
      map.getCanvas().style.cursor = '';
      popupRef.current.remove();
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      if (pointerPrimaryRef.current) pointerPrimaryRef.current.remove();
      if (pointerSecondaryRef.current) pointerSecondaryRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Change basemap style
  const handleBasemapChange = (key) => {
    setActiveBasemap(key);
    setShowBasemapPicker(false);
    const map = mapRef.current;
    if (!map) return;

    const basemapConfig = BASEMAPS[key];
    if (basemapConfig) {
      map.setStyle(basemapConfig.style);
      map.once('style.load', () => {
        setupDataLayers(map, geojson);
      });
    }
  };

  // Fly to city when changed
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !city) return;
    const coords = CITIES[city];
    if (!coords) return;
    map.flyTo({
      center: [coords.lng, coords.lat],
      zoom: coords.zoom || 12,
      duration: 1000,
    });
  }, [city]);

  // Update GeoJSON hex cells
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      const source = map.getSource(SOURCE_ID);
      if (source && geojson) {
        source.setData(geojson);
      } else {
        setupDataLayers(map, geojson);
      }
    } else {
      map.once('load', () => setupDataLayers(map, geojson));
    }
  }, [geojson, setupDataLayers]);

  // UPDATE SELECTED LOCATION POINTER MARKER(S)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Helper to clear existing markers
    if (pointerPrimaryRef.current) {
      pointerPrimaryRef.current.remove();
      pointerPrimaryRef.current = null;
    }
    if (pointerSecondaryRef.current) {
      pointerSecondaryRef.current.remove();
      pointerSecondaryRef.current = null;
    }

    // Determine target location for Primary Pointer (Location A / Selected Cell / Live Point)
    let primaryTarget = null;
    if (livePoint?.lat && livePoint?.lon) {
      primaryTarget = {
        lat: livePoint.lat,
        lon: livePoint.lon,
        label: livePoint.label || `Live Point (${livePoint.lat.toFixed(4)}, ${livePoint.lon.toFixed(4)})`,
        color: '#ec4899',
        pulseColor: 'rgba(236, 72, 153, 0.4)',
        letter: compareMode ? 'A' : null,
      };
    } else if (selectedCell?.lat && selectedCell?.lon) {
      primaryTarget = {
        lat: selectedCell.lat,
        lon: selectedCell.lon,
        label: selectedCell.label || `Selected Area (${selectedCell.lat.toFixed(4)}, ${selectedCell.lon.toFixed(4)})`,
        color: '#4f46e5',
        pulseColor: 'rgba(79, 70, 229, 0.4)',
        letter: compareMode ? 'A' : null,
      };
    }

    if (primaryTarget) {
      const el = createMarkerDom(primaryTarget);
      pointerPrimaryRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([primaryTarget.lon, primaryTarget.lat])
        .addTo(map);
    }

    // Determine target location for Secondary Pointer (Compare Location B)
    if (compareMode && compareCell?.lat && compareCell?.lon) {
      const secondaryTarget = {
        lat: compareCell.lat,
        lon: compareCell.lon,
        label: compareCell.label || `Location B (${compareCell.lat.toFixed(4)}, ${compareCell.lon.toFixed(4)})`,
        color: '#059669',
        pulseColor: 'rgba(5, 150, 105, 0.4)',
        letter: 'B',
      };
      const el = createMarkerDom(secondaryTarget);
      pointerSecondaryRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([secondaryTarget.lon, secondaryTarget.lat])
        .addTo(map);
    }
  }, [livePoint, selectedCell, compareCell, compareMode]);

  // UPDATE SELECTED AREA COVERAGE GEOMETRY (Hexagon polygon or 1.5km circle)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateSelectedArea = () => {
      const source = map.getSource(SELECTED_AREA_SOURCE);
      if (!source) return;

      const features = [];

      // 1. Live Point Circle (1.5 km Catchment Area)
      if (livePoint?.lat && livePoint?.lon) {
        const circleCoords = circleVertices(livePoint.lat, livePoint.lon, 1.5);
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [circleCoords],
          },
          properties: {
            id: 'live-area',
            color: '#ec4899',
            label: 'Catchment: 1.5 km Radius',
          },
        });
      }

      // 2. Selected Cell Hexagon Polygon (Location A)
      if (selectedCell?.lat && selectedCell?.lon) {
        // Try to find matching geometry in geojson
        let cellPolygon = null;
        if (selectedCell.geometry) {
          cellPolygon = selectedCell.geometry;
        } else if (geojson?.features) {
          const matched = geojson.features.find(
            (f) => f.properties?.id === selectedCell.id || f.properties?.cell_id === selectedCell.id
          );
          if (matched) cellPolygon = matched.geometry;
        }

        if (!cellPolygon) {
          const hexCoords = hexagonVertices(selectedCell.lat, selectedCell.lon, selectedCell.radius_km || 1.2);
          cellPolygon = { type: 'Polygon', coordinates: [hexCoords] };
        }

        features.push({
          type: 'Feature',
          geometry: cellPolygon,
          properties: {
            id: selectedCell.id || 'cell-a-area',
            color: '#4f46e5',
            label: selectedCell.label || 'Selected Hexagon',
          },
        });
      }

      // 3. Compare Cell Hexagon Polygon (Location B)
      if (compareMode && compareCell?.lat && compareCell?.lon) {
        let cellPolygon = null;
        if (compareCell.geometry) {
          cellPolygon = compareCell.geometry;
        } else if (geojson?.features) {
          const matched = geojson.features.find(
            (f) => f.properties?.id === compareCell.id || f.properties?.cell_id === compareCell.id
          );
          if (matched) cellPolygon = matched.geometry;
        }

        if (!cellPolygon) {
          const hexCoords = hexagonVertices(compareCell.lat, compareCell.lon, compareCell.radius_km || 1.2);
          cellPolygon = { type: 'Polygon', coordinates: [hexCoords] };
        }

        features.push({
          type: 'Feature',
          geometry: cellPolygon,
          properties: {
            id: compareCell.id || 'cell-b-area',
            color: '#059669',
            label: compareCell.label || 'Compare Hexagon B',
          },
        });
      }

      source.setData({
        type: 'FeatureCollection',
        features,
      });
    };

    if (map.isStyleLoaded()) {
      updateSelectedArea();
    } else {
      map.once('style.load', updateSelectedArea);
    }
  }, [livePoint, selectedCell, compareCell, compareMode, geojson]);

  // Update venue markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateVenues = () => {
      const source = map.getSource(VENUE_SOURCE);
      if (source) {
        if (venueMarkers && venueMarkers.length > 0) {
          const features = venueMarkers.map((v) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [v.lon || v.lng, v.lat],
            },
            properties: {
              name: v.name || 'Venue',
            },
          }));
          source.setData({ type: 'FeatureCollection', features });
        } else {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateVenues();
    } else {
      map.once('style.load', updateVenues);
    }
  }, [venueMarkers]);

  // Recenter map on selected target
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    const target = livePoint || selectedCell;
    if (target?.lat && target?.lon) {
      map.flyTo({
        center: [target.lon, target.lat],
        zoom: 13.5,
        duration: 900,
      });
    } else {
      const coords = CITIES[city] || CITIES['New York'];
      map.flyTo({
        center: [coords.lng, coords.lat],
        zoom: coords.zoom || 12,
        duration: 900,
      });
    }
  };

  return (
    <div className="relative w-full h-full select-none">
      {/* MapLibre DOM container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Floating Map Controls (bottom-left) */}
      <div className="absolute bottom-6 left-4 z-10 flex items-center gap-2">
        {/* Basemap Picker */}
        <div className="relative">
          <button
            onClick={() => setShowBasemapPicker(!showBasemapPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-white transition-all cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-600" />
            <span>Map Style</span>
          </button>

          {showBasemapPicker && (
            <div className="absolute bottom-10 left-0 bg-white rounded-xl shadow-xl border border-slate-200 p-2 w-56 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">Select Free Basemap</p>
              {Object.values(BASEMAPS).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleBasemapChange(b.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeBasemap === b.id
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center on Selected Button */}
        {(selectedCell || livePoint) && (
          <button
            onClick={handleRecenter}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-lg shadow-md border border-slate-200 text-xs font-medium text-indigo-700 hover:bg-white transition-all cursor-pointer"
            title="Focus map on selected location"
          >
            <Crosshair className="h-3.5 w-3.5 text-indigo-600" />
            <span>Center Location</span>
          </button>
        )}
      </div>
    </div>
  );
}
