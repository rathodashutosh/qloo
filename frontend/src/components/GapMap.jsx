import { useRef, useEffect, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAPS, DEFAULT_BASEMAP, CITIES } from '../utils/constants';
import { gapFillColorExpression } from '../utils/colors';
import { Layers } from 'lucide-react';

const SOURCE_ID = 'hex-cells';
const FILL_LAYER = 'cells-fill';
const OUTLINE_LAYER = 'cells-outline';
const VENUE_SOURCE = 'venues';
const VENUE_LAYER = 'venue-dots';
const LIVE_POINT_SOURCE = 'live-point';
const LIVE_POINT_LAYER = 'live-point-circle';
const LIVE_POINT_PULSE = 'live-point-pulse';

/**
 * GapMap — interactive MapLibre map with:
 * - 100% free, unwatermarked basemaps (ESRI World Street, ESRI Light, OpenStreetMap)
 * - Semi-transparent opportunity hexagons showing street-level details
 * - Click and hover handlers
 * - Layer switcher
 */
export default function GapMap({
  city,
  geojson,
  selectedCellId,
  venueMarkers,
  livePoint,
  onCellClick,
  onLivePointClick,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
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
          'line-width': [
            'case',
            ['==', ['coalesce', ['get', 'id'], ['get', 'cell_id'], ''], selectedCellId || ''],
            3.5,
            1.8,
          ],
          'line-opacity': 0.85,
        },
      });
    }

    // 4. Venue Markers Source & Layer
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

    // 5. Live Point Source & Layers
    if (!map.getSource(LIVE_POINT_SOURCE)) {
      map.addSource(LIVE_POINT_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(LIVE_POINT_PULSE)) {
      map.addLayer({
        id: LIVE_POINT_PULSE,
        type: 'circle',
        source: LIVE_POINT_SOURCE,
        paint: {
          'circle-radius': 22,
          'circle-color': '#ec4899',
          'circle-opacity': 0.35,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#db2777',
        },
      });
    }

    if (!map.getLayer(LIVE_POINT_LAYER)) {
      map.addLayer({
        id: LIVE_POINT_LAYER,
        type: 'circle',
        source: LIVE_POINT_SOURCE,
        paint: {
          'circle-radius': 8,
          'circle-color': '#db2777',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });
    }
  }, [geojson, selectedCellId]);

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
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const props = feature.properties;
        onCellClick?.({
          id: props.id || props.cell_id,
          cell_id: props.cell_id || props.id,
          label: props.label,
          gap: Number(props.gap) || 0,
          demand: Number(props.demand) || 0,
          supply: Number(props.supply) || 0,
          confidence: props.confidence,
          lat: Number(props.lat),
          lon: Number(props.lon),
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
        onLivePointClick?.({
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
      duration: 1200,
    });
  }, [city]);

  // Update GeoJSON hex cells whenever geojson changes
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

  // Selected cell outline styling
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      if (map.getLayer(OUTLINE_LAYER)) {
        map.setPaintProperty(OUTLINE_LAYER, 'line-width', [
          'case',
          ['==', ['coalesce', ['get', 'id'], ['get', 'cell_id'], ''], selectedCellId || ''],
          4.0,
          1.8,
        ]);
        map.setPaintProperty(OUTLINE_LAYER, 'line-color', [
          'case',
          ['==', ['coalesce', ['get', 'id'], ['get', 'cell_id'], ''], selectedCellId || ''],
          '#312e81',
          '#0f172a',
        ]);
      }
    } catch {
      // ignore
    }
  }, [selectedCellId]);

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

  // Update live point marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateLivePoint = () => {
      const source = map.getSource(LIVE_POINT_SOURCE);
      if (source) {
        if (livePoint?.lat && livePoint?.lon) {
          source.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [livePoint.lon, livePoint.lat],
                },
                properties: {
                  label: livePoint.label || 'Live Point',
                },
              },
            ],
          });
        } else {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateLivePoint();
    } else {
      map.once('style.load', updateLivePoint);
    }
  }, [livePoint]);

  return (
    <div className="relative w-full h-full">
      {/* MapLibre DOM container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Basemap Switcher Button (bottom-left) */}
      <div className="absolute bottom-6 left-4 z-10">
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
      </div>
    </div>
  );
}
