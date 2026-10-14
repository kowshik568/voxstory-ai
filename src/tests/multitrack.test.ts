import { describe, it, expect } from 'vitest';
import {
  calculateTotalDuration,
  splitClipAtTime,
  duplicateClip,
  isTrackAudible,
  rippleClipsSequentially,
  generateSubtitlesFromMultitrack,
  mixMultitrackTimeline,
  createDefaultMultitrackSetup,
} from '../lib/multitrackEngine';
import { TimelineClip, TimelineTrack } from '../types';

describe('VoxStory Multitrack DAW Engine (v7.0)', () => {
  const { tracks, clips } = createDefaultMultitrackSetup();

  it('calculates total timeline duration accurately from all tracks', () => {
    const duration = calculateTotalDuration(clips);
    expect(duration).toBeGreaterThanOrEqual(17.5);
  });

  it('splits a clip cleanly at playhead position', () => {
    const testClip: TimelineClip = {
      id: 'test-clip-1',
      trackId: 'track-1',
      title: 'Speech Segment',
      startTime: 2.0,
      duration: 6.0,
      fadeIn: 0.2,
      fadeOut: 0.2,
      volume: 1.0,
      pan: 0.0,
    };

    const splitResult = splitClipAtTime(testClip, 5.0);
    expect(splitResult).not.toBeNull();
    if (!splitResult) return;

    const [part1, part2] = splitResult;
    expect(part1.id).toBe('test-clip-1-part1');
    expect(part1.startTime).toBe(2.0);
    expect(part1.duration).toBe(3.0);

    expect(part2.startTime).toBe(5.0);
    expect(part2.duration).toBe(3.0);
    expect(part2.trimStart).toBe(3.0);
  });

  it('rejects split outside of clip boundaries', () => {
    const testClip: TimelineClip = {
      id: 'test-clip-2',
      trackId: 'track-1',
      title: 'Short Clip',
      startTime: 4.0,
      duration: 2.0,
      fadeIn: 0,
      fadeOut: 0,
      volume: 1.0,
      pan: 0,
    };

    // Before clip
    expect(splitClipAtTime(testClip, 3.5)).toBeNull();
    // After clip
    expect(splitClipAtTime(testClip, 7.0)).toBeNull();
    // Too close to edge (< 0.1s margin)
    expect(splitClipAtTime(testClip, 4.05)).toBeNull();
  });

  it('duplicates a clip with unique id and offset', () => {
    const sourceClip = clips[0];
    const copy = duplicateClip(sourceClip, 0.5);

    expect(copy.id).not.toBe(sourceClip.id);
    expect(copy.title).toContain('Copy');
    expect(copy.startTime).toBe(Math.round((sourceClip.startTime + sourceClip.duration + 0.5) * 100) / 100);
  });

  it('evaluates track audibility honoring Solo and Mute rules', () => {
    const trackA: TimelineTrack = {
      id: 't-1',
      name: 'Vocals',
      type: 'speaker',
      color: '#fff',
      isMuted: false,
      isSolo: false,
      volume: 1,
      pan: 0,
    };
    const trackB: TimelineTrack = {
      id: 't-2',
      name: 'Music',
      type: 'music',
      color: '#fff',
      isMuted: false,
      isSolo: false,
      volume: 1,
      pan: 0,
    };

    // Both audible
    expect(isTrackAudible(trackA, [trackA, trackB])).toBe(true);
    expect(isTrackAudible(trackB, [trackA, trackB])).toBe(true);

    // Track A muted
    trackA.isMuted = true;
    expect(isTrackAudible(trackA, [trackA, trackB])).toBe(false);
    expect(isTrackAudible(trackB, [trackA, trackB])).toBe(true);

    // Track B soloed -> overrides non-soloed tracks
    trackA.isMuted = false;
    trackB.isSolo = true;
    expect(isTrackAudible(trackA, [trackA, trackB])).toBe(false);
    expect(isTrackAudible(trackB, [trackA, trackB])).toBe(true);
  });

  it('ripples clips sequentially with configured gap pacing', () => {
    const sampleClips: TimelineClip[] = [
      { id: 'c1', trackId: 't1', title: '1', startTime: 10, duration: 2.0, fadeIn: 0, fadeOut: 0, volume: 1, pan: 0 },
      { id: 'c2', trackId: 't1', title: '2', startTime: 25, duration: 3.0, fadeIn: 0, fadeOut: 0, volume: 1, pan: 0 },
    ];

    const rippled = rippleClipsSequentially(sampleClips, 0.5);
    expect(rippled[0].startTime).toBe(0);
    expect(rippled[1].startTime).toBe(2.5); // 0 + 2.0 + 0.5
  });

  it('generates subtitle cues with correct speaker tags and timestamps', () => {
    const subtitles = generateSubtitlesFromMultitrack(clips);
    expect(subtitles.srt).toContain('Elena (Commander)');
    expect(subtitles.srt).toContain('-->');
    expect(subtitles.vtt).toContain('WEBVTT');
    expect(subtitles.vtt).toContain('Rohan (Operative)');
  });

  it('renders multitrack mixdown generating valid WAV buffer with header', async () => {
    const mix = await mixMultitrackTimeline(tracks.slice(0, 3), clips.slice(0, 3), 16000);
    expect(mix.durationSeconds).toBeGreaterThan(0);
    expect(mix.sizeBytes).toBeGreaterThan(44);
    expect(mix.dataUrl).toBeDefined();
  });
});
