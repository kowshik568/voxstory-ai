/**
 * Unit Tests for Gnani Timbre v3.0 Provider Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GnaniTimbreProvider,
  GnaniProviderError,
  resolveTimbreVoice,
  VERIFIED_TIMBRE_VOICES,
  getWavDurationFromBuffer,
} from '../server/gnaniProvider';

describe('GnaniTimbreProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports missing API key safely', () => {
    const provider = new GnaniTimbreProvider('');
    expect(provider.hasApiKey()).toBe(false);
    const health = provider.getHealth();
    expect(health.status).toBe('degraded');
    expect(health.hasApiKey).toBe(false);
  });

  it('reports active key when provided', () => {
    const provider = new GnaniTimbreProvider('gnani_valid_secret_key_123');
    expect(provider.hasApiKey()).toBe(true);
    const health = provider.getHealth();
    expect(health.status).toBe('online');
    expect(health.hasApiKey).toBe(true);
  });

  it('resolves verified voices and maps legacy voices to valid timbre-v3.0 voices', () => {
    expect(resolveTimbreVoice('Shivani')).toBe('Shivani');
    expect(resolveTimbreVoice('Avinash')).toBe('Avinash');
    expect(resolveTimbreVoice('Nalini')).toBe('Shivani');
    expect(resolveTimbreVoice('deepak')).toBe('Avinash');
    expect(resolveTimbreVoice('rohan')).toBe('Yashraj');
    expect(VERIFIED_TIMBRE_VOICES).toHaveLength(13);
  });

  it('calculates duration accurately from WAV buffer headers', () => {
    // 44-byte header + 48,000 bytes = 1.0s at 24000Hz 16-bit mono
    const buf = new ArrayBuffer(44 + 48000);
    const view = new DataView(buf);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true);
    view.setUint32(40, 48000, true);

    const dur = getWavDurationFromBuffer(buf, 2.0);
    expect(dur).toBe(1.0);
  });

  it('throws an error if attempting live generation without an API key', async () => {
    const provider = new GnaniTimbreProvider('');
    await expect(
      provider.generateSpeech({
        script: '<whispers> Testing without key',
        voice: 'Shivani',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
        },
      })
    ).rejects.toThrowError(GnaniProviderError);
  });

  it('rejects an empty script before making an HTTP request', async () => {
    const provider = new GnaniTimbreProvider('some_key');
    await expect(
      provider.generateSpeech({
        script: '   ',
        voice: 'Shivani',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
        },
      })
    ).rejects.toThrow('Script validation failed');
  });

  it('constructs requests with model: timbre-v3.0 and handles successful binary audio from Gnani API', async () => {
    const provider = new GnaniTimbreProvider('valid_test_key');
    const fakeWav = new Uint8Array(44 + 48000);
    const view = new DataView(fakeWav.buffer);
    view.setUint32(24, 24000, true);
    view.setUint32(28, 48000, true);
    view.setUint32(40, 48000, true);

    let sentBody: any = null;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, opts) => {
        sentBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'audio/wav' }),
          arrayBuffer: () => Promise.resolve(fakeWav.buffer),
        });
      })
    );

    const result = await provider.generateSpeech({
      script: '<excited> Hello VoxStory AI!',
      voice: 'Nalini', // Should resolve to Shivani
      language: 'en-IN',
      audioConfig: {
        container: 'wav',
        encoding: 'linear_pcm',
        sampleRate: 24000,
      },
    });

    expect(sentBody.model).toBe('timbre-v3.0');
    expect(sentBody.voice).toBe('Shivani');
    expect(result.provider).toBe('gnani-timbre-v3');
    expect(result.isDemo).toBe(false);
    expect(result.audioUrl).toContain('data:audio/wav;base64,');
    expect(result.detectedTags).toContain('<excited>');
  });

  it('handles 401 Unauthorized from Gnani API gracefully', async () => {
    const provider = new GnaniTimbreProvider('invalid_key');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('{"error": "Invalid API key"}'),
        headers: new Headers(),
      })
    );

    await expect(
      provider.generateSpeech({
        script: '<laugh> Testing invalid key response',
        voice: 'Shivani',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
        },
      })
    ).rejects.toThrow('Unauthorized: Invalid Gnani API Key');
  });

  it('runs diagnoseConnection without leaking sensitive credentials', async () => {
    const provider = new GnaniTimbreProvider('secret_vac_key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'audio/wav' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(44)),
      })
    );

    const diag = await provider.diagnoseConnection();
    expect(diag.configured).toBe(true);
    expect(diag.connectivity).toBe('connected');
    expect(diag.authStatus).toBe('authenticated');
    expect(diag.model).toBe('timbre-v3.0');
    expect(JSON.stringify(diag)).not.toContain('secret_vac_key');
  });
});
