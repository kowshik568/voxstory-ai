/**
 * Unit Tests for Multi-Character Dialogue Assembly & Audio Stitching
 */

import { describe, it, expect } from 'vitest';
import { extractPcmFromWav, createWavHeader, stitchWavTracks } from '../lib/audioStitcher';

describe('Broadcast WAV Stitcher & Audio Assembly', () => {
  it('creates a valid 44-byte WAV header matching RIFF specification', () => {
    const dataSize = 48000; // 1 second of 24kHz 16-bit mono
    const header = createWavHeader(dataSize, 24000);
    expect(header.length).toBe(44);

    const view = new DataView(header.buffer);
    // RIFF check
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');

    // WAVE check
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe('WAVE');

    // Sample rate check
    expect(view.getUint32(24, true)).toBe(24000);
    // Byte rate (24000 * 2)
    expect(view.getUint32(28, true)).toBe(48000);
    // Bits per sample
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('extracts raw PCM data correctly from valid WAV buffer', () => {
    const sampleRate = 24000;
    const fakePcm = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const header = createWavHeader(fakePcm.length, sampleRate);
    const fullWav = new Uint8Array(44 + fakePcm.length);
    fullWav.set(header, 0);
    fullWav.set(fakePcm, 44);

    const { pcm, sampleRate: extractedRate } = extractPcmFromWav(fullWav);
    expect(extractedRate).toBe(24000);
    expect(pcm.length).toBe(4);
    expect(pcm[0]).toBe(0x01);
    expect(pcm[3]).toBe(0x04);
  });

  it('concatenates multiple WAV tracks with natural pauses', async () => {
    const pcmA = new Uint8Array(2400); // 50ms of audio
    const hdrA = createWavHeader(pcmA.length, 24000);
    const wavA = new Uint8Array(44 + pcmA.length);
    wavA.set(hdrA, 0);
    wavA.set(pcmA, 44);
    const b64A = `data:audio/wav;base64,${Buffer.from(wavA).toString('base64')}`;

    const pcmB = new Uint8Array(4800); // 100ms of audio
    const hdrB = createWavHeader(pcmB.length, 24000);
    const wavB = new Uint8Array(44 + pcmB.length);
    wavB.set(hdrB, 0);
    wavB.set(pcmB, 44);
    const b64B = `data:audio/wav;base64,${Buffer.from(wavB).toString('base64')}`;

    // Stitched with 0.1s pause (2400 samples = 4800 bytes)
    const result = await stitchWavTracks([b64A, b64B], 0.1, 24000);

    expect(result.dataUrl).toBeDefined();
    expect(result.durationSeconds).toBeGreaterThan(0.2);
    expect(result.sizeBytes).toBeGreaterThan(44 + 2400 + 4800);
  });
});
