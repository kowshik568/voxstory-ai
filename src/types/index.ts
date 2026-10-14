/**
 * VoxStory AI - Core Type Definitions
 * Supporting Gnani Timbre v3.0 Expressive TTS and Audio Tags
 */

export type TagCategory = 'reaction' | 'delivery' | 'pacing' | 'nonverbal';

export interface ExpressionTag {
  id: string;
  tag: string; // e.g. "<laugh>"
  name: string;
  category: TagCategory;
  description: string;
  example: string;
  sampleText: string;
  pacingEffect: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
}

export type SupportedLanguage = 
  | 'en-IN' // Indian English
  | 'hi-IN' // Hindi
  | 'ta-IN' // Tamil
  | 'te-IN' // Telugu
  | 'kn-IN' // Kannada
  | 'ml-IN' // Malayalam
  | 'bn-IN' // Bengali
  | 'mr-IN' // Marathi
  | 'gu-IN' // Gujarati
  | 'pa-IN'; // Punjabi

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  description: string;
}

export interface VoiceProfile {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  primaryLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
  style: string;
  description: string;
  recommendedUse: string;
  accent: string;
  avatarSeed: string;
}

export type AudioContainer = 'wav' | 'mp3' | 'ogg';

export interface AudioConfig {
  container: AudioContainer;
  encoding: 'linear_pcm' | 'mp3' | 'opus';
  sampleRate: 16000 | 24000 | 48000;
  numChannels?: number;
}

export interface ScriptSpan {
  id: string;
  type: 'tag' | 'text';
  content: string;
  tagInfo?: ExpressionTag;
  activeTag?: ExpressionTag | null;
}

export interface ScriptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedTags: string[];
  invalidTags: string[];
  wordCount: number;
  characterCount: number;
  estimatedDurationSeconds: number;
  spokenText: string;
}

export interface ScriptTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  recommendedVoice: string;
  recommendedLanguage: SupportedLanguage;
  script: string;
  performanceNotes: string;
  tagsUsed: string[];
}

export interface GenerationRequest {
  script: string;
  voice: string;
  language: SupportedLanguage;
  audioConfig: AudioConfig;
  title?: string;
  projectId?: string;
}

export type GenerationMode = 'live-provider' | 'procedural-demo' | 'prerecorded-showcase';

export interface DialogueCharacter {
  id: string;
  name: string;
  voice: string;
  color: string;
  avatarSeed?: string;
}

export interface DialogueSegment {
  id: string;
  characterId: string;
  characterName: string;
  voice: string;
  language: SupportedLanguage;
  text: string; // contains verified expression tags
  audioUrl?: string;
  duration?: number;
  status?: 'idle' | 'generating' | 'ready' | 'error';
  errorMessage?: string;
}

export interface DialogueScene {
  id: string;
  title: string;
  language: SupportedLanguage;
  audioConfig: AudioConfig;
  characters: DialogueCharacter[];
  segments: DialogueSegment[];
  assembledAudioUrl?: string;
  assembledDuration?: number;
  assembledMode?: GenerationMode;
  updatedAt: string;
  createdAt: string;
}

export interface WaveformData {
  peaks: number[]; // real calculated normalized audio amplitudes (0 to 1) from decodeAudioData
  duration: number;
  sampleRate: number;
}

export interface GenerationResult {
  id: string;
  projectId?: string;
  title: string;
  script: string;
  voice: string;
  language: SupportedLanguage;
  audioConfig: AudioConfig;
  audioUrl: string; // Base64 data URI or blob URL
  durationSeconds: number;
  wordCount: number;
  detectedTags: string[];
  createdAt: string;
  provider: 'gnani-timbre-v3' | 'studio-demo';
  generationMode: GenerationMode;
  isDemo: boolean;
  fileSizeBytes: number;
  waveform?: WaveformData;
}

export interface StudioProject {
  id: string;
  title: string;
  script: string;
  voice: string;
  language: SupportedLanguage;
  audioConfig: AudioConfig;
  mode?: 'solo' | 'dialogue';
  dialogueScene?: DialogueScene;
  updatedAt: string;
  createdAt: string;
  lastGeneration?: GenerationResult;
}

export interface BackgroundTrackConfig {
  id: string;
  name: string;
  audioUrl: string; // Blob or Data URI
  volume: number; // 0.0 to 1.0 (default 0.25)
  fadeInSeconds: number; // 0.0 to 5.0 (default 1.0)
  fadeOutSeconds: number; // 0.0 to 5.0 (default 1.5)
  loop: boolean; // default true
  duckingEnabled: boolean; // default true
  duckingAmount: number; // 0.0 to 1.0 (default 0.7 = -10dB reduction during speech)
  isMuted: boolean;
  duration?: number;
}

export interface SubtitleCue {
  index: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  speaker?: string;
  text: string;
  tagsUsed?: string[];
}

export interface ExportPackage {
  title: string;
  voice: string;
  language: SupportedLanguage;
  format: AudioContainer;
  durationSeconds: number;
  wordCount: number;
  audioUrl: string;
  mixedAudioUrl?: string;
  srtContent: string;
  vttContent: string;
  txtTranscript: string;
  projectMetadataJson: string;
}

export interface ProviderHealth {
  status: 'online' | 'degraded' | 'offline';
  provider: string;
  model: string;
  hasApiKey: boolean;
  version: string;
  apiEndpoint: string;
  streamingSupported: boolean;
  streamingEndpoint: string;
}

export type GenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  idempotencyKey?: string;
  status: GenerationJobStatus;
  progress: number; // 0 to 100
  request: GenerationRequest;
  result?: GenerationResult;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
  retryCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
}

export interface SystemMetrics {
  totalRequests: number;
  successfulGenerations: number;
  failedGenerations: number;
  activeJobs: number;
  averageLatencyMs: number;
  totalAudioSecondsGenerated: number;
  providerHealth: 'online' | 'degraded';
  uptimeSeconds: number;
}

export interface UserWorkspace {
  id: string;
  name: string;
  email: string;
  role: 'director' | 'producer' | 'creator';
  projectsCount: number;
  totalGenerations: number;
  tier: 'Studio Pro';
}

export type TrackType = 'speaker' | 'music' | 'ambience' | 'sfx';

export interface TimelineClip {
  id: string;
  trackId: string;
  title: string;
  text?: string;
  voice?: string;
  language?: SupportedLanguage;
  characterName?: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  trimStart?: number; // seconds trimmed from start
  trimEnd?: number; // seconds trimmed from end
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  volume: number; // 0.0 to 1.5
  pan: number; // -1.0 to 1.0
  audioUrl?: string;
  color?: string;
  status?: 'idle' | 'generating' | 'ready' | 'error';
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  characterId?: string;
  voice?: string;
  color: string;
  isMuted: boolean;
  isSolo: boolean;
  volume: number; // 0.0 to 1.5
  pan: number; // -1.0 to 1.0
}

export interface MultitrackTimelineState {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  playheadTime: number;
  zoomPixelsPerSecond: number;
  rippleMode: boolean;
  pauseGapSeconds: number;
}


