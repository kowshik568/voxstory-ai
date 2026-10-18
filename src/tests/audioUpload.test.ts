/**
 * VoxStory AI - Audio Upload & Asset Management Tests (v12 Beta)
 * Verifies WAV file validation, chunk bounds parsing, upload endpoints,
 * size constraints, binary streaming, and reference-safe cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { createApiRouter } from '../server/routes';
import { validateWavBuffer } from '../lib/audioValidator';
import { createWavHeader } from '../lib/audioStitcher';

describe('VoxStory AI - Background Audio Upload & Asset Lifecycle Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '20mb' }));
    app.use('/api', createApiRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // Helper to generate synthetic WAV buffer
  function generateSyntheticWav(durationSec = 2, sampleRate = 24000, numChannels = 1): Buffer {
    const numSamples = Math.floor(durationSec * sampleRate * numChannels);
    const pcmBytes = Buffer.alloc(numSamples * 2);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3; // 440Hz tone
      pcmBytes.writeInt16LE(sample < 0 ? sample * 0x8000 : sample * 0x7fff, i * 2);
    }
    const header = Buffer.from(createWavHeader(pcmBytes.length, sampleRate));
    return Buffer.concat([header, pcmBytes]);
  }

  describe('WAV Structural Format Validation', () => {
    it('accepts valid synthetic WAV audio', () => {
      const wav = generateSyntheticWav(3, 24000, 1);
      const check = validateWavBuffer(wav);
      expect(check.isValid).toBe(true);
      expect(check.sampleRate).toBe(24000);
      expect(check.numChannels).toBe(1);
      expect(check.durationSeconds).toBeCloseTo(3, 0);
      expect(check.errors).toHaveLength(0);
    });

    it('rejects truncated files under 44 bytes', () => {
      const check = validateWavBuffer(Buffer.from([0x52, 0x49, 0x46, 0x46]));
      expect(check.isValid).toBe(false);
      expect(check.errors[0]).toContain('under 44 bytes');
    });

    it('rejects corrupt RIFF magic header', () => {
      const wav = generateSyntheticWav(1, 24000, 1);
      wav[0] = 0x00; // Corrupt 'R'
      const check = validateWavBuffer(wav);
      expect(check.isValid).toBe(false);
      expect(check.errors.some((e) => e.includes('Invalid RIFF'))).toBe(true);
    });

    it('handles additional WAV chunks (e.g. LIST metadata chunk) without corruption', () => {
      const wav = generateSyntheticWav(2, 24000, 1);
      const listChunk = Buffer.alloc(16);
      listChunk.write('LIST', 0);
      listChunk.writeUInt32LE(8, 4);
      listChunk.write('INFO', 8);

      const wavWithMetadata = Buffer.concat([wav, listChunk]);
      const check = validateWavBuffer(wavWithMetadata);
      expect(check.isValid).toBe(true);
      expect(check.durationSeconds).toBeGreaterThan(1.5);
    });
  });

  describe('Audio Upload API Endpoint (/api/audio/upload)', () => {
    it('uploads valid WAV audio and returns structured AudioAsset metadata', async () => {
      const wav = generateSyntheticWav(2.5, 24000, 1);
      const res = await fetch(`${baseUrl}/audio/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'cinematic_strings.wav',
          audioBase64: wav.toString('base64'),
          trackType: 'music',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toMatch(/^asset-/);
      expect(json.data.filename).toBe('cinematic_strings.wav');
      expect(json.data.sampleRate).toBe(24000);
      expect(json.data.durationSeconds).toBeGreaterThan(2);
      expect(json.data.url).toContain('/api/audio/assets/');
    });

    it('rejects empty file payloads with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/audio/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'empty.wav',
          audioBase64: '',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Missing audio payload');
    });

    it('rejects corrupt non-WAV audio with 400 Bad Request', async () => {
      const fakeAudio = Buffer.from('NOT_A_WAV_HEADER_DATA_1234567890123456789012345678901234567890123456');
      const res = await fetch(`${baseUrl}/audio/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'corrupted.wav',
          audioBase64: fakeAudio.toString('base64'),
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid or malformed WAV');
    });

    it('sanitizes dangerous filenames against directory traversal', async () => {
      const wav = generateSyntheticWav(1, 24000, 1);
      const res = await fetch(`${baseUrl}/audio/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: '../../../etc/passwd.wav',
          audioBase64: wav.toString('base64'),
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.filename).not.toContain('..');
      expect(json.data.filename).not.toContain('/');
    });
  });

  describe('Audio Asset Lifecycle & Streaming', () => {
    it('retrieves asset metadata and streams raw binary audio with correct headers', async () => {
      const wav = generateSyntheticWav(2, 24000, 1);
      const uploadRes = await fetch(`${baseUrl}/audio/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'room_tone.wav',
          audioBase64: wav.toString('base64'),
          trackType: 'ambience',
        }),
      });

      const uploadJson = await uploadRes.json();
      const assetId = uploadJson.data.id;

      // 1. Get metadata
      const metaRes = await fetch(`${baseUrl}/audio/assets/${assetId}`);
      expect(metaRes.status).toBe(200);
      const metaJson = await metaRes.json();
      expect(metaJson.data.filename).toBe('room_tone.wav');

      // 2. Stream binary audio
      const streamRes = await fetch(`${baseUrl}/audio/assets/${assetId}/stream`);
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get('content-type')).toContain('audio/wav');
      expect(streamRes.headers.get('x-audio-samplerate')).toBe('24000');
      const streamBuf = await streamRes.arrayBuffer();
      expect(streamBuf.byteLength).toBe(wav.length);

      // 3. Delete asset
      const deleteRes = await fetch(`${baseUrl}/audio/assets/${assetId}`, { method: 'DELETE' });
      expect(deleteRes.status).toBe(200);

      // 4. Verify gone
      const checkRes = await fetch(`${baseUrl}/audio/assets/${assetId}`);
      expect(checkRes.status).toBe(404);
    });

    it('returns 404 for nonexistent asset streams', async () => {
      const res = await fetch(`${baseUrl}/audio/assets/asset-nonexistent-999/stream`);
      expect(res.status).toBe(404);
    });
  });
});
