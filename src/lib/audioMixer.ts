/**
 * VoxStory AI - Background Audio Mixer & Voice-Priority Ducking Engine
 * Blends narration voice tracks with background ambience / music,
 * providing fade-in, fade-out, voice-priority ducking, and soft-limiting.
 */

import { BackgroundTrackConfig } from '../types';
import { createWavHeader } from './audioStitcher';

/**
 * Procedural ambient track presets available out-of-the-box
 */
export const BUILTIN_AMBIENT_PRESETS = [
  {
    id: 'cinematic-drone',
    name: 'Cinematic Deep Drone (Warm & Mysterious)',
    description: 'Resonant 55Hz sub-drone with gentle slow-filtered harmonic pads.',
  },
  {
    id: 'studio-warmth',
    name: 'Warm Studio Room Tone (Acoustic Depth)',
    description: 'Soft analog room presence that adds subtle realism behind the voice.',
  },
  {
    id: 'lofi-late-night',
    name: 'Midnight Tape Hiss (Intimate Radio)',
    description: 'Delicate vinyl warmth and subtle tape saturation.',
  },
];

/**
 * Generates an ambient audio buffer procedurally
 */
export function generateProceduralAmbience(
  presetId: string,
  durationSeconds: number = 20,
  sampleRate: number = 24000
): { dataUrl: string; duration: number } {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (presetId === 'cinematic-drone') {
      // 55Hz bass + 110Hz fifth + 165Hz third with slow sweep
      const lfo = Math.sin(t * 0.2) * 0.3 + 0.7;
      const b1 = Math.sin(2 * Math.PI * 55 * t) * 0.4;
      const b2 = Math.sin(2 * Math.PI * 110 * t) * 0.25;
      const b3 = Math.sin(2 * Math.PI * 165 * t) * 0.15;
      sample = (b1 + b2 + b3) * lfo * 0.3;
    } else if (presetId === 'studio-warmth') {
      // Gentle room presence
      const noise = (Math.random() * 2 - 1) * 0.04;
      const sub = Math.sin(2 * Math.PI * 60 * t) * 0.05;
      sample = noise + sub;
    } else {
      // Tape Lo-Fi
      const pink = (Math.random() * 2 - 1) * 0.035;
      const drone = Math.sin(2 * Math.PI * 80 * t) * 0.08;
      sample = (pink + drone) * 0.5;
    }

    buffer[i] = sample;
  }

  // Encode WAV
  const dataSize = buffer.length * 2;
  const header = createWavHeader(dataSize, sampleRate);
  const wavBytes = new Uint8Array(44 + dataSize);
  wavBytes.set(header, 0);

  const view = new DataView(wavBytes.buffer);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  let dataUrl = '';
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    dataUrl = URL.createObjectURL(blob);
  } else {
    dataUrl = `data:audio/wav;base64,${Buffer.from(wavBytes).toString('base64')}`;
  }

  return {
    dataUrl,
    duration: durationSeconds,
  };
}

/**
 * Pure DSP function to mix voice and background PCM buffers.
 * Applies volume, fade curves, voice-priority ducking, and tanh soft-limiting.
 */
export function mixPcmSamples(
  voiceChannel: Float32Array,
  bgChannel: Float32Array,
  sampleRate: number,
  bgConfig: BackgroundTrackConfig
): Float32Array {
  const outputSamples = voiceChannel.length;
  const outputBuffer = new Float32Array(outputSamples);

  const fadeInSamples = Math.floor(bgConfig.fadeInSeconds * sampleRate);
  const fadeOutSamples = Math.floor(bgConfig.fadeOutSeconds * sampleRate);
  const duckingReduction = bgConfig.duckingEnabled ? 1 - bgConfig.duckingAmount : 1;

  // Pre-calculate voice activity envelope for smooth ducking
  const voiceActivity = new Float32Array(outputSamples);
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.05)); // 50ms window

  for (let i = 0; i < outputSamples; i += windowSize) {
    const end = Math.min(outputSamples, i + windowSize);
    let sum = 0;
    for (let j = i; j < end; j++) {
      sum += Math.abs(voiceChannel[j]);
    }
    const avg = sum / (end - i || 1);
    const isSpeaking = avg > 0.02 ? 1 : 0;
    for (let j = i; j < end; j++) {
      voiceActivity[j] = isSpeaking;
    }
  }

  // Smooth voice activity for natural ducking transitions
  let smoothedDucking = 1.0;

  for (let i = 0; i < outputSamples; i++) {
    const voiceSample = voiceChannel[i] || 0;

    // Loop background audio if shorter than voice
    const bgSampleIndex = bgChannel.length > 0 ? i % bgChannel.length : 0;
    const bgSample = bgChannel[bgSampleIndex] || 0;

    // 1. Fade-in curve
    let fadeMultiplier = 1.0;
    if (fadeInSamples > 0 && i < fadeInSamples) {
      fadeMultiplier = i / fadeInSamples;
    }
    // 2. Fade-out curve
    const samplesLeft = outputSamples - i;
    if (fadeOutSamples > 0 && samplesLeft < fadeOutSamples) {
      fadeMultiplier = Math.min(fadeMultiplier, samplesLeft / fadeOutSamples);
    }

    // 3. Smooth Ducking (target either 1.0 or duckingReduction)
    const targetGain = voiceActivity[i] > 0.5 ? duckingReduction : 1.0;
    // Exponential moving average filter (~150ms rise/fall)
    smoothedDucking += (targetGain - smoothedDucking) * 0.002;

    // Apply background volume & mute
    const effectiveBgGain = bgConfig.isMuted
      ? 0
      : bgConfig.volume * fadeMultiplier * smoothedDucking;

    // Mixed sample with soft saturation curve (tanh) to prevent clipping
    const rawMix = voiceSample + bgSample * effectiveBgGain;
    outputBuffer[i] = Math.tanh(rawMix);
  }

  return outputBuffer;
}

/**
 * Mix voice narration audio with background music/ambience
 * Applies:
 * - Independent background volume
 * - Fade in & fade out curves
 * - Voice-priority ducking (background drops when narration is active)
 * - Soft-limiter protection to prevent digital clipping
 */
export async function mixAudioTracks(
  voiceAudioUrl: string,
  bgConfig: BackgroundTrackConfig,
  targetSampleRate: number = 24000
): Promise<{ dataUrl: string; durationSeconds: number; sizeBytes: number }> {
  if (typeof window === 'undefined') {
    throw new Error('Audio mixing requires Web Audio API browser environment');
  }

  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    // 1. Decode Voice Audio
    const voiceArrayBuffer = await fetchAudioBuffer(voiceAudioUrl);
    const voiceDecoded = await audioCtx.decodeAudioData(voiceArrayBuffer);
    const voiceChannel = voiceDecoded.getChannelData(0);

    // 2. Decode Background Audio
    const bgArrayBuffer = await fetchAudioBuffer(bgConfig.audioUrl);
    const bgDecoded = await audioCtx.decodeAudioData(bgArrayBuffer);
    const bgChannel = bgDecoded.getChannelData(0);

    // Mix PCM samples using pure DSP pipeline
    const outputBuffer = mixPcmSamples(voiceChannel, bgChannel, voiceDecoded.sampleRate, bgConfig);
    const outputSamples = outputBuffer.length;
    const voiceDuration = outputSamples / voiceDecoded.sampleRate;

    // 4. Encode mixed float PCM to 16-bit WAV
    const dataSize = outputSamples * 2;
    const header = createWavHeader(dataSize, voiceDecoded.sampleRate);
    const wavBytes = new Uint8Array(44 + dataSize);
    wavBytes.set(header, 0);

    const view = new DataView(wavBytes.buffer);
    for (let i = 0; i < outputSamples; i++) {
      const s = Math.max(-1, Math.min(1, outputBuffer[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
    const dataUrl = URL.createObjectURL(blob);

    return {
      dataUrl,
      durationSeconds: Math.round(voiceDuration * 100) / 100,
      sizeBytes: wavBytes.byteLength,
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Fetch and convert data URI or Blob URL to ArrayBuffer
 */
async function fetchAudioBuffer(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  const response = await fetch(url);
  return response.arrayBuffer();
}
