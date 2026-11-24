import { GoogleGenAI } from '@google/genai';
import { MeetingAnalysisResult, MinutesLanguage, TranscriptFormat, MinutesTone, MeetingMetadata } from '../types';
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
  while ((fileState === 'PROCESSING' || !fileState) && pollCount < 30) {
    onStatus?.(`Preparing audio in Gemini (${pollCount + 1}/30)...`);
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
    // 1. Load & upload saved Voice Vault profiles in parallel
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

    // 2. Upload main meeting audio blob
    onStatus?.('Uploading meeting audio to Gemini...');
    const uploadDisplayName = filename || `recording_${Date.now()}.mp3`;
    const mimeType = audioBlob.type || 'audio/mp3';

    const uploadedFile = await ai.files.upload({
      file: audioBlob,
      config: {
        mimeType,
        displayName: uploadDisplayName,
      },
    });
    filesToCleanup.push(uploadedFile.name);

    await waitForFileActive(ai, uploadedFile, onStatus);

    onStatus?.(
      referenceVoiceNames.length > 0
        ? `Matching ${referenceVoiceNames.length} saved voice(s) & generating minutes...`
        : `Generating executive minutes in ${minutesLanguage}...`
    );

    const mainAudioPart = {
      fileData: {
        fileUri: uploadedFile.uri,
        mimeType: uploadedFile.mimeType || mimeType,
      },
    };

    const userPrompt = buildMeetingPrompt(
      minutesLanguage,
      transcriptFormat,
      minutesTone,
      additionalContext,
      opts.meetingMetadata,
      referenceVoiceNames
    );

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ];

    let response: any = null;
    let modelUsed = candidateModels[0];

    for (const modelCandidate of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          onStatus?.(`Transcribing & drafting minutes with ${modelCandidate}${attempt > 1 ? ' (retry)' : ''}...`);
          const res = await ai.models.generateContent({
            model: modelCandidate,
            contents: {
              parts: [...referenceVoiceParts, mainAudioPart, { text: userPrompt }],
            },
            config: {
              responseMimeType: 'application/json',
              temperature: 0.15,
              maxOutputTokens: 8192,
              thinkingConfig: { thinkingBudget: 0 },
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
          }
        } catch (err: any) {
          console.warn(`Direct client call to ${modelCandidate} (attempt ${attempt}) failed:`, err?.message);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000));
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

    onStatus?.('Formatting executive minutes...');
    const parsedData = parseMeetingJsonResponse(rawText, filename, minutesLanguage, opts.meetingMetadata);

    return {
      success: true,
      modelUsed,
      fileUriUsed: uploadedFile.uri,
      data: parsedData,
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