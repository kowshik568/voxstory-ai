/**
 * VoxStory AI - Broadcast WAV Audio Concatenator & Stitcher
 * Assembles multi-character dialogue segments into a single seamless continuous WAV master track
 */

/**
 * Extracts raw 16-bit mono PCM sample bytes from a base64 or binary WAV
 */
export function extractPcmFromWav(wavBytes: Uint8Array): { pcm: Uint8Array; sampleRate: number } {
  // Find 'data' chunk
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  let sampleRate = 24000;

  // Read sample rate from fmt chunk
  let offset = 12;
  let pcmOffset = 44;
  let pcmLength = wavBytes.byteLength - 44;

  while (offset < wavBytes.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      sampleRate = view.getUint32(offset + 12, true);
    } else if (chunkId === 'data') {
      pcmOffset = offset + 8;
      pcmLength = Math.min(chunkSize, wavBytes.byteLength - pcmOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  const pcm = wavBytes.subarray(pcmOffset, pcmOffset + pcmLength);
  return { pcm, sampleRate };
}

/**
 * Creates a standard 44-byte WAV header for 16-bit mono PCM
 */
export function createWavHeader(dataSize: number, sampleRate: number = 24000): Uint8Array {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');

  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  return new Uint8Array(buffer);
}

/**
 * Stitches an array of WAV data URIs into a single assembled master WAV
 */
export async function stitchWavTracks(
  wavDataUrls: string[],
  pauseDurationSeconds: number = 0.35,
  targetSampleRate: number = 24000
): Promise<{ dataUrl: string; durationSeconds: number; sizeBytes: number }> {
  const pcmChunks: Uint8Array[] = [];
  const pauseSamples = Math.floor(targetSampleRate * pauseDurationSeconds);
  const pauseBytes = new Uint8Array(pauseSamples * 2); // 16-bit silence (0x0000)

  let totalPcmBytes = 0;

  for (let i = 0; i < wavDataUrls.length; i++) {
    const url = wavDataUrls[i];
    let wavBytes: Uint8Array;

    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      const binaryString = atob(base64);
      wavBytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        wavBytes[j] = binaryString.charCodeAt(j);
      }
    } else {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      wavBytes = new Uint8Array(buf);
    }

    const { pcm } = extractPcmFromWav(wavBytes);
    pcmChunks.push(pcm);
    totalPcmBytes += pcm.byteLength;

    // Add conversational silence pause between dialogue lines (except after the final line)
    if (i < wavDataUrls.length - 1 && pauseDurationSeconds > 0) {
      pcmChunks.push(pauseBytes);
      totalPcmBytes += pauseBytes.byteLength;
    }
  }

  // Create unified output buffer
  const header = createWavHeader(totalPcmBytes, targetSampleRate);
  const assembled = new Uint8Array(44 + totalPcmBytes);
  assembled.set(header, 0);

  let currentOffset = 44;
  for (const chunk of pcmChunks) {
    assembled.set(chunk, currentOffset);
    currentOffset += chunk.byteLength;
  }

  // Calculate duration
  const totalSamples = totalPcmBytes / 2;
  const durationSeconds = Math.round((totalSamples / targetSampleRate) * 100) / 100;

  // Convert to Blob data URL
  const blob = new Blob([assembled.buffer as ArrayBuffer], { type: 'audio/wav' });
  const dataUrl = URL.createObjectURL(blob);

  return {
    dataUrl,
    durationSeconds,
    sizeBytes: assembled.byteLength,
  };
}
