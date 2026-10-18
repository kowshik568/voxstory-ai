/**
 * Tests for WAV Audio Format & Header Integrity Validator
 */

import { describe, it, expect } from 'vitest';
import { validateWavBuffer, validateWavDataUrl } from '../lib/audioValidator';
import { createWavHeader } from '../lib/audioStitcher';

describe('Audio Validator', () => {
  it('validates a standard 24kHz 16-bit mono PCM WAV header', () => {
    const sampleRate = 24000;
    const numSamples = 24000 * 2; // 2 seconds
    const dataSize = numSamples * 2; // 16-bit = 2 bytes/sample
    const header = createWavHeader(dataSize, sampleRate);

    const fullBuffer = new Uint8Array(44 + dataSize);
    fullBuffer.set(header, 0);

    const result = validateWavBuffer(fullBuffer);
    expect(result.isValid).toBe(true);
    expect(result.sampleRate).toBe(24000);
    expect(result.numChannels).toBe(1);
    expect(result.bitsPerSample).toBe(16);
    expect(result.durationSeconds).toBe(2);
    expect(result.errors.length).toBe(0);
  });

  it('detects corrupted or truncated headers', () => {
    const corruptedBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00]); // 5 bytes
    const result = validateWavBuffer(corruptedBytes);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('under 44 bytes');
  });

  it('rejects non-WAV headers missing RIFF and WAVE magic signatures', () => {
    const fakeBuffer = new Uint8Array(50);
    const result = validateWavBuffer(fakeBuffer);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('RIFF'))).toBe(true);
  });

  it('validates a base64 WAV data URL', () => {
    const sampleRate = 16000;
    const dataSize = 32000; // 1 second
    const header = createWavHeader(dataSize, sampleRate);
    const fullBuffer = new Uint8Array(44 + dataSize);
    fullBuffer.set(header, 0);

    const base64 = Buffer.from(fullBuffer).toString('base64');
    const dataUrl = `data:audio/wav;base64,${base64}`;

    const result = validateWavDataUrl(dataUrl);
    expect(result.isValid).toBe(true);
    expect(result.sampleRate).toBe(16000);
    expect(result.durationSeconds).toBe(1);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('reports clipping and low-signal warnings without failing structural WAV validation', () => {
    const sampleRate = 24000;
    const numSamples = 24000; // 1 second
    const dataSize = numSamples * 2;
    const header = createWavHeader(dataSize, sampleRate);

    const buffer = Buffer.alloc(44 + dataSize);
    header.forEach((byte, i) => (buffer[i] = byte));

    // Fill with high-amplitude samples triggering clipping
    for (let i = 0; i < 20; i++) {
      buffer.writeInt16LE(32767, 44 + i * 2);
    }

    const result = validateWavBuffer(buffer);
    expect(result.isValid).toBe(true);
    expect(result.isClipping).toBe(true);
    expect(result.warnings?.some((w) => w.includes('clipping warning'))).toBe(true);
  });
});

