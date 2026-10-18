/**
 * Tests for Asynchronous Persistent Generation Jobs, Idempotency & System Metrics
 * Uses native fetch on ephemeral Express test server (zero extra dependencies)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { createApiRouter } from '../server/routes';

describe('Generation Jobs API', () => {
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

  it('creates and tracks a persistent generation job', async () => {
    const res = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: '<laugh> Hello from automated test job!',
        voice: 'Nalini',
        language: 'en-IN',
      }),
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe('queued');

    const jobId = body.jobId;

    // Poll for worker to complete (allowing network latency for live provider)
    let statusBody: any = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const statusRes = await fetch(`${baseUrl}/jobs/${jobId}`);
      expect(statusRes.status).toBe(200);
      statusBody = await statusRes.json();
      if (statusBody.data.status === 'completed' || statusBody.data.status === 'failed') {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    expect(statusBody.success).toBe(true);
    expect(statusBody.data.status).toBe('completed');
    expect(statusBody.data.result).toBeDefined();
    expect(statusBody.data.result.audioUrl).toContain('data:audio/wav;base64,');
  });

  it('prevents duplicate submissions using idempotency keys', async () => {
    const idempotencyKey = `idemp-${Date.now()}`;

    const res1 = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        script: '<whispers> Secret line test',
        voice: 'Aarav',
        language: 'en-IN',
      }),
    });

    expect(res1.status).toBe(202);
    const body1 = await res1.json();
    const firstJobId = body1.jobId;

    // Resubmit identical request with same key
    const res2 = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        script: '<whispers> Secret line test',
        voice: 'Aarav',
        language: 'en-IN',
      }),
    });

    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.jobId).toBe(firstJobId);
    expect(body2.isDuplicateSubmission).toBe(true);
  });

  it('provides accurate production metrics', async () => {
    const res = await fetch(`${baseUrl}/metrics`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(body.data.providerHealth).toBeDefined();
  });

  it('returns authenticated director workspace info', async () => {
    const res = await fetch(`${baseUrl}/auth/me`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('director');
    expect(body.data.tier).toBe('Studio Pro');
  });
});
