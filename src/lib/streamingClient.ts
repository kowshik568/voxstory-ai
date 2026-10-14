/**
 * VoxStory AI - Real-time Streaming Client (SSE)
 * Reads streamed audio events from the backend using fetch + ReadableStream
 * Supports cancellation, chunk buffering, and progress tracking.
 */

import { GenerationRequest, GenerationResult } from '../types';

export interface StreamCallbacks {
  onStart?: () => void;
  onProgress?: (receivedBytes: number, chunkIndex: number) => void;
  onChunk?: (base64AudioChunk: string) => void;
  onComplete?: (result: GenerationResult) => void;
  onError?: (error: string) => void;
}

export class StreamingSpeechClient {
  private abortController: AbortController | null = null;
  private isStreaming = false;

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isStreaming = false;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  async startStream(
    request: GenerationRequest,
    callbacks: StreamCallbacks
  ): Promise<void> {
    this.cancel();
    this.abortController = new AbortController();
    this.isStreaming = true;

    callbacks.onStart?.();

    try {
      const response = await fetch('/api/generations/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        let errText = '';
        try {
          const errJson = await response.json();
          errText = errJson.error || errJson.message;
        } catch {
          errText = response.statusText;
        }
        throw new Error(`Streaming failed (${response.status}): ${errText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let receivedBytes = 0;
      let chunkCount = 0;

      while (this.isStreaming) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        // Keep trailing incomplete event in buffer
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          const parsed = parseSseEvent(rawEvent);

          if (parsed.event === 'chunk' && parsed.data) {
            chunkCount++;
            receivedBytes += (parsed.data.audioChunk?.length || 0);
            callbacks.onProgress?.(receivedBytes, chunkCount);
            callbacks.onChunk?.(parsed.data.audioChunk);
          } else if (parsed.event === 'complete' && parsed.data?.result) {
            this.isStreaming = false;
            callbacks.onComplete?.(parsed.data.result);
            return;
          } else if (parsed.event === 'error') {
            throw new Error(parsed.data?.error || 'Provider stream error');
          }
        }
      }
    } catch (err: unknown) {
      this.isStreaming = false;
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
        callbacks.onError?.('Streaming cancelled by user.');
        return;
      }
      callbacks.onError?.(err instanceof Error ? err.message : String(err));
    }
  }
}

/**
 * Parses raw SSE chunk into event name and JSON data
 */
export function parseSseEvent(raw: string): { event: string; data: any } {
  const lines = raw.split('\n');
  let event = 'message';
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.replace('event:', '').trim();
    } else if (line.startsWith('data:')) {
      dataStr += line.replace('data:', '').trim();
    }
  }

  let data: any = null;
  try {
    data = dataStr ? JSON.parse(dataStr) : null;
  } catch {
    data = dataStr;
  }

  return { event, data };
}

/**
 * Decodes base64-encoded audio chunk into binary bytes
 */
export function decodeBase64AudioChunk(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Buffers and concatenates multiple binary audio chunks seamlessly
 */
export function assembleAudioChunks(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
