import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { createApiRouter } from '../server/routes';

describe('VoxStory AI v13 - Voice Studio & History & Usage Workflows', () => {
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

  it('GET /api/usage returns real usage metrics and credit accounting disclosure', async () => {
    const res = await fetch(`${baseUrl}/usage`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(typeof json.data.totalRequests).toBe('number');
    expect(typeof json.data.totalCharactersProcessed).toBe('number');
    expect(typeof json.data.totalAudioSecondsGenerated).toBe('number');
    expect(json.data.provider).toBeDefined();
    expect(typeof json.data.creditAccountingNotice).toBe('string');
  });

  it('GET /api/favorites returns favorite voices and supports add/delete', async () => {
    // 1. Get favorites
    const getRes = await fetch(`${baseUrl}/favorites`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(Array.isArray(getJson.data)).toBe(true);

    // 2. Add favorite
    const addRes = await fetch(`${baseUrl}/favorites/yashraj`, { method: 'POST' });
    expect(addRes.status).toBe(200);
    const addJson = await addRes.json();
    expect(addJson.data).toContain('yashraj');

    // 3. Remove favorite
    const delRes = await fetch(`${baseUrl}/favorites/yashraj`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.data).not.toContain('yashraj');
  });

  it('POST /api/generations saves take to history and GET /api/generations lists it', async () => {
    const genRes = await fetch(`${baseUrl}/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: '<whispers> The night whispered ancient secrets. <pauses>',
        voice: 'Shivani',
        language: 'en-IN',
        audioConfig: { container: 'wav', encoding: 'linear_pcm', sampleRate: 24000 },
        title: 'Secrets Take 1',
      }),
    });

    expect(genRes.status).toBe(200);
    const genJson = await genRes.json();
    expect(genJson.success).toBe(true);
    const takeId = genJson.data.id;
    expect(takeId).toBeDefined();

    // List generations
    const listRes = await fetch(`${baseUrl}/generations`);
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.success).toBe(true);
    expect(listJson.data.length).toBeGreaterThan(0);
    const found = listJson.data.find((g: any) => g.id === takeId);
    expect(found).toBeDefined();
    expect(found.voice).toBe('Shivani');

    // Search generations
    const searchRes = await fetch(`${baseUrl}/generations?search=Secrets`);
    expect(searchRes.status).toBe(200);
    const searchJson = await searchRes.json();
    expect(searchJson.data.some((g: any) => g.id === takeId)).toBe(true);

    // Filter by voice
    const voiceRes = await fetch(`${baseUrl}/generations?voice=Shivani`);
    expect(voiceRes.status).toBe(200);
    const voiceJson = await voiceRes.json();
    expect(voiceJson.data.every((g: any) => g.voice.toLowerCase() === 'shivani')).toBe(true);

    // Delete individual take
    const delRes = await fetch(`${baseUrl}/generations/${takeId}`, { method: 'DELETE' });
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.deleted).toBe(true);
  });
});
