/**
 * Application constants: city coordinates, API URLs, concept emoji map, 100% free basemap styles.
 */

export const API_BASE_URL = '/api';

export const CITIES = {
  'Bengaluru': { lat: 12.9716, lng: 77.5946, zoom: 12 },
  'Mumbai': { lat: 19.0760, lng: 72.8777, zoom: 12 },
  'Delhi NCR': { lat: 28.6139, lng: 77.2090, zoom: 12 },
  'New York': { lat: 40.7128, lng: -74.006, zoom: 12 },
  'London': { lat: 51.5074, lng: -0.1278, zoom: 12 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437, zoom: 12 },
  'Chicago': { lat: 41.8781, lng: -87.6298, zoom: 12 },
  'Austin': { lat: 30.2672, lng: -97.7431, zoom: 12 },
};

export const DEFAULT_CITY = 'Bengaluru';

export const CONCEPT_ICONS = {
  'Specialty Coffee': '☕',
  'Live Music Venue': '🎵',
  'Board Game Cafe': '🎲',
  'Bookstore Cafe': '📚',
  'Vegan Restaurant': '🌱',
  'Co-working Cafe': '💻',
  'Craft Brewery': '🍺',
  'Natural Wine Bar': '🍷',
};

/**
 * 100% Free, reliable raster basemaps with NO watermarks and NO API key requirements.
 */
export const BASEMAPS = {
  esriStreet: {
    id: 'esriStreet',
    name: 'Detailed Street Map (ESRI)',
    style: {
      version: 8,
      sources: {
        'esri-streets': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS',
        },
      },
      layers: [
        {
          id: 'esri-streets-layer',
          type: 'raster',
          source: 'esri-streets',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  esriLight: {
    id: 'esriLight',
    name: 'Clean Light Canvas (ESRI)',
    style: {
      version: 8,
      sources: {
        'esri-canvas': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, HERE, Garmin, FAO, NOAA, USGS, EPA',
        },
      },
      layers: [
        {
          id: 'esri-canvas-layer',
          type: 'raster',
          source: 'esri-canvas',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  osm: {
    id: 'osm',
    name: 'OpenStreetMap (Standard)',
    style: {
      version: 8,
      sources: {
        'osm-standard': {
          type: 'raster',
          tiles: [
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: 'osm-standard-layer',
          type: 'raster',
          source: 'osm-standard',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  esriTopo: {
    id: 'esriTopo',
    name: 'Topographic Map (ESRI)',
    style: {
      version: 8,
      sources: {
        'esri-topo': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, DeLorme, NAVTEQ, TomTom, Intermap, IPC, USGS, FAO, NPS',
        },
      },
      layers: [
        {
          id: 'esri-topo-layer',
          type: 'raster',
          source: 'esri-topo',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  satellite: {
    id: 'satellite',
    name: 'Earth Satellite Imagery (High-Res)',
    badge: 'Earth Observation',
    style: {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA, USGS',
        },
      },
      layers: [
        {
          id: 'esri-satellite-layer',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  geeSentinel1: {
    id: 'geeSentinel1',
    name: 'Copernicus Sentinel-1 SAR (Radar)',
    badge: 'Google Earth Engine',
    isGee: true,
    geeLayer: 'sentinel1',
    description: 'COPERNICUS/S1_GRD radar penetrating weather and clouds; bright backscatter highlights dense commercial built infrastructure.',
    style: {
      version: 8,
      sources: {
        'gee-s1': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Google Earth Engine | COPERNICUS/S1_GRD',
        },
      },
      layers: [
        {
          id: 'gee-s1-layer',
          type: 'raster',
          source: 'gee-s1',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  geeNightLights: {
    id: 'geeNightLights',
    name: 'Earth at Night (VIIRS Nighttime Lights)',
    badge: 'Google Earth Engine',
    isGee: true,
    geeLayer: 'nightlights',
    description: 'NOAA/VIIRS monthly radiance proxy for foot traffic, nightlife vitality, and retail clusters.',
    style: {
      version: 8,
      sources: {
        'gee-viirs': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Google Earth Engine | NOAA/VIIRS Nighttime Lights',
        },
      },
      layers: [
        {
          id: 'gee-viirs-layer',
          type: 'raster',
          source: 'gee-viirs',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

export const DEFAULT_BASEMAP = 'esriStreet';
export const MAP_STYLE = BASEMAPS.esriStreet.style;

/**
 * Generate hexagon vertices from a center point and radius.
 */
export function hexagonVertices(centerLat, centerLon, radiusKm) {
  const vertices = [];
  for (let i = 0; i < 6; i++) {
    const angle = (60 * i - 30) * Math.PI / 180;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const lat = centerLat + (dy / 111.32);
    const lon = centerLon + (dx / (111.32 * Math.cos(centerLat * Math.PI / 180)));
    vertices.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
  }
  vertices.push(vertices[0]); // close the polygon
  return vertices;
}
