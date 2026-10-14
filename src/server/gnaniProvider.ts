/**
 * VoxStory AI - Gnani Timbre v3.0 Provider Adapter
 * Handles communication with Gnani Vachana / Timbre TTS API
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

export class GnaniTimbreProvider {
  private apiKey: string | null;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://api.vachana.ai') {
    this.apiKey = apiKey || process.env.GNANI_API_KEY || null;
    this.baseUrl = baseUrl;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.apiKey.includes('your_gnani_api_key'));
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

    const payload = {
      text: request.script,
      voice: request.voice,
      language: request.language,
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
          'Accept': `audio/${request.audioConfig.container}, application/json`,
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

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      let audioBuffer: ArrayBuffer;

      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.audioContent || json.audio_data || json.audio) {
          const base64Str = json.audioContent || json.audio_data || json.audio;
          return {
            id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            projectId: request.projectId,
            title: request.title || 'Live Timbre v3.0 Take',
            script: request.script,
            voice: request.voice,
            language: request.language,
            audioConfig: request.audioConfig,
            audioUrl: `data:audio/${request.audioConfig.container};base64,${base64Str}`,
            durationSeconds: validation.estimatedDurationSeconds,
            wordCount: validation.wordCount,
            detectedTags: validation.detectedTags,
            createdAt: new Date().toISOString(),
            provider: 'gnani-timbre-v3',
            generationMode: 'live-provider',
            isDemo: false,
            fileSizeBytes: Buffer.from(base64Str, 'base64').byteLength,
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
        const mimeType = request.audioConfig.container === 'mp3' ? 'audio/mpeg' : `audio/${request.audioConfig.container}`;

        return {
          id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          projectId: request.projectId,
          title: request.title || 'Live Timbre v3.0 Take',
          script: request.script,
          voice: request.voice,
          language: request.language,
          audioConfig: request.audioConfig,
          audioUrl: `data:${mimeType};base64,${base64Audio}`,
          durationSeconds: validation.estimatedDurationSeconds,
          wordCount: validation.wordCount,
          detectedTags: validation.detectedTags,
          createdAt: new Date().toISOString(),
          provider: 'gnani-timbre-v3',
          generationMode: 'live-provider',
          isDemo: false,
          fileSizeBytes: audioBuffer.byteLength,
        };
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof GnaniProviderError) throw err;
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
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
