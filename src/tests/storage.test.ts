import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AtomicJsonStorageAdapter } from '../server/storage/storageManager';
import { StudioProject, GenerationResult } from '../types';

describe('VoxStory AI - Storage Abstraction & Atomic Persistence Tests', () => {
  const testDir = path.resolve(process.cwd(), '.data-test');
  let storage: AtomicJsonStorageAdapter;

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    storage = new AtomicJsonStorageAdapter(testDir);
    await storage.init();
  });

  it('initializes clean storage directory and reports accurate health metadata', async () => {
    const health = await storage.getHealth();
    expect(health.driver).toBe('local-json-atomic');
    expect(health.status).toBe('healthy');
    expect(health.isDurable).toBe(false); // Accurately flags Cloud Run container filesystem as ephemeral
    expect(health.projectsCount).toBe(0);
    expect(health.cloudRunNotice).toContain('Cloud Run ephemeral filesystem');
  });

  it('saves and retrieves projects atomically without data corruption', async () => {
    const sampleProject: StudioProject = {
      id: 'proj-test-1',
      title: 'Atomic Test Script',
      script: '<whispers> Testing atomic storage.',
      voice: 'Nalini',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.saveProject(sampleProject);
    const retrieved = await storage.getProject('proj-test-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('Atomic Test Script');

    const all = await storage.getProjects();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('proj-test-1');
  });

  it('persists backup file on subsequent writes for crash protection', async () => {
    const p1: StudioProject = {
      id: 'proj-1',
      title: 'P1',
      script: 'Line 1',
      voice: 'Shivani',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.saveProject(p1);

    const p2: StudioProject = {
      ...p1,
      id: 'proj-2',
      title: 'P2',
    };

    await storage.saveProject(p2);

    const backupPath = path.join(testDir, 'voxstory_store.bak');
    expect(fs.existsSync(backupPath)).toBe(true);

    const health = await storage.getHealth();
    expect(health.projectsCount).toBe(2);
    expect(health.lastBackupAt).toBeDefined();
  });

  it('deletes projects and updates store', async () => {
    const p1: StudioProject = {
      id: 'proj-del',
      title: 'To Delete',
      script: 'Text',
      voice: 'Shivani',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.saveProject(p1);
    const deleteResult = await storage.deleteProject('proj-del');
    expect(deleteResult).toBe(true);

    const after = await storage.getProject('proj-del');
    expect(after).toBeNull();
  });

  it('reloads saved state when a fresh storage instance is created on the directory', async () => {
    const p1: StudioProject = {
      id: 'proj-persist',
      title: 'Persistent Check',
      script: 'Survives reload',
      voice: 'Shivani',
      language: 'en-IN',
      audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await storage.saveProject(p1);

    // Fresh instance pointing at the same directory
    const reloadedStorage = new AtomicJsonStorageAdapter(testDir);
    await reloadedStorage.init();

    const retrieved = await reloadedStorage.getProject('proj-persist');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('Persistent Check');
  });
});
