import { GoogleGenAI } from "@google/genai";
import { getAllVoiceProfiles } from "./voiceVault";

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const CANDIDATE_MODELS = [PRIMARY_MODEL, FALLBACK_MODEL];
const REQUEST_TIMEOUT_MS = 90000;

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

function extractResponseText(response: any): string {
  if (!response) return "";
  if (typeof response.text === "string" && response.text.trim()) {
    return response.text.trim();
  }
  const candidates = response.candidates || response.response?.candidates || [];
  const collected: string[] = [];
  for (const cand of candidates) {
    const parts = cand?.content?.parts || [];
    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        collected.push(part.text.trim());
      }
    }
  }
  return collected.join("\n\n").trim();
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
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("empty response")
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callModelWithRetry(
  ai: GoogleGenAI,
  model: string,
  contents: any[],
  onStatus?: (msg: string) => void
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof onStatus === "function") {
        onStatus(`Transcribing with ${model} (attempt ${attempt}/2)...`);
      }
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents,
        }),
        REQUEST_TIMEOUT_MS,
        `${model} request`
      );
      const text = extractResponseText(response);
      if (!text) {
        throw new Error(`${model} (attempt ${attempt}): empty response text`);
      }
      return text;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === 2) {
        throw err;
      }
      if (typeof onStatus === "function") {
        onStatus(`Retrying ${model} in ${attempt * 3}s...`);
      }
      await sleep(3000 * attempt);
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
  onStatus?: (msg: string) => void;
}): Promise<string> {
  const {
    apiKey: rawApiKey,
    audioBase64,
    mimeType,
    chunkIndex,
    totalChunks,
    includeVoiceVault = false,
    onStatus,
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
      return await callModelWithRetry(ai, model, parts, onStatus);
    } catch (err) {
      lastError = err;
      if (typeof onStatus === "function") {
        onStatus(`Switching from ${model} to next model...`);
      }
    }
  }
  throw lastError;
}

export async function generateMinutesDirectly(...args: any[]): Promise<any> {
  const targetFile = args[0];
  const targetName = typeof args[1] === "string" ? args[1] : "";
  const options = args[2] && typeof args[2] === "object" ? args[2] : {};
  const onStatus =
    typeof options.onStatus === "function" ? options.onStatus : undefined;

  if (onStatus) {
    onStatus("Checking API key and preparing audio...");
  }

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
    const sizeMb =
      typeof targetFile.size === "number"
        ? (targetFile.size / (1024 * 1024)).toFixed(1)
        : "?";
    if (onStatus) {
      onStatus(`Reading audio file (${sizeMb} MB)...`);
    }
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
    onStatus,
  });

  if (onStatus) {
    onStatus("Paragraph transcription complete.");
  }

  return {
    transcript: paragraphText,
    rawTranscript: paragraphText,
    minutes: paragraphText,
    summary: paragraphText,
    text: paragraphText,
  };
}