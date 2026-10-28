import { useState, useEffect, useCallback } from 'react';
import { fetchMapData } from '../api/client';
import { hexagonVertices } from '../utils/constants';

/**
 * Hook to fetch and manage map GeoJSON data.
 * Fetches hex-cell data when city/concept changes.
 * Ensures all features have valid Polygon geometry for MapLibre rendering.
 */
export default function useMapData(city, conceptId) {
  const [geojson, setGeojson] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!city || !conceptId) {
      setGeojson(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchMapData(city, conceptId);

      let features = [];
      if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        features = data.features;
      } else if (Array.isArray(data)) {
        features = data;
      }

      // Ensure every feature has valid Polygon coordinates and standardized properties
      const normalizedFeatures = features.map((f) => {
        const props = f.properties || f;
        const cellId = props.id || props.cell_id || f.id;
        const lat = props.lat;
        const lon = props.lon;

        let geometry = f.geometry;
        if (!geometry || geometry.type !== 'Polygon') {
          // Calculate polygon vertices
          const poly = hexagonVertices(lat, lon, props.radius_km || 1.2);
          geometry = {
            type: 'Polygon',
            coordinates: [poly],
          };
        }

        return {
          type: 'Feature',
          id: cellId,
          properties: {
            id: cellId,
            cell_id: cellId,
            label: props.label || `Cell ${cellId}`,
            gap: typeof props.gap === 'number' ? props.gap : 0.25,
            demand: typeof props.demand === 'number' ? props.demand : 0.5,
            supply: typeof props.supply === 'number' ? props.supply : 0.5,
            confidence: props.confidence || 'medium',
            lat,
            lon,
          },
          geometry,
        };
      });

      setGeojson({
        type: 'FeatureCollection',
        features: normalizedFeatures,
      });
    } catch (err) {
      console.error('Failed to load map data:', err);
      setError(err.message || 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, [city, conceptId]);

  useEffect(() => {
    load();
  }, [load]);

  return { geojson, loading, error, reload: load };
}
