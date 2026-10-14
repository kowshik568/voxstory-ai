/**
 * VoxStory AI - Provider Settings & Diagnostics Modal
 */

import React, { useState } from 'react';
import { X, Key, CheckCircle2, AlertTriangle, ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { ProviderHealth } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: ProviderHealth | null;
  onRefreshHealth: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  health,
  onRefreshHealth,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLive = health?.hasApiKey;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.data?.hasApiKey) {
        setTestResult('Successfully connected to Gnani Timbre API with live key.');
      } else {
        setTestResult('Server online. Operating in high-fidelity Studio Demo Mode (GNANI_API_KEY not configured).');
      }
    } catch {
      setTestResult('Failed to reach local server.');
    } finally {
      setTesting(false);
      onRefreshHealth();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#10121a] border border-[#232738] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#1f2231] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Gnani Timbre v3.0 Provider Settings
              </h3>
              <p className="text-xs text-[#8e92a8]">
                API Configuration & Connection Status
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e92a8] hover:text-white hover:bg-[#1b1f2e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs text-[#b8bdcf]">
          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            isLive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}>
            {isLive ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-white text-sm mb-0.5">
                {isLive ? 'Live Gnani API Connected' : 'Studio Demo Mode Active'}
              </h4>
              <p className="text-[11px] leading-relaxed">
                {isLive
                  ? 'Your GNANI_API_KEY is active. Voice generation requests are securely sent directly to Gnani Vachana / Timbre v3.0.'
                  : 'No GNANI_API_KEY detected in the environment. VoxStory AI is running in interactive Studio Demo Mode with procedural audio synthesis.'}
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-[#141622] rounded-xl border border-[#222638] divide-y divide-[#1e2233]">
            <div className="p-3 flex justify-between items-center">
              <span className="text-[#8e92a8]">Target Platform</span>
              <span className="font-mono text-white">Gnani AI Vachana TTS</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-[#8e92a8]">Model Engine</span>
              <span className="font-mono text-purple-300">Timbre v3.0</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-[#8e92a8]">Inference Endpoint</span>
              <span className="font-mono text-xs text-[#9fa3b8] truncate max-w-[220px]">
                api.vachana.ai/api/v1/tts/inference
              </span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-[#8e92a8]">Authentication Header</span>
              <span className="font-mono text-xs text-[#9fa3b8]">X-API-Key-ID</span>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="p-4 rounded-xl bg-[#0b0c10] border border-[#1c1f2e] space-y-2">
            <h5 className="font-bold text-white flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>How to Configure Live API Key</span>
            </h5>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#8e92a8] leading-relaxed">
              <li>Obtain your API key from the Gnani.ai Vachana portal.</li>
              <li>Add <code className="text-purple-300 font-mono">GNANI_API_KEY="your_key"</code> to your <code className="text-white">.env</code> file.</li>
              <li>Restart the server. All requests will automatically route to live Timbre v3.0 inference.</li>
            </ol>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div className="p-3 rounded-lg bg-[#181a26] border border-[#282d3f] text-[11px] font-mono text-purple-300">
              {testResult}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1f2231] bg-[#0c0e15] flex items-center justify-between">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#171a26] hover:bg-[#232738] text-white text-xs font-medium border border-[#25293d] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
