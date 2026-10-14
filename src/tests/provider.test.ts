/**
 * Unit Tests for Gnani Timbre v3.0 Provider Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GnaniTimbreProvider, GnaniProviderError } from '../server/gnaniProvider';

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

  it('throws an error if attempting live generation without an API key', async () => {
    const provider = new GnaniTimbreProvider('');
    await expect(
      provider.generateSpeech({
        script: '<whispers> Testing without key',
        voice: 'Nalini',
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
        voice: 'Nalini',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
        },
      })
    ).rejects.toThrow('Script validation failed');
  });

  it('handles successful binary audio from Gnani API', async () => {
    const provider = new GnaniTimbreProvider('valid_test_key');
    const fakeWavBuffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00]).buffer;

    // Mock global fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/wav' }),
      arrayBuffer: () => Promise.resolve(fakeWavBuffer),
    }));

    const result = await provider.generateSpeech({
      script: '<excited> Hello VoxStory AI!',
      voice: 'Nalini',
      language: 'en-IN',
      audioConfig: {
        container: 'wav',
        encoding: 'linear_pcm',
        sampleRate: 24000,
      },
    });

    expect(result.provider).toBe('gnani-timbre-v3');
    expect(result.isDemo).toBe(false);
    expect(result.audioUrl).toContain('data:audio/wav;base64,');
    expect(result.detectedTags).toContain('<excited>');
  });

  it('handles 401 Unauthorized from Gnani API gracefully', async () => {
    const provider = new GnaniTimbreProvider('invalid_key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('{"error": "Invalid API key"}'),
      headers: new Headers(),
    }));

    await expect(
      provider.generateSpeech({
        script: '<laugh> Testing invalid key response',
        voice: 'Nalini',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
        },
      })
    ).rejects.toThrow('Unauthorized: Invalid Gnani API Key');
  });
});
