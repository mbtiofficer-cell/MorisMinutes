import { GoogleGenAI } from '@google/genai';
import { MeetingAnalysisResult, MinutesLanguage, TranscriptFormat, MinutesTone, MeetingMetadata } from '../types';
import { buildMeetingPrompt } from './promptBuilder';
import { parseMeetingJsonResponse } from './jsonParser';

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

  // 1. Check process.env if injected by Vite
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    cachedApiKey = process.env.GEMINI_API_KEY;
    return cachedApiKey;
  }

  // 2. Fetch from lightweight local config route with content-type verification
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
      } else {
        const text = await res.text();
        console.warn('/api/config returned non-JSON response:', text.slice(0, 80));
      }
    }
  } catch (err) {
    console.warn('Could not fetch apiKey from /api/config:', err);
  }

  throw new Error('GEMINI_API_KEY is not configured. Please ensure it is set in your environment.');
}

/**
 * Direct client-side Gemini API call using the Gemini Files API (`ai.files.upload`).
 *
 * 1. Uploads the compressed audio blob directly to the Gemini Files API from the browser.
 * 2. Polls until the file state becomes ACTIVE.
 * 3. Passes the file object URI ({ fileData: { fileUri, mimeType } }) directly into model.generateContent.
 * 4. Generates verbatim transcription and executive meeting minutes in the user-selected languages and format.
 * 5. Cleans up the temporary Gemini Files API resource after processing.
 */
export async function generateMinutesDirectly(
  audioBlob: Blob,
  filename: string,
  options?: DirectGenerationOptions | string,
  onStatus?: (status: string) => void
): Promise<{ success: boolean; modelUsed: string; fileUriUsed: string; data: MeetingAnalysisResult }> {
  // Support both options object and legacy additionalContext string
  const opts: DirectGenerationOptions = typeof options === 'string'
    ? { additionalContext: options }
    : (options || {});

  const minutesLanguage = opts.minutesLanguage || 'English';
  const transcriptFormat = opts.transcriptFormat || 'original';
  const minutesTone = opts.minutesTone || 'diplomatic';
  const additionalContext = opts.additionalContext;

  onStatus?.('Initializing direct client-side connection to Gemini API...');
  const apiKey = await getClientApiKey();

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  let uploadedFile: any = null;

  try {
    // 1. Upload audio file blob using the Gemini Files API directly from browser
    onStatus?.('Uploading compressed audio to Gemini Files API from browser...');
    const uploadDisplayName = filename || `recording_${Date.now()}.mp3`;

    uploadedFile = await ai.files.upload({
      file: audioBlob,
      config: {
        mimeType: 'audio/mp3',
        displayName: uploadDisplayName,
      },
    });

    console.log('[Client Files API] Uploaded file:', uploadedFile.name, 'URI:', uploadedFile.uri, 'State:', uploadedFile.state);

    // 2. Wait for the file state to become ACTIVE
    let fileState = uploadedFile.state;
    let pollCount = 0;
    while ((fileState === 'PROCESSING' || !fileState) && pollCount < 35) {
      onStatus?.(`Processing audio in Gemini Files API (${pollCount + 1}/35)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const fileCheck = await ai.files.get({ name: uploadedFile.name });
        fileState = fileCheck.state;
      } catch (checkErr) {
        console.warn('Could not check file state:', checkErr);
      }
      pollCount++;
    }

    if (fileState === 'FAILED') {
      throw new Error('Gemini Files API audio processing failed. The audio file could not be prepared.');
    }

    // Verify file state is strictly ACTIVE before calling generateContent
    if (fileState !== 'ACTIVE') {
      try {
        const fileFinalCheck = await ai.files.get({ name: uploadedFile.name });
        fileState = fileFinalCheck.state;
      } catch {
        // ignore
      }
      if (fileState !== 'ACTIVE') {
        throw new Error(`Audio file state is "${fileState || 'PENDING'}". Audio must be in ACTIVE state before generating minutes.`);
      }
    }

    onStatus?.(`Audio ACTIVE in Gemini Files API. Generating minutes in ${minutesLanguage}...`);

    // 3. Pass the file object URI directly to model.generateContent
    const audioPart = {
      fileData: {
        fileUri: uploadedFile.uri,
        mimeType: uploadedFile.mimeType || 'audio/mp3',
      },
    };

    // Build dynamic prompt based on selected Minutes Language, Transcript Format & Tone
    const userPrompt = buildMeetingPrompt(
      minutesLanguage,
      transcriptFormat,
      minutesTone,
      additionalContext,
      opts.meetingMetadata
    );

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
    ];

    let response: any = null;
    let modelUsed = candidateModels[0];
    let lastError: any = null;

    for (const modelCandidate of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          onStatus?.(`Transcribing audio with ${modelCandidate} directly via Gemini API${attempt > 1 ? ' (retry)' : ''}...`);
          const res = await ai.models.generateContent({
            model: modelCandidate,
            contents: {
              parts: [audioPart, { text: userPrompt }],
            },
            config: {
              responseMimeType: 'application/json',
              temperature: 0.15,
              maxOutputTokens: 8192,
            },
          });

          // Check if response text is present
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
            console.warn(`Model ${modelCandidate} returned empty text, checking candidate parts...`);
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Direct client call to ${modelCandidate} (attempt ${attempt}) failed:`, err?.message);
          if (attempt < 2 && (err?.status === 503 || err?.status === 429)) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }
      if (response) break;
    }

    // Extract text safely from response
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

    onStatus?.('Parsing and structuring executive meeting minutes...');
    const parsedData = parseMeetingJsonResponse(rawText, filename, minutesLanguage, opts.meetingMetadata);

    return {
      success: true,
      modelUsed,
      fileUriUsed: uploadedFile.uri,
      data: parsedData,
    };
  } finally {
    // 5. Clean up remote file from Gemini Files API after processing
    if (uploadedFile?.name) {
      try {
        console.log('[Client Files API] Cleaning up remote file:', uploadedFile.name);
        await ai.files.delete({ name: uploadedFile.name });
      } catch (cleanupErr: any) {
        console.warn('[Client Files API] Could not delete temporary remote file:', cleanupErr?.message);
      }
    }
  }
}
