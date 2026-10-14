/**
 * VoxStory AI - Gnani Timbre v3.0 Verified Expression Tags Catalog
 *
 * Official Gnani Timbre v3.0 Audio Tags:
 * 1. <laugh>        - Directs voice to laugh or chuckle naturally before continuing
 * 2. <sigh>         - Adds an emotional sigh or deep release of breath
 * 3. <whispers>     - Soft, intimate whisper delivery until next tag or sentence
 * 4. <pauses>       - Introduces a dramatic or reflective timed pause
 * 5. <coughs>       - Realistic natural throat cough / interruption
 * 6. <excited>      - Elevated pitch, energetic tempo, upbeat enthusiastic delivery
 * 7. <exhales>      - Breath out / audible relief or exhaustion sound
 * 8. <giggle>       - Playful light chuckle or amusement
 * 9. <shouting>     - Projected loud voice with dramatic intensity
 * 10. <slow>        - Measured, deliberate, slowed pacing for gravity or emphasis
 * 11. <sniffles>    - Emotional or cold sniffle sound
 * 12. <yawns>       - Tired or relaxed yawn vocalization
 * 13. <clears throat> - Brief vocal clearing sound for hesitation or beginning a speech
 */

import { ExpressionTag, ScriptSpan, ScriptValidationResult } from '../types';

export const VERIFIED_TAGS: ExpressionTag[] = [
  {
    id: 'excited',
    tag: '<excited>',
    name: 'Excited',
    category: 'delivery',
    description: 'Elevates pitch and increases energy, delivering text with enthusiasm, optimism, and dynamic tempo.',
    example: '<excited> We just broke through our all-time record! This changes everything.',
    sampleText: 'We just broke through our all-time record! This changes everything.',
    pacingEffect: '+15% tempo, elevated formant pitch',
    color: '#ec4899', // pink-500
    badgeBg: 'rgba(236, 72, 153, 0.15)',
    badgeBorder: 'rgba(236, 72, 153, 0.4)',
  },
  {
    id: 'whispers',
    tag: '<whispers>',
    name: 'Whispers',
    category: 'delivery',
    description: 'Transitions into a hushed, breathy, intimate vocal tone for secrecy, suspense, or emotional proximity.',
    example: '<whispers> Don’t make a sound. Whatever is out there, it’s listening.',
    sampleText: 'Don’t make a sound. Whatever is out there, it’s listening.',
    pacingEffect: 'Soft breathy intensity, lowered amplitude',
    color: '#8b5cf6', // purple-500
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeBorder: 'rgba(139, 92, 246, 0.4)',
  },
  {
    id: 'laugh',
    tag: '<laugh>',
    name: 'Laugh',
    category: 'reaction',
    description: 'Inserts natural laughter or an amused chuckle into the vocal delivery before transitioning into dialogue.',
    example: '<laugh> You honestly thought I hadn’t prepared for that scenario?',
    sampleText: 'You honestly thought I hadn’t prepared for that scenario?',
    pacingEffect: '+1.2s chuckle gesture, cheerful pitch transition',
    color: '#eab308', // yellow-500
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    badgeBorder: 'rgba(234, 179, 8, 0.4)',
  },
  {
    id: 'giggle',
    tag: '<giggle>',
    name: 'Giggle',
    category: 'reaction',
    description: 'A light, cheerful, playful chuckle suitable for storytelling, children’s content, or friendly banter.',
    example: '<giggle> Look at him trying to wear adult shoes! Isn’t he adorable?',
    sampleText: 'Look at him trying to wear adult shoes! Isn’t he adorable?',
    pacingEffect: '+0.8s playful giggle gesture',
    color: '#f59e0b', // amber-500
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    badgeBorder: 'rgba(245, 158, 11, 0.4)',
  },
  {
    id: 'sigh',
    tag: '<sigh>',
    name: 'Sigh',
    category: 'reaction',
    description: 'An audible emotional sigh expressing fatigue, nostalgia, resignation, or profound relief.',
    example: '<sigh> It was a long journey, but we finally made it home.',
    sampleText: 'It was a long journey, but we finally made it home.',
    pacingEffect: '+1.0s breath release, softer downward pitch',
    color: '#06b6d4', // cyan-500
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeBorder: 'rgba(6, 182, 212, 0.4)',
  },
  {
    id: 'shouting',
    tag: '<shouting>',
    name: 'Shouting',
    category: 'delivery',
    description: 'Projects the voice outward with high acoustic energy, command, or urgency without distorting clarity.',
    example: '<shouting> Hold the gate! Do not let them breach the perimeter!',
    sampleText: 'Hold the gate! Do not let them breach the perimeter!',
    pacingEffect: 'Maximum projection, compressed dynamic range',
    color: '#ef4444', // red-500
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeBorder: 'rgba(239, 68, 68, 0.4)',
  },
  {
    id: 'slow',
    tag: '<slow>',
    name: 'Slow',
    category: 'pacing',
    description: 'Reduces speech rate for measured gravitas, dramatic emphasis, instructional clarity, or contemplation.',
    example: '<slow> Every single decision you make from this instant will echo in eternity.',
    sampleText: 'Every single decision you make from this instant will echo in eternity.',
    pacingEffect: '-25% speech rate, elongated vowels',
    color: '#3b82f6', // blue-500
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeBorder: 'rgba(59, 130, 246, 0.4)',
  },
  {
    id: 'pauses',
    tag: '<pauses>',
    name: 'Pauses',
    category: 'pacing',
    description: 'Inserts a deliberate, dramatic beat of silence to build suspense, allow absorption, or punctuate a thought.',
    example: 'There was only one person who knew the truth. <pauses> It was the captain.',
    sampleText: 'It was the captain.',
    pacingEffect: '+1.5s pregnant silence beat',
    color: '#6366f1', // indigo-500
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    badgeBorder: 'rgba(99, 102, 241, 0.4)',
  },
  {
    id: 'coughs',
    tag: '<coughs>',
    name: 'Coughs',
    category: 'nonverbal',
    description: 'Inserts a realistic throat cough or minor vocal disturbance before continuing dialogue.',
    example: '<coughs> Excuse me... as I was explaining before the interruption.',
    sampleText: 'Excuse me... as I was explaining before the interruption.',
    pacingEffect: '+0.9s acoustic cough transient',
    color: '#10b981', // emerald-500
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
  },
  {
    id: 'exhales',
    tag: '<exhales>',
    name: 'Exhales',
    category: 'nonverbal',
    description: 'A deep breath outward, signifying relief after tension or grounding oneself.',
    example: '<exhales> The test results are clean. We’re in the clear.',
    sampleText: 'The test results are clean. We’re in the clear.',
    pacingEffect: '+0.8s gentle breath release',
    color: '#14b8a6', // teal-500
    badgeBg: 'rgba(20, 184, 166, 0.15)',
    badgeBorder: 'rgba(20, 184, 166, 0.4)',
  },
  {
    id: 'clears throat',
    tag: '<clears throat>',
    name: 'Clears Throat',
    category: 'nonverbal',
    description: 'Inserts a realistic throat-clearing sound for hesitation, formality, or commanding a room’s attention.',
    example: '<clears throat> Ladies and gentlemen, if I could have your attention please.',
    sampleText: 'Ladies and gentlemen, if I could have your attention please.',
    pacingEffect: '+0.7s polite throat clear gesture',
    color: '#84cc16', // lime-500
    badgeBg: 'rgba(132, 204, 22, 0.15)',
    badgeBorder: 'rgba(132, 204, 22, 0.4)',
  },
  {
    id: 'sniffles',
    tag: '<sniffles>',
    name: 'Sniffles',
    category: 'nonverbal',
    description: 'Generates a subtle sniffle for emotional distress, cold, or poignant vulnerability.',
    example: '<sniffles> I didn’t think saying goodbye would ever be this hard.',
    sampleText: 'I didn’t think saying goodbye would ever be this hard.',
    pacingEffect: '+0.6s subtle sniffle transient',
    color: '#a855f7', // purple-500
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(168, 85, 247, 0.4)',
  },
  {
    id: 'yawns',
    tag: '<yawns>',
    name: 'Yawns',
    category: 'nonverbal',
    description: 'Vocalizes a tired or drowsy yawn, ideal for late-night storytelling, tired characters, or bed-time tales.',
    example: '<yawns> What time is it? I must have fallen asleep at the desk.',
    sampleText: 'What time is it? I must have fallen asleep at the desk.',
    pacingEffect: '+1.4s drawn-out yawn acoustic gesture',
    color: '#f97316', // orange-500
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    badgeBorder: 'rgba(249, 115, 22, 0.4)',
  },
];

// Map for quick lookup
export const TAG_MAP = new Map<string, ExpressionTag>(
  VERIFIED_TAGS.map((t) => [t.tag.toLowerCase(), t])
);

// Also support tag name without brackets e.g. "whispers" -> ExpressionTag
export const TAG_NAME_MAP = new Map<string, ExpressionTag>(
  VERIFIED_TAGS.map((t) => [t.id.toLowerCase(), t])
);

// Regex matching tags in angle brackets: <tag_name>
export const TAG_REGEX = /<([a-zA-Z\s]+)>/g;

/**
 * Normalizes any bracket style or spacing to standard Timbre v3.0 syntax: <tag>
 * E.g. [whispers] -> <whispers>, < whispers > -> <whispers>
 */
export function normalizeTag(tagStr: string): string {
  const cleaned = tagStr.replace(/^[<\[]\s*/, '').replace(/\s*[>\]]$/, '').trim().toLowerCase();
  const match = TAG_NAME_MAP.get(cleaned);
  return match ? match.tag : tagStr;
}

/**
 * Parse script into structured spans for visualization and playback direction.
 * In Gnani Timbre v3.0, "an expression continues until the next tag".
 */
export function parseScriptToSpans(script: string): ScriptSpan[] {
  if (!script) return [];

  const spans: ScriptSpan[] = [];
  const regex = /<([a-zA-Z\s]+)>/g;
  let lastIndex = 0;
  let currentActiveTag: ExpressionTag | null = null;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(script)) !== null) {
    const textBefore = script.substring(lastIndex, match.index);
    if (textBefore) {
      spans.push({
        id: `text-${lastIndex}`,
        type: 'text',
        content: textBefore,
        activeTag: currentActiveTag,
      });
    }

    const rawTag = match[0].toLowerCase();
    const tagInfo = TAG_MAP.get(rawTag);

    spans.push({
      id: `tag-${match.index}`,
      type: 'tag',
      content: match[0],
      tagInfo,
    });

    // Update active expression governing subsequent text
    currentActiveTag = tagInfo || null;
    lastIndex = regex.lastIndex;
  }

  // Trailing text
  if (lastIndex < script.length) {
    spans.push({
      id: `text-${lastIndex}`,
      type: 'text',
      content: script.substring(lastIndex),
      activeTag: currentActiveTag,
    });
  }

  return spans;
}

/**
 * Validates script for length, expression syntax, and unsupported tags.
 */
export function validateScript(script: string): ScriptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const detectedTags: string[] = [];
  const invalidTags: string[] = [];

  const trimmed = (script || '').trim();
  if (!trimmed) {
    errors.push('Script is empty. Please enter text to generate speech.');
    return {
      isValid: false,
      errors,
      warnings,
      detectedTags: [],
      invalidTags: [],
      wordCount: 0,
      characterCount: 0,
      estimatedDurationSeconds: 0,
      spokenText: '',
    };
  }

  if (trimmed.length > 5000) {
    errors.push(`Script exceeds maximum limit of 5,000 characters (current: ${trimmed.length}).`);
  }

  // Check for brackets [tag] which might be user mistyping angle brackets <tag>
  const squareBracketMatch = trimmed.match(/\[([a-zA-Z\s]+)\]/g);
  if (squareBracketMatch) {
    warnings.push(
      `Detected square brackets ${squareBracketMatch.slice(0, 3).join(', ')}. Gnani Timbre v3.0 uses angle brackets like <laugh> or <whispers>.`
    );
  }

  // Detect and validate angle bracket tags
  const regex = /<([^>]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(trimmed)) !== null) {
    const rawTag = `<${match[1].trim().toLowerCase()}>`;
    if (TAG_MAP.has(rawTag)) {
      if (!detectedTags.includes(rawTag)) {
        detectedTags.push(rawTag);
      }
    } else {
      invalidTags.push(rawTag);
      warnings.push(`Unknown expression tag "${rawTag}". Supported tags: ${VERIFIED_TAGS.map(t => t.tag).join(', ')}.`);
    }
  }

  // Clean spoken text by stripping verified tags
  const spokenText = trimmed.replace(/<[a-zA-Z\s]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = spokenText ? spokenText.split(/\s+/) : [];
  const wordCount = words.length;

  if (wordCount === 0 && detectedTags.length > 0) {
    errors.push('Script contains only audio tags without any spoken dialogue text.');
  }

  // Estimate duration: ~140 words per minute average (2.33 words/sec) + tag modifiers
  let estimatedDuration = (wordCount / 140) * 60;
  
  // Factor in detected tag pacing
  for (const tagStr of detectedTags) {
    const tag = TAG_MAP.get(tagStr);
    if (!tag) continue;
    if (tag.id === 'pauses') estimatedDuration += 1.5;
    else if (tag.id === 'slow') estimatedDuration *= 1.25;
    else if (tag.id === 'excited') estimatedDuration *= 0.9;
    else if (tag.id === 'laugh' || tag.id === 'yawns' || tag.id === 'coughs') estimatedDuration += 1.0;
  }

  estimatedDuration = Math.max(1, Math.round(estimatedDuration * 10) / 10);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    detectedTags,
    invalidTags,
    wordCount,
    characterCount: trimmed.length,
    estimatedDurationSeconds: estimatedDuration,
    spokenText,
  };
}
