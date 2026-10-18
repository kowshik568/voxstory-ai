/**
 * VoxStory AI - Atomic Storage Subsystem & Local Audio Storage Manager (v12 Beta)
 * Provides atomic disk persistence, corruption recovery, audio asset storage, and durability reporting.
 */

import fs from 'fs';
import path from 'path';
import { StudioProject, GenerationResult, GenerationJob, AudioAsset } from '../../types';
import { StorageAdapter, StorageHealth, AudioStorageAdapter, StorageDriverType } from './types';

export class AtomicJsonStorageAdapter implements StorageAdapter {
  readonly driver: StorageDriverType = 'local-json-atomic';
  readonly isDurable: boolean = false; // Ephemeral on Cloud Run container restarts

  private dataDir: string;
  private dataFile: string;
  private backupFile: string;
  private projectsMap: Map<string, StudioProject> = new Map();
  private generationsMap: Map<string, GenerationResult> = new Map();
  private jobsMap: Map<string, GenerationJob> = new Map();
  private audioAssetsMap: Map<string, AudioAsset> = new Map();
  private lastBackupAt?: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.resolve(process.cwd(), '.data');
    this.dataFile = path.join(this.dataDir, 'voxstory_store.json');
    this.backupFile = path.join(this.dataDir, 'voxstory_store.bak');
  }

  async init(): Promise<void> {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed.projects)) {
          parsed.projects.forEach((p: StudioProject) => this.projectsMap.set(p.id, p));
        }
        if (Array.isArray(parsed.generations)) {
          parsed.generations.forEach((g: GenerationResult) => this.generationsMap.set(g.id, g));
        }
        if (Array.isArray(parsed.jobs)) {
          parsed.jobs.forEach((j: GenerationJob) => this.jobsMap.set(j.id, j));
        }
        if (Array.isArray(parsed.audioAssets)) {
          parsed.audioAssets.forEach((a: AudioAsset) => this.audioAssetsMap.set(a.id, a));
        }
      }
    } catch (err) {
      console.warn('[Storage] Failed to parse primary store, checking backup:', err);
      // Attempt recovery from backup
      try {
        if (fs.existsSync(this.backupFile)) {
          const rawBak = fs.readFileSync(this.backupFile, 'utf-8');
          const parsedBak = JSON.parse(rawBak);
          if (Array.isArray(parsedBak.projects)) {
            parsedBak.projects.forEach((p: StudioProject) => this.projectsMap.set(p.id, p));
          }
          if (Array.isArray(parsedBak.generations)) {
            parsedBak.generations.forEach((g: GenerationResult) => this.generationsMap.set(g.id, g));
          }
          if (Array.isArray(parsedBak.jobs)) {
            parsedBak.jobs.forEach((j: GenerationJob) => this.jobsMap.set(j.id, j));
          }
          if (Array.isArray(parsedBak.audioAssets)) {
            parsedBak.audioAssets.forEach((a: AudioAsset) => this.audioAssetsMap.set(a.id, a));
          }
          console.info('[Storage] Successfully recovered state from backup store.');
        }
      } catch (bakErr) {
        console.error('[Storage] Backup recovery failed:', bakErr);
      }
    }
  }

  private persistAtomic(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // Safe limit on recent generations to prevent unbounded file growth
      const safeGenerations = Array.from(this.generationsMap.values()).slice(-100);

      const serialized = JSON.stringify(
        {
          version: '12.0.0',
          updatedAt: new Date().toISOString(),
          projects: Array.from(this.projectsMap.values()),
          generations: safeGenerations,
          jobs: Array.from(this.jobsMap.values()).slice(-60),
          audioAssets: Array.from(this.audioAssetsMap.values()),
        },
        null,
        2
      );

      // Create backup copy of current store before atomic write
      if (fs.existsSync(this.dataFile)) {
        fs.copyFileSync(this.dataFile, this.backupFile);
        this.lastBackupAt = new Date().toISOString();
      }

      // Atomic write: write to temp file first, then atomically rename
      const tmpFile = `${this.dataFile}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpFile, serialized, 'utf-8');
      fs.renameSync(tmpFile, this.dataFile);
    } catch (e) {
      console.warn('[Storage] Atomic disk persistence error:', e);
    }
  }

  async getHealth(): Promise<StorageHealth> {
    let diskSizeBytes = 0;
    try {
      if (fs.existsSync(this.dataFile)) {
        const stats = fs.statSync(this.dataFile);
        diskSizeBytes = stats.size;
      }
    } catch {
      // ignore
    }

    const durableRequired = process.env.STORAGE_REQUIRE_DURABLE === 'true';

    return {
      driver: this.driver,
      status: durableRequired ? 'degraded' : 'healthy',
      isDurable: this.isDurable,
      storageMode: 'local',
      durableRequired,
      dataPath: this.dataFile,
      projectsCount: this.projectsMap.size,
      generationsCount: this.generationsMap.size,
      jobsCount: this.jobsMap.size,
      audioAssetsCount: this.audioAssetsMap.size,
      diskSizeBytes,
      lastBackupAt: this.lastBackupAt,
      cloudRunNotice:
        'Cloud Run ephemeral filesystem: writes persist across app reloads within the same container, but instance restarts, redeployments, or multi-instance scaling create fresh containers. Use Firestore and Cloud Storage adapter for persistent cross-instance production durability.',
    };
  }

  // Projects
  async getProjects(): Promise<StudioProject[]> {
    return Array.from(this.projectsMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getProject(id: string): Promise<StudioProject | null> {
    return this.projectsMap.get(id) || null;
  }

  async saveProject(project: StudioProject): Promise<StudioProject> {
    if (!project.id) {
      throw new Error('Cannot save project without id');
    }
    const updated: StudioProject = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    this.projectsMap.set(project.id, updated);
    this.persistAtomic();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const existed = this.projectsMap.delete(id);
    if (existed) {
      this.persistAtomic();
    }
    return existed;
  }

  // Generations
  async getGenerations(limit = 60): Promise<GenerationResult[]> {
    const all = Array.from(this.generationsMap.values());
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit);
  }

  async getGeneration(id: string): Promise<GenerationResult | null> {
    return this.generationsMap.get(id) || null;
  }

  async saveGeneration(generation: GenerationResult): Promise<GenerationResult> {
    if (!generation.id) {
      throw new Error('Cannot save generation without id');
    }
    this.generationsMap.set(generation.id, generation);
    this.persistAtomic();
    return generation;
  }

  async deleteGeneration(id: string): Promise<boolean> {
    const existed = this.generationsMap.delete(id);
    if (existed) {
      this.persistAtomic();
    }
    return existed;
  }

  // Jobs
  async getJobs(): Promise<GenerationJob[]> {
    return Array.from(this.jobsMap.values());
  }

  async getJob(id: string): Promise<GenerationJob | null> {
    return this.jobsMap.get(id) || null;
  }

  async saveJob(job: GenerationJob): Promise<GenerationJob> {
    if (!job.id) {
      throw new Error('Cannot save job without id');
    }
    this.jobsMap.set(job.id, job);
    this.persistAtomic();
    return job;
  }

  async updateJob(id: string, updates: Partial<GenerationJob>): Promise<GenerationJob | null> {
    const existing = this.jobsMap.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.jobsMap.set(id, updated);
    this.persistAtomic();
    return updated;
  }

  // Audio Assets
  async getAudioAssets(projectId?: string): Promise<AudioAsset[]> {
    const all = Array.from(this.audioAssetsMap.values());
    if (projectId) {
      return all.filter((a) => a.projectId === projectId);
    }
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAudioAsset(id: string): Promise<AudioAsset | null> {
    return this.audioAssetsMap.get(id) || null;
  }

  async saveAudioAsset(asset: AudioAsset): Promise<AudioAsset> {
    if (!asset.id) {
      throw new Error('Cannot save audio asset without id');
    }
    this.audioAssetsMap.set(asset.id, asset);
    this.persistAtomic();
    return asset;
  }

  async deleteAudioAsset(id: string): Promise<boolean> {
    const existed = this.audioAssetsMap.delete(id);
    if (existed) {
      this.persistAtomic();
    }
    return existed;
  }
}

/**
 * Local Disk Object Storage for Audio Binaries
 * Validates keys to prevent path traversal and isolates files in .data/audio/
 */
export class LocalDiskAudioStorage implements AudioStorageAdapter {
  private audioDir: string;

  constructor(audioDir?: string) {
    this.audioDir = audioDir || path.resolve(process.cwd(), '.data', 'audio');
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  private sanitizeKey(key: string): string {
    // Only allow alphanumeric, dash, and underscore; reject dots and slashes to prevent traversal
    const sanitized = key.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) {
      throw new Error('Invalid storage key: contains illegal characters');
    }
    return sanitized;
  }

  private getFilePath(key: string): string {
    const safeKey = this.sanitizeKey(key);
    return path.join(this.audioDir, `${safeKey}.bin`);
  }

  async storeAudio(
    key: string,
    data: Buffer,
    mimeType: string
  ): Promise<{ key: string; url: string; sizeBytes: number }> {
    await this.init();
    const filePath = this.getFilePath(key);
    const tmpPath = `${filePath}.${Date.now()}.tmp`;

    // Atomic write
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, filePath);

    const safeKey = this.sanitizeKey(key);
    return {
      key: safeKey,
      url: `/api/audio/assets/${safeKey}/stream`,
      sizeBytes: data.length,
    };
  }

  async getAudio(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    try {
      const filePath = this.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = fs.readFileSync(filePath);
      return {
        data,
        mimeType: 'audio/wav',
      };
    } catch {
      return null;
    }
  }

  async deleteAudio(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async hasAudio(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

// Global Singleton Instances
export const storage = new AtomicJsonStorageAdapter();
export const audioStorage = new LocalDiskAudioStorage();
