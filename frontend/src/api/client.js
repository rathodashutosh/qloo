import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

/**
 * Axios client instance configured with base URL and defaults.
 */
const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API Error ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      console.error('Network error: No response received');
    } else {
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch available concepts.
 */
export async function fetchConcepts() {
  const { data } = await client.get('/concepts');
  return data;
}

/**
 * Fetch map data (hex cells) for a given city and concept.
 */
export async function fetchMapData(city, conceptId) {
  const { data } = await client.get('/map', {
    params: {
      city,
      concept: conceptId,
      concept_id: conceptId,
    },
  });
  return data;
}

/**
 * Fetch detailed data for a single cell.
 */
export async function fetchCellDetail(cellId, conceptId) {
  const { data } = await client.get(`/cell/${cellId}`, {
    params: {
      concept: conceptId,
      concept_id: conceptId,
    },
  });
  return data;
}

/**
 * Generate an AI report for a cell.
 */
export async function generateReport(cellId, conceptId, city) {
  const { data } = await client.post('/report', {
    cell_id: cellId,
    concept_id: conceptId,
    city,
  });
  return data;
}

/**
 * Send a chat message with context.
 */
export async function sendChatMessage(message, context = {}) {
  const { data } = await client.post('/chat', {
    message,
    context,
    cell_id: context?.cell_id,
    concept_id: context?.concept_id,
    city: context?.city,
  });
  return data;
}

/**
 * Real-time live query for a clicked point.
 */
export async function liveQuery(lat, lon, conceptId, radiusKm = 1.5) {
  const { data } = await client.post('/live-query', {
    lat,
    lon,
    concept_id: conceptId,
    radius_km: radiusKm,
  });
  return data;
}

/**
 * Key status check
 */
export async function fetchKeyStatus() {
  const { data } = await client.get('/settings/keys');
  return data;
}

/**
 * Update API keys dynamically
 */
export async function updateApiKeys({ qlooApiKey, openaiApiKey, eeProjectId }) {
  const { data } = await client.post('/settings/keys', {
    qloo_api_key: qlooApiKey,
    openai_api_key: openaiApiKey,
    ee_project_id: eeProjectId,
  });
  return data;
}

/**
 * Upload .env or key file
 */
export async function uploadEnvFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/settings/upload-env', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

/**
 * Earth Engine (GEE) API Calls
 */
export async function fetchGeeStatus() {
  const { data } = await client.get('/gee/status');
  return data;
}

export async function fetchGeeTileUrl(layer = 'sentinel1') {
  const { data } = await client.get('/gee/tile-url', {
    params: { layer },
  });
  return data;
}

export async function initGee({ projectId, serviceAccountEmail, serviceAccountKey }) {
  const { data } = await client.post('/gee/init', {
    project_id: projectId,
    service_account_email: serviceAccountEmail,
    service_account_key: serviceAccountKey,
  });
  return data;
}

export async function uploadGeeServiceAccount(file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await client.post('/gee/upload-service-account', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function verifySentinel1() {
  const { data } = await client.get('/gee/verify-sentinel1');
  return data;
}

export default client;
