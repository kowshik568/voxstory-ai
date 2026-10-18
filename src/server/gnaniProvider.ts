/**
 * VoxStory AI - Gnani Timbre v3.0 Provider Adapter
 * Handles live communication with Gnani Vachana / Timbre TTS API
 */

import { z } from 'zod';
import { GenerationRequest, GenerationResult, ProviderHealth } from '../types';
import { validateScript } from '../lib/tagCatalog';

export const GenerationRequestSchema = z.object({
  script: z.string().min(1, 'Script cannot be empty').max(5000, 'Script cannot exceed 5000 characters'),
  voice: z.string().min(1, 'Voice must be specified'),
  language: z.enum(['en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'bn-IN', 'mr-IN', 'gu-IN', 'pa-IN']),
  audioConfig: z.object({
    container: z.enum(['wav', 'mp3', 'ogg']),
    encoding: z.enum(['linear_pcm', 'mp3', 'opus']).default('linear_pcm'),
    sampleRate: z.union([z.literal(16000), z.literal(24000), z.literal(48000)]).default(24000),
    numChannels: z.number().optional().default(1),
  }).default({
    container: 'wav',
    encoding: 'linear_pcm',
    sampleRate: 24000,
    numChannels: 1,
  }),
  title: z.string().optional().default('Untitled Take'),
  projectId: z.string().optional(),
});

export class GnaniProviderError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = 'GNANI_PROVIDER_ERROR', details?: unknown) {
    super(message);
    this.name = 'GnaniProviderError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * 13 verified live voices supported directly by Gnani Timbre v3.0
 */
export const VERIFIED_TIMBRE_VOICES = [
  'Avinash',
  'Shivani',
  'Lakshmi',
  'Kalpana',
  'Shubham',
  'Prakash',
  'Devansh',
  'Yashraj',
  'Chetana',
  'Vasudha',
  'Harshad',
  'Riyaa',
  'Tarika',
] as const;

/**
 * Maps legacy or demo voice names to verified Timbre v3.0 voices
 */
export const VOICE_COMPAT_MAP: Record<string, string> = {
  nalini: 'Shivani',
  deepak: 'Avinash',
  kaveri: 'Lakshmi',
  aarav: 'Shubham',
  ananya: 'Kalpana',
  rohan: 'Yashraj',
  priya: 'Chetana',
  aditi: 'Vasudha',
  suresh: 'Prakash',
  meera: 'Tarika',
  vikram: 'Harshad',
  sneha: 'Riyaa',
};

export function resolveTimbreVoice(voiceInput: string): string {
  const match = VERIFIED_TIMBRE_VOICES.find(
    (v) => v.toLowerCase() === voiceInput.trim().toLowerCase()
  );
  if (match) return match;

  const mapped = VOICE_COMPAT_MAP[voiceInput.trim().toLowerCase()];
  if (mapped) return mapped;

  return 'Shivani'; // Default expressive flagship voice
}

/**
 * Extracts accurate duration from a binary WAV buffer
 */
export function getWavDurationFromBuffer(buffer: ArrayBuffer, fallbackSec: number): number {
  if (buffer.byteLength < 44) return fallbackSec;
  try {
    const view = new DataView(buffer);
    const sampleRate = view.getUint32(24, true);
    const byteRate = view.getUint32(28, true);
    const dataSize = view.getUint32(40, true);

    const actualPcmSize =
      dataSize > 0 && dataSize < buffer.byteLength ? dataSize : buffer.byteLength - 44;
    const rate = byteRate > 0 ? byteRate : sampleRate > 0 ? sampleRate * 2 : 48000;
    const dur = actualPcmSize / rate;

    return dur > 0.1 && dur < 3600 ? Math.round(dur * 100) / 100 : fallbackSec;
  } catch {
    return fallbackSec;
  }
}

export class GnaniTimbreProvider {
  private apiKey: string | null;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://api.vachana.ai') {
    this.apiKey =
      typeof apiKey === 'string'
        ? apiKey
        : process.env.GNANI_API_KEY || process.env.GNANI_TOKEN || null;
    this.baseUrl = baseUrl;
  }

  hasApiKey(): boolean {
    return Boolean(
      this.apiKey &&
        this.apiKey.trim().length > 0 &&
        !this.apiKey.includes('your_gnani_api_key')
    );
  }

  getHealth(): ProviderHealth {
    const hasKey = this.hasApiKey();
    return {
      status: hasKey ? 'online' : 'degraded',
      provider: 'Gnani AI Vachana / Timbre Platform',
      model: 'Timbre v3.0 (with 13 Audio Expression Tags)',
      hasApiKey: hasKey,
      version: '3.0.0',
      apiEndpoint: `${this.baseUrl}/api/v1/tts/inference`,
      streamingSupported: true,
      streamingEndpoint: `${this.baseUrl}/api/v1/tts/sse`,
    };
  }

  /**
   * Safe connectivity diagnostic that verifies API connectivity and authentication
   * without logging or exposing secrets.
   */
  async diagnoseConnection(): Promise<{
    configured: boolean;
    connectivity: 'connected' | 'unreachable';
    authStatus: 'authenticated' | 'invalid_credentials' | 'not_configured';
    model: string;
    latencyMs: number;
    supportedVoicesCount: number;
    error?: string;
  }> {
    if (!this.hasApiKey()) {
      return {
        configured: false,
        connectivity: 'connected',
        authStatus: 'not_configured',
        model: 'timbre-v3.0',
        latencyMs: 0,
        supportedVoicesCount: VERIFIED_TIMBRE_VOICES.length,
      };
    }

    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/tts/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key-ID': this.apiKey as string,
          Accept: 'audio/wav, application/json',
        },
        body: JSON.stringify({
          text: 'Ping.',
          voice: 'Shivani',
          language: 'en-IN',
          model: 'timbre-v3.0',
          audio_config: {
            container: 'wav',
            encoding: 'linear_pcm',
            sample_rate: 24000,
          },
        }),
      });

      const latencyMs = Date.now() - start;

      if (response.ok) {
        return {
          configured: true,
          connectivity: 'connected',
          authStatus: 'authenticated',
          model: 'timbre-v3.0',
          latencyMs,
          supportedVoicesCount: VERIFIED_TIMBRE_VOICES.length,
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          configured: true,
          connectivity: 'connected',
          authStatus: 'invalid_credentials',
          model: 'timbre-v3.0',
          latencyMs,
          supportedVoicesCount: VERIFIED_TIMBRE_VOICES.length,
          error: 'Gnani API key rejected (401 Unauthorized)',
        };
      } else {
        const text = await response.text();
        return {
          configured: true,
          connectivity: 'connected',
          authStatus: 'authenticated',
          model: 'timbre-v3.0',
          latencyMs,
          supportedVoicesCount: VERIFIED_TIMBRE_VOICES.length,
          error: `Provider HTTP status ${response.status}: ${text.slice(0, 100)}`,
        };
      }
    } catch (err) {
      return {
        configured: true,
        connectivity: 'unreachable',
        authStatus: 'not_configured',
        model: 'timbre-v3.0',
        latencyMs: Date.now() - start,
        supportedVoicesCount: VERIFIED_TIMBRE_VOICES.length,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Calls Gnani Timbre v3.0 REST inference endpoint
   */
  async generateSpeech(request: GenerationRequest): Promise<GenerationResult> {
    const validation = validateScript(request.script);
    if (!validation.isValid) {
      throw new GnaniProviderError(
        `Script validation failed: ${validation.errors.join('; ')}`,
        400,
        'INVALID_SCRIPT'
      );
    }

    if (!this.hasApiKey()) {
      throw new GnaniProviderError(
        'GNANI_API_KEY is not configured in environment. To execute live API synthesis, provide a valid Gnani API key.',
        401,
        'API_KEY_MISSING'
      );
    }

    const resolvedVoice = resolveTimbreVoice(request.voice);

    const payload = {
      text: request.script,
      voice: resolvedVoice,
      language: request.language,
      model: 'timbre-v3.0',
      audio_config: {
        container: request.audioConfig.container,
        encoding: request.audioConfig.encoding === 'mp3' ? 'mp3' : 'linear_pcm',
        sample_rate: request.audioConfig.sampleRate,
        num_channels: 1,
      },
    };

    const endpoint = `${this.baseUrl}/api/v1/tts/inference`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key-ID': this.apiKey as string,
          Accept: `audio/${request.audioConfig.container}, application/json`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore
        }

        if (response.status === 401) {
          throw new GnaniProviderError(
            'Unauthorized: Invalid Gnani API Key (X-API-Key-ID rejected by api.vachana.ai)',
            401,
            'INVALID_API_KEY',
            errorBody
          );
        } else if (response.status === 429) {
          throw new GnaniProviderError(
            'Rate limit exceeded on Gnani Timbre v3.0 endpoint. Please wait a moment before trying again.',
            429,
            'RATE_LIMIT_EXCEEDED',
            errorBody
          );
        } else {
          throw new GnaniProviderError(
            `Gnani Timbre API returned error ${response.status}: ${errorBody || response.statusText}`,
            response.status,
            'PROVIDER_HTTP_ERROR',
            errorBody
          );
        }
      }

      // Check content type & provider request tracking
      const contentType = response.headers.get('content-type') || '';
      const providerRequestId = response.headers.get('x-api-request-id') || undefined;
      let audioBuffer: ArrayBuffer;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.audioContent || json.audio_data || json.audio) {
          const base64Str = json.audioContent || json.audio_data || json.audio;
          const rawBytes = Buffer.from(base64Str, 'base64');
          const exactDuration = getWavDurationFromBuffer(
            rawBytes.buffer,
            validation.estimatedDurationSeconds
          );

          return {
            id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            projectId: request.projectId,
            title: request.title || 'Live Timbre v3.0 Take',
            script: request.script,
            voice: resolvedVoice,
            language: request.language,
            audioConfig: request.audioConfig,
            audioUrl: `data:audio/${request.audioConfig.container};base64,${base64Str}`,
            durationSeconds: exactDuration,
            wordCount: validation.wordCount,
            detectedTags: validation.detectedTags,
            createdAt: new Date().toISOString(),
            provider: 'gnani-timbre-v3',
            generationMode: 'live-provider',
            isDemo: false,
            fileSizeBytes: rawBytes.byteLength,
            providerRequestId,
          };
        } else {
          throw new GnaniProviderError(
            `Unexpected JSON response from Gnani API: ${JSON.stringify(json)}`,
            502,
            'INVALID_RESPONSE_FORMAT'
          );
        }
      } else {
        // Binary audio response
        audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const mimeType =
          request.audioConfig.container === 'mp3'
            ? 'audio/mpeg'
            : `audio/${request.audioConfig.container}`;
        const exactDuration = getWavDurationFromBuffer(
          audioBuffer,
          validation.estimatedDurationSeconds
        );

        return {
          id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          projectId: request.projectId,
          title: request.title || 'Live Timbre v3.0 Take',
          script: request.script,
          voice: resolvedVoice,
          language: request.language,
          audioConfig: request.audioConfig,
          audioUrl: `data:${mimeType};base64,${base64Audio}`,
          durationSeconds: exactDuration,
          wordCount: validation.wordCount,
          detectedTags: validation.detectedTags,
          createdAt: new Date().toISOString(),
          provider: 'gnani-timbre-v3',
          generationMode: 'live-provider',
          isDemo: false,
          fileSizeBytes: audioBuffer.byteLength,
          providerRequestId,
        };
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof GnaniProviderError) throw err;
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'AbortError'
      ) {
        throw new GnaniProviderError(
          'Request to Gnani Timbre v3.0 timed out after 25 seconds.',
          504,
          'PROVIDER_TIMEOUT'
        );
      }
      throw new GnaniProviderError(
        `Failed to communicate with Gnani Timbre API: ${err instanceof Error ? err.message : String(err)}`,
        500,
        'NETWORK_ERROR'
      );
    }
  }
}
