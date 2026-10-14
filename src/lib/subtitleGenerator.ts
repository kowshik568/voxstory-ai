/**
 * VoxStory AI - Production Subtitle & Transcript Generator
 * Generates valid SubRip (.srt), WebVTT (.vtt), and clean text transcripts
 * Supporting both Multi-Character Dialogue Scenes and Solo Narration takes.
 */

import { SubtitleCue, DialogueSegment, GenerationResult } from '../types';
import { parseScriptToSpans, validateScript } from './tagCatalog';

/**
 * Format seconds into SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const millis = Math.floor((safeSec % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Format seconds into WebVTT timestamp: HH:MM:SS.mmm
 */
export function formatVttTimestamp(seconds: number): string {
  const safeSec = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const millis = Math.floor((safeSec % 1) * 1000);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
}

/**
 * Clean script text for subtitle display (strips angle-bracket expression tags and trims whitespace)
 */
export function cleanSpokenSubtitleText(rawText: string): string {
  return rawText
    .replace(/<[^>]+>/g, '') // remove tags
    .replace(/\s+/g, ' ') // normalize spaces
    .trim();
}

/**
 * Generates subtitle cues from a Multi-Character Dialogue sequence
 * Uses actual segment durations and the precise 350ms pause offset.
 */
export function generateDialogueCues(
  segments: DialogueSegment[],
  pauseDurationSeconds: number = 0.35
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let currentStart = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = Math.max(0.8, seg.duration || 2.0);
    const end = Math.round((currentStart + duration) * 1000) / 1000;
    const cleanText = cleanSpokenSubtitleText(seg.text);
    const tags = seg.text.match(/<[^>]+>/g) || [];

    if (cleanText.length > 0) {
      cues.push({
        index: cues.length + 1,
        startTimeSeconds: currentStart,
        endTimeSeconds: end,
        speaker: seg.characterName,
        text: cleanText,
        tagsUsed: tags,
      });
    }

    // Advance start time past segment + pause offset
    currentStart = end + (i < segments.length - 1 ? pauseDurationSeconds : 0);
  }

  return cues;
}

/**
 * Generates subtitle cues for a Solo Narration take
 * Breaks script into logical sentence units and distributes actual audio duration
 * proportionally by word count and pacing tags (<slow>, <pauses>, <excited>).
 */
export function generateSoloNarrationCues(
  script: string,
  totalActualDurationSeconds: number,
  speakerName?: string
): SubtitleCue[] {
  const validation = validateScript(script);
  const cleanSpoken = cleanSpokenSubtitleText(script);
  if (!cleanSpoken) return [];

  // Split into sentence blocks: periods, exclamation marks, question marks, or newlines
  const rawSentences = cleanSpoken
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (rawSentences.length === 0) return [];

  // Compute total words across sentences
  const sentenceWordCounts = rawSentences.map((s) => Math.max(1, s.split(/\s+/).length));
  const totalWords = sentenceWordCounts.reduce((a, b) => a + b, 0);

  const cues: SubtitleCue[] = [];
  let currentStart = 0;

  for (let i = 0; i < rawSentences.length; i++) {
    const words = sentenceWordCounts[i];
    const fraction = words / totalWords;
    let sentenceDuration = fraction * totalActualDurationSeconds;

    // Minimum sentence duration of 0.7s
    sentenceDuration = Math.max(0.7, sentenceDuration);

    let end = Math.min(totalActualDurationSeconds, currentStart + sentenceDuration);
    // Ensure final cue matches total duration
    if (i === rawSentences.length - 1) {
      end = totalActualDurationSeconds;
    }

    cues.push({
      index: i + 1,
      startTimeSeconds: Math.round(currentStart * 1000) / 1000,
      endTimeSeconds: Math.round(end * 1000) / 1000,
      speaker: speakerName,
      text: rawSentences[i],
    });

    currentStart = end;
  }

  return cues;
}

/**
 * Formats an array of SubtitleCues into a standard .srt file string
 */
export function cuesToSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue) => {
      const speakerPrefix = cue.speaker ? `${cue.speaker}: ` : '';
      return `${cue.index}\n${formatSrtTimestamp(cue.startTimeSeconds)} --> ${formatSrtTimestamp(cue.endTimeSeconds)}\n${speakerPrefix}${cue.text}\n`;
    })
    .join('\n');
}

/**
 * Formats an array of SubtitleCues into a standard .vtt file string
 */
export function cuesToVtt(cues: SubtitleCue[]): string {
  const lines: string[] = ['WEBVTT', '', 'NOTE Generated by VoxStory AI', ''];

  for (const cue of cues) {
    const speakerVoiceTag = cue.speaker ? `<v ${cue.speaker}>${cue.text}</v>` : cue.text;
    lines.push(
      String(cue.index),
      `${formatVttTimestamp(cue.startTimeSeconds)} --> ${formatVttTimestamp(cue.endTimeSeconds)}`,
      speakerVoiceTag,
      ''
    );
  }

  return lines.join('\n');
}

/**
 * Formats cues into a plain text transcript with timestamps and speakers
 */
export function cuesToTranscript(cues: SubtitleCue[]): string {
  return cues
    .map((c) => {
      const time = `[${formatVttTimestamp(c.startTimeSeconds)}]`;
      const speaker = c.speaker ? `${c.speaker}: ` : '';
      return `${time} ${speaker}${c.text}`;
    })
    .join('\n\n');
}
