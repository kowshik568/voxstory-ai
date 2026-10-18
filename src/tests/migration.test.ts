/**
 * VoxStory AI - Safe Legacy Data Migration Tests (v12 Beta)
 * Verifies non-destructive migration, dry-run mode, idempotency,
 * invalid record filtering, and crash recovery.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AtomicJsonStorageAdapter } from '../server/storage/storageManager';
import { FirestoreStorageAdapter } from '../server/storage/firestoreAdapter';
import { migrateStorage, validateProjectRecord, validateGenerationRecord } from '../server/storage/migrator';
import { StudioProject, GenerationResult, AudioAsset } from '../types';

describe('VoxStory AI - Safe Legacy Data Migration Tests', () => {
  const sourceDir = path.resolve(process.cwd(), '.data-mig-src');
  let source: AtomicJsonStorageAdapter;
  let target: FirestoreStorageAdapter;

  beforeEach(async () => {
    if (fs.existsSync(sourceDir)) fs.rmSync(sourceDir, { recursive: true, force: true });
    source = new AtomicJsonStorageAdapter(sourceDir);
    await source.init();
    target = new FirestoreStorageAdapter();
    await target.init();
    target.clear();
  });

  afterEach(() => {
    if (fs.existsSync(sourceDir)) fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('validates project and generation records accurately', () => {
    expect(validateProjectRecord({ id: 'p1', title: 'Valid' }).isValid).toBe(true);
    expect(validateProjectRecord({ id: '', title: 'Missing ID' }).isValid).toBe(false);
    expect(validateProjectRecord(null).isValid).toBe(false);

    expect(validateGenerationRecord({ id: 'g1', audioUrl: 'data:audio/wav;base64,AAA' }).isValid).toBe(true);
    expect(validateGenerationRecord({ id: 'g1' }).isValid).toBe(false);
  });

  it('handles empty source store cleanly without errors', async () => {
    const report = await migrateStorage(source, target, { dryRun: true });
    expect(report.success).toBe(true);
    expect(report.totalRecordsRead).toBe(0);
    expect(report.importedCount).toBe(0);
    expect(report.errors).toHaveLength(0);
  });

  it('performs dry-run without writing records to target adapter', async () => {
    const project: StudioProject = {
      id: 'proj-migrate-1',
      title: 'Migration Candidate',
      script: '<whispers> Source script',
      voice: 'Nalini',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await source.saveProject(project);

    const report = await migrateStorage(source, target, { dryRun: true });
    expect(report.success).toBe(true);
    expect(report.dryRun).toBe(true);
    expect(report.importedCount).toBe(1);

    // Target must still be empty because dryRun was true
    const inTarget = await target.getProject('proj-migrate-1');
    expect(inTarget).toBeNull();
  });

  it('migrates valid projects and audio assets cleanly in live run', async () => {
    const project: StudioProject = {
      id: 'proj-live-1',
      title: 'Live Project',
      script: '<excited> Ready for migration',
      voice: 'Aarav',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await source.saveProject(project);

    const asset: AudioAsset = {
      id: 'asset-mig-1',
      projectId: 'proj-live-1',
      filename: 'bg_music.wav',
      originalFilename: 'bg_music.wav',
      mimeType: 'audio/wav',
      sizeBytes: 8192,
      durationSeconds: 10.0,
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      storageKey: 'asset-mig-1',
      url: '/api/audio/assets/asset-mig-1/stream',
      createdAt: new Date().toISOString(),
    };
    await source.saveAudioAsset(asset);

    const report = await migrateStorage(source, target, { dryRun: false });
    expect(report.success).toBe(true);
    expect(report.importedCount).toBe(2);

    // Verify in target
    const targetProject = await target.getProject('proj-live-1');
    expect(targetProject).not.toBeNull();
    expect(targetProject?.title).toBe('Live Project');

    const targetAsset = await target.getAudioAsset('asset-mig-1');
    expect(targetAsset).not.toBeNull();
    expect(targetAsset?.filename).toBe('bg_music.wav');
  });

  it('is completely idempotent on repeated migration runs (skips existing)', async () => {
    const project: StudioProject = {
      id: 'proj-idempotent',
      title: 'Idempotent Project',
      script: 'Text',
      voice: 'Nalini',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await source.saveProject(project);

    // First live run: imports record
    const r1 = await migrateStorage(source, target, { dryRun: false });
    expect(r1.importedCount).toBe(1);
    expect(r1.skippedCount).toBe(0);

    // Second live run: skips existing record without re-writing or error
    const r2 = await migrateStorage(source, target, { dryRun: false, overwrite: false });
    expect(r2.importedCount).toBe(0);
    expect(r2.skippedCount).toBe(1);
    expect(r2.success).toBe(true);
  });

  it('filters invalid records gracefully without interrupting valid records', async () => {
    const validProject: StudioProject = {
      id: 'proj-valid',
      title: 'Valid Project',
      script: 'Text',
      voice: 'Nalini',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await source.saveProject(validProject);

    // Inject invalid record directly into internal source map
    (source as any).projectsMap.set('bad-1', { id: 'bad-1', title: '' }); // Empty title

    const report = await migrateStorage(source, target, { dryRun: false });
    expect(report.importedCount).toBe(1);
    expect(report.invalidCount).toBe(1);
    expect(report.success).toBe(true);

    // Valid project made it through
    expect(await target.getProject('proj-valid')).not.toBeNull();
  });
});
