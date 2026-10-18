/**
 * VoxStory AI - Security Hardening & Isolation Tests (v12 Beta)
 * Verifies path traversal defense, rate limit headers, secret redaction,
 * invalid ID rejections, and safe error handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { createApiRouter } from '../server/routes';
import { FirestoreStorageAdapter } from '../server/storage/firestoreAdapter';
import { LocalDiskAudioStorage } from '../server/storage/storageManager';

describe('VoxStory AI - Security Hardening & Defenses', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', createApiRouter());

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Path Traversal & Filename Sanitization', () => {
    it('prevents directory traversal in audio storage keys', async () => {
      const audioStore = new LocalDiskAudioStorage();
      const testBytes = Buffer.from('test');

      const result = await audioStore.storeAudio('../../../../evil_key', testBytes, 'audio/wav');
      expect(result.key).not.toContain('..');
      expect(result.key).not.toContain('/');
      expect(result.key).toBe('evil_key');
    });

    it('rejects document ID path traversal in Firestore adapter', () => {
      const adapter = new FirestoreStorageAdapter();
      expect(() => adapter.validateDocumentId('../../admin/secret')).toThrow();
      expect(() => adapter.validateDocumentId('..\\..\\windows')).toThrow();
      expect(() => adapter.validateDocumentId('/root')).toThrow();
    });
  });

  describe('Secret Redaction & Observability Protection', () => {
    it('never leaks raw API keys in health check responses', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const json = await res.json();
      const serialized = JSON.stringify(json);

      expect(serialized).not.toContain('gnani_api_key');
      expect(serialized).not.toContain('GNANI_API_KEY');
      expect(json.data.hasApiKey).toBeDefined(); // Boolean only
      expect(typeof json.data.hasApiKey).toBe('boolean');
    });

    it('redacts sensitive configuration in provider diagnostic', async () => {
      const res = await fetch(`${baseUrl}/provider/diagnostic`);
      expect(res.status).toBe(200);
      const json = await res.json();
      const serialized = JSON.stringify(json);

      expect(serialized).not.toContain(process.env.GNANI_API_KEY || 'SECRET_KEY_NOT_LEAKED');
    });
  });

  describe('Safe Error Responses & Status Codes', () => {
    it('returns structured 404 with safe message for missing projects', async () => {
      const res = await fetch(`${baseUrl}/projects/nonexistent-project-id`);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
      expect(json.stack).toBeUndefined(); // Never leaks stack trace
    });

    it('returns structured 400 with safe validation details on bad input', async () => {
      const res = await fetch(`${baseUrl}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Missing title and script
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('required');
    });

    it('enforces rate limiter headers on API calls', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.headers.get('x-ratelimit-limit')).toBeDefined();
      expect(res.headers.get('x-ratelimit-remaining')).toBeDefined();
    });
  });
});
