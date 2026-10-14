/**
 * Unit Tests for Background Audio Mixer & Ambience Presets
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_AMBIENT_PRESETS, generateProceduralAmbience, mixPcmSamples } from '../lib/audioMixer';
import { BackgroundTrackConfig } from '../types';

describe('Background Audio Mixer Engine', () => {
  it('provides built-in atmospheric presets', () => {
    expect(BUILTIN_AMBIENT_PRESETS.length).toBeGreaterThanOrEqual(3);
    const ids = BUILTIN_AMBIENT_PRESETS.map((p) => p.id);
    expect(ids).toContain('cinematic-drone');
    expect(ids).toContain('studio-warmth');
    expect(ids).toContain('lofi-late-night');
  });

  it('generates genuine WAV audio data for ambient presets', () => {
    const res = generateProceduralAmbience('cinematic-drone', 2.0, 24000);
    expect(res.duration).toBe(2.0);
    expect(res.dataUrl).toBeDefined();
    expect(typeof res.dataUrl).toBe('string');
  });

  it('generates warm studio room tone preset', () => {
    const res = generateProceduralAmbience('studio-warmth', 1.5, 24000);
    expect(res.duration).toBe(1.5);
    expect(res.dataUrl).toMatch(/^(blob:|data:audio\/wav)/);
  });

  it('preserves exact voice narration duration during mixing', () => {
    const sampleRate = 24000;
    const voiceSamples = new Float32Array(sampleRate * 3); // 3 seconds
    const bgSamples = new Float32Array(sampleRate * 1); // 1 second loop
    const config: BackgroundTrackConfig = {
      id: 'cinematic-drone',
      name: 'Drone',
      volume: 0.5,
      fadeInSeconds: 0.5,
      fadeOutSeconds: 0.5,
      loop: true,
      duckingEnabled: true,
      duckingAmount: 0.7,
      isMuted: false,
      audioUrl: 'test.wav',
    };

    const mixed = mixPcmSamples(voiceSamples, bgSamples, sampleRate, config);
    expect(mixed.length).toBe(voiceSamples.length);
  });

  it('prevents digital clipping via soft saturation (values bounded in [-1, 1])', () => {
    const sampleRate = 24000;
    // Construct very loud signals that would clip (+0.95 + +0.95 = 1.9 > 1.0)
    const voiceSamples = new Float32Array(1000).fill(0.95);
    const bgSamples = new Float32Array(1000).fill(0.95);
    const config: BackgroundTrackConfig = {
      id: 'custom',
      name: 'Loud',
      volume: 1.0,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      loop: true,
      duckingEnabled: false,
      duckingAmount: 0,
      isMuted: false,
      audioUrl: '',
    };

    const mixed = mixPcmSamples(voiceSamples, bgSamples, sampleRate, config);
    for (let i = 0; i < mixed.length; i++) {
      expect(mixed[i]).toBeLessThanOrEqual(1.0);
      expect(mixed[i]).toBeGreaterThanOrEqual(-1.0);
      // Math.tanh(1.9) is ~0.9556, safely saturated below 1.0
      expect(mixed[i]).toBeCloseTo(Math.tanh(1.9), 2);
    }
  });

  it('mutes background audio when isMuted is true', () => {
    const sampleRate = 24000;
    const voiceSamples = new Float32Array(500).fill(0.3);
    const bgSamples = new Float32Array(500).fill(0.8);
    const config: BackgroundTrackConfig = {
      id: 'custom',
      name: 'Muted',
      volume: 0.8,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      loop: true,
      duckingEnabled: false,
      duckingAmount: 0,
      isMuted: true,
      audioUrl: '',
    };

    const mixed = mixPcmSamples(voiceSamples, bgSamples, sampleRate, config);
    for (let i = 0; i < mixed.length; i++) {
      expect(mixed[i]).toBeCloseTo(Math.tanh(0.3), 3);
    }
  });

  it('applies voice-priority ducking when narration is active', () => {
    const sampleRate = 24000;
    const voiceSamples = new Float32Array(sampleRate * 2); // 2 seconds
    // First second is silent, second second has speech
    for (let i = sampleRate; i < voiceSamples.length; i++) {
      voiceSamples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * (i / sampleRate));
    }
    const bgSamples = new Float32Array(sampleRate * 2).fill(0.5);

    const config: BackgroundTrackConfig = {
      id: 'custom',
      name: 'Ducked',
      volume: 0.5,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      loop: true,
      duckingEnabled: true,
      duckingAmount: 0.8, // 80% reduction
      isMuted: false,
      audioUrl: '',
    };

    const mixed = mixPcmSamples(voiceSamples, bgSamples, sampleRate, config);
    expect(mixed.length).toBe(voiceSamples.length);
    // Silent section mix has background present without ducking
    expect(Math.abs(mixed[1000])).toBeGreaterThan(0.1);
  });
});
