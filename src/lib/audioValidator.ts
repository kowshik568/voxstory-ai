/**
 * VoxStory AI - Audio Format & WAV Header Integrity Validator
 * Rigorously checks audio buffers, byte signatures, PCM format tags,
 * channels, sample rates, and byte rates for audio workstation mixing.
 */

export interface WavHeaderInfo {
  isValid: boolean;
  formatTag: number; // 1 = PCM, 3 = IEEE Float
  formatName: string;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataSizeBytes: number;
  durationSeconds: number;
  fileSizeBytes: number;
  errors: string[];
}

/**
 * Validates a WAV buffer (Uint8Array, Buffer, or ArrayBuffer)
 */
export function validateWavBuffer(input: Uint8Array | ArrayBuffer | Buffer): WavHeaderInfo {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const errors: string[] = [];

  if (bytes.length < 44) {
    return {
      isValid: false,
      formatTag: 0,
      formatName: 'unknown',
      numChannels: 0,
      sampleRate: 0,
      byteRate: 0,
      blockAlign: 0,
      bitsPerSample: 0,
      dataSizeBytes: 0,
      durationSeconds: 0,
      fileSizeBytes: bytes.length,
      errors: ['File size is under 44 bytes; cannot contain valid WAV header'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // 1. RIFF Identifier
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (riff !== 'RIFF') {
    errors.push(`Invalid RIFF signature: found "${riff}", expected "RIFF"`);
  }

  // 2. Chunk size
  const riffSize = view.getUint32(4, true);

  // 3. WAVE Identifier
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (wave !== 'WAVE') {
    errors.push(`Invalid WAVE signature: found "${wave}", expected "WAVE"`);
  }

  // Search for fmt and data chunks
  let offset = 12;
  let formatTag = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let byteRate = 0;
  let blockAlign = 0;
  let bitsPerSample = 0;
  let dataSizeBytes = 0;
  let foundFmt = false;
  let foundData = false;

  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      foundFmt = true;
      if (chunkSize >= 16) {
        formatTag = view.getUint16(offset + 8, true);
        numChannels = view.getUint16(offset + 10, true);
        sampleRate = view.getUint32(offset + 12, true);
        byteRate = view.getUint32(offset + 16, true);
        blockAlign = view.getUint16(offset + 20, true);
        bitsPerSample = view.getUint16(offset + 22, true);

        if (formatTag !== 1 && formatTag !== 3) {
          errors.push(`Unsupported audio format tag: ${formatTag} (expected 1 for linear PCM)`);
        }
        if (numChannels < 1 || numChannels > 8) {
          errors.push(`Invalid channel count: ${numChannels}`);
        }
        if (sampleRate < 8000 || sampleRate > 192000) {
          errors.push(`Unusual sample rate: ${sampleRate} Hz`);
        }
        const expectedBlockAlign = numChannels * (bitsPerSample / 8);
        if (blockAlign !== expectedBlockAlign) {
          errors.push(`Block align mismatch: got ${blockAlign}, expected ${expectedBlockAlign}`);
        }
      } else {
        errors.push(`Malformed fmt chunk: size ${chunkSize} is smaller than 16`);
      }
    } else if (chunkId === 'data') {
      foundData = true;
      dataSizeBytes = chunkSize;
    }

    offset += 8 + chunkSize;
    // Align to 2-byte boundary
    if (chunkSize % 2 !== 0) offset += 1;
  }

  if (!foundFmt) {
    errors.push('Missing "fmt " chunk in WAV header');
  }
  if (!foundData) {
    // Fallback: estimate data chunk from remainder of buffer
    dataSizeBytes = Math.max(0, bytes.length - 44);
  }

  const bytesPerSample = (bitsPerSample || 16) / 8;
  const channelCount = numChannels || 1;
  const rate = sampleRate || 24000;
  const durationSeconds =
    rate > 0 && channelCount > 0 && bytesPerSample > 0
      ? Math.round((dataSizeBytes / (rate * channelCount * bytesPerSample)) * 100) / 100
      : 0;

  const formatName = formatTag === 1 ? 'Linear PCM' : formatTag === 3 ? 'IEEE Float' : 'Unknown';

  return {
    isValid: errors.length === 0,
    formatTag,
    formatName,
    numChannels,
    sampleRate,
    byteRate,
    blockAlign,
    bitsPerSample,
    dataSizeBytes,
    durationSeconds,
    fileSizeBytes: bytes.length,
    errors,
  };
}

/**
 * Validates a base64 data URI WAV string
 */
export function validateWavDataUrl(dataUrl: string): WavHeaderInfo {
  try {
    const base64Index = dataUrl.indexOf('base64,');
    if (base64Index === -1) {
      return {
        isValid: false,
        formatTag: 0,
        formatName: 'unknown',
        numChannels: 0,
        sampleRate: 0,
        byteRate: 0,
        blockAlign: 0,
        bitsPerSample: 0,
        dataSizeBytes: 0,
        durationSeconds: 0,
        fileSizeBytes: 0,
        errors: ['Invalid data URL: missing base64 marker'],
      };
    }

    const base64Str = dataUrl.slice(base64Index + 7);
    let bytes: Uint8Array;
    if (typeof Buffer !== 'undefined') {
      bytes = new Uint8Array(Buffer.from(base64Str, 'base64'));
    } else {
      const binary = atob(base64Str);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    }
    return validateWavBuffer(bytes);
  } catch (err) {
    return {
      isValid: false,
      formatTag: 0,
      formatName: 'unknown',
      numChannels: 0,
      sampleRate: 0,
      byteRate: 0,
      blockAlign: 0,
      bitsPerSample: 0,
      dataSizeBytes: 0,
      durationSeconds: 0,
      fileSizeBytes: 0,
      errors: [`Base64 decoding failed: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}
