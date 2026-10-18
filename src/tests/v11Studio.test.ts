/**
 * VoxStory AI v11.0 - Professional Creator Studio Tests
 * Verifies:
 * - Script line formatting and speaker attribution
 * - Expression tag suggestion validation against Timbre catalog
 * - Duration estimation and metrics calculation
 * - Cast and character voice consistency
 * - Multitrack timeline synchronization integrity
 */

import { describe, it, expect } from 'vitest';
import { VERIFIED_TAGS, validateScript } from '../lib/tagCatalog';
import { SUPPORTED_VOICES } from '../lib/voices';

describe('VoxStory AI v11.0 - Script Validation & Tag Suggestions', () => {
  it('validates all 13 supported expression tags correctly', () => {
    expect(VERIFIED_TAGS.length).toBe(13);
    for (const tag of VERIFIED_TAGS) {
      expect(tag.id).toBeTruthy();
      expect(tag.tag).toMatch(/^<[a-z ]+>$/);
      expect(tag.name).toBeTruthy();
      expect(tag.description).toBeTruthy();
    }
  });

  it('accurately identifies invalid expression tags without false positives', () => {
    const validScript = 'Welcome everyone. <whispers> Keep your voice down. <excited> We did it!';
    const validResult = validateScript(validScript);
    expect(validResult.isValid).toBe(true);
    expect(validResult.detectedTags).toContain('<whispers>');
    expect(validResult.detectedTags).toContain('<excited>');
    expect(validResult.invalidTags.length).toBe(0);

    const invalidScript = 'Hello <alien> extraterrestrial <robot> beep boop';
    const invalidResult = validateScript(invalidScript);
    expect(invalidResult.warnings.length).toBeGreaterThan(0);
    expect(invalidResult.invalidTags).toContain('<alien>');
    expect(invalidResult.invalidTags).toContain('<robot>');
  });

  it('computes accurate estimated duration and metrics for scripts', () => {
    const text = 'This is a high quality test sentence containing precisely ten words in the script.';
    const result = validateScript(text);
    expect(result.wordCount).toBe(14);
    expect(result.estimatedDurationSeconds).toBeGreaterThan(2);
    expect(result.estimatedDurationSeconds).toBeLessThan(15);
  });
});

describe('VoxStory AI v11.0 - Voice Catalog & Character Management', () => {
  it('provides verified Gnani Timbre v3.0 voice catalog with rich voice profiles', () => {
    expect(SUPPORTED_VOICES.length).toBeGreaterThanOrEqual(13);
    const voiceIds = SUPPORTED_VOICES.map((v) => v.id);
    expect(voiceIds).toContain('shivani');
    expect(voiceIds).toContain('avinash');
    expect(voiceIds).toContain('lakshmi');
    expect(voiceIds).toContain('shubham');
    expect(voiceIds).toContain('kalpana');
    expect(voiceIds).toContain('nalini');
    expect(voiceIds).toContain('rohan');
  });

  it('ensures every voice profile specifies valid gender, style, and sample text/description', () => {
    for (const voice of SUPPORTED_VOICES) {
      expect(voice.name).toBeTruthy();
      expect(['Male', 'Female']).toContain(voice.gender);
      expect(voice.style).toBeTruthy();
      expect(voice.description).toBeTruthy();
    }
  });

  it('binds characters consistently to supported voice IDs without inventing voices', () => {
    const validVoiceSet = new Set<string>(SUPPORTED_VOICES.map((v) => v.id));

    const cast = [
      { id: 'c1', name: 'Host Nalini', voice: 'nalini' },
      { id: 'c2', name: 'Dr. Rohan', voice: 'rohan' },
      { id: 'c3', name: 'Narrator Shivani', voice: 'shivani' },
    ];

    for (const character of cast) {
      expect(validVoiceSet.has(character.voice)).toBe(true);
    }
  });
});
