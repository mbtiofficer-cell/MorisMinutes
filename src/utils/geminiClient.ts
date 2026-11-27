import { GoogleGenAI } from "@google/genai";
import { getAllVoiceProfiles } from "./voiceVault";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const CANDIDATE_MODELS = [PRIMARY_MODEL, FALLBACK_MODEL];

const PARAGRAPH_TRANSCRIPTION_PROMPT = `
Transcribe everything spoken in this audio recording into clear, complete paragraphs.
Rules:
- Capture all spoken content faithfully across Mauritian Creole (Morisyen), French, and English without summarizing away details or stopping early.
- Write in continuous, well-spaced paragraphs rather than Speaker 1 / Speaker 2 turn labels.
- Do not invent names or guess speakers; focus on capturing every word and idea accurately so it can be organized into minutes or assigned to speakers afterward.
- Keep natural phrasing and accurate terminology.
`.trim();

function resolveApiKey(explicitKey?: unknown): string {
  if (typeof explicitKey === "string" && explicitKey.trim()) {
    return explicitKey.trim();
  }
  try {
    const metaEnv = (import.meta as any)?.env || {};
    const fromVite =
      metaEnv.VITE_GEMINI_API_KEY ||
      metaEnv.VITE_API_KEY ||
      metaEnv.GEMINI_API_KEY ||
      "";
    if (typeof fromVite === "string" && fromVite.trim()) {
      return fromVite.trim();
    }
  } catch {
    // Ignore import.meta access issues outside module environments
  }
  try {
    const procEnv = (globalThis as any)?.process?.env || {};
    const fromProc =
      procEnv.GEMINI_API_KEY ||
      procEnv.VITE_GEMINI_API_KEY ||
      procEnv.API_KEY ||
      "";
    if (typeof fromProc === "string" && fromProc.trim()) {
      return fromProc.trim();
    }
  } catch {
    // Ignore process access issues in browser
  }
  return "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("500") ||
    msg.includes("504") ||
    msg.includes("timeout")
  );
}

async function callModelWithRetry(
  ai: GoogleGenAI,
  model: string,
  contents: any[]
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
      });
      const text = response?.text?.trim() || "";
      if (!text) {
        throw new Error(`${model} (attempt ${attempt}): empty response text`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === 3) {
        throw err;
      }
      await sleep(5000 * attempt);
    }
  }
  throw lastError;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export async function transcribeAudioToParagraphs(params: {
  apiKey?: string;
  audioBase64: string;
  mimeType: string;
  chunkIndex?: number;
  totalChunks?: number;
  includeVoiceVault?: boolean;
}): Promise<string> {
  const {
    apiKey: rawApiKey,
    audioBase64,
    mimeType,
    chunkIndex,
    totalChunks,
    includeVoiceVault = false,
  } = params;

  const apiKey = resolveApiKey(rawApiKey);
  if (!apiKey) {
    throw new Error("API key is missing. Please provide a valid API key.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const chunkNote =
    typeof chunkIndex === "number" && typeof totalChunks === "number"
      ? `\nSegment ${chunkIndex + 1} of ${totalChunks}: transcribe this segment completely into paragraphs.`
      : "";

  const parts: any[] = [
    {
      inlineData: {
        data: audioBase64,
        mimeType,
      },
    },
    {
      text: `${PARAGRAPH_TRANSCRIPTION_PROMPT}${chunkNote}`,
    },
  ];

  if (includeVoiceVault) {
    const savedVoices = (await getAllVoiceProfiles()).slice(0, 8);
    if (savedVoices.length > 0) {
      const names = savedVoices.map((v: any) => v.name).filter(Boolean);
      if (names.length > 0) {
        parts.push({
          text: `Optional reference names if clearly stated: ${names.join(", ")}. Still write in clean paragraphs without forcing speaker labels.`,
        });
      }
    }
  }

  let lastError: unknown;
  for (const model of CANDIDATE_MODELS) {
    try {
      return await callModelWithRetry(ai, model, parts);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function generateMinutesDirectly(...args: any[]): Promise<any> {
  const targetFile = args[0];
  const targetName = typeof args[1] === "string" ? args[1] : "";
  const options = args[2] && typeof args[2] === "object" ? args[2] : {};

  const apiKey = resolveApiKey(
    options.apiKey ||
      options.geminiApiKey ||
      (typeof targetFile === "object" && targetFile ? targetFile.apiKey : "")
  );

  let audioBase64 = "";
  let mimeType = options.mimeType || "audio/webm";

  if (
    targetFile instanceof Blob ||
    (targetFile && typeof targetFile.arrayBuffer === "function")
  ) {
    mimeType = targetFile.type || mimeType;
    audioBase64 = await blobToBase64(targetFile as Blob);
  } else if (targetFile && typeof targetFile === "object") {
    audioBase64 =
      targetFile.audioBase64 ||
      targetFile.base64Audio ||
      targetFile.audioData ||
      targetFile.data ||
      "";
    mimeType = targetFile.mimeType || targetFile.type || mimeType;
  } else if (typeof targetFile === "string") {
    audioBase64 = targetFile.includes(",")
      ? targetFile.split(",")[1]
      : targetFile;
  }

  if (!audioBase64) {
    throw new Error(
      `No audio data found on targetFile (${targetName || "unnamed"}). Please select a valid audio file.`
    );
  }

  const paragraphText = await transcribeAudioToParagraphs({
    apiKey,
    audioBase64,
    mimeType,
    chunkIndex: options.chunkIndex,
    totalChunks: options.totalChunks,
    includeVoiceVault: false,
  });

  if (typeof options.onStatus === "function") {
    options.onStatus("Paragraph transcription complete.");
  }

  return {
    transcript: paragraphText,
    rawTranscript: paragraphText,
    minutes: paragraphText,
    summary: paragraphText,
    text: paragraphText,
  };
}