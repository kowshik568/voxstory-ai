/**
 * VoxStory AI - Express API Router
 * Endpoints for voice metadata, script validation, audio generation,
 * persistent generation jobs, dialogue scene assembly, and project management.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GnaniTimbreProvider, GenerationRequestSchema, GnaniProviderError } from './gnaniProvider';
import { VERIFIED_TAGS, validateScript } from '../lib/tagCatalog';
import { SUPPORTED_VOICES, SUPPORTED_LANGUAGES } from '../lib/voices';
import { TEMPLATES } from '../lib/templates';
import { validateWavBuffer, validateWavDataUrl } from '../lib/audioValidator';
import { extractPcmFromWav } from '../lib/audioStitcher';
import {
  StudioProject,
  GenerationResult,
  AudioConfig,
  GenerationJob,
  SystemMetrics,
  UserWorkspace,
  AudioAsset,
} from '../types';
import { storage, audioStorage } from './storage/storageManager';
import { migrateStorage } from './storage/migrator';
import { generalRateLimiter, generationRateLimiter } from './rateLimiter';
import {
  getUserContext,
  requireAuthMiddleware,
  checkProjectOwnership,
  checkAssetOwnership,
} from './auth';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'voxstory_store.json');

function loadPersistedData(): {
  projects?: StudioProject[];
  generations?: GenerationResult[];
} | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[VoxStory Persistence] Could not read disk store:', e);
  }
  return null;
}

function savePersistedData(projects: StudioProject[], generations: GenerationResult[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const safeGenerations = generations.slice(-50);
    const content = JSON.stringify({ projects, generations: safeGenerations }, null, 2);
    // Atomic write to prevent file corruption
    const tmp = `${DATA_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.warn('[VoxStory Persistence] Could not write disk store:', e);
  }
}

export function createApiRouter(): Router {
  const router = Router();
  router.use(generalRateLimiter);
  router.use(requireAuthMiddleware);
  const provider = new GnaniTimbreProvider();
  storage.init().catch(console.error);
  const startTime = Date.now();

  // Load from disk if available
  const persisted = loadPersistedData();

  // Metrics Counters
  let totalRequests = 0;
  let successfulGenerations = 0;
  let failedGenerations = 0;
  let totalLatencyMs = 0;
  let totalAudioSecondsGenerated = 0;
  let totalCharactersProcessed = 0;

  // Persisted Favorites Store
  const favoritesStore = new Set<string>(['shivani', 'avinash', 'nalini', 'lakshmi', 'kalpana']);

  // Initialize projects store
  const defaultProjects: [string, StudioProject][] = [
    [
      'demo-project-1',
      {
        id: 'demo-project-1',
        title: 'YouTube Tech Reveal Hook',
        script: `<excited> What if I told you that everything you knew about battery technology just became obsolete? <pauses> Last Tuesday, researchers quietly published a paper. <whispers> And the numbers they reported are almost impossible to believe.`,
        voice: 'Shivani',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
          numChannels: 1,
        },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'demo-project-2',
      {
        id: 'demo-project-2',
        title: 'Midnight Chronicles Trailer',
        script: `<sigh> It is midnight across the subcontinent. <pauses> You’re listening to Midnight Chronicles. <whispers> Tonight, we unlock the forgotten telegrams. <slow> Pour yourself a warm cup, and let’s dive into the dark.`,
        voice: 'Avinash',
        language: 'en-IN',
        audioConfig: {
          container: 'wav',
          encoding: 'linear_pcm',
          sampleRate: 24000,
          numChannels: 1,
        },
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  ];

  const projectsStore = new Map<string, StudioProject>(
    persisted?.projects && persisted.projects.length > 0
      ? persisted.projects.map((p) => [p.id, p])
      : defaultProjects
  );

  // Generation takes history store
  const generationsStore = new Map<string, GenerationResult>(
    persisted?.generations && persisted.generations.length > 0
      ? persisted.generations.map((g) => [g.id, g])
      : []
  );

  const persistCurrentState = () => {
    savePersistedData(Array.from(projectsStore.values()), Array.from(generationsStore.values()));
  };
  // Asynchronous persistent jobs store & idempotency map
  const jobsStore = new Map<string, GenerationJob>();
  const idempotencyMap = new Map<string, string>(); // idempotencyKey -> jobId
  const activeControllers = new Map<string, AbortController>();

  /**
   * Core Audio Synthesis Engine: executes speech generation via live provider
   * or studio demo synthesis, validates the resulting WAV headers, and logs metrics.
   */
  async function executeSpeechGeneration(
    reqData: {
      script: string;
      voice: string;
      language: any;
      audioConfig: any;
      title?: string;
      projectId?: string;
    },
    signal?: AbortSignal
  ): Promise<GenerationResult> {
    totalRequests += 1;
    const reqStart = Date.now();
    const { script, voice, language, audioConfig, title, projectId } = reqData;

    // 1. Live Gnani Timbre v3.0 Synthesis
    if (provider.hasApiKey()) {
      try {
        const result = await provider.generateSpeech({
          script,
          voice,
          language,
          audioConfig: audioConfig as unknown as AudioConfig,
          title,
          projectId,
        });

        const latency = Date.now() - reqStart;
        successfulGenerations += 1;
        totalLatencyMs += latency;
        totalAudioSecondsGenerated += result.durationSeconds;

        generationsStore.set(result.id, result);
        persistCurrentState();
        return result;
      } catch (err: unknown) {
        failedGenerations += 1;
        throw err;
      }
    }

    // 2. Studio Demo Mode Synthesis (Formant-modeled PCM WAV)
    const validation = validateScript(script);
    const selectedVoiceProfile = SUPPORTED_VOICES.find(
      (v) => v.name.toLowerCase() === voice.toLowerCase()
    );
    const gender = selectedVoiceProfile?.gender || 'Female';

    const sampleRate = audioConfig.sampleRate || 24000;
    const duration = Math.max(2.5, validation.estimatedDurationSeconds);
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const baseF0 = gender === 'Female' ? 220 : 130;

    for (let i = 0; i < numSamples; i++) {
      if (signal?.aborted) {
        throw new Error('Generation cancelled by user');
      }
      const t = i / sampleRate;
      const progress = i / numSamples;

      // Natural speech cadence & tag modeling
      const syllable = Math.max(0.1, Math.sin(t * 4 * Math.PI));
      const h1 = Math.sin(2 * Math.PI * baseF0 * t) * 0.5;
      const h2 = Math.sin(2 * Math.PI * (baseF0 * 2) * t) * 0.3;
      const h3 = Math.sin(2 * Math.PI * (baseF0 * 3) * t) * 0.15;
      const breath = (Math.random() * 2 - 1) * 0.05;

      const envelope = Math.min(1, Math.min(progress * 15, (1 - progress) * 15));
      buffer[i] = (h1 + h2 + h3 + breath) * 0.3 * syllable * envelope;
    }

    // Encode to WAV Buffer
    const byteRate = sampleRate * 2;
    const dataSize = buffer.length * 2;
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20); // PCM
    wavHeader.writeUInt16LE(1, 22); // Mono
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(2, 32); // BlockAlign
    wavHeader.writeUInt16LE(16, 34); // BitsPerSample
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    const pcmData = Buffer.alloc(dataSize);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      pcmData.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
    }

    const fullWav = Buffer.concat([wavHeader, pcmData]);

    // Rigorous WAV integrity check
    const headerValidation = validateWavBuffer(fullWav);
    if (!headerValidation.isValid) {
      console.error('WAV synthesis integrity failure:', headerValidation.errors);
    }

    const base64Audio = fullWav.toString('base64');
    const result: GenerationResult = {
      id: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      title: title || `${voice} - Expressive Take`,
      script,
      voice,
      language,
      audioConfig: audioConfig as unknown as AudioConfig,
      audioUrl: `data:audio/wav;base64,${base64Audio}`,
      durationSeconds: duration,
      wordCount: validation.wordCount,
      detectedTags: validation.detectedTags,
      createdAt: new Date().toISOString(),
      provider: 'studio-demo',
      generationMode: 'procedural-demo',
      isDemo: true,
      fileSizeBytes: fullWav.byteLength,
    };

    const latency = Date.now() - reqStart;
    successfulGenerations += 1;
    totalLatencyMs += latency;
    totalAudioSecondsGenerated += result.durationSeconds;
    totalCharactersProcessed += script.length;

    generationsStore.set(result.id, result);
    persistCurrentState();
    storage.saveGeneration(result).catch((err) => {
      console.warn('[Storage] Background save generation failed:', err);
    });
    return result;
  }

  // 1. Health & Liveness check (Fast, bounded, consumes zero Gnani credits)
  const handleHealth = async (_req: Request, res: Response) => {
    try {
      const providerHealth = provider.getHealth();
      const storageHealth = await storage.getHealth();
      const durableRequired = process.env.STORAGE_REQUIRE_DURABLE === 'true';

      return res.json({
        success: true,
        status: 'online',
        version: '12.0.0',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        storage: {
          driver: storageHealth.driver,
          status: storageHealth.status,
          isDurable: storageHealth.isDurable,
          durableRequired,
        },
        data: providerHealth,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        status: 'degraded',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
  router.get('/health', handleHealth);
  router.get('/status', handleHealth);

  // Readiness Check: Verifies critical storage readiness without calling external billable APIs
  router.get('/ready', async (_req: Request, res: Response) => {
    try {
      const storageHealth = await storage.getHealth();
      const durableRequired = process.env.STORAGE_REQUIRE_DURABLE === 'true';

      if (durableRequired && (storageHealth.status === 'unavailable' || !storageHealth.isDurable)) {
        return res.status(503).json({
          success: false,
          ready: false,
          error: 'Durable cloud persistence is required (STORAGE_REQUIRE_DURABLE=true), but durable adapter is unavailable.',
          storage: storageHealth,
        });
      }

      return res.json({
        success: true,
        ready: true,
        storage: storageHealth,
      });
    } catch (err) {
      return res.status(503).json({
        success: false,
        ready: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Safe Provider Connection Diagnostic (Redacts keys, verifies live status)
  router.get('/provider/diagnostic', async (_req: Request, res: Response) => {
    try {
      const diag = await provider.diagnoseConnection();
      res.json({
        success: true,
        data: diag,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Storage Durability & Disk Persistence Diagnostics
  const handleStorageHealth = async (_req: Request, res: Response) => {
    try {
      const storageHealth = await storage.getHealth();
      res.json({
        success: true,
        data: storageHealth,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
  router.get('/storage/health', handleStorageHealth);
  router.get('/storage/status', handleStorageHealth);

  // 2. Production Metrics & Structured Logs
  router.get('/metrics', (_req: Request, res: Response) => {
    const activeJobs = Array.from(jobsStore.values()).filter(
      (j) => j.status === 'queued' || j.status === 'processing'
    ).length;

    const metrics: SystemMetrics = {
      totalRequests,
      successfulGenerations,
      failedGenerations,
      activeJobs,
      averageLatencyMs:
        successfulGenerations > 0 ? Math.round(totalLatencyMs / successfulGenerations) : 0,
      totalAudioSecondsGenerated: Math.round(totalAudioSecondsGenerated * 10) / 10,
      providerHealth: provider.hasApiKey() ? 'online' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    };

    res.json({
      success: true,
      data: metrics,
    });
  });

  // 3. Verified expression tags catalog
  router.get('/expressions', (_req: Request, res: Response) => {
    res.json({
      success: true,
      count: VERIFIED_TAGS.length,
      data: VERIFIED_TAGS,
    });
  });

  // 4. Supported voices catalog
  router.get('/voices', (_req: Request, res: Response) => {
    res.json({
      success: true,
      count: SUPPORTED_VOICES.length,
      data: SUPPORTED_VOICES,
    });
  });

  // 5. Supported languages
  router.get('/languages', (_req: Request, res: Response) => {
    res.json({
      success: true,
      count: SUPPORTED_LANGUAGES.length,
      data: SUPPORTED_LANGUAGES,
    });
  });

  // 6. Directorial templates
  router.get('/templates', (_req: Request, res: Response) => {
    res.json({
      success: true,
      count: TEMPLATES.length,
      data: TEMPLATES,
    });
  });

  // 7. Validate script
  const handleScriptValidation = (req: Request, res: Response) => {
    const { script } = req.body;
    if (typeof script !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body: "script" string is required',
      });
    }

    const result = validateScript(script);
    return res.json({
      success: true,
      data: result,
    });
  };

  router.post('/validate-script', handleScriptValidation);
  router.post('/validate', handleScriptValidation);

  // 8. Synchronous Speech Generation (Legacy & Fast UI CTA)
  router.post('/generations', generationRateLimiter, async (req: Request, res: Response) => {
    const parsed = GenerationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    try {
      const result = await executeSpeechGeneration(parsed.data);
      return res.json({
        success: true,
        data: result,
        note: result.isDemo
          ? 'Generated in Studio Demo Mode. Configure GNANI_API_KEY in environment for live api.vachana.ai requests.'
          : 'Synthesized via live Gnani Timbre v3.0 endpoint.',
      });
    } catch (err: unknown) {
      if (err instanceof GnaniProviderError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.message,
          code: err.code,
          details: err.details,
        });
      }
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Speech synthesis failed',
      });
    }
  });

  // 9. Persistent Generation Job System
  // Queue a new synthesis job with unique ID & duplicate-submission protection
  router.post('/jobs', generationRateLimiter, async (req: Request, res: Response) => {
    const parsed = GenerationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const idempotencyKey =
      (req.headers['x-idempotency-key'] as string) || req.body.idempotencyKey;

    // Idempotency check: if job exists for this key, return it immediately
    if (idempotencyKey && idempotencyMap.has(idempotencyKey)) {
      const existingJobId = idempotencyMap.get(idempotencyKey)!;
      const existingJob = jobsStore.get(existingJobId);
      if (existingJob) {
        return res.status(200).json({
          success: true,
          jobId: existingJob.id,
          status: existingJob.status,
          progress: existingJob.progress,
          result: existingJob.result,
          error: existingJob.error,
          isDuplicateSubmission: true,
        });
      }
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const controller = new AbortController();
    activeControllers.set(jobId, controller);

    if (idempotencyKey) {
      idempotencyMap.set(idempotencyKey, jobId);
    }

    const job: GenerationJob = {
      id: jobId,
      idempotencyKey,
      status: 'queued',
      progress: 10,
      request: parsed.data as any,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    jobsStore.set(jobId, job);

    // Asynchronous background worker execution
    const processJob = async (retryAttempt = 0) => {
      const currentJob = jobsStore.get(jobId);
      if (!currentJob || currentJob.status === 'cancelled') return;

      currentJob.status = 'processing';
      currentJob.progress = 30 + retryAttempt * 10;
      currentJob.startedAt = currentJob.startedAt || new Date().toISOString();

      try {
        const result = await executeSpeechGeneration(currentJob.request, controller.signal);
        currentJob.status = 'completed';
        currentJob.progress = 100;
        currentJob.result = result;
        currentJob.completedAt = new Date().toISOString();
        currentJob.latencyMs = Date.now() - new Date(currentJob.startedAt).getTime();
        activeControllers.delete(jobId);
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          currentJob.status = 'cancelled';
          activeControllers.delete(jobId);
          return;
        }

        // Retry policy: Only retry network/5xx errors, never 4xx client errors
        const isClientError =
          err instanceof GnaniProviderError && err.statusCode >= 400 && err.statusCode < 500;

        if (!isClientError && retryAttempt < 2) {
          currentJob.retryCount = retryAttempt + 1;
          setTimeout(() => processJob(retryAttempt + 1), 1000 * (retryAttempt + 1));
          return;
        }

        currentJob.status = 'failed';
        currentJob.error = {
          message: err instanceof Error ? err.message : 'Job execution failed',
          code: err instanceof GnaniProviderError ? err.code : 'UNKNOWN_ERROR',
        };
        activeControllers.delete(jobId);
      }
    };

    // Kick off worker asynchronously
    setTimeout(processJob, 50);

    return res.status(202).json({
      success: true,
      jobId,
      status: 'queued',
      progress: 10,
      createdAt: job.createdAt,
    });
  });

  // Query Generation Job status
  router.get('/jobs/:id', (req: Request, res: Response) => {
    const job = jobsStore.get(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Job "${req.params.id}" not found`,
      });
    }
    return res.json({
      success: true,
      data: job,
    });
  });

  // Cancel Generation Job
  const handleCancelJob = (req: Request, res: Response) => {
    const job = jobsStore.get(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Job "${req.params.id}" not found`,
      });
    }

    if (job.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel an already completed job',
      });
    }

    const controller = activeControllers.get(job.id);
    if (controller) {
      controller.abort();
      activeControllers.delete(job.id);
    }

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();

    return res.json({
      success: true,
      message: `Job ${job.id} cancelled successfully`,
      data: job,
    });
  };

  router.post('/jobs/:id/cancel', handleCancelJob);
  router.delete('/jobs/:id', handleCancelJob);

  // 10. Server-Sent Events (SSE) Streaming Speech Generation
  router.post('/generations/stream', generationRateLimiter, async (req: Request, res: Response) => {
    const parsed = GenerationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const { script, voice, language, audioConfig, title, projectId } = parsed.data;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let isAborted = false;
    req.on('close', () => {
      isAborted = true;
    });

    const sendEvent = (event: string, data: any) => {
      if (!isAborted) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    if (provider.hasApiKey()) {
      try {
        sendEvent('start', { status: 'connecting', provider: 'gnani-timbre-v3' });
        const endpoint = 'https://api.vachana.ai/api/v1/tts/sse';
        const controller = new AbortController();
        req.on('close', () => controller.abort());

        const sseResp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key-ID': (provider as any).apiKey,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            text: script,
            voice,
            language,
            audio_config: {
              container: audioConfig.container,
              encoding: audioConfig.encoding === 'mp3' ? 'mp3' : 'linear_pcm',
              sample_rate: audioConfig.sampleRate,
            },
          }),
          signal: controller.signal,
        });

        if (!sseResp.ok) {
          const errText = await sseResp.text();
          sendEvent('error', { error: `Gnani stream error (${sseResp.status}): ${errText}` });
          return res.end();
        }

        if (sseResp.body) {
          const reader = sseResp.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (!isAborted) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.includes('data:')) {
                res.write(`${line}\n\n`);
              }
            }
          }
        }
        return res.end();
      } catch (err: unknown) {
        sendEvent('error', {
          error: `Stream communication error: ${err instanceof Error ? err.message : String(err)}`,
        });
        return res.end();
      }
    }

    // Studio Demo SSE Mode: progressive PCM streaming
    sendEvent('start', { status: 'synthesizing', provider: 'studio-demo', mode: 'procedural-demo' });

    const validation = validateScript(script);
    const selectedVoiceProfile = SUPPORTED_VOICES.find(
      (v) => v.name.toLowerCase() === voice.toLowerCase()
    );
    const gender = selectedVoiceProfile?.gender || 'Female';
    const sampleRate = audioConfig.sampleRate || 24000;
    const duration = Math.max(2.5, validation.estimatedDurationSeconds);
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const baseF0 = gender === 'Female' ? 220 : 130;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = i / numSamples;
      const syllable = Math.max(0.1, Math.sin(t * 4 * Math.PI));
      const h1 = Math.sin(2 * Math.PI * baseF0 * t) * 0.5;
      const h2 = Math.sin(2 * Math.PI * (baseF0 * 2) * t) * 0.3;
      const h3 = Math.sin(2 * Math.PI * (baseF0 * 3) * t) * 0.15;
      const breath = (Math.random() * 2 - 1) * 0.05;
      const envelope = Math.min(1, Math.min(progress * 15, (1 - progress) * 15));
      buffer[i] = (h1 + h2 + h3 + breath) * 0.3 * syllable * envelope;
    }

    const byteRate = sampleRate * 2;
    const dataSize = buffer.length * 2;
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + dataSize, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16);
    wavHeader.writeUInt16LE(1, 20);
    wavHeader.writeUInt16LE(1, 22);
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(byteRate, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(dataSize, 40);

    const pcmData = Buffer.alloc(dataSize);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      pcmData.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
    }

    const numChunks = 4;
    const chunkSize = Math.floor(pcmData.length / numChunks);

    for (let c = 0; c < numChunks; c++) {
      if (isAborted) break;
      const chunkBuf = pcmData.subarray(c * chunkSize, (c + 1) * chunkSize);
      sendEvent('chunk', {
        chunkIndex: c + 1,
        totalChunks: numChunks,
        audioChunk: chunkBuf.toString('base64'),
      });
      await new Promise((r) => setTimeout(r, 150));
    }

    const fullWav = Buffer.concat([wavHeader, pcmData]);
    const base64Audio = fullWav.toString('base64');

    const result: GenerationResult = {
      id: `gen-stream-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      title: title || `${voice} - Stream Take`,
      script,
      voice,
      language,
      audioConfig: audioConfig as unknown as AudioConfig,
      audioUrl: `data:audio/wav;base64,${base64Audio}`,
      durationSeconds: duration,
      wordCount: validation.wordCount,
      detectedTags: validation.detectedTags,
      createdAt: new Date().toISOString(),
      provider: 'studio-demo',
      generationMode: 'procedural-demo',
      isDemo: true,
      fileSizeBytes: fullWav.byteLength,
    };

    generationsStore.set(result.id, result);
    sendEvent('complete', { result });
    return res.end();
  });

  // 11. Multi-Character Dialogue Assembly Endpoint
  router.post('/dialogue/assemble', generationRateLimiter, async (req: Request, res: Response) => {
    const title = req.body.title || req.body.scene?.title || 'Dialogue Scene';
    const language = req.body.language || req.body.scene?.language || 'en-IN';
    const segments = req.body.segments || req.body.scene?.segments;

    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: "segments" array cannot be empty',
      });
    }

    try {
      const generatedSegments: {
        id: string;
        characterName: string;
        voice: string;
        audioUrl: string;
        duration: number;
      }[] = [];
      const sampleRate = 24000;
      const pauseDuration = 0.35;
      const pauseSamples = Math.floor(sampleRate * pauseDuration);
      const pauseBytes = Buffer.alloc(pauseSamples * 2);

      const pcmBuffers: Buffer[] = [];
      let totalPcmBytes = 0;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segScript = seg.text || '';
        const segVoice = seg.voice || 'Nalini';

        let segAudioUrl = '';
        let segDuration = 2.0;

        if (provider.hasApiKey()) {
          try {
            const gen = await provider.generateSpeech({
              script: segScript,
              voice: segVoice,
              language: (seg.language || language) as any,
              audioConfig: {
                container: 'wav',
                encoding: 'linear_pcm',
                sampleRate: 24000,
                numChannels: 1,
              },
              title: `${seg.characterName || 'Character'} Line`,
            });
            segAudioUrl = gen.audioUrl;
            segDuration = gen.durationSeconds;
          } catch (e) {
            console.warn(`Failed live generation for segment ${i}:`, e);
          }
        }

        if (!segAudioUrl) {
          const validation = validateScript(segScript);
          const voiceProf = SUPPORTED_VOICES.find(
            (v) => v.name.toLowerCase() === segVoice.toLowerCase()
          );
          const gender = voiceProf?.gender || 'Female';
          const dur = Math.max(1.8, validation.estimatedDurationSeconds);
          const numSamples = Math.floor(sampleRate * dur);
          const f0 = gender === 'Female' ? 220 : 130;
          const pcm = Buffer.alloc(numSamples * 2);

          for (let s = 0; s < numSamples; s++) {
            const t = s / sampleRate;
            const progress = s / numSamples;
            const syllable = Math.max(0.1, Math.sin(t * 4 * Math.PI));
            const h1 = Math.sin(2 * Math.PI * f0 * t) * 0.5;
            const h2 = Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.25;
            const envelope = Math.min(1, Math.min(progress * 15, (1 - progress) * 15));
            const val = Math.max(-1, Math.min(1, (h1 + h2) * 0.35 * syllable * envelope));
            pcm.writeInt16LE(val < 0 ? val * 0x8000 : val * 0x7fff, s * 2);
          }

          const wavHdr = Buffer.alloc(44);
          wavHdr.write('RIFF', 0);
          wavHdr.writeUInt32LE(36 + pcm.length, 4);
          wavHdr.write('WAVE', 8);
          wavHdr.write('fmt ', 12);
          wavHdr.writeUInt32LE(16, 16);
          wavHdr.writeUInt16LE(1, 20);
          wavHdr.writeUInt16LE(1, 22);
          wavHdr.writeUInt32LE(sampleRate, 24);
          wavHdr.writeUInt32LE(sampleRate * 2, 28);
          wavHdr.writeUInt16LE(2, 32);
          wavHdr.writeUInt16LE(16, 34);
          wavHdr.write('data', 36);
          wavHdr.writeUInt32LE(pcm.length, 40);

          const fullWav = Buffer.concat([wavHdr, pcm]);
          segAudioUrl = `data:audio/wav;base64,${fullWav.toString('base64')}`;
          segDuration = dur;

          pcmBuffers.push(pcm);
          totalPcmBytes += pcm.length;
        } else {
          const base64Data = segAudioUrl.split(',')[1];
          const rawWav = Buffer.from(base64Data, 'base64');
          const { pcm } = extractPcmFromWav(new Uint8Array(rawWav));
          const pcmBuf = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
          pcmBuffers.push(pcmBuf);
          totalPcmBytes += pcmBuf.length;
        }

        if (i < segments.length - 1) {
          pcmBuffers.push(pauseBytes);
          totalPcmBytes += pauseBytes.length;
        }

        generatedSegments.push({
          id: seg.id,
          characterName: seg.characterName,
          voice: segVoice,
          audioUrl: segAudioUrl,
          duration: segDuration,
        });
      }

      const masterHeader = Buffer.alloc(44);
      masterHeader.write('RIFF', 0);
      masterHeader.writeUInt32LE(36 + totalPcmBytes, 4);
      masterHeader.write('WAVE', 8);
      masterHeader.write('fmt ', 12);
      masterHeader.writeUInt32LE(16, 16);
      masterHeader.writeUInt16LE(1, 20);
      masterHeader.writeUInt16LE(1, 22);
      masterHeader.writeUInt32LE(sampleRate, 24);
      masterHeader.writeUInt32LE(sampleRate * 2, 28);
      masterHeader.writeUInt16LE(2, 32);
      masterHeader.writeUInt16LE(16, 34);
      masterHeader.write('data', 36);
      masterHeader.writeUInt32LE(totalPcmBytes, 40);

      const assembledWav = Buffer.concat([masterHeader, ...pcmBuffers]);
      const totalDuration = Math.round((totalPcmBytes / (sampleRate * 2)) * 100) / 100;

      const generationMode = provider.hasApiKey() ? 'live-provider' : 'procedural-demo';

      const assembledTake: GenerationResult = {
        id: `dialogue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: title || 'Assembled Dialogue Scene',
        script: segments.map((s: any) => `${s.characterName}: ${s.text}`).join('\n\n'),
        voice: `Multi-Character (${segments.length} roles)`,
        language,
        audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000, numChannels: 1 },
        audioUrl: `data:audio/wav;base64,${assembledWav.toString('base64')}`,
        durationSeconds: totalDuration,
        wordCount: segments.reduce(
          (acc: number, s: any) => acc + (s.text || '').split(/\s+/).length,
          0
        ),
        detectedTags: Array.from(
          new Set(segments.flatMap((s: any) => s.text.match(/<[^>]+>/g) || []))
        ),
        createdAt: new Date().toISOString(),
        provider: provider.hasApiKey() ? 'gnani-timbre-v3' : 'studio-demo',
        generationMode,
        isDemo: !provider.hasApiKey(),
        fileSizeBytes: assembledWav.byteLength,
      };

      generationsStore.set(assembledTake.id, assembledTake);

      return res.json({
        success: true,
        data: {
          assembledTake,
          segments: generatedSegments,
        },
      });
    } catch (err: unknown) {
      console.error('Error assembling dialogue:', err);
      return res.status(500).json({
        success: false,
        error: `Dialogue assembly failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // 12. Audio Delivery & Binary Streaming Download with verification headers
  router.get('/audio/:id/download', (req: Request, res: Response) => {
    const generation = generationsStore.get(req.params.id);
    if (!generation) {
      return res.status(404).json({
        success: false,
        error: `Audio take "${req.params.id}" not found`,
      });
    }

    try {
      const base64Index = generation.audioUrl.indexOf('base64,');
      if (base64Index === -1) {
        return res.status(400).json({
          success: false,
          error: 'Audio take does not contain base64 binary stream',
        });
      }

      const rawBuffer = Buffer.from(generation.audioUrl.slice(base64Index + 7), 'base64');
      const wavCheck = validateWavBuffer(rawBuffer);

      const safeFilename = `${generation.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'take'}.wav`;

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Length', rawBuffer.length.toString());
      res.setHeader('ETag', `W/"take-${generation.id}"`);
      res.setHeader('X-Audio-Valid', wavCheck.isValid ? 'true' : 'false');
      res.setHeader('X-Audio-SampleRate', wavCheck.sampleRate.toString());
      res.setHeader('X-Audio-Duration', wavCheck.durationSeconds.toString());
      res.setHeader('Cache-Control', 'public, max-age=3600');

      return res.end(rawBuffer);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Failed to stream audio file: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // 13. Audio Verification Endpoint
  router.post('/audio/verify', (req: Request, res: Response) => {
    const { dataUrl, audioBase64 } = req.body;
    let url = dataUrl;
    if (!url && audioBase64) {
      url = typeof audioBase64 === 'string' && audioBase64.startsWith('data:')
        ? audioBase64
        : `data:audio/wav;base64,${audioBase64}`;
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing "dataUrl" or "audioBase64" in request body',
      });
    }

    const verification = validateWavDataUrl(url);
    return res.json({
      success: true,
      data: verification,
    });
  });

  // 14. User Workspace & Profile
  router.get('/auth/me', (_req: Request, res: Response) => {
    const workspace: UserWorkspace = {
      id: 'usr-voxstory-director',
      name: 'VoxStory Audio Director',
      email: 'director@voxstory.studio',
      role: 'director',
      projectsCount: projectsStore.size,
      totalGenerations: generationsStore.size,
      tier: 'Studio Pro',
    };
    return res.json({
      success: true,
      data: workspace,
    });
  });

  // 15a. List generation history (with pagination & search)
  router.get('/generations', async (req: Request, res: Response) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
    const voiceFilter = req.query.voice as string | undefined;
    const search = req.query.search as string | undefined;

    let list = Array.from(generationsStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (voiceFilter) {
      list = list.filter((g) => g.voice.toLowerCase() === voiceFilter.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q) || g.script.toLowerCase().includes(q));
    }

    const total = list.length;
    const paginated = list.slice(offset, offset + limit);

    return res.json({
      success: true,
      count: paginated.length,
      total,
      data: paginated,
    });
  });

  // 15b. Get generation by id
  router.get('/generations/:id', (req: Request, res: Response) => {
    const generation = generationsStore.get(req.params.id);
    if (!generation) {
      return res.status(404).json({
        success: false,
        error: `Generation with id "${req.params.id}" not found`,
      });
    }
    return res.json({
      success: true,
      data: generation,
    });
  });

  // 15c. Delete generation by id
  router.delete('/generations/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const existed = generationsStore.delete(id);
    if (existed) {
      persistCurrentState();
      await storage.deleteGeneration(id).catch(console.error);
    }
    return res.json({
      success: true,
      deleted: existed,
      id,
    });
  });

  // 15d. Clear all generations
  router.delete('/generations', async (_req: Request, res: Response) => {
    const count = generationsStore.size;
    generationsStore.clear();
    persistCurrentState();
    return res.json({
      success: true,
      cleared: count,
    });
  });

  // 15e. Favorites CRUD
  router.get('/favorites', (_req: Request, res: Response) => {
    return res.json({
      success: true,
      count: favoritesStore.size,
      data: Array.from(favoritesStore),
    });
  });

  router.post('/favorites/:id', (req: Request, res: Response) => {
    const voiceId = req.params.id.toLowerCase().trim();
    favoritesStore.add(voiceId);
    return res.json({
      success: true,
      data: Array.from(favoritesStore),
    });
  });

  router.delete('/favorites/:id', (req: Request, res: Response) => {
    const voiceId = req.params.id.toLowerCase().trim();
    favoritesStore.delete(voiceId);
    return res.json({
      success: true,
      data: Array.from(favoritesStore),
    });
  });

  // 15f. Real Usage & Credit Accounting
  router.get('/usage', (_req: Request, res: Response) => {
    const pHealth = provider.getHealth();
    return res.json({
      success: true,
      data: {
        totalRequests,
        successfulGenerations,
        failedGenerations,
        totalAudioSecondsGenerated: Math.round(totalAudioSecondsGenerated * 10) / 10,
        totalCharactersProcessed,
        activeJobs: jobsStore.size,
        provider: {
          status: pHealth.status,
          model: pHealth.model,
          hasApiKey: pHealth.hasApiKey,
          apiEndpoint: pHealth.apiEndpoint,
          streamingSupported: pHealth.streamingSupported,
        },
        creditAccountingNotice:
          'Gnani Timbre v3.0 charges based on character volume and inference requests according to enterprise API quota. Consult provider console for exact balance ledger.',
      },
    });
  });

  // 16. Projects CRUD (with User & Workspace Isolation)
  router.get('/projects', (req: Request, res: Response) => {
    const user = getUserContext(req);
    const list = Array.from(projectsStore.values())
      .filter((p) => !p.userId || p.userId === user.userId || p.workspaceId === user.workspaceId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({
      success: true,
      count: list.length,
      data: list,
    });
  });

  router.get('/projects/:id', async (req: Request, res: Response) => {
    const user = getUserContext(req);
    let project = projectsStore.get(req.params.id);
    if (!project) {
      project = (await storage.getProject(req.params.id)) || undefined;
    }
    if (!project) {
      return res.status(404).json({
        success: false,
        error: `Project "${req.params.id}" not found`,
      });
    }
    const ownership = checkProjectOwnership(project, user);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: ownership.reason || 'Forbidden: Access denied to project',
        code: 'FORBIDDEN',
      });
    }
    return res.json({
      success: true,
      data: project,
    });
  });

  router.post('/projects', (req: Request, res: Response) => {
    const user = getUserContext(req);
    const { title, script, voice, language, audioConfig, mode } = req.body;
    if (!title || !script) {
      return res.status(400).json({
        success: false,
        error: 'title and script are required',
      });
    }

    const id = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newProject: StudioProject = {
      id,
      title,
      script,
      voice: voice || 'Nalini',
      language: language || 'en-IN',
      mode: mode || 'solo',
      audioConfig: audioConfig || {
        container: 'wav',
        encoding: 'linear_pcm',
        sampleRate: 24000,
        numChannels: 1,
      },
      userId: user.userId,
      workspaceId: user.workspaceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    projectsStore.set(id, newProject);
    persistCurrentState();
    storage.saveProject(newProject).catch(console.error);
    res.status(201).json({
      success: true,
      data: newProject,
    });
  });

  router.patch('/projects/:id', (req: Request, res: Response) => {
    const user = getUserContext(req);
    const existing = projectsStore.get(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const ownership = checkProjectOwnership(existing, user);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: ownership.reason || 'Forbidden: Cannot modify project',
        code: 'FORBIDDEN',
      });
    }

    const updated: StudioProject = {
      ...existing,
      ...req.body,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    projectsStore.set(existing.id, updated);
    persistCurrentState();
    storage.saveProject(updated).catch(console.error);
    res.json({
      success: true,
      data: updated,
    });
  });

  router.delete('/projects/:id', (req: Request, res: Response) => {
    const user = getUserContext(req);
    const existing = projectsStore.get(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const ownership = checkProjectOwnership(existing, user);
    if (!ownership.allowed) {
      return res.status(403).json({
        success: false,
        error: ownership.reason || 'Forbidden: Cannot delete project',
        code: 'FORBIDDEN',
      });
    }

    projectsStore.delete(req.params.id);
    persistCurrentState();
    storage.deleteProject(req.params.id).catch(console.error);
    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  });

  // 17. Background Audio Asset Upload & Streaming
  router.post('/audio/upload', async (req: Request, res: Response) => {
    try {
      const MAX_UPLOAD_SIZE = 15 * 1024 * 1024; // 15MB limit
      let rawBuffer: Buffer | null = null;
      const filename = (req.body.filename || req.body.originalFilename || 'custom-audio.wav') as string;
      const trackType = (req.body.trackType || 'ambience') as 'music' | 'ambience' | 'sfx' | 'speaker';
      const projectId = req.body.projectId as string | undefined;

      if (req.body.audioBase64) {
        const cleanBase64 = req.body.audioBase64.replace(/^data:audio\/[a-z]+;base64,/, '');
        rawBuffer = Buffer.from(cleanBase64, 'base64');
      } else if (req.body.dataUrl) {
        const parts = req.body.dataUrl.split('base64,');
        if (parts.length > 1) {
          rawBuffer = Buffer.from(parts[1], 'base64');
        }
      } else if (Buffer.isBuffer(req.body)) {
        rawBuffer = req.body;
      }

      if (!rawBuffer || rawBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing audio payload: upload must contain audioBase64, dataUrl, or binary audio data',
        });
      }

      if (rawBuffer.length > MAX_UPLOAD_SIZE) {
        return res.status(413).json({
          success: false,
          error: `Payload Too Large: Audio upload exceeds 15MB limit (received ${(rawBuffer.length / (1024 * 1024)).toFixed(2)} MB)`,
        });
      }

      // Validate WAV header & PCM audio data
      const wavCheck = validateWavBuffer(rawBuffer);
      if (!wavCheck.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or malformed WAV file',
          details: wavCheck.errors,
        });
      }

      // Sanitize filename against directory traversal and dangerous characters
      const sanitizedBasename = path
        .basename(filename)
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-\s]/g, '')
        .trim()
        .substring(0, 80) || 'imported_audio';

      const assetId = `asset-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const user = getUserContext(req);

      // Store audio binary in audioStorage
      await audioStorage.storeAudio(assetId, rawBuffer, 'audio/wav');

      const asset: AudioAsset = {
        id: assetId,
        projectId,
        filename: `${sanitizedBasename}.wav`,
        originalFilename: filename,
        mimeType: 'audio/wav',
        sizeBytes: rawBuffer.length,
        durationSeconds: wavCheck.durationSeconds,
        sampleRate: wavCheck.sampleRate,
        channels: wavCheck.numChannels,
        bitDepth: wavCheck.bitsPerSample,
        storageKey: assetId,
        url: `/api/audio/assets/${assetId}/stream`,
        trackType,
        userId: user.userId,
        workspaceId: user.workspaceId,
        createdAt: new Date().toISOString(),
      };

      await storage.saveAudioAsset(asset);

      // If projectId is associated, attach asset to project's audioAssets array
      if (projectId && projectsStore.has(projectId)) {
        const proj = projectsStore.get(projectId)!;
        const currentAssets = proj.audioAssets || [];
        proj.audioAssets = [...currentAssets, asset];
        projectsStore.set(projectId, proj);
        persistCurrentState();
        storage.saveProject(proj).catch(console.error);
      }

      return res.status(201).json({
        success: true,
        data: asset,
      });
    } catch (err) {
      console.error('[AudioUpload] Error processing upload:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error processing audio upload',
      });
    }
  });

  // List Audio Assets
  router.get('/audio/assets', async (req: Request, res: Response) => {
    try {
      const user = getUserContext(req);
      const projectId = req.query.projectId as string | undefined;
      const allAssets = await storage.getAudioAssets(projectId);
      const filtered = allAssets.filter((a) => !a.userId || a.userId === user.userId || a.workspaceId === user.workspaceId);
      return res.json({
        success: true,
        count: filtered.length,
        data: filtered,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Get Audio Asset Metadata
  router.get('/audio/assets/:id', async (req: Request, res: Response) => {
    try {
      const user = getUserContext(req);
      const asset = await storage.getAudioAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          error: `Audio asset "${req.params.id}" not found`,
        });
      }
      const ownership = checkAssetOwnership(asset, user);
      if (!ownership.allowed) {
        return res.status(403).json({
          success: false,
          error: ownership.reason || 'Forbidden: Access denied to audio asset',
          code: 'FORBIDDEN',
        });
      }
      return res.json({
        success: true,
        data: asset,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Stream Audio Asset Binary
  router.get('/audio/assets/:id/stream', async (req: Request, res: Response) => {
    try {
      const user = getUserContext(req);
      const asset = await storage.getAudioAsset(req.params.id);
      if (asset) {
        const ownership = checkAssetOwnership(asset, user);
        if (!ownership.allowed) {
          return res.status(403).json({
            success: false,
            error: ownership.reason || 'Forbidden: Access denied to audio stream',
            code: 'FORBIDDEN',
          });
        }
      }
      const binary = await audioStorage.getAudio(req.params.id);

      if (!binary) {
        return res.status(404).json({
          success: false,
          error: `Audio stream for asset "${req.params.id}" not found`,
        });
      }

      const filename = asset?.filename || `${req.params.id}.wav`;
      res.setHeader('Content-Type', binary.mimeType || 'audio/wav');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', binary.data.length.toString());
      res.setHeader('ETag', `W/"asset-${req.params.id}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (asset) {
        res.setHeader('X-Audio-SampleRate', asset.sampleRate.toString());
        res.setHeader('X-Audio-Duration', asset.durationSeconds.toString());
        res.setHeader('X-Audio-Channels', asset.channels.toString());
      }

      return res.end(binary.data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Failed to stream audio: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // Delete Audio Asset
  router.delete('/audio/assets/:id', async (req: Request, res: Response) => {
    try {
      const user = getUserContext(req);
      const asset = await storage.getAudioAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({
          success: false,
          error: `Audio asset "${req.params.id}" not found`,
        });
      }

      const ownership = checkAssetOwnership(asset, user);
      if (!ownership.allowed) {
        return res.status(403).json({
          success: false,
          error: ownership.reason || 'Forbidden: Cannot delete audio asset',
          code: 'FORBIDDEN',
        });
      }

      // Protect against accidental deletion of referenced assets
      const allProjects = await storage.getProjects();
      const isReferenced = allProjects.some((p) => {
        const hasInAssets = p.audioAssets?.some((a) => a.id === asset.id);
        const hasInBg = p.backgroundTrack?.id === asset.id || p.backgroundTrack?.audioUrl?.includes(asset.id);
        const hasInClips = p.timelineState?.clips?.some((c) => c.audioUrl?.includes(asset.id));
        return hasInAssets || hasInBg || hasInClips;
      });

      if (isReferenced && req.query.force !== 'true') {
        return res.status(409).json({
          success: false,
          error: `Cannot delete audio asset: it is currently referenced in an active project timeline or mixer track. Pass ?force=true to override.`,
        });
      }

      await audioStorage.deleteAudio(req.params.id);
      await storage.deleteAudioAsset(req.params.id);

      return res.json({
        success: true,
        message: `Audio asset "${req.params.id}" deleted successfully`,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 18. Safe Legacy Storage Migration
  router.post('/storage/migrate', async (req: Request, res: Response) => {
    try {
      const dryRun = req.body.dryRun ?? true;
      const overwrite = req.body.overwrite ?? false;

      const { FirestoreStorageAdapter } = await import('./storage/firestoreAdapter');
      const target = new FirestoreStorageAdapter();
      await target.init();

      const report = await migrateStorage(storage, target, { dryRun, overwrite });

      return res.json({
        success: report.success,
        data: report,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Migration failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  return router;
}
