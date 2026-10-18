/**
 * VoxStory AI - Multitrack DAW Audio & Timeline Engine (v7.0)
 * Handles track lanes, clip manipulation, split/trim/duplicate,
 * duration computation, mute/solo evaluation, and multitrack WAV mixdown.
 */

import { TimelineTrack, TimelineClip, TrackType } from '../types';
import { createWavHeader } from './audioStitcher';
import { generateProceduralAmbience } from './audioMixer';

/**
 * Calculates the total timeline duration based on all active clips.
 */
export function calculateTotalDuration(clips: TimelineClip[]): number {
  if (!clips || clips.length === 0) return 10.0;
  const maxEnd = clips.reduce((max, clip) => {
    const end = (clip.startTime || 0) + (clip.duration || 0);
    return end > max ? end : max;
  }, 0);
  return Math.max(10.0, Math.ceil(maxEnd * 10) / 10);
}

/**
 * Splits a clip at a given timeline position.
 */
export function splitClipAtTime(
  clip: TimelineClip,
  splitTime: number
): [TimelineClip, TimelineClip] | null {
  const clipEnd = clip.startTime + clip.duration;
  // Needs to be strictly inside the clip with at least 0.1s margin
  if (splitTime <= clip.startTime + 0.1 || splitTime >= clipEnd - 0.1) {
    return null;
  }

  const firstDuration = Math.round((splitTime - clip.startTime) * 100) / 100;
  const secondDuration = Math.round((clipEnd - splitTime) * 100) / 100;

  const firstClip: TimelineClip = {
    ...clip,
    id: `${clip.id}-part1`,
    duration: firstDuration,
    fadeOut: Math.min(clip.fadeOut || 0, firstDuration / 2),
  };

  const secondClip: TimelineClip = {
    ...clip,
    id: `${clip.id}-part2-${Date.now().toString(36)}`,
    startTime: splitTime,
    duration: secondDuration,
    trimStart: (clip.trimStart || 0) + firstDuration,
    fadeIn: Math.min(clip.fadeIn || 0, secondDuration / 2),
    title: `${clip.title} (Part 2)`,
  };

  return [firstClip, secondClip];
}

/**
 * Duplicates a clip and places it immediately adjacent or offset by 0.2s
 */
export function duplicateClip(clip: TimelineClip, offsetSeconds: number = 0.2): TimelineClip {
  return {
    ...clip,
    id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    title: `${clip.title} (Copy)`,
    startTime: Math.round((clip.startTime + clip.duration + offsetSeconds) * 100) / 100,
  };
}

/**
 * Checks whether a track and its clips are audible based on Solo / Mute states
 */
export function isTrackAudible(track: TimelineTrack, allTracks: TimelineTrack[]): boolean {
  if (track.isMuted) return false;
  const hasAnySolo = allTracks.some((t) => t.isSolo);
  if (hasAnySolo) {
    return track.isSolo;
  }
  return true;
}

/**
 * Formats seconds into MM:SS.mmm format for display
 */
export function formatTimelineTime(seconds: number): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const mins = Math.floor(safeSec / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.floor((safeSec % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Auto-ripples clips sequentially across their respective speaker tracks
 */
export function rippleClipsSequentially(
  clips: TimelineClip[],
  gapSeconds: number = 0.35
): TimelineClip[] {
  let currentTime = 0;
  return clips.map((clip) => {
    const updated = {
      ...clip,
      startTime: currentTime,
    };
    currentTime = Math.round((currentTime + clip.duration + gapSeconds) * 100) / 100;
    return updated;
  });
}

/**
 * Generates Subtitle cues (SRT & VTT) directly from multitrack clips
 */
export function generateSubtitlesFromMultitrack(
  clips: TimelineClip[]
): { srt: string; vtt: string } {
  const dialogueClips = clips
    .filter((c) => c.text && c.text.trim().length > 0)
    .sort((a, b) => a.startTime - b.startTime);

  const formatSrtTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const formatVttTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  let srt = '';
  let vtt = 'WEBVTT - VoxStory AI Multitrack Export\n\n';

  dialogueClips.forEach((clip, index) => {
    const start = clip.startTime;
    const end = clip.startTime + clip.duration;
    const cleanText = (clip.text || '').replace(/<[^>]+>/g, '').trim();
    const speakerPrefix = clip.characterName ? `[${clip.characterName}] ` : '';
    const fullText = `${speakerPrefix}${cleanText}`;

    // SRT
    srt += `${index + 1}\n`;
    srt += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`;
    srt += `${fullText}\n\n`;

    // VTT
    vtt += `${index + 1}\n`;
    vtt += `${formatVttTime(start)} --> ${formatVttTime(end)}\n`;
    vtt += `${fullText}\n\n`;
  });

  return { srt: srt.trim(), vtt: vtt.trim() };
}

/**
 * Extracts 16-bit PCM samples from a base64 WAV data URL and resamples if needed
 */
export function extractSamplesFromWavDataUrl(
  dataUrl: string,
  targetSampleRate: number
): Float32Array | null {
  try {
    if (!dataUrl || !dataUrl.includes('base64,')) return null;
    const base64 = dataUrl.split('base64,')[1];
    if (!base64) return null;

    let binaryStr = '';
    if (typeof atob === 'function') {
      binaryStr = atob(base64);
    } else if (typeof Buffer !== 'undefined') {
      binaryStr = Buffer.from(base64, 'base64').toString('binary');
    } else {
      return null;
    }

    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (bytes.length < 44) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Verify RIFF & WAVE headers
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    if (riff !== 'RIFF' || wave !== 'WAVE') return null;

    let offset = 12;
    let srcSampleRate = 24000;
    let dataOffset = 44;
    let dataLength = bytes.length - 44;

    while (offset + 8 <= bytes.length) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === 'fmt ' && offset + 16 <= bytes.length) {
        srcSampleRate = view.getUint32(offset + 12, true);
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataLength = Math.min(chunkSize, bytes.length - dataOffset);
        break;
      }
      offset += 8 + chunkSize;
    }

    const numSamples = Math.floor(dataLength / 2);
    if (numSamples <= 0) return null;

    const rawSamples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const val = view.getInt16(dataOffset + i * 2, true);
      rawSamples[i] = val < 0 ? val / 32768 : val / 32767;
    }

    // Resample if necessary
    if (srcSampleRate === targetSampleRate) {
      return rawSamples;
    }

    const ratio = srcSampleRate / targetSampleRate;
    const targetLength = Math.floor(numSamples / ratio);
    const resampled = new Float32Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const srcIdx = i * ratio;
      const idxFloor = Math.floor(srcIdx);
      const frac = srcIdx - idxFloor;
      const s0 = rawSamples[idxFloor] || 0;
      const s1 = rawSamples[idxFloor + 1] || s0;
      resampled[i] = s0 + frac * (s1 - s0);
    }

    return resampled;
  } catch {
    return null;
  }
}

const clipSampleCache = new Map<string, Float32Array>();

/**
 * Preloads and decodes audio samples for clips with remote or data URLs
 */
export async function preloadClipSamples(clips: TimelineClip[], sampleRate: number): Promise<void> {
  for (const clip of clips) {
    if (!clip.audioUrl || clipSampleCache.has(clip.audioUrl)) continue;
    try {
      if (clip.audioUrl.startsWith('data:audio/')) {
        const decoded = extractSamplesFromWavDataUrl(clip.audioUrl, sampleRate);
        if (decoded) clipSampleCache.set(clip.audioUrl, decoded);
      } else if (typeof fetch === 'function') {
        const res = await fetch(clip.audioUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const base64 =
            typeof Buffer !== 'undefined'
              ? Buffer.from(arrayBuf).toString('base64')
              : btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
          const decoded = extractSamplesFromWavDataUrl(`data:audio/wav;base64,${base64}`, sampleRate);
          if (decoded) clipSampleCache.set(clip.audioUrl, decoded);
        }
      }
    } catch {
      // Ignore network failures gracefully; will fall back to synthesis
    }
  }
}

/**
 * Retrieves audio samples for a clip: uses real decoded audio from audioUrl if available,
 * or falls back cleanly to procedural speech/instrument synthesis.
 */
export function getClipSamples(clip: TimelineClip, sampleRate: number): Float32Array {
  if (clip.audioUrl) {
    let decoded = clipSampleCache.get(clip.audioUrl);
    if (!decoded && clip.audioUrl.startsWith('data:audio/')) {
      decoded = extractSamplesFromWavDataUrl(clip.audioUrl, sampleRate) || undefined;
    }
    if (decoded && decoded.length > 0) {
      const targetSamples = Math.floor(clip.duration * sampleRate);
      const result = new Float32Array(targetSamples);

      const trimStartSamples = Math.floor((clip.trimStart || 0) * sampleRate);

      for (let i = 0; i < targetSamples; i++) {
        const srcIndex = trimStartSamples + i;
        if (srcIndex >= decoded.length) break;

        let s = decoded[srcIndex];
        const t = i / sampleRate;

        // Apply fade in
        if (clip.fadeIn > 0 && t < clip.fadeIn) {
          s *= t / clip.fadeIn;
        }
        // Apply fade out
        const timeRemaining = clip.duration - t;
        if (clip.fadeOut > 0 && timeRemaining < clip.fadeOut) {
          s *= Math.max(0, timeRemaining / clip.fadeOut);
        }

        result[i] = s * (clip.volume ?? 1.0);
      }
      return result;
    }
  }

  // Fallback to procedural synthesis
  return synthesizeClipSamples(clip, sampleRate);
}

/**
 * Procedural synthesizer for timeline clips when raw WAV data is unavailable
 */
function synthesizeClipSamples(clip: TimelineClip, sampleRate: number): Float32Array {
  const numSamples = Math.floor(clip.duration * sampleRate);
  const samples = new Float32Array(numSamples);

  // Derive fundamental pitch based on track or title
  let baseFreq = 160;
  if (clip.trackId.includes('music')) baseFreq = 110;
  else if (clip.trackId.includes('ambience')) baseFreq = 55;
  else if (clip.trackId.includes('sfx')) baseFreq = 300;
  else if (clip.characterName?.toLowerCase().includes('elena')) baseFreq = 220;
  else if (clip.characterName?.toLowerCase().includes('rohan')) baseFreq = 130;
  else if (clip.characterName?.toLowerCase().includes('nexus')) baseFreq = 280;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    if (clip.trackId.includes('ambience')) {
      s = (Math.random() * 2 - 1) * 0.05 + Math.sin(2 * Math.PI * baseFreq * t) * 0.1;
    } else if (clip.trackId.includes('sfx')) {
      const decay = Math.exp(-t * 4);
      s = Math.sin(2 * Math.PI * (baseFreq + Math.sin(t * 20) * 80) * t) * decay * 0.3;
    } else {
      // Speech / dialogue modulation
      const mod = Math.sin(2 * Math.PI * 4 * t) * 0.2 + 0.8;
      const f1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.25;
      const f2 = Math.sin(2 * Math.PI * (baseFreq * 2) * t) * 0.12;
      const noise = (Math.random() * 2 - 1) * 0.02;
      s = (f1 + f2 + noise) * mod;
    }

    // Apply fade in
    if (clip.fadeIn > 0 && t < clip.fadeIn) {
      s *= t / clip.fadeIn;
    }
    // Apply fade out
    const timeRemaining = clip.duration - t;
    if (clip.fadeOut > 0 && timeRemaining < clip.fadeOut) {
      s *= Math.max(0, timeRemaining / clip.fadeOut);
    }

    samples[i] = s * (clip.volume ?? 1.0);
  }

  return samples;
}

/**
 * Mixes all multitrack timeline clips into a single master WAV buffer
 */
export async function mixMultitrackTimeline(
  tracks: TimelineTrack[],
  clips: TimelineClip[],
  sampleRate: number = 24000
): Promise<{ dataUrl: string; durationSeconds: number; sizeBytes: number; rawBytes?: Uint8Array }> {
  // Preload and decode any remote/uploaded audio streams
  await preloadClipSamples(clips, sampleRate);

  const totalDuration = calculateTotalDuration(clips);
  const totalSamples = Math.floor(totalDuration * sampleRate);

  // Left & Right mix channels for stereo panning
  const mixLeft = new Float32Array(totalSamples);
  const mixRight = new Float32Array(totalSamples);

  // Map track IDs to tracks
  const trackMap = new Map<string, TimelineTrack>();
  tracks.forEach((t) => trackMap.set(t.id, t));

  for (const clip of clips) {
    const track = trackMap.get(clip.trackId);
    if (!track) continue;

    // Check mute & solo
    if (!isTrackAudible(track, tracks)) continue;

    const clipSamples = getClipSamples(clip, sampleRate);
    const startSample = Math.floor(clip.startTime * sampleRate);

    // Calculate effective pan (-1.0 left to +1.0 right)
    const effectivePan = Math.max(-1.0, Math.min(1.0, (track.pan || 0) + (clip.pan || 0)));
    const panAngle = ((effectivePan + 1) / 2) * (Math.PI / 2);
    const gainLeft = Math.cos(panAngle) * (track.volume || 1.0);
    const gainRight = Math.sin(panAngle) * (track.volume || 1.0);

    for (let i = 0; i < clipSamples.length; i++) {
      const destIndex = startSample + i;
      if (destIndex >= totalSamples) break;

      mixLeft[destIndex] += clipSamples[i] * gainLeft;
      mixRight[destIndex] += clipSamples[i] * gainRight;
    }
  }

  // Soft limiting with Math.tanh
  const monoMix = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const combined = (mixLeft[i] + mixRight[i]) * 0.5;
    monoMix[i] = Math.tanh(combined);
  }

  // Encode 16-bit mono WAV
  const dataSize = totalSamples * 2;
  const header = createWavHeader(dataSize, sampleRate);
  const wavBytes = new Uint8Array(44 + dataSize);
  wavBytes.set(header, 0);

  const view = new DataView(wavBytes.buffer);
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, monoMix[i]));
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
    durationSeconds: totalDuration,
    sizeBytes: wavBytes.byteLength,
    rawBytes: wavBytes,
  };
}

/**
 * Creates default multitrack tracks and clips initialized from Dialogue scene
 */
export function createDefaultMultitrackSetup(): {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
} {
  const tracks: TimelineTrack[] = [
    {
      id: 'track-speaker-1',
      name: 'Elena (Commander)',
      type: 'speaker',
      characterId: 'char-1',
      voice: 'Nalini',
      color: '#ec4899',
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      pan: -0.15,
    },
    {
      id: 'track-speaker-2',
      name: 'Rohan (Operative)',
      type: 'speaker',
      characterId: 'char-2',
      voice: 'Rohan',
      color: '#8b5cf6',
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      pan: 0.15,
    },
    {
      id: 'track-speaker-3',
      name: 'Nexus (AI Voice)',
      type: 'speaker',
      characterId: 'char-3',
      voice: 'Ananya',
      color: '#06b6d4',
      isMuted: false,
      isSolo: false,
      volume: 1.0,
      pan: 0.0,
    },
    {
      id: 'track-music',
      name: 'Cinematic Score Bed',
      type: 'music',
      color: '#eab308',
      isMuted: false,
      isSolo: false,
      volume: 0.35,
      pan: 0.0,
    },
    {
      id: 'track-ambience',
      name: 'Vault Atmosphere',
      type: 'ambience',
      color: '#10b981',
      isMuted: false,
      isSolo: false,
      volume: 0.25,
      pan: 0.0,
    },
    {
      id: 'track-sfx',
      name: 'Security Alarm & SFX',
      type: 'sfx',
      color: '#f97316',
      isMuted: false,
      isSolo: false,
      volume: 0.6,
      pan: 0.2,
    },
  ];

  const clips: TimelineClip[] = [
    {
      id: 'clip-1',
      trackId: 'track-speaker-1',
      title: 'Elena: Status report',
      text: '<whispers> Status report. Have we bypassed their automated sentries yet?',
      characterName: 'Elena (Commander)',
      voice: 'Nalini',
      startTime: 0.5,
      duration: 3.2,
      fadeIn: 0.1,
      fadeOut: 0.1,
      volume: 1.0,
      pan: 0.0,
      color: '#ec4899',
    },
    {
      id: 'clip-2',
      trackId: 'track-speaker-2',
      title: 'Rohan: Barely',
      text: '<laugh> Barely. Their security protocols were outdated. <slow> But we only have four minutes.',
      characterName: 'Rohan (Operative)',
      voice: 'Rohan',
      startTime: 4.1,
      duration: 4.8,
      fadeIn: 0.1,
      fadeOut: 0.1,
      volume: 1.0,
      pan: 0.0,
      color: '#8b5cf6',
    },
    {
      id: 'clip-3',
      trackId: 'track-speaker-3',
      title: 'Nexus: Mainframe connected',
      text: '<excited> Mainframe connection established! I have downloaded the coordinates.',
      characterName: 'Nexus (AI Voice)',
      voice: 'Ananya',
      startTime: 9.3,
      duration: 3.6,
      fadeIn: 0.1,
      fadeOut: 0.1,
      volume: 1.0,
      pan: 0.0,
      color: '#06b6d4',
    },
    {
      id: 'clip-4',
      trackId: 'track-speaker-1',
      title: 'Elena: Fall back',
      text: '<shouting> Everyone fall back to extraction point Bravo! Move, move, move!',
      characterName: 'Elena (Commander)',
      voice: 'Nalini',
      startTime: 13.3,
      duration: 3.4,
      fadeIn: 0.1,
      fadeOut: 0.1,
      volume: 1.0,
      pan: 0.0,
      color: '#ec4899',
    },
    {
      id: 'clip-amb-1',
      trackId: 'track-ambience',
      title: 'Vault Room Drone',
      text: '',
      startTime: 0.0,
      duration: 17.5,
      fadeIn: 1.0,
      fadeOut: 1.5,
      volume: 0.4,
      pan: 0.0,
      color: '#10b981',
    },
    {
      id: 'clip-sfx-alarm',
      trackId: 'track-sfx',
      title: 'Alarm Sensor Pulse',
      text: '',
      startTime: 12.8,
      duration: 4.2,
      fadeIn: 0.2,
      fadeOut: 0.5,
      volume: 0.7,
      pan: 0.3,
      color: '#f97316',
    },
  ];

  return { tracks, clips };
}
