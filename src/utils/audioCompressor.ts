import { Mp3Encoder } from '@breezystack/lamejs';

export interface CompressionProgress {
  stage: 'decoding' | 'resampling' | 'encoding' | 'done';
  percent: number;
  message: string;
}

export interface CompressionResult {
  compressedBlob: Blob;
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  durationSeconds: number;
}

/**
 * Downsamples and compresses an audio file in the browser to 16kHz Mono MP3 at 64kbps.
 * Uses Web Audio API (OfflineAudioContext) for hardware-accelerated resampling to 16kHz Mono,
 * followed by MP3 encoding.
 */
export async function compressAudioTo16kHzMono(
  file: File | Blob,
  fileName: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  const originalSize = file.size;

  onProgress?.({
    stage: 'decoding',
    percent: 10,
    message: 'Compressing audio file for upload... (reading audio data)',
  });

  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({
    stage: 'decoding',
    percent: 25,
    message: 'Compressing audio file for upload... (decoding audio stream)',
  });

  // Decode audio using AudioContext
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const tempAudioCtx = new AudioCtxClass();
  let decodedBuffer: AudioBuffer;

  try {
    decodedBuffer = await tempAudioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    try {
      await tempAudioCtx.close();
    } catch {
      // ignore
    }
  }

  const durationSeconds = decodedBuffer.duration;
  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.ceil(durationSeconds * targetSampleRate));

  onProgress?.({
    stage: 'resampling',
    percent: 45,
    message: 'Compressing audio file for upload... (downsampling to 16kHz Mono)',
  });

  // Use OfflineAudioContext to render downsampled mono channel
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = decodedBuffer;
  sourceNode.connect(offlineCtx.destination);
  sourceNode.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  const monoChannel = resampledBuffer.getChannelData(0);

  // Aggressive compression: 32kbps mono (16kHz).
  // For long recordings (> 65 mins, e.g. 91 minutes), dynamically downshift to 24kbps
  // to ensure the file strictly compresses under 15MB.
  let kbps = 32;
  if (durationSeconds > 65 * 60) {
    kbps = 24;
  }

  onProgress?.({
    stage: 'encoding',
    percent: 60,
    message: `Compressing audio file for upload... (encoding ${kbps}kbps Mono MP3)`,
  });

  // Convert Float32 [-1.0, 1.0] to Int16 PCM [-32768, 32767]
  const pcmSamples = new Int16Array(monoChannel.length);
  for (let i = 0; i < monoChannel.length; i++) {
    const s = Math.max(-1, Math.min(1, monoChannel[i]));
    pcmSamples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Encode to 16kHz Mono MP3 at 32kbps / 24kbps
  const encoder = new Mp3Encoder(1, targetSampleRate, kbps);
  const sampleBlockSize = 1152;
  const mp3DataParts: Uint8Array[] = [];

  const totalBlocks = Math.ceil(pcmSamples.length / sampleBlockSize);
  let processedBlocks = 0;

  for (let i = 0; i < pcmSamples.length; i += sampleBlockSize) {
    const chunk = pcmSamples.subarray(i, i + sampleBlockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3DataParts.push(new Uint8Array(mp3buf));
    }

    processedBlocks++;
    if (processedBlocks % 150 === 0) {
      const encodePercent = 60 + Math.round((processedBlocks / totalBlocks) * 35);
      onProgress?.({
        stage: 'encoding',
        percent: encodePercent,
        message: `Compressing audio file for upload... (${encodePercent}%)`,
      });
      // Yield thread briefly so browser doesn't block UI renders
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const flushBuf = encoder.flush();
  if (flushBuf.length > 0) {
    mp3DataParts.push(new Uint8Array(flushBuf));
  }

  const compressedBlob = new Blob(mp3DataParts as BlobPart[], { type: 'audio/mp3' });
  const compressedSize = compressedBlob.size;
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const compressedFileName = `${baseName}_16k_${kbps}k_mono.mp3`;

  const compressedFile = new File([compressedBlob], compressedFileName, {
    type: 'audio/mp3',
    lastModified: Date.now(),
  });

  onProgress?.({
    stage: 'done',
    percent: 100,
    message: 'Audio compressed successfully!',
  });

  return {
    compressedBlob,
    compressedFile,
    originalSize,
    compressedSize,
    compressionRatio: Math.round((1 - compressedSize / originalSize) * 100),
    durationSeconds,
  };
}
