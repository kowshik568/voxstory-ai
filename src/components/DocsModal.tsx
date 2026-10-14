/**
 * VoxStory AI - Gnani Timbre v3.0 Integration & API Documentation Modal
 */

import React from 'react';
import { X, BookOpen, ExternalLink, Code2, Sparkles, CheckCircle2 } from 'lucide-react';
import { VERIFIED_TAGS } from '../lib/tagCatalog';

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#10121a] border border-[#232738] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#1f2231] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Gnani Timbre v3.0 Technical Documentation
              </h3>
              <p className="text-xs text-[#8e92a8]">
                Official Audio Tags, REST Inference & Directorial Continuation Specification
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8 text-xs text-[#b8bdcf] leading-relaxed">
          {/* Section 1: Overview */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              1. Platform & Model Overview
            </h4>
            <p>
              Gnani AI’s <strong>Timbre v3.0</strong> is an expressive text-to-speech (TTS) engine built on the Vachana platform, designed specifically for fine-grained vocal direction. Rather than relying on generic emotion presets, Timbre v3.0 accepts inline <strong>audio tags</strong> directly inside the script text.
            </p>
            <p>
              When audio tags are omitted, the model naturally modulates speech using sentence semantics and punctuation. When tags are provided, the model performs the requested vocal modulation or non-verbal sound without reading the bracketed tag aloud.
            </p>
          </div>

          {/* Section 2: Continuation Semantics */}
          <div className="p-4 rounded-xl bg-[#141622] border border-[#222638] space-y-2">
            <h5 className="font-bold text-white text-xs flex items-center gap-2 text-purple-300">
              <Sparkles className="w-4 h-4" />
              2. Core Rule: Continuation Until Next Tag
            </h5>
            <p className="text-[11px] text-[#a0a5bc]">
              Unlike XML or SSML tags that require closing tags (e.g., <code className="text-[#e2e8f0]">&lt;/whisper&gt;</code>), Timbre v3.0 audio tags are <strong>open continuation cues</strong>:
            </p>
            <div className="p-3 rounded-lg bg-[#0b0c10] border border-[#1b1e2a] font-mono text-[11px] text-purple-200">
              &lt;whispers&gt; The door unlocked slowly. &lt;slow&gt; He stepped inside the silent room. &lt;excited&gt; He found the hidden treasure!
            </div>
            <p className="text-[11px] text-[#8e92a8]">
              The whisper continues until <code className="text-purple-300">&lt;slow&gt;</code> is encountered, which in turn continues until <code className="text-purple-300">&lt;excited&gt;</code> takes effect.
            </p>
          </div>

          {/* Section 3: The 13 Verified Audio Tags */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              3. The 13 Verified Audio Tags Catalog
            </h4>
            <div className="overflow-x-auto border border-[#222638] rounded-xl">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#171a26] text-[#8e92a8] border-b border-[#222638]">
                    <th className="p-2.5 font-semibold">Tag Syntax</th>
                    <th className="p-2.5 font-semibold">Category</th>
                    <th className="p-2.5 font-semibold">Description</th>
                    <th className="p-2.5 font-semibold">Acoustic Modifier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2233]">
                  {VERIFIED_TAGS.map((t) => (
                    <tr key={t.id} className="hover:bg-[#131622]">
                      <td className="p-2.5 font-mono font-bold text-purple-300">{t.tag}</td>
                      <td className="p-2.5 uppercase text-[10px] text-[#8e92a8]">{t.category}</td>
                      <td className="p-2.5 text-[#cad0e4]">{t.description}</td>
                      <td className="p-2.5 font-mono text-[#8e92a8]">{t.pacingEffect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: API Contract & Request Format */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              4. REST Inference Endpoint Contract
            </h4>
            <div className="bg-[#0b0c10] rounded-xl border border-[#202434] overflow-hidden font-mono text-[11px]">
              <div className="px-4 py-2 bg-[#141622] border-b border-[#202434] text-[#8e92a8] flex justify-between">
                <span>POST https://api.vachana.ai/api/v1/tts/inference</span>
                <span className="text-purple-400">Content-Type: application/json</span>
              </div>
              <pre className="p-4 text-purple-200 overflow-x-auto">
{`{
  "text": "<whispers> The night is silent. <pauses> Wait, did you hear that? <excited> It's them!",
  "voice": "Nalini",
  "language": "en-IN",
  "audio_config": {
    "container": "wav",
    "encoding": "linear_pcm",
    "sample_rate": 24000
  }
}`}
              </pre>
            </div>
          </div>

          {/* Section 5: Authentication & Headers */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              5. Authentication Header
            </h4>
            <div className="p-3 rounded-lg bg-[#141622] border border-[#222638] font-mono text-[11px]">
              <span className="text-[#8e92a8]">Header:</span>{' '}
              <strong className="text-white">X-API-Key-ID:</strong>{' '}
              <span className="text-purple-300">&lt;YOUR_GNANI_API_KEY&gt;</span>
            </div>
            <p className="text-[11px] text-[#8e92a8]">
              API keys are generated in the Gnani API console. In VoxStory AI, the key is securely injected server-side via the <code className="text-white">GNANI_API_KEY</code> environment variable and is never exposed to browser bundles.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1f2231] bg-[#0c0e15] flex items-center justify-between">
          <span className="text-xs text-[#8e92a8]">
            Gnani Vachana / Timbre v3.0 Specification Reference
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
