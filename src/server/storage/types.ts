/**
 * VoxStory AI - Storage Abstraction Layer Types (v12 Beta)
 * Unified persistence contracts for Projects, Characters, Generations, Jobs, and Audio Assets.
 */

import { StudioProject, GenerationResult, GenerationJob, AudioAsset } from '../../types';

export type StorageDriverType = 'local-json-atomic' | 'firestore-cloud' | 'mock-firestore';

export interface StorageHealth {
  driver: StorageDriverType;
  status: 'healthy' | 'degraded' | 'unavailable';
  isDurable: boolean;
  storageMode: 'local' | 'cloud' | 'mock';
  durableRequired: boolean;
  dataPath?: string;
  cloudProjectId?: string;
  projectsCount: number;
  generationsCount: number;
  jobsCount: number;
  audioAssetsCount: number;
  diskSizeBytes: number;
  lastBackupAt?: string;
  cloudRunNotice: string;
}

export interface StorageAdapter {
  readonly driver: StorageDriverType;
  readonly isDurable: boolean;
  init(): Promise<void>;
  getHealth(): Promise<StorageHealth>;
  
  // Projects & Characters
  getProjects(): Promise<StudioProject[]>;
  getProject(id: string): Promise<StudioProject | null>;
  saveProject(project: StudioProject): Promise<StudioProject>;
  deleteProject(id: string): Promise<boolean>;

  // Generations
  getGenerations(limit?: number): Promise<GenerationResult[]>;
  getGeneration(id: string): Promise<GenerationResult | null>;
  saveGeneration(generation: GenerationResult): Promise<GenerationResult>;
  deleteGeneration(id: string): Promise<boolean>;

  // Jobs
  getJobs(): Promise<GenerationJob[]>;
  getJob(id: string): Promise<GenerationJob | null>;
  saveJob(job: GenerationJob): Promise<GenerationJob>;
  updateJob(id: string, updates: Partial<GenerationJob>): Promise<GenerationJob | null>;

  // Audio Assets (Background Tracks & Mixed Audio)
  getAudioAssets(projectId?: string): Promise<AudioAsset[]>;
  getAudioAsset(id: string): Promise<AudioAsset | null>;
  saveAudioAsset(asset: AudioAsset): Promise<AudioAsset>;
  deleteAudioAsset(id: string): Promise<boolean>;
}

export interface AudioStorageAdapter {
  init(): Promise<void>;
  storeAudio(
    key: string,
    data: Buffer,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<{ key: string; url: string; sizeBytes: number }>;
  getAudio(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  deleteAudio(key: string): Promise<boolean>;
  hasAudio(key: string): Promise<boolean>;
}
