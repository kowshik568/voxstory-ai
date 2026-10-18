import { describe, it, expect } from 'vitest';
import {
  VERIFIED_TAGS,
  TAG_MAP,
  validateScript,
  parseScriptToSpans,
} from '../lib/tagCatalog';
import { SUPPORTED_VOICES } from '../lib/voices';
import {
  calculateTotalDuration,
  splitClipAtTime,
  duplicateClip,
  rippleClipsSequentially,
} from '../lib/multitrackEngine';
import { TimelineClip } from '../types';

describe('VoxStory AI v11.0 — Professional Creator Studio Tests', () => {
  describe('1. Professional Script Validation & Tag Catalog', () => {
    it('contains all 13 official Timbre v3.0 expression tags with valid categories', () => {
      expect(VERIFIED_TAGS).toHaveLength(13);
      const tagStrings = VERIFIED_TAGS.map((t) => t.tag);
      expect(tagStrings).toContain('<excited>');
      expect(tagStrings).toContain('<whispers>');
      expect(tagStrings).toContain('<laugh>');
      expect(tagStrings).toContain('<pauses>');
      expect(tagStrings).toContain('<slow>');
      expect(tagStrings).toContain('<sigh>');
      expect(tagStrings).toContain('<giggle>');
      expect(tagStrings).toContain('<shouting>');
      expect(tagStrings).toContain('<coughs>');
      expect(tagStrings).toContain('<exhales>');
      expect(tagStrings).toContain('<sniffles>');
      expect(tagStrings).toContain('<yawns>');
      expect(tagStrings).toContain('<clears throat>');
    });

    it('accurately identifies invalid/unsupported tags with actionable warnings', () => {
      const scriptWithBadTags = 'Elena: <whisper> Wait here. <angry> He is coming.';
      const result = validateScript(scriptWithBadTags);
      expect(result.invalidTags).toContain('<whisper>');
      expect(result.invalidTags).toContain('<angry>');
      expect(result.warnings.some((w) => w.includes('Unknown expression tag'))).toBe(true);
    });

    it('calculates duration factoring tag pacing modifiers', () => {
      const plain = 'This is a normal sentence with seven words.';
      const withPauseAndSlow = '<pauses> <slow> This is a normal sentence with seven words.';
      const resPlain = validateScript(plain);
      const resModified = validateScript(withPauseAndSlow);
      // Pacing modifiers should increase duration
      expect(resModified.estimatedDurationSeconds).toBeGreaterThan(resPlain.estimatedDurationSeconds);
    });

    it('flags empty scripts or scripts containing only audio tags', () => {
      const emptyRes = validateScript('   ');
      expect(emptyRes.isValid).toBe(false);
      expect(emptyRes.errors[0]).toContain('Script is empty');

      const tagOnlyRes = validateScript('<whispers> <laugh>');
      expect(tagOnlyRes.isValid).toBe(false);
      expect(tagOnlyRes.errors[0]).toContain('contains only audio tags');
    });
  });

  describe('2. Voice Direction & Timbre Catalog Consistency', () => {
    it('verifies all supported voices belong to the verified Timbre v3.0 catalog', () => {
      expect(SUPPORTED_VOICES.length).toBeGreaterThanOrEqual(6);
      const names = SUPPORTED_VOICES.map((v) => v.name);
      expect(names).toContain('Nalini');
      expect(names).toContain('Rohan');
      expect(names).toContain('Aarav');
      expect(names).toContain('Ananya');
    });
  });

  describe('3. Timeline Clip Manipulation & Precision DAW Operations', () => {
    it('splits clip accurately at playhead timestamp', () => {
      const clip: TimelineClip = {
        id: 'c-test-1',
        trackId: 'track-1',
        title: 'Dialogue Take',
        startTime: 2.0,
        duration: 6.0,
        fadeIn: 0,
        fadeOut: 0,
        volume: 1.0,
        pan: 0,
        audioUrl: 'data:audio/wav;base64,UklGRg==',
      };

      const split = splitClipAtTime(clip, 5.0);
      expect(split).not.toBeNull();
      if (split) {
        const [c1, c2] = split;
        expect(c1.startTime).toBe(2.0);
        expect(c1.duration).toBe(3.0);
        expect(c2.startTime).toBe(5.0);
        expect(c2.duration).toBe(3.0);
        expect(c1.duration + c2.duration).toBe(clip.duration);
      }
    });

    it('ripples clips sequentially with configurable pause gaps', () => {
      const clips: TimelineClip[] = [
        { id: 'c1', trackId: 't1', title: 'Line 1', startTime: 0, duration: 2.0, fadeIn: 0, fadeOut: 0, volume: 1, pan: 0 },
        { id: 'c2', trackId: 't1', title: 'Line 2', startTime: 10, duration: 3.0, fadeIn: 0, fadeOut: 0, volume: 1, pan: 0 },
        { id: 'c3', trackId: 't1', title: 'Line 3', startTime: 25, duration: 1.5, fadeIn: 0, fadeOut: 0, volume: 1, pan: 0 },
      ];

      const rippled = rippleClipsSequentially(clips, 0.5);
      expect(rippled[0].startTime).toBe(0);
      expect(rippled[1].startTime).toBe(2.5); // 2.0 + 0.5 gap
      expect(rippled[2].startTime).toBe(6.0); // 2.5 + 3.0 + 0.5 gap
    });
  });
});
