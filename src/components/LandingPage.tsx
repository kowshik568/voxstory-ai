/**
 * VoxStory AI - Landing Page & Showcase
 * Features interactive A/B comparison, 13-tag explorer, and direct-to-studio workflows
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  ArrowRight,
  Volume2,
  Sliders,
  CheckCircle2,
  Layers,
  Mic,
  Zap,
  Globe2,
  FileCode,
  Info,
} from 'lucide-react';
import { VERIFIED_TAGS, TAG_MAP } from '../lib/tagCatalog';
import { TEMPLATES } from '../lib/templates';
import { generateProceduralSpeechWav } from '../lib/audioGenerator';
import { TagCategory, ScriptTemplate } from '../types';

interface LandingPageProps {
  onOpenStudio: (template?: ScriptTemplate) => void;
  onOpenDocs: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenStudio, onOpenDocs }) => {
  // A/B Comparison state
  const [activeTrack, setActiveTrack] = useState<'flat' | 'expressive'>('expressive');
  const [isPlayingAB, setIsPlayingAB] = useState(false);
  const [abProgress, setAbProgress] = useState(0);
  const [abAudioUrls, setAbAudioUrls] = useState<{ flat: string; expressive: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Expression Tag explorer state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTagId, setActiveTagId] = useState<string>('whispers');

  // Generate audio for A/B demo on mount
  useEffect(() => {
    try {
      const flatAudio = generateProceduralSpeechWav(
        'We made it past the perimeter. They actually thought we would not dare. Run to the escape shuttle now.',
        'Female',
        24000
      );
      const expressiveAudio = generateProceduralSpeechWav(
        '<whispers> We made it past the perimeter. <laugh> They actually thought we wouldn’t dare! <excited> Run to the escape shuttle now!',
        'Female',
        24000
      );
      setAbAudioUrls({
        flat: flatAudio.dataUrl,
        expressive: expressiveAudio.dataUrl,
      });
    } catch (e) {
      console.error('Failed to generate A/B audio preview:', e);
    }
  }, []);

  // Handle A/B playback
  const togglePlayAB = () => {
    if (!audioRef.current || !abAudioUrls) return;
    if (isPlayingAB) {
      audioRef.current.pause();
      setIsPlayingAB(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlayingAB(true);
    }
  };

  const handleTrackSwitch = (track: 'flat' | 'expressive') => {
    setActiveTrack(track);
    setIsPlayingAB(false);
    setAbProgress(0);
    if (audioRef.current && abAudioUrls) {
      audioRef.current.src = abAudioUrls[track];
      audioRef.current.currentTime = 0;
    }
  };

  // Filter tags
  const filteredTags = selectedCategory === 'all'
    ? VERIFIED_TAGS
    : VERIFIED_TAGS.filter((t) => t.category === selectedCategory);

  const activeTag = VERIFIED_TAGS.find((t) => t.id === activeTagId) || VERIFIED_TAGS[0];

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#e0e2ec]">
      {/* Hidden audio element for A/B demonstration */}
      {abAudioUrls && (
        <audio
          ref={audioRef}
          src={abAudioUrls[activeTrack]}
          onTimeUpdate={() => {
            if (audioRef.current && audioRef.current.duration) {
              setAbProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
            }
          }}
          onEnded={() => {
            setIsPlayingAB(false);
            setAbProgress(0);
          }}
        />
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-[#1b1e2a]">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-purple-900/25 via-violet-900/10 to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Gnani Timbre v3.0 Audio Tags Integration</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            Make Every Word <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-300">
              Feel Something.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-[#9fa3b8] mb-10 leading-relaxed font-normal">
            Your words. Your voice. Your emotion. Direct AI speech performances using 13 verified audio tags for whisper, laughter, breath, excitement, and deliberate pacing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onOpenStudio()}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sliders className="w-4 h-4" />
              <span>Open Voice Studio</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={() => {
                const element = document.getElementById('interactive-ab');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#171a26] hover:bg-[#202436] text-white font-medium text-sm border border-[#2a2f44] transition-colors"
            >
              <Play className="w-4 h-4 text-purple-400" />
              <span>Hear A/B Comparison</span>
            </button>
          </div>
        </div>
      </section>

      {/* Section 1: Interactive A/B Narration Comparison */}
      <section id="interactive-ab" className="py-16 lg:py-24 border-b border-[#1b1e2a] bg-[#0e1017]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Auditory Proof of Concept
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Ordinary Narration vs. Directed Expression
            </h2>
            <p className="text-sm text-[#8e92a8] mt-2 max-w-xl mx-auto">
              Toggle between flat text-to-speech and Timbre v3.0 with inline emotion tags to experience the dramatic shift in believability.
            </p>
          </div>

          <div className="bg-[#131622] rounded-2xl border border-[#232738] p-6 lg:p-8 shadow-2xl">
            {/* Track Switcher Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => handleTrackSwitch('flat')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  activeTrack === 'flat'
                    ? 'bg-[#1b1f30] border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                    : 'bg-[#10121a] border-[#222533] opacity-70 hover:opacity-100 hover:border-[#2d3246]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#8e92a8]">Baseline Narration</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2233] text-[#71768d]">Monotone</span>
                </div>
                <h4 className="text-sm font-bold text-white">Ordinary Neural TTS</h4>
                <p className="text-xs text-[#8e92a8] mt-1">
                  Predictable cadence with zero breath, pauses, or vocal dynamics.
                </p>
              </button>

              <button
                onClick={() => handleTrackSwitch('expressive')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  activeTrack === 'expressive'
                    ? 'bg-gradient-to-br from-purple-950/40 to-[#1b1f30] border-purple-500 shadow-md ring-1 ring-purple-500/50'
                    : 'bg-[#10121a] border-[#222533] opacity-70 hover:opacity-100 hover:border-[#2d3246]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-purple-400">Timbre v3.0 Directed</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                    3 Tags Active
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white">VoxStory Expressive Studio</h4>
                <p className="text-xs text-purple-200/80 mt-1">
                  Dynamic shifts across &lt;whispers&gt;, &lt;laugh&gt;, and &lt;excited&gt;.
                </p>
              </button>
            </div>

            {/* Script Display */}
            <div className="p-4 rounded-xl bg-[#0b0c10] border border-[#1e212f] mb-6 font-mono text-sm leading-relaxed">
              {activeTrack === 'flat' ? (
                <p className="text-[#a8adc2]">
                  We made it past the perimeter. They actually thought we would not dare. Run to the escape shuttle now.
                </p>
              ) : (
                <div className="text-sm leading-relaxed space-y-1">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs mr-1 font-semibold">
                    &lt;whispers&gt;
                  </span>
                  <span className="text-purple-200">We made it past the perimeter. </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs mx-1 font-semibold">
                    &lt;laugh&gt;
                  </span>
                  <span className="text-amber-100">They actually thought we wouldn’t dare! </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs mx-1 font-semibold">
                    &lt;excited&gt;
                  </span>
                  <span className="text-pink-100">Run to the escape shuttle now!</span>
                </div>
              )}
            </div>

            {/* Player Controls */}
            <div className="flex items-center gap-4 bg-[#171a26] p-4 rounded-xl border border-[#262a3d]">
              <button
                onClick={togglePlayAB}
                className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                {isPlayingAB ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <div className="flex-1">
                <div className="flex justify-between items-center text-xs font-mono text-[#8e92a8] mb-1.5">
                  <span>{activeTrack === 'flat' ? 'Baseline Monotone Audio' : 'Timbre v3.0 Expressive Audio'}</span>
                  <span>{isPlayingAB ? 'Playing' : 'Ready'}</span>
                </div>

                {/* Simulated Audio Frequency Visualizer */}
                <div className="relative w-full h-8 bg-[#0e1017] rounded-lg overflow-hidden flex items-center px-2 gap-1 border border-[#1f2231]">
                  {Array.from({ length: 48 }).map((_, i) => {
                    const isPassed = (i / 48) * 100 <= abProgress;
                    const heightPercent = isPlayingAB
                      ? Math.min(95, Math.max(15, (Math.sin(i * 0.4 + (abProgress * 0.1)) * 35 + 50)))
                      : Math.min(80, Math.max(20, (Math.sin(i * 0.6) * 30 + 40)));

                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-75 ${
                          isPassed
                            ? activeTrack === 'expressive'
                              ? 'bg-purple-400'
                              : 'bg-zinc-400'
                            : 'bg-[#252837]'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-[#8e92a8] pl-2 border-l border-[#262a3d]">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>24kHz WAV</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Verified 13 Expression Tags Explorer */}
      <section className="py-16 lg:py-24 border-b border-[#1b1e2a] bg-[#0b0c10]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Official Catalog
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              The 13 Gnani Timbre v3.0 Audio Tags
            </h2>
            <p className="text-sm text-[#8e92a8] mt-2 max-w-2xl mx-auto">
              In Timbre v3.0, expression tags dictate how subsequent text is delivered until the next tag is encountered.
            </p>

            {/* Category filter pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {[
                { id: 'all', label: 'All 13 Tags' },
                { id: 'delivery', label: 'Vocal Delivery' },
                { id: 'reaction', label: 'Reactions & Emotion' },
                { id: 'pacing', label: 'Pacing & Silence' },
                { id: 'nonverbal', label: 'Non-Verbal Gestures' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-[#151722] text-[#8e92a8] hover:text-white border border-[#232636]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Tag Selection Chips (Left 7 cols) */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredTags.map((tag) => {
                const isSelected = tag.id === activeTagId;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setActiveTagId(tag.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#1c1f2e] border-purple-500 ring-1 ring-purple-500/40 shadow-md'
                        : 'bg-[#12141c] border-[#222533] hover:border-[#2f3346] hover:bg-[#161822]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-purple-300">
                        {tag.tag}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded uppercase font-semibold text-[#7d8299] bg-[#1a1d29]">
                        {tag.category}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white">{tag.name}</div>
                    <div className="text-[11px] text-[#8e92a8] truncate mt-0.5">
                      {tag.pacingEffect}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Tag Inspector Card (Right 5 cols) */}
            <div className="lg:col-span-5 bg-[#141622] rounded-2xl border border-[#25293d] p-6 shadow-xl sticky top-24">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#232738]">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#8e92a8] font-medium">
                    Active Director Tag
                  </span>
                  <h3 className="text-xl font-mono font-bold text-white flex items-center gap-2 mt-0.5">
                    <span className="text-purple-400">{activeTag.tag}</span>
                    <span className="text-xs font-sans font-normal px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                      {activeTag.category}
                    </span>
                  </h3>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#8e92a8] font-medium block mb-1">
                    Performance Description
                  </label>
                  <p className="text-xs text-[#c6cbde] leading-relaxed">
                    {activeTag.description}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-[#8e92a8] font-medium block mb-1">
                    Acoustic & Pacing Modifier
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-[#0e1017] border border-[#202434] text-xs font-mono text-purple-300">
                    {activeTag.pacingEffect}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#8e92a8] font-medium block mb-1">
                    Script Example
                  </label>
                  <div className="p-3 rounded-lg bg-[#0b0c10] border border-[#1f2231] text-xs font-mono text-[#d1d5db] leading-relaxed">
                    <span className="text-purple-400 font-bold">{activeTag.tag}</span>{' '}
                    <span>{activeTag.sampleText}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onOpenStudio()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Direct with {activeTag.tag} in Studio</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Built-In Creative Workflows */}
      <section className="py-16 lg:py-24 border-b border-[#1b1e2a] bg-[#0e1017]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                Production Blueprints
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Directorial Script Templates
              </h2>
              <p className="text-sm text-[#8e92a8] mt-2">
                12 pre-crafted scenarios demonstrating real vocal directing for creators and brands.
              </p>
            </div>

            <button
              onClick={() => onOpenStudio()}
              className="mt-4 md:mt-0 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300"
            >
              <span>Explore all templates in studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEMPLATES.slice(0, 6).map((tpl) => (
              <div
                key={tpl.id}
                className="bg-[#131622] rounded-2xl border border-[#232738] p-5 flex flex-col justify-between hover:border-[#353b52] transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#1d2130] text-[#8e92a8]">
                      Voice: {tpl.recommendedVoice}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                    {tpl.title}
                  </h4>
                  <p className="text-xs text-[#8e92a8] mb-4 line-clamp-2">
                    {tpl.description}
                  </p>

                  <div className="p-3 rounded-lg bg-[#0b0c10] border border-[#1e2130] text-xs font-mono text-[#b1b6cb] mb-4 line-clamp-3">
                    {tpl.script}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {tpl.tagsUsed.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25 font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onOpenStudio(tpl)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#1c2030] hover:bg-purple-600 hover:text-white text-xs font-medium text-[#c0c5dc] transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Open in Studio</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Gnani Timbre v3.0 Architecture & API Specifications */}
      <section className="py-16 lg:py-24 bg-[#0b0c10]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Developer Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Engineered on Gnani Vachana / Timbre v3.0
            </h2>
            <p className="text-sm text-[#8e92a8] mt-2 max-w-xl mx-auto">
              Direct, low-latency REST and streaming audio generation using authentic API contracts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl bg-[#12141d] border border-[#212433]">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Globe2 className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">10 Indic + English</h4>
              <p className="text-xs text-[#8e92a8]">
                Multilingual expression across en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN, bn-IN, mr-IN, gu-IN, and pa-IN.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#12141d] border border-[#212433]">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Continuation Semantics</h4>
              <p className="text-xs text-[#8e92a8]">
                Tags govern spoken inflection continuously until the subsequent tag, faithfully maintaining director intent.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#12141d] border border-[#212433]">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <FileCode className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Broadcast Containers</h4>
              <p className="text-xs text-[#8e92a8]">
                Uncompressed 24/48kHz WAV PCM, web-optimized MP3, and low-latency OGG Opus streaming.
              </p>
            </div>
          </div>

          {/* Code Spec Snippet */}
          <div className="bg-[#11131c] rounded-2xl border border-[#222536] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#171a26] border-b border-[#222536] text-xs font-mono text-[#8e92a8]">
              <span>POST https://api.vachana.ai/api/v1/tts/inference</span>
              <span className="text-purple-400">Header: X-API-Key-ID</span>
            </div>
            <pre className="p-5 text-xs font-mono text-[#b9bfd6] overflow-x-auto leading-relaxed">
{`{
  "text": "<whispers> The perimeter is clear. <laugh> They suspect nothing. <excited> Move in now!",
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

          <div className="text-center mt-8">
            <button
              onClick={onOpenDocs}
              className="inline-flex items-center gap-2 text-xs font-medium text-purple-400 hover:text-purple-300"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Read Full Gnani Timbre v3.0 Integration & API Docs</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#1b1e2a] bg-[#090a0e] text-xs text-[#71768d]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-white">VoxStory AI</span>
            <span>—</span>
            <span>Your words. Your voice. Your emotion.</span>
          </div>
          <div>
            <span>Powered by Gnani Timbre v3.0 & Vachana TTS Platform.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
