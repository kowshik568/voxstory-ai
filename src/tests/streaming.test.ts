/**
 * Unit Tests for SSE Streaming Protocol & Client
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseSseEvent,
  StreamingSpeechClient,
  decodeBase64AudioChunk,
  assembleAudioChunks,
} from '../lib/streamingClient';

describe('SSE Streaming Protocol', () => {
  it('parses basic SSE data event', () => {
    const raw = 'event: chunk\ndata: {"chunkIndex": 1, "totalChunks": 4, "audioChunk": "SGVsbG8="}\n\n';
    const parsed = parseSseEvent(raw);
    expect(parsed.event).toBe('chunk');
    expect(parsed.data).toBeDefined();
    expect(parsed.data.chunkIndex).toBe(1);
    expect(parsed.data.audioChunk).toBe('SGVsbG8=');
  });

  it('parses complete SSE event with generation result', () => {
    const raw = 'event: complete\ndata: {"result": {"id": "gen-123", "title": "Stream Take"}}\n\n';
    const parsed = parseSseEvent(raw);
    expect(parsed.event).toBe('complete');
    expect(parsed.data.result.id).toBe('gen-123');
  });

  it('parses error SSE event', () => {
    const raw = 'event: error\ndata: {"error": "Rate limit exceeded"}\n\n';
    const parsed = parseSseEvent(raw);
    expect(parsed.event).toBe('error');
    expect(parsed.data.error).toBe('Rate limit exceeded');
  });

  it('handles default message event type when no event header is present', () => {
    const raw = 'data: {"status": "ok"}\n\n';
    const parsed = parseSseEvent(raw);
    expect(parsed.event).toBe('message');
    expect(parsed.data.status).toBe('ok');
  });

  it('decodes base64 audio chunks to Uint8Array', () => {
    // "Hello" in base64 is SGVsbG8=
    const decoded = decodeBase64AudioChunk('SGVsbG8=');
    expect(decoded.length).toBe(5);
    expect(String.fromCharCode(...decoded)).toBe('Hello');
  });

  it('buffers and concatenates multiple audio chunks seamlessly', () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5]);
    const chunk3 = new Uint8Array([6, 7, 8, 9]);

    const assembled = assembleAudioChunks([chunk1, chunk2, chunk3]);
    expect(assembled.length).toBe(9);
    expect(Array.from(assembled)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('StreamingSpeechClient initializes and cancels cleanly', () => {
    const client = new StreamingSpeechClient();
    expect(client.getIsStreaming()).toBe(false);
    client.cancel();
    expect(client.getIsStreaming()).toBe(false);
  });

  it('handles cancellation and abort signal without throwing uncaught errors', async () => {
    const client = new StreamingSpeechClient();
    const onError = vi.fn();
    const onStart = vi.fn();

    // Mock global fetch to return an abortable stream
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const streamPromise = client.startStream(
      {
        voice: 'Nalini',
        script: 'Test script',
        language: 'en-IN',
        audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      },
      { onStart, onError }
    );

    expect(client.getIsStreaming()).toBe(true);
    // User cancels the stream mid-flight
    client.cancel();
    await streamPromise;

    expect(client.getIsStreaming()).toBe(false);
    expect(onError).toHaveBeenCalledWith('Streaming cancelled by user.');

    global.fetch = origFetch;
  });
});
