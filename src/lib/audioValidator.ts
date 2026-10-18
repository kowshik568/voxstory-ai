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
  peakAmplitude?: number; // 0.0 to 1.0
  rmsEnergy?: number; // 0.0 to 1.0
  isClipping?: boolean;
  isSilent?: boolean;
  warnings?: string[];
  errors: string[];
}

/**
 * Validates a WAV buffer (Uint8Array, Buffer, or ArrayBuffer)
 */
export function validateWavBuffer(input: Uint8Array | ArrayBuffer | Buffer): WavHeaderInfo {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const errors: string[] = [];
  const warnings: string[] = [];

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
  let dataChunkOffset = 0;
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

    // Prevent integer overflow / infinite loop if chunkSize corrupted
    if (chunkSize > bytes.length) {
      warnings.push(`Chunk "${chunkId}" declares size ${chunkSize} exceeding total buffer length`);
    }

    if (chunkId === 'fmt ') {
      foundFmt = true;
      if (chunkSize >= 16 && offset + 8 + 16 <= bytes.length) {
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
      dataChunkOffset = offset + 8;
    }

    offset += 8 + chunkSize;
    // Align to 2-byte boundary
    if (chunkSize % 2 !== 0) offset += 1;
    if (offset < 0) break; // Overflow guard
  }

  if (!foundFmt) {
    errors.push('Missing "fmt " chunk in WAV header');
  }

  // Handle streaming/chunked WAV where dataSizeBytes is either omitted, 0xFFFFFFFF, or oversized
  const maxSafeData = Math.max(0, bytes.length - (dataChunkOffset || 44));
  const effectiveDataSize =
    foundData && dataSizeBytes > 0 && dataSizeBytes <= maxSafeData
      ? dataSizeBytes
      : maxSafeData;

  const bytesPerSample = (bitsPerSample || 16) / 8;
  const channelCount = numChannels || 1;
  const rate = sampleRate || 24000;
  const durationSeconds =
    rate > 0 && channelCount > 0 && bytesPerSample > 0
      ? Math.round((effectiveDataSize / (rate * channelCount * bytesPerSample)) * 100) / 100
      : 0;

  // Audio Signal Analysis: Peak, RMS, Clipping, and Silence Detection
  let peakAmplitude = 0;
  let sumSquares = 0;
  let clippingCount = 0;
  let sampleCount = 0;

  if (formatTag === 1 && bitsPerSample === 16 && bytes.length >= 44 + 2) {
    const dataStart = foundData && dataChunkOffset > 0 ? dataChunkOffset : 44;
    const startIdx = Math.max(44, Math.min(bytes.length - 2, dataStart));
    const endIdx = Math.min(bytes.length, startIdx + effectiveDataSize);

    for (let i = startIdx; i + 1 < endIdx; i += 2) {
      const val = view.getInt16(i, true);
      const normalized = Math.abs(val) / 32768.0;

      if (normalized > peakAmplitude) {
        peakAmplitude = normalized;
      }
      sumSquares += normalized * normalized;
      sampleCount++;

      // Detect clipping (sample hitting absolute digital ceiling)
      if (val >= 32767 || val <= -32768) {
        clippingCount++;
      }
    }
  }

  const rmsEnergy = sampleCount > 0 ? Math.round(Math.sqrt(sumSquares / sampleCount) * 1000) / 1000 : 0;
  const isClipping = clippingCount > 4; // Multiple consecutive or frequent clipped samples
  const isSilent = sampleCount > 0 && rmsEnergy < 0.0005;

  if (isClipping) {
    warnings.push(`Audio clipping warning: ${clippingCount} full-scale digital limit samples found.`);
  }
  if (isSilent) {
    warnings.push('Audio signal is extremely quiet or near silence (RMS < 0.0005).');
  }

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
    dataSizeBytes: effectiveDataSize,
    durationSeconds,
    fileSizeBytes: bytes.length,
    peakAmplitude: Math.round(peakAmplitude * 1000) / 1000,
    rmsEnergy,
    isClipping,
    isSilent,
    warnings,
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
