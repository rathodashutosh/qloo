import { useState, useEffect } from 'react';
import { fetchGeeStatus, initGee, uploadGeeServiceAccount, verifySentinel1 } from '../api/client';
import {
  Satellite,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  RefreshCw,
  ExternalLink,
  Radar,
  Sparkles,
  Info
} from 'lucide-react';

export default function GeeModal({ isOpen, onClose, onLayerSelect, activeLayerId }) {
  const [status, setStatus] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const res = await fetchGeeStatus();
      setStatus(res);
      if (res.project) {
        setProjectId(res.project);
      }
    } catch (e) {
      console.error('Failed to load GEE status', e);
    }
  };

  if (!isOpen) return null;

  const handleInitProject = async (e) => {
    e.preventDefault();
    if (!projectId.trim()) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await initGee({ projectId: projectId.trim() });
      setFeedback({ success: true, message: `Earth Engine initialized with project: ${res.project}` });
      await loadStatus();
    } catch (err) {
      setFeedback({
        success: false,
        message: err.response?.data?.detail || err.message || 'Initialization failed. Check project ID.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFeedback(null);
    try {
      const res = await uploadGeeServiceAccount(file);
      setFeedback({ success: true, message: res.message });
      await loadStatus();
    } catch (err) {
      setFeedback({
        success: false,
        message: err.response?.data?.detail || err.message || 'Failed to upload service account',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySentinel1 = async () => {
    setVerifyLoading(true);
    setVerificationResult(null);
    try {
      const res = await verifySentinel1();
      setVerificationResult({ success: true, data: res });
    } catch (err) {
      setVerificationResult({
        success: false,
        error: err.response?.data?.detail || err.message || 'Verification failed. Authenticate Earth Engine first.',
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md">
              <Satellite className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                Google Earth Engine (GEE)
                <span className="text-[10px] font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200 border border-sky-400/30">
                  Remote Sensing
                </span>
              </h3>
              <p className="text-xs text-sky-100/80">
                Copernicus Sentinel radar, optical satellite imagery, and night lights
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Radar className="h-4 w-4 text-indigo-600" />
                Earth Engine Status
              </span>
              {status?.initialized ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Live Connected (Project: {status.project})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold text-[11px]">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  Satellite Fallback Active
                </span>
              )}
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              When live GEE is connected, real Sentinel-1 SAR and Sentinel-2 satellite tiles are streamed directly beneath your taste gap opportunity hexagons. High-resolution satellite basemap is currently active as the baseline.
            </p>
          </div>

          {/* Earth Observation Layers Selector */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              Available Earth Observation Layers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Sentinel-1 */}
              <div
                onClick={() => onLayerSelect?.('geeSentinel1')}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  activeLayerId === 'geeSentinel1'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    🛰️ Copernicus Sentinel-1
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono rounded">
                    S1_GRD
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Synthetic Aperture Radar (SAR). Penetrates clouds and illuminates dense commercial concrete structures and urban building footprints.
                </p>
              </div>

              {/* High-Res Satellite */}
              <div
                onClick={() => onLayerSelect?.('satellite')}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  activeLayerId === 'satellite'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    🌍 High-Res Earth Imagery
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded">
                    Ready
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Crisp optical satellite photography showing actual roofs, outdoor patios, high streets, parking lots, and walkable pedestrian corridors.
                </p>
              </div>

              {/* Night Lights */}
              <div
                onClick={() => onLayerSelect?.('geeNightLights')}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  activeLayerId === 'geeNightLights'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    🌃 VIIRS Earth at Night
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono rounded">
                    VIIRS/DNB
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Nocturnal luminosity directly correlated with foot traffic, evening nightlife vitality, and retail corridor clustering.
                </p>
              </div>

              {/* Detailed Street Map */}
              <div
                onClick={() => onLayerSelect?.('esriStreet')}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  activeLayerId === 'esriStreet'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    🗺️ Detailed Street Map
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono rounded">
                    Streets
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Standard cartographic street network with road names, transit stops, and neighborhood boundaries.
                </p>
              </div>
            </div>
          </div>

          {/* Connect / Authenticate Earth Engine */}
          <div className="border-t border-slate-200 pt-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              Configure Google Earth Engine Authentication
            </h4>

            <form onSubmit={handleInitProject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Cloud Project ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. your-gcp-project-id"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={loading || !projectId.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Initialize Project'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  If you have run <code>earthengine authenticate</code> in terminal, entering your GCP Project ID initializes GEE immediately.
                </p>
              </div>
            </form>

            {/* Service Account Upload */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <p className="text-xs font-semibold text-slate-800">Or use a Service Account Key</p>
                <p className="text-[11px] text-slate-500">For headless server or instant GEE verification</p>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-300 shadow-xs">
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                <span>Upload JSON Key</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Verification Button: ee.ImageCollection('COPERNICUS/S1_GRD').first().getInfo() */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-950">
                  Verify Sentinel-1 Collection
                </span>
                <button
                  type="button"
                  onClick={handleVerifySentinel1}
                  disabled={verifyLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {verifyLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
                  <span>Run Verification</span>
                </button>
              </div>
              <p className="text-[11px] text-indigo-900/70 font-mono">
                ee.ImageCollection('COPERNICUS/S1_GRD').first().getInfo()
              </p>

              {/* Verification Output */}
              {verificationResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs font-mono mt-2 ${
                    verificationResult.success
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-red-50 text-red-900 border border-red-200'
                  }`}
                >
                  {verificationResult.success ? (
                    <div className="space-y-1">
                      <p className="font-semibold text-emerald-800">✅ Sentinel-1 Verified Successfully!</p>
                      <p className="text-[10px]">Image ID: {verificationResult.data.image_id}</p>
                      <p className="text-[10px]">Bands: {verificationResult.data.bands?.join(', ')}</p>
                      <p className="text-[10px]">Spacecraft: {verificationResult.data.properties?.spacecraft_name || 'Sentinel-1'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-red-800">Verification Result:</p>
                      <p className="text-[10px] mt-0.5">{verificationResult.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Feedback Message */}
            {feedback && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  feedback.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {feedback.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            earthengine-api v1.7+ active
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
