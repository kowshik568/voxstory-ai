/**
 * VoxStory AI - Persistence Architecture Tests (v12 Beta)
 * Verifies Local Adapter, Cloud Firestore Adapter, Storage Factory,
 * Durability Enforcement, and Fail-Safe Selection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AtomicJsonStorageAdapter, LocalDiskAudioStorage } from '../server/storage/storageManager';
import { FirestoreStorageAdapter } from '../server/storage/firestoreAdapter';
import { createStorageAdapter, StorageInitError } from '../server/storage/storageFactory';
import { StudioProject, AudioAsset } from '../types';

describe('VoxStory AI - Persistence Architecture & Durability Tests', () => {
  const testDir = path.resolve(process.cwd(), '.data-persistence-test');
  const testAudioDir = path.resolve(process.cwd(), '.data-audio-test');

  beforeEach(async () => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    if (fs.existsSync(testAudioDir)) fs.rmSync(testAudioDir, { recursive: true, force: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    if (fs.existsSync(testAudioDir)) fs.rmSync(testAudioDir, { recursive: true, force: true });
  });

  describe('Local Atomic Storage Adapter', () => {
    it('persists and retrieves audio asset metadata', async () => {
      const adapter = new AtomicJsonStorageAdapter(testDir);
      await adapter.init();

      const asset: AudioAsset = {
        id: 'asset-test-1',
        projectId: 'proj-1',
        filename: 'rain_ambience.wav',
        originalFilename: 'rain_ambience.wav',
        mimeType: 'audio/wav',
        sizeBytes: 10240,
        durationSeconds: 12.5,
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        storageKey: 'asset-test-1',
        url: '/api/audio/assets/asset-test-1/stream',
        trackType: 'ambience',
        createdAt: new Date().toISOString(),
      };

      await adapter.saveAudioAsset(asset);
      const retrieved = await adapter.getAudioAsset('asset-test-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.filename).toBe('rain_ambience.wav');
      expect(retrieved?.durationSeconds).toBe(12.5);

      const byProject = await adapter.getAudioAssets('proj-1');
      expect(byProject).toHaveLength(1);

      const deleted = await adapter.deleteAudioAsset('asset-test-1');
      expect(deleted).toBe(true);
      expect(await adapter.getAudioAsset('asset-test-1')).toBeNull();
    });

    it('reports accurate health and flags Cloud Run ephemeral filesystem', async () => {
      const adapter = new AtomicJsonStorageAdapter(testDir);
      await adapter.init();
      const health = await adapter.getHealth();

      expect(health.driver).toBe('local-json-atomic');
      expect(health.isDurable).toBe(false);
      expect(health.cloudRunNotice).toContain('Cloud Run ephemeral filesystem');
    });
  });

  describe('Local Audio Object Storage', () => {
    it('stores binary audio and retrieves without data corruption', async () => {
      const audioStore = new LocalDiskAudioStorage(testAudioDir);
      await audioStore.init();

      const sampleBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
      const stored = await audioStore.storeAudio('test-asset-1', sampleBytes, 'audio/wav');

      expect(stored.key).toBe('test-asset-1');
      expect(stored.url).toBe('/api/audio/assets/test-asset-1/stream');
      expect(stored.sizeBytes).toBe(12);

      const retrieved = await audioStore.getAudio('test-asset-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.data.equals(sampleBytes)).toBe(true);

      const deleted = await audioStore.deleteAudio('test-asset-1');
      expect(deleted).toBe(true);
      expect(await audioStore.getAudio('test-asset-1')).toBeNull();
    });

    it('sanitizes keys to prevent path traversal attempts', async () => {
      const audioStore = new LocalDiskAudioStorage(testAudioDir);
      await audioStore.init();

      const sampleBytes = Buffer.from([1, 2, 3]);
      // Attempt traversal key
      const stored = await audioStore.storeAudio('../../../etc/passwd', sampleBytes, 'audio/wav');
      expect(stored.key).toBe('etcpasswd');
      expect(stored.key).not.toContain('..');
      expect(stored.key).not.toContain('/');
    });
  });

  describe('Firestore Storage Adapter', () => {
    it('validates document IDs and rejects unsafe characters', async () => {
      const firestore = new FirestoreStorageAdapter();
      await firestore.init();

      // Valid IDs
      expect(firestore.validateDocumentId('proj-123_abc')).toBe('proj-123_abc');

      // Invalid IDs (slashes, path traversal, spaces)
      expect(() => firestore.validateDocumentId('../../bad-doc')).toThrow();
      expect(() => firestore.validateDocumentId('')).toThrow();
      expect(() => firestore.validateDocumentId('has spaces')).toThrow();
    });

    it('performs CRUD operations and reports durable status', async () => {
      const firestore = new FirestoreStorageAdapter();
      await firestore.init();

      const health = await firestore.getHealth();
      expect(health.driver).toBe('firestore-cloud');
      expect(health.isDurable).toBe(true);

      const project: StudioProject = {
        id: 'proj-firestore-1',
        title: 'Cloud Project',
        script: '<whispers> Stored in Firestore',
        voice: 'Shivani',
        language: 'en-IN',
        audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestore.saveProject(project);
      const retrieved = await firestore.getProject('proj-firestore-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Cloud Project');

      const all = await firestore.getProjects();
      expect(all).toHaveLength(1);

      await firestore.deleteProject('proj-firestore-1');
      expect(await firestore.getProject('proj-firestore-1')).toBeNull();
    });
  });

  describe('Storage Factory & Production Durability Enforcement', () => {
    it('instantiates local storage adapter by default', async () => {
      const adapter = await createStorageAdapter({ driver: 'local-json-atomic', dataPath: testDir });
      expect(adapter.driver).toBe('local-json-atomic');
      expect(adapter.isDurable).toBe(false);
    });

    it('strictly forbids local ephemeral adapter when durability is required', async () => {
      await expect(
        createStorageAdapter({
          driver: 'local-json-atomic',
          requireDurable: true,
          dataPath: testDir,
        })
      ).rejects.toThrow(StorageInitError);
    });

    it('instantiates mock-firestore or cloud adapter when durability is enabled', async () => {
      const adapter = await createStorageAdapter({
        driver: 'mock-firestore',
        requireDurable: false,
      });
      expect(adapter.driver).toBe('firestore-cloud');
      expect(adapter.isDurable).toBe(true);
    });
  });
});
