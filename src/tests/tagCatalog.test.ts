/**
 * Unit Tests for VoxStory AI Expression Tag Parsing & Script Validation
 */

import { describe, it, expect } from 'vitest';
import {
  VERIFIED_TAGS,
  validateScript,
  parseScriptToSpans,
  normalizeTag,
} from '../lib/tagCatalog';

describe('Gnani Timbre v3.0 Tag Catalog & Validator', () => {
  it('contains exactly 13 verified expression tags', () => {
    expect(VERIFIED_TAGS.length).toBe(13);
    const tags = VERIFIED_TAGS.map((t) => t.tag);
    expect(tags).toContain('<laugh>');
    expect(tags).toContain('<sigh>');
    expect(tags).toContain('<whispers>');
    expect(tags).toContain('<pauses>');
    expect(tags).toContain('<coughs>');
    expect(tags).toContain('<excited>');
    expect(tags).toContain('<exhales>');
    expect(tags).toContain('<giggle>');
    expect(tags).toContain('<shouting>');
    expect(tags).toContain('<slow>');
    expect(tags).toContain('<sniffles>');
    expect(tags).toContain('<yawns>');
    expect(tags).toContain('<clears throat>');
  });

  it('rejects an empty script with validation error', () => {
    const res = validateScript('   ');
    expect(res.isValid).toBe(false);
    expect(res.errors[0]).toContain('Script is empty');
  });

  it('correctly detects verified tags in a script', () => {
    const script = '<excited> Welcome to our channel! <pauses> Wait, did you hear that? <whispers> Don’t move.';
    const res = validateScript(script);
    expect(res.isValid).toBe(true);
    expect(res.detectedTags).toContain('<excited>');
    expect(res.detectedTags).toContain('<pauses>');
    expect(res.detectedTags).toContain('<whispers>');
    expect(res.wordCount).toBeGreaterThan(10);
    expect(res.estimatedDurationSeconds).toBeGreaterThan(3);
  });

  it('flags unknown tags as warnings', () => {
    const script = '<nonexistent_tag> Hello world, testing invalid tag.';
    const res = validateScript(script);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.invalidTags).toContain('<nonexistent_tag>');
  });

  it('warns if user uses square brackets instead of angle brackets', () => {
    const script = '[whispers] Hello from square brackets.';
    const res = validateScript(script);
    expect(res.warnings.some((w) => w.includes('square brackets'))).toBe(true);
  });

  it('parses script into continuous spans respecting the continuation rule', () => {
    const script = '<whispers> Secret message <excited> Happy message';
    const spans = parseScriptToSpans(script);
    expect(spans.length).toBe(4); // tag, text, tag, text
    expect(spans[0].type).toBe('tag');
    expect(spans[1].type).toBe('text');
    expect(spans[1].activeTag?.id).toBe('whispers');
    expect(spans[2].type).toBe('tag');
    expect(spans[3].type).toBe('text');
    expect(spans[3].activeTag?.id).toBe('excited');
  });

  it('normalizes various tag casings and bracket styles', () => {
    expect(normalizeTag('<whispers>')).toBe('<whispers>');
    expect(normalizeTag('[whispers]')).toBe('<whispers>');
    expect(normalizeTag('whispers')).toBe('<whispers>');
    expect(normalizeTag('<WHISPERS>')).toBe('<whispers>');
  });
});
