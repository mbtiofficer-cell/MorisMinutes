import { GoogleGenAI } from '@google/genai';
import { MeetingAnalysisResult, MinutesLanguage, TranscriptFormat, MinutesTone, MeetingMetadata, ActionItem, KeyTopic } from '../types';
import { buildMeetingPrompt } from './promptBuilder';
import { parseMeetingJsonResponse } from './jsonParser';
import { getAllVoiceProfiles } from './voiceVault';

export interface DirectGenerationOptions {
  minutesLanguage?: MinutesLanguage;
  transcriptFormat?: TranscriptFormat;
  minutesTone?: MinutesTone;
  additionalContext?: string;
  meetingMetadata?: MeetingMetadata;
}

let cachedApiKey: string | null = null;

export async function getClientApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    cachedApiKey = process.env.GEMINI_API_KEY;
    return cachedApiKey;
  }

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.apiKey) {
          cachedApiKey = data.apiKey;
          return data.apiKey;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch apiKey from /api/config:', err);
  }

  throw new Error('GEMINI_API_KEY is not configured. Please ensure it is set in your environment.');
}

async function waitForFileActive(ai: GoogleGenAI, fileObj: any, onStatus?: (msg: string) => void): Promise<any> {
  let fileState = fileObj.state;
  let pollCount = 0;
  while ((fileState === 'PROCESSING' || !fileState) && pollCount < 60) {
    onStatus?.(`Preparing audio in Gemini (${pollCount + 1}/60)...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const fileCheck = await ai.files.get({ name: fileObj.name });
      fileState = fileCheck.state;
    } catch (checkErr) {
      console.warn('Could not check file state:', checkErr);
    }
    pollCount++;
  }

  if (fileState === 'FAILED') {
    throw new Error('Gemini Files API audio processing failed. The audio file could not be prepared.');
  }

  if (fileState !== 'ACTIVE') {
    try {
      const fileFinalCheck = await ai.files.get({ name: fileObj.name });
      fileState = fileFinalCheck.state;
    } catch {
      // ignore
    }
    if (fileState !== 'ACTIVE') {
      throw new Error(`Audio file state is "${fileState || 'PENDING'}". Audio must be in ACTIVE state before generating minutes.`);
    }
  }

  return fileObj;
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const channelData = buffer.getChannelData(0);
  const bytesPerSample = 2;
  const dataSize = length * numChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function splitAudioIntoChunks(
  audioBlob: Blob,
  filename: string,
  chunkSeconds: number = 600,
  onStatus?: (status: string) => void
): Promise<Array<{ blob: Blob; name: string; offsetSeconds: number }>> {
  const AudioCtx = typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null;

  if (!AudioCtx || audioBlob.size < 2 * 1024 * 1024) {
    return [{ blob: audioBlob, name: filename || `recording_${Date.now()}.mp3`, offsetSeconds: 0 }];
  }

  let audioContext: AudioContext | null = null;
  try {
    onStatus?.('Checking recording length for automatic chunking...');
    const arrayBuffer = await audioBlob.arrayBuffer();
    audioContext = new AudioCtx();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    if (decoded.duration <= chunkSeconds + 30) {
      return [{ blob: audioBlob, name: filename || `recording_${Date.now()}.mp3`, offsetSeconds: 0 }];
    }

    const chunks: Array<{ blob: Blob; name: string; offsetSeconds: number }> = [];
    const totalChunks = Math.ceil(decoded.duration / chunkSeconds);
    const baseName = (filename || 'recording').replace(/\.[^/.]+$/, '');

    for (let i = 0; i < totalChunks; i++) {
      const startSec = i * chunkSeconds;
      const endSec = Math.min(decoded.duration, (i + 1) * chunkSeconds);
      const frameStart = Math.floor(startSec * decoded.sampleRate);
      const frameCount = Math.max(1, Math.floor((endSec - startSec) * decoded.sampleRate));

      const segmentBuffer = audioContext.createBuffer(1, frameCount, decoded.sampleRate);
      const srcChannel = decoded.getChannelData(0);
      const dstChannel = segmentBuffer.getChannelData(0);
      for (let j = 0; j < frameCount; j++) {
        dstChannel[j] = srcChannel[frameStart + j] || 0;
      }

      chunks.push({
        blob: audioBufferToWavBlob(segmentBuffer),
        name: `${baseName}_part_${i + 1}_of_${totalChunks}.wav`,
        offsetSeconds: startSec,
      });
    }

    return chunks;
  } catch (err) {
    console.warn('Could not decode audio in browser for chunking; sending whole file:', err);
    return [{ blob: audioBlob, name: filename || `recording_${Date.now()}.mp3`, offsetSeconds: 0 }];
  } finally {
    if (audioContext) {
      try {
        await audioContext.close();
      } catch {
        // ignore
      }
    }
  }
}

function offsetTranscriptTimestamps(transcript: string, offsetSeconds: number): string {
  if (!transcript || offsetSeconds <= 0) return transcript;
  return transcript.replace(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g, (_match, a, b, c) => {
    const totalSec = c !== undefined
      ? Number(a) * 3600 + Number(b) * 60 + Number(c) + Math.floor(offsetSeconds)
      : Number(a) * 60 + Number(b) + Math.floor(offsetSeconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `[${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
    }
    return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
  });
}

function mergeChunkResults(
  partResults: Array<{ data: MeetingAnalysisResult; offsetSeconds: number; index: number; total: number }>,
  filename: string,
  opts: DirectGenerationOptions
): MeetingAnalysisResult {
  const validParts = partResults.filter((p) => p.data.verbatimTranscript.trim() || p.data.executiveMinutes.keyTopicsDiscussed.length > 0);
  const base = validParts[0]?.data || partResults[0].data;

  const transcripts = partResults
    .map((p) => {
      const shifted = offsetTranscriptTimestamps(p.data.verbatimTranscript || '', p.offsetSeconds);
      return shifted.trim() ? `[Part ${p.index + 1} of ${p.total}]\n${shifted.trim()}` : '';
    })
    .filter(Boolean);

  const speakerSet = new Set<string>();
  const overviews: string[] = [];
  const keyTopics: KeyTopic[] = [];
  const decisions: string[] = [];
  const actionItems: ActionItem[] = [];
  const nextSteps: string[] = [];
  const expressionsMap = new Map<string, any>();
  const diagnostics: string[] = [];

  for (const part of partResults) {
    for (const spk of part.data.speakersIdentified || []) {
      if (spk && spk.trim()) speakerSet.add(spk.trim());
    }
    const ov = part.data.executiveMinutes?.meetingOverview?.trim();
    if (ov) {
      if (ov.startsWith('Gemini returned no output. Diagnostics:')) {
        diagnostics.push(`Part ${part.index + 1}: ${ov}`);
      } else {
        overviews.push(`Part ${part.index + 1}: ${ov}`);
      }
    }
    for (const kt of part.data.executiveMinutes?.keyTopicsDiscussed || []) {
      keyTopics.push(kt);
    }
    for (const dec of part.data.executiveMinutes?.decisions || []) {
      if (dec && !decisions.includes(dec)) decisions.push(dec);
    }
    for (const act of part.data.executiveMinutes?.actionItems || []) {
      actionItems.push(act);
    }
    for (const step of part.data.executiveMinutes?.nextSteps || []) {
      if (step && !nextSteps.includes(step)) nextSteps.push(step);
    }
    for (const expr of part.data.languageAnalysis?.creoleExpressionsIdentified || []) {
      if (expr?.phrase && !expressionsMap.has(expr.phrase)) {
        expressionsMap.set(expr.phrase, expr);
      }
    }
  }

  const speakers = Array.from(speakerSet);
  const attendeesCount = opts.meetingMetadata?.attendeesCount?.trim()
    || (speakers.length > 0 ? `${speakers.length} Speakers` : base.attendeesCount);
  const attendeesPresent = opts.meetingMetadata?.attendeesPresent?.trim()
    || (speakers.length > 0 ? speakers.join(', ') : base.attendeesPresent);

  const finalOverview = overviews.length > 0
    ? overviews.join('\n\n')
    : (diagnostics.join(' | ') || base.executiveMinutes.meetingOverview);

  return {
    ...base,
    meetingTitle: filename ? `Executive Minutes: ${filename.replace(/\.[^/.]+$/, '')}` : base.meetingTitle,
    attendeesCount,
    attendeesPresent,
    meetingMetadata: {
      ...base.meetingMetadata,
      attendeesCount,
      attendeesPresent,
    },
    speakersIdentified: speakers,
    languageAnalysis: {
      ...base.languageAnalysis,
      creoleExpressionsIdentified: Array.from(expressionsMap.values()),
    },
    verbatimTranscript: transcripts.join('\n\n'),
    executiveMinutes: {
      meetingOverview: finalOverview,
      keyTopicsDiscussed: keyTopics,
      decisions,
      actionItems,
      nextSteps,
    },
    fullMarkdownOutput: transcripts.join('\n\n'),
  };
}

async function runSingleAudioPart(
  ai: GoogleGenAI,
  partBlob: Blob,
  partName: string,
  referenceVoiceParts: any[],
  referenceVoiceNames: string[],
  minutesLanguage: MinutesLanguage,
  transcriptFormat: TranscriptFormat,
  minutesTone: MinutesTone,
  additionalContext: string | undefined,
  meetingMetadata: MeetingMetadata | undefined,
  filesToCleanup: string[],
  onStatus?: (status: string) => void
): Promise<{ modelUsed: string; fileUriUsed: string; data: MeetingAnalysisResult; hasText: boolean }> {
  onStatus?.(`Uploading ${partName} to Gemini...`);
  const mimeType = partBlob.type || 'audio/mp3';

  const uploadedFile = await ai.files.upload({
    file: partBlob,
    config: {
      mimeType,
      displayName: partName,
    },
  });
  filesToCleanup.push(uploadedFile.name);

  await waitForFileActive(ai, uploadedFile, onStatus);

  const mainAudioPart = {
    fileData: {
      fileUri: uploadedFile.uri,
      mimeType: uploadedFile.mimeType || mimeType,
    },
  };

  const speakerInstruction = referenceVoiceNames.length > 0
    ? additionalContext
    : [
        additionalContext || '',
        'Label distinct speakers dynamically as Speaker 1, Speaker 2, etc. (or use their actual spoken name/role only if explicitly stated in the recording). Do not guess or invent speaker names.',
      ]
        .filter(Boolean)
        .join(' ');

  const userPrompt = buildMeetingPrompt(
    minutesLanguage,
    transcriptFormat,
    minutesTone,
    speakerInstruction,
    meetingMetadata,
    referenceVoiceNames
  );

  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
  ];

  let response: any = null;
  let modelUsed = candidateModels[0];
  const failureReasons: string[] = [];

  for (const modelCandidate of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        onStatus?.(`Transcribing ${partName} with ${modelCandidate}${attempt > 1 ? ' (retry)' : ''}...`);
        const res = await ai.models.generateContent({
          model: modelCandidate,
          contents: {
            parts: [...referenceVoiceParts, mainAudioPart, { text: userPrompt }],
          },
          config: {
            responseMimeType: 'application/json',
            temperature: 0.15,
            maxOutputTokens: 32768,
          },
        });

        let candidateText = '';
        if (typeof res?.text === 'string' && res.text.trim()) {
          candidateText = res.text.trim();
        } else if (res?.candidates?.[0]?.content?.parts) {
          candidateText = res.candidates[0].content.parts
            .map((p: any) => p.text || '')
            .join('')
            .trim();
        }

        if (candidateText) {
          response = res;
          modelUsed = modelCandidate;
          break;
        } else {
          const finishReason = res?.candidates?.[0]?.finishReason || 'EMPTY_TEXT';
          failureReasons.push(`${modelCandidate} (attempt ${attempt}): empty response (${finishReason})`);
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.warn(`Direct client call to ${modelCandidate} (attempt ${attempt}) failed:`, msg);
        failureReasons.push(`${modelCandidate} (attempt ${attempt}): ${msg}`);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    if (response) break;
  }

  let rawText = '';
  if (response) {
    if (typeof response.text === 'string' && response.text.trim()) {
      rawText = response.text.trim();
    } else if (response.candidates?.[0]?.content?.parts) {
      rawText = response.candidates[0].content.parts
        .map((p: any) => p.text || '')
        .join('')
        .trim();
    }
  }

  const parsedData = parseMeetingJsonResponse(rawText, partName, minutesLanguage, meetingMetadata);

  if (!rawText && failureReasons.length > 0) {
    parsedData.executiveMinutes.meetingOverview = `Gemini returned no output. Diagnostics: ${failureReasons.slice(-2).join(' | ')}`;
  }

  return {
    modelUsed,
    fileUriUsed: uploadedFile.uri,
    data: parsedData,
    hasText: Boolean(rawText),
  };
}

export async function generateMinutesDirectly(
  audioBlob: Blob,
  filename: string,
  options?: DirectGenerationOptions | string,
  onStatus?: (status: string) => void
): Promise<{ success: boolean; modelUsed: string; fileUriUsed: string; data: MeetingAnalysisResult }> {
  const opts: DirectGenerationOptions = typeof options === 'string'
    ? { additionalContext: options }
    : (options || {});

  const minutesLanguage = opts.minutesLanguage || 'English';
  const transcriptFormat = opts.transcriptFormat || 'original';
  const minutesTone = opts.minutesTone || 'diplomatic';
  const additionalContext = opts.additionalContext;

  onStatus?.('Connecting to Gemini API...');
  const apiKey = await getClientApiKey();

  const ai = new GoogleGenAI({ apiKey });

  const filesToCleanup: string[] = [];

  try {
    const savedVoices = (await getAllVoiceProfiles()).slice(0, 8);
    const referenceVoiceParts: any[] = [];
    const referenceVoiceNames: string[] = [];

    if (savedVoices.length > 0) {
      onStatus?.(`Loading ${savedVoices.length} saved voice(s) from Voice Vault...`);
      const uploadedRefs = await Promise.all(
        savedVoices.map(async (vp, i) => {
          try {
            const uploadedRef = await ai.files.upload({
              file: vp.clipBlob,
              config: {
                mimeType: vp.clipBlob.type || 'audio/wav',
                displayName: `voice_ref_${i + 1}_${vp.name.replace(/\s+/g, '_')}.wav`,
              },
            });
            filesToCleanup.push(uploadedRef.name);
            await waitForFileActive(ai, uploadedRef);
            return {
              name: vp.name,
              part: {
                fileData: {
                  fileUri: uploadedRef.uri,
                  mimeType: uploadedRef.mimeType || 'audio/wav',
                },
              },
            };
          } catch (refErr) {
            console.warn(`Skipping voice reference for ${vp.name}:`, refErr);
            return null;
          }
        })
      );

      for (const item of uploadedRefs) {
        if (item) {
          referenceVoiceNames.push(item.name);
          referenceVoiceParts.push(item.part);
        }
      }
    }

    const chunks = await splitAudioIntoChunks(audioBlob, filename, 600, onStatus);
    const collected: Array<{ data: MeetingAnalysisResult; offsetSeconds: number; index: number; total: number }> = [];
    let lastModelUsed = 'gemini-2.5-flash';
    let lastFileUri = '';
    let anySuccess = false;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const label = chunks.length > 1 ? `${chunk.name} (${i + 1}/${chunks.length})` : chunk.name;
      const partOut = await runSingleAudioPart(
        ai,
        chunk.blob,
        label,
        referenceVoiceParts,
        referenceVoiceNames,
        minutesLanguage,
        transcriptFormat,
        minutesTone,
        additionalContext,
        opts.meetingMetadata,
        filesToCleanup,
        onStatus
      );

      lastModelUsed = partOut.modelUsed;
      lastFileUri = partOut.fileUriUsed;
      if (partOut.hasText) anySuccess = true;

      collected.push({
        data: partOut.data,
        offsetSeconds: chunk.offsetSeconds,
        index: i,
        total: chunks.length,
      });
    }

    onStatus?.('Formatting executive minutes...');
    const finalData = chunks.length === 1
      ? collected[0].data
      : mergeChunkResults(collected, filename, opts);

    return {
      success: anySuccess,
      modelUsed: lastModelUsed,
      fileUriUsed: lastFileUri,
      data: finalData,
    };
  } finally {
    for (const remoteName of filesToCleanup) {
      try {
        await ai.files.delete({ name: remoteName });
      } catch (cleanupErr: any) {
        console.warn('[Client Files API] Could not delete temporary remote file:', cleanupErr?.message);
      }
    }
  }
}