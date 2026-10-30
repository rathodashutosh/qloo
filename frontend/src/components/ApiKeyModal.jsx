import { useState, useEffect } from 'react';
import { updateApiKeys, uploadEnvFile, fetchKeyStatus } from '../api/client';
import { Key, Upload, CheckCircle2, AlertCircle, X, Shield, RefreshCw } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, onKeysUpdated }) {
  const [qlooKey, setQlooKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [resultMessage, setResultMessage] = useState(null);
  const [isSuccess, setIsSuccess] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchKeyStatus()
        .then((data) => setStatus(data))
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!qlooKey.trim() && !geminiKey.trim() && !openaiKey.trim()) return;

    setLoading(true);
    setResultMessage(null);
    setIsSuccess(null);

    try {
      const res = await updateApiKeys({
        qlooApiKey: qlooKey.trim() || undefined,
        geminiApiKey: geminiKey.trim() || undefined,
        openaiApiKey: openaiKey.trim() || undefined,
      });

      setIsSuccess(res.qloo_valid !== false);
      setResultMessage(res.message);

      const refreshed = await fetchKeyStatus();
      setStatus(refreshed);
      onKeysUpdated?.(refreshed);

      if (res.qloo_valid !== false) {
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      setIsSuccess(false);
      setResultMessage(err.response?.data?.detail || err.message || 'Failed to update keys');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResultMessage(null);
    setIsSuccess(null);

    try {
      const res = await uploadEnvFile(file);
      setIsSuccess(res.qloo_valid !== false);
      setResultMessage(`File uploaded: ${res.message}`);
      const refreshed = await fetchKeyStatus();
      setStatus(refreshed);
      onKeysUpdated?.(refreshed);
    } catch (err) {
      setIsSuccess(false);
      setResultMessage(err.response?.data?.detail || err.message || 'Failed to upload .env file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-200" />
            <h3 className="font-semibold text-base">Configure Qloo & Gemini AI Keys</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-500 font-medium">Qloo Taste API: </span>
                {status?.qloo_configured ? (
                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Active ({status.qloo_key_preview})
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    Key Needed
                  </span>
                )}
              </div>
              <span className="text-slate-400 text-[10px]">hackathon.api.qloo.com</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <div>
                <span className="text-slate-500 font-medium">Gemini 2.5 Flash: </span>
                {status?.gemini_configured ? (
                  <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Integrated ({status.gemini_key_preview})
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    Optional / Key Needed
                  </span>
                )}
              </div>
              <span className="text-slate-400 text-[10px]">AI Location Analyst</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Qloo API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="hack_..."
                  value={qlooKey}
                  onChange={(e) => setQlooKey(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Google Gemini API Key
              </label>
              <input
                type="password"
                placeholder="AQ... or AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Powers AI Location Analyst chat, custom location briefs, and head-to-head comparison reports.
              </p>
            </div>

            {/* Validation Feedback */}
            {resultMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{resultMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              {/* File upload */}
              <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors border border-slate-200">
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                <span>Upload .env</span>
                <input
                  type="file"
                  accept=".env,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={loading || (!qlooKey.trim() && !openaiKey.trim())}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {loading ? 'Validating with Qloo...' : 'Validate & Save Keys'}
              </button>
            </div>
          </form>

          {/* Security note */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400 border-t border-slate-100 pt-3">
            <Shield className="h-3.5 w-3.5 text-slate-400" />
            <span>Keys are kept server-side in your local environment and never sent to third parties.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
