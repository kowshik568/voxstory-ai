/**
 * VoxStory AI - Multitrack Mixer Integration Tests (v12 Beta)
 * Verifies DSP mixing, ducking curves, multitrack mixdown, mute/solo behavior,
 * volume faders, and WAV structural integrity using synthetic audio fixtures.
 */

import { describe, it, expect } from 'vitest';
import { mixPcmSamples, generateProceduralAmbience } from '../lib/audioMixer';
import {
  mixMultitrackTimeline,
  calculateTotalDuration,
  isTrackAudible,
  createDefaultMultitrackSetup,
} from '../lib/multitrackEngine';
import { validateWavBuffer } from '../lib/audioValidator';
import { createWavHeader } from '../lib/audioStitcher';
import { TimelineTrack, TimelineClip, BackgroundTrackConfig } from '../types';

describe('VoxStory AI - Mixer & Multitrack DSP Integration Tests', () => {
  const sampleRate = 24000;

  // Helper to create synthetic PCM tone
  function createPcmTone(freqHz: number, durationSec: number, amplitude = 0.5): Float32Array {
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      buffer[i] = Math.sin(2 * Math.PI * freqHz * (i / sampleRate)) * amplitude;
    }
    return buffer;
  }

  // Helper to convert Float32Array to WAV data URI
  function pcmToWavDataUrl(samples: Float32Array): string {
    const dataSize = samples.length * 2;
    const header = createWavHeader(dataSize, sampleRate);
    const bytes = new Uint8Array(44 + dataSize);
    bytes.set(header, 0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return `data:audio/wav;base64,${Buffer.from(bytes).toString('base64')}`;
  }

  describe('Voice-Priority Ducking & Background DSP Mixing', () => {
    it('applies voice ducking to reduce background volume during speech', () => {
      const voice = createPcmTone(200, 2.0, 0.6); // Active voice narration
      const bg = createPcmTone(60, 2.0, 0.4); // Constant background drone

      const bgConfig: BackgroundTrackConfig = {
        id: 'bg-1',
        name: 'Test Bed',
        audioUrl: '',
        volume: 0.5,
        fadeInSeconds: 0.1,
        fadeOutSeconds: 0.1,
        loop: true,
        duckingEnabled: true,
        duckingAmount: 0.7, // -10dB reduction
        isMuted: false,
      };

      const mixed = mixPcmSamples(voice, bg, sampleRate, bgConfig);
      expect(mixed).toHaveLength(voice.length);

      // Verify no NaN or infinite samples
      for (let i = 0; i < mixed.length; i++) {
        expect(isNaN(mixed[i])).toBe(false);
        expect(isFinite(mixed[i])).toBe(true);
        expect(mixed[i]).toBeGreaterThanOrEqual(-1.0);
        expect(mixed[i]).toBeLessThanOrEqual(1.0);
      }
    });

    it('outputs pure voice channel when background track is muted', () => {
      const voice = createPcmTone(300, 1.0, 0.5);
      const bg = createPcmTone(80, 1.0, 0.5);

      const mutedConfig: BackgroundTrackConfig = {
        id: 'bg-muted',
        name: 'Muted',
        audioUrl: '',
        volume: 0.5,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        loop: true,
        duckingEnabled: false,
        duckingAmount: 0,
        isMuted: true, // Muted
      };

      const mixed = mixPcmSamples(voice, bg, sampleRate, mutedConfig);
      // Soft saturation (tanh) of pure voice
      const expected = Math.tanh(voice[100]);
      expect(mixed[100]).toBeCloseTo(expected, 4);
    });
  });

  describe('Multitrack Timeline Mixdown Engine', () => {
    it('mixes multiple tracks with independent volume and pan into a valid master WAV', async () => {
      const tracks: TimelineTrack[] = [
        { id: 't-speaker', name: 'Voice', type: 'speaker', color: '#a855f7', isMuted: false, isSolo: false, volume: 1.0, pan: 0 },
        { id: 't-music', name: 'Music', type: 'music', color: '#eab308', isMuted: false, isSolo: false, volume: 0.4, pan: -0.3 },
      ];

      const voiceDataUrl = pcmToWavDataUrl(createPcmTone(220, 2.0, 0.4));
      const musicDataUrl = pcmToWavDataUrl(createPcmTone(110, 2.5, 0.3));

      const clips: TimelineClip[] = [
        { id: 'c1', trackId: 't-speaker', title: 'Voice Take', startTime: 0, duration: 2.0, fadeIn: 0.1, fadeOut: 0.1, volume: 1.0, pan: 0, audioUrl: voiceDataUrl },
        { id: 'c2', trackId: 't-music', title: 'Imported Score', startTime: 0.5, duration: 2.0, fadeIn: 0.2, fadeOut: 0.2, volume: 0.8, pan: 0, audioUrl: musicDataUrl },
      ];

      const mix = (await mixMultitrackTimeline(tracks, clips, sampleRate)) as any;
      expect(mix.durationSeconds).toBeGreaterThanOrEqual(2.5);
      expect(mix.dataUrl).toMatch(/^(blob:|data:audio\/wav;base64,)/);

      // Verify the generated WAV passes structural checks
      const wavCheck = validateWavBuffer(mix.rawBytes);

      expect(wavCheck.isValid).toBe(true);
      expect(wavCheck.sampleRate).toBe(sampleRate);
      expect(wavCheck.numChannels).toBe(1);
      expect(wavCheck.durationSeconds).toBeCloseTo(mix.durationSeconds, 0);
      expect(wavCheck.errors).toHaveLength(0);
    });

    it('respects solo and mute states across lanes', () => {
      const tracks: TimelineTrack[] = [
        { id: 't1', name: 'T1', type: 'speaker', color: '#fff', isMuted: true, isSolo: false, volume: 1, pan: 0 },
        { id: 't2', name: 'T2', type: 'music', color: '#fff', isMuted: false, isSolo: false, volume: 1, pan: 0 },
      ];
      // Muted track is inaudible
      expect(isTrackAudible(tracks[0], tracks)).toBe(false);
      expect(isTrackAudible(tracks[1], tracks)).toBe(true);

      // When T2 is soloed, only T2 is audible
      tracks[1].isSolo = true;
      expect(isTrackAudible(tracks[0], tracks)).toBe(false);
      expect(isTrackAudible(tracks[1], tracks)).toBe(true);
    });

    it('handles empty clip timeline gracefully with safe default duration', async () => {
      const setup = createDefaultMultitrackSetup();
      const duration = calculateTotalDuration([]);
      expect(duration).toBe(10.0);

      const mix = await mixMultitrackTimeline(setup.tracks, [], sampleRate);
      expect(mix.durationSeconds).toBe(10.0);
      expect(mix.sizeBytes).toBeGreaterThan(44);
    });
  });
});
