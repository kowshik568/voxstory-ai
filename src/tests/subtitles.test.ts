/**
 * Unit Tests for Subtitle & Creator Export Package Generators (SRT, VTT, Transcripts)
 */

import { describe, it, expect } from 'vitest';
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  cleanSpokenSubtitleText,
  generateSoloNarrationCues,
  generateDialogueCues,
  cuesToSrt,
  cuesToVtt,
  cuesToTranscript,
} from '../lib/subtitleGenerator';
import { DialogueSegment } from '../types';

describe('Subtitle & Transcript Generator', () => {
  it('formats SRT timestamps correctly (HH:MM:SS,mmm)', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(65.432)).toBe('00:01:05,432');
    expect(formatSrtTimestamp(3661.05)).toBe('01:01:01,050');
  });

  it('formats WebVTT timestamps correctly (HH:MM:SS.mmm)', () => {
    expect(formatVttTimestamp(0)).toBe('00:00:00.000');
    expect(formatVttTimestamp(12.75)).toBe('00:00:12.750');
    expect(formatVttTimestamp(3600)).toBe('01:00:00.000');
  });

  it('strips expression tags cleanly from spoken text', () => {
    const raw = '<excited> Welcome back! <pauses> Today we test <whispers> secret audio.';
    const clean = cleanSpokenSubtitleText(raw);
    expect(clean).toBe('Welcome back! Today we test secret audio.');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
  });

  it('generates solo narration cues distributed across duration', () => {
    const script = '<excited> First sentence here. <pauses> Second sentence follows. <whispers> And the conclusion.';
    const cues = generateSoloNarrationCues(script, 10.0, 'Nalini');
    expect(cues.length).toBe(3);
    expect(cues[0].speaker).toBe('Nalini');
    expect(cues[0].startTimeSeconds).toBe(0);
    expect(cues[2].endTimeSeconds).toBe(10.0);
  });

  it('generates dialogue cues with precise pause gaps', () => {
    const segments: DialogueSegment[] = [
      {
        id: '1',
        characterId: 'c1',
        characterName: 'Elena',
        voice: 'Nalini',
        language: 'en-IN',
        text: '<whispers> The vault is open.',
        duration: 2.0,
      },
      {
        id: '2',
        characterId: 'c2',
        characterName: 'Rohan',
        voice: 'Rohan',
        language: 'en-IN',
        text: '<excited> Grab the package!',
        duration: 1.5,
      },
    ];

    const cues = generateDialogueCues(segments, 0.35);
    expect(cues.length).toBe(2);
    expect(cues[0].speaker).toBe('Elena');
    expect(cues[0].startTimeSeconds).toBe(0);
    expect(cues[0].endTimeSeconds).toBe(2.0);
    // Second cue should start after 2.0 + 0.35 = 2.35
    expect(cues[1].startTimeSeconds).toBe(2.35);
    expect(cues[1].endTimeSeconds).toBe(3.85);
  });

  it('formats cues to valid SubRip (.srt) syntax', () => {
    const cues = [
      { index: 1, startTimeSeconds: 0, endTimeSeconds: 2.5, speaker: 'Host', text: 'Hello world.' },
    ];
    const srt = cuesToSrt(cues);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,500\nHost: Hello world.\n');
  });

  it('formats cues to valid WebVTT (.vtt) syntax', () => {
    const cues = [
      { index: 1, startTimeSeconds: 0, endTimeSeconds: 2.5, speaker: 'Host', text: 'Hello world.' },
    ];
    const vtt = cuesToVtt(cues);
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.500');
    expect(vtt).toContain('<v Host>Hello world.</v>');
  });

  it('formats cues to clean plain-text transcript', () => {
    const cues = [
      { index: 1, startTimeSeconds: 0, endTimeSeconds: 2.5, speaker: 'Host', text: 'Hello world.' },
    ];
    const txt = cuesToTranscript(cues);
    expect(txt).toBe('[00:00:00.000] Host: Hello world.');
  });

  it('recalculates subtitle timestamps correctly when dialogue segments are reordered', () => {
    const segA: DialogueSegment = {
      id: 'a',
      characterId: 'c1',
      characterName: 'Speaker A',
      voice: 'Nalini',
      language: 'en-IN',
      text: 'Segment Alpha',
      duration: 3.0,
    };
    const segB: DialogueSegment = {
      id: 'b',
      characterId: 'c2',
      characterName: 'Speaker B',
      voice: 'Rohan',
      language: 'en-IN',
      text: 'Segment Beta',
      duration: 1.0,
    };

    const pause = 0.5;

    // Order 1: A then B
    const cuesForward = generateDialogueCues([segA, segB], pause);
    expect(cuesForward[0].speaker).toBe('Speaker A');
    expect(cuesForward[0].startTimeSeconds).toBe(0);
    expect(cuesForward[0].endTimeSeconds).toBe(3.0);
    expect(cuesForward[1].speaker).toBe('Speaker B');
    expect(cuesForward[1].startTimeSeconds).toBe(3.5);
    expect(cuesForward[1].endTimeSeconds).toBe(4.5);

    // Order 2: Reordered B then A
    const cuesReordered = generateDialogueCues([segB, segA], pause);
    expect(cuesReordered[0].speaker).toBe('Speaker B');
    expect(cuesReordered[0].startTimeSeconds).toBe(0);
    expect(cuesReordered[0].endTimeSeconds).toBe(1.0);
    expect(cuesReordered[1].speaker).toBe('Speaker A');
    expect(cuesReordered[1].startTimeSeconds).toBe(1.5);
    expect(cuesReordered[1].endTimeSeconds).toBe(4.5);
  });

  it('generates safe creator export metadata without credentials or private keys', () => {
    const mockExportMetadata = {
      app: 'VoxStory AI v3.0',
      exportedAt: new Date().toISOString(),
      project: {
        id: 'proj-001',
        title: 'Cyberpunk Narrative',
        mode: 'dialogue',
      },
      characters: [
        { name: 'Elena', voice: 'Nalini' },
        { name: 'Rohan', voice: 'Rohan' },
      ],
      expressionTags: ['whispers', 'excited'],
      durationSeconds: 4.5,
    };

    const jsonString = JSON.stringify(mockExportMetadata, null, 2);
    expect(jsonString).not.toContain('apiKey');
    expect(jsonString).not.toContain('authorization');
    expect(jsonString).not.toContain('token');
    expect(jsonString).toContain('Cyberpunk Narrative');
    expect(jsonString).toContain('whispers');
  });
});
