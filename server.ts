import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { buildMeetingPrompt } from './src/utils/promptBuilder';
import { parseMeetingJsonResponse } from './src/utils/jsonParser';
import { MinutesLanguage, TranscriptFormat, MinutesTone } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolvePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  return Number(process.env.PORT) || 3000;
}

const PORT = resolvePort();

// Setup temporary directory for streaming audio uploads
const uploadDir = path.join(os.tmpdir(), 'moris_uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for streaming large multipart files (MP3, WAV, M4A up to 100MB)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `moris_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Lightweight client config route for direct in-browser Gemini SDK execution
app.get('/api/config', (_req, res) => {
  res.json({
    apiKey: process.env.GEMINI_API_KEY || '',
  });
});

// Lazy init of GoogleGenAI client with required User-Agent
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Map common audio MIME types to standardized ones accepted by Gemini
function normalizeMimeType(mime?: string, filename?: string): string {
  const cleanMime = (mime || '').toLowerCase().trim();
  const ext = filename ? path.extname(filename).toLowerCase().replace('.', '') : '';

  if (cleanMime.includes('mp3') || cleanMime.includes('mpeg') || ext === 'mp3') {
    return 'audio/mp3';
  }
  if (cleanMime.includes('wav') || cleanMime.includes('wave') || ext === 'wav') {
    return 'audio/wav';
  }
  if (cleanMime.includes('m4a') || cleanMime.includes('mp4') || ext === 'm4a') {
    return 'audio/mp4'; // Gemini standard for m4a/aac container
  }
  if (cleanMime.includes('webm') || ext === 'webm') {
    return 'audio/webm';
  }
  if (cleanMime.includes('ogg') || ext === 'ogg') {
    return 'audio/ogg';
  }
  if (cleanMime.includes('aac') || ext === 'aac') {
    return 'audio/aac';
  }
  return 'audio/mp3';
}

// Built-in authentic Mauritian meetings transcripts & sample scenarios
const SAMPLE_MEETINGS = [
  {
    id: 'sample-fintech',
    title: 'Fintech Product Sprint - Port Louis',
    scenario: 'Diskisyon lor lansman nouvo app peman mobil Moris ek integrasion MCB Juice',
    languageBreakdown: 'Mauritian Creole (60%), French (30%), English (10%)',
    durationEst: '1m 45s',
    sampleTranscriptText: `[00:02] Speaker 1 (Dev Lead) [Kreol]: Bonzour tou dimounn. Mersi pou zot prezans. Zordi nou bizin fer enn pwin lor lansman nouvo payment gateway MorisPay. Ki pozision avek integrasion API MCB Juice ek SBM?
[00:18] Speaker 2 (Backend Dev) [Français]: Bonjour à tous. Pour la partie MCB Juice, l'API sandbox fonctionne bien. Par contre, il nous reste un souci de token expiration qu'on doit fixer avant le staging.
[00:35] Speaker 3 (Product Manager) [Code-switching]: Yes, exacteman. But we need to meet the deadline of next Friday. Si nou pa fini security audit la, Banque de Maurice pa pou donn clearance.
[00:52] Speaker 1 (Dev Lead) [Kreol]: Donk solision la li kler. Kevin, to kapav pran charge fix sa bug token la avek support teknik MCB zordi mem?
[01:08] Speaker 2 (Backend Dev) [Français/Kreol]: Oui, tout à fait. Mo pou kordonn direkteman avek zot lekip l'après-midi la.
[01:21] Speaker 3 (Product Manager) [English/Kreol]: Great. Mo pou notify legal team pou compliance documentation. Next sync dime 10h.`
  },
  {
    id: 'sample-budget',
    title: 'Executive Budget & Marketing Review',
    scenario: 'Revi bidze kanpagn piblisite frapan pou sezon vakans Grand Baie & Flic-en-Flac',
    languageBreakdown: 'Mauritian Creole (50%), French (40%), English (10%)',
    durationEst: '2m 10s',
    sampleTranscriptText: `[00:05] Speaker 1 (Finance Director) [Français]: Alors, passons au point crucial de notre ordre du jour: la révision du budget marketing pour le troisième trimestre.
[00:22] Speaker 2 (Marketing Manager) [Kreol/Français]: Wi, anfet nou pe propoz enn réallocation de 350,000 roupies depi print media ver social media ads ek kolaborasion avek bann créateurs de contenu locaux lor TikTok ek Instagram.
[00:44] Speaker 3 (Operations) [Code-switching]: Mo dabor lor sa stratezi la, parski ROI lor digital li boukou pli for. Mais qu'en est-il du sponsoring pour le festival de Grand Baie?
[01:03] Speaker 1 (Finance Director) [Français]: C'est approuvé sous réserve d'un reporting hebdomadaire des conversions. We need clear analytics.
[01:20] Speaker 2 (Marketing Manager) [Kreol]: Korek net. Mo pou finalize kontra avek bann influencers avan vandredi e partager le dashboard KPI.`
  }
];

// POST /api/generate-sample-audio - Generates real audio for sample using Gemini TTS
app.post('/api/generate-sample-audio', async (req, res) => {
  try {
    const { sampleId } = req.body;
    const meeting = SAMPLE_MEETINGS.find(m => m.id === sampleId) || SAMPLE_MEETINGS[0];

    const ai = getAIClient();

    const speechPrompt = `Read this Mauritian corporate meeting dialogue with natural inflection and code-switching:
    ${meeting.sampleTranscriptText}`;

    const ttsResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: speechPrompt,
              speechMetadata: {
                style: 'Professional corporate meeting dialogue with Mauritian Creole, French and English phrasing',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'Failed to generate audio sample via TTS' });
    }

    return res.json({
      success: true,
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      sampleId: meeting.id,
      title: meeting.title,
    });
  } catch (error: any) {
    console.error('Error generating sample audio:', error);
    return res.status(500).json({
      error: error.message || 'Failed to synthesize sample audio. You can upload an audio file directly.',
    });
  }
});

// GET /api/samples - List pre-configured sample meeting briefs
app.get('/api/samples', (_req, res) => {
  res.json({ samples: SAMPLE_MEETINGS });
});

// Helper to safely clean up temporary disk files
function cleanupLocalFile(filePath?: string) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('Could not remove temporary file:', e);
    }
  }
}

// POST /api/generate-minutes - Primary core endpoint with Gemini File API asynchronous upload
app.post('/api/generate-minutes', upload.single('audioFile'), async (req, res) => {
  let tempFilePath: string | undefined;
  let uploadedFileResource: any = null;

  try {
    const ai = getAIClient();

    let filename = req.body.filename;
    let mimeType = req.body.mimeType;
    const additionalContext = req.body.additionalContext;
    let fileSize = 0;

    // Check if file was uploaded via multipart/form-data
    if (req.file) {
      tempFilePath = req.file.path;
      fileSize = req.file.size;
      filename = filename || req.file.originalname;
      mimeType = mimeType || req.file.mimetype;
    } else if (req.body.audioBase64) {
      // Support base64 JSON payload: write to disk temporarily to use File API
      const cleanBase64 = req.body.audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+_-]+;base64,/, '').trim();
      const buffer = Buffer.from(cleanBase64, 'base64');
      fileSize = buffer.length;
      const ext = filename ? path.extname(filename) : '.mp3';
      tempFilePath = path.join(uploadDir, `moris_${Date.now()}_payload${ext || '.mp3'}`);
      fs.writeFileSync(tempFilePath, buffer);
    } else {
      return res.status(400).json({
        error: 'No audio file provided. Please select or record an audio file.',
      });
    }

    const normalizedMime = normalizeMimeType(mimeType, filename);

    // Dynamically build prompt based on requested Minutes Language, Transcript Format & Tone
    const minutesLanguage = (req.body.minutesLanguage as MinutesLanguage) || 'English';
    const transcriptFormat = (req.body.transcriptFormat as TranscriptFormat) || 'original';
    const minutesTone = (req.body.minutesTone as MinutesTone) || 'diplomatic';
    const userPrompt = buildMeetingPrompt(minutesLanguage, transcriptFormat, minutesTone, additionalContext);

    let audioPart: any = null;

    // Asynchronously upload to Google Generative AI File API (genai.upload_file / ai.files.upload)
    // This resolves the 413 error for audio files over 20MB by obtaining a file URI
    try {
      console.log(`[File API] Uploading audio (${fileSize} bytes, ${normalizedMime}) asynchronously to Gemini File API...`);
      uploadedFileResource = await ai.files.upload({
        file: tempFilePath,
        config: {
          mimeType: normalizedMime,
          displayName: filename || path.basename(tempFilePath),
        },
      });

      console.log(`[File API] Upload successful. Name: ${uploadedFileResource.name}, URI: ${uploadedFileResource.uri}, State: ${uploadedFileResource.state}`);

      // Poll until file state is ACTIVE if still processing
      let currentState = uploadedFileResource.state;
      let pollCount = 0;
      while (currentState === 'PROCESSING' && pollCount < 40) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const check = await ai.files.get({ name: uploadedFileResource.name });
        currentState = check.state;
        pollCount++;
        console.log(`[File API] Polling file state: ${currentState} (attempt ${pollCount})`);
      }

      if (currentState === 'FAILED') {
        throw new Error('Gemini File API returned FAILED state for audio file.');
      }

      // Use file URI reference in model.generateContent
      audioPart = {
        fileData: {
          fileUri: uploadedFileResource.uri,
          mimeType: uploadedFileResource.mimeType || normalizedMime,
        },
      };
    } catch (uploadError: any) {
      console.warn('[File API] File API upload error:', uploadError?.message);

      // Fallback: If file is smaller than 20MB, try inlineData; otherwise rethrow 413 guidance
      if (fileSize < 20 * 1024 * 1024) {
        console.log('[File API] Falling back to inline data for file under 20MB...');
        const fileBytes = fs.readFileSync(tempFilePath);
        audioPart = {
          inlineData: {
            mimeType: normalizedMime,
            data: fileBytes.toString('base64'),
          },
        };
      } else {
        throw new Error(
          `Failed to upload audio file (${(fileSize / (1024 * 1024)).toFixed(1)}MB) via Gemini File API: ${uploadError?.message}`
        );
      }
    }

    // Candidate models in priority order, handling transient 503s seamlessly
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.5-transcribe',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    let lastError: any = null;
    let modelUsed = candidateModels[0];
    let response: any = null;

    for (const modelCandidate of candidateModels) {
      try {
        console.log(`[Model] Processing audio with ${modelCandidate}...`);
        response = await ai.models.generateContent({
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
        modelUsed = modelCandidate;
        console.log(`[Model] Successfully generated content using ${modelCandidate}`);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Model] Model ${modelCandidate} failed (${err?.status || err?.message}), falling back to next...`);
      }
    }

    if (!response) {
      throw lastError || new Error('Failed to generate minutes across all model endpoints.');
    }

    const rawText = response.text || '';
    const parsedData = parseMeetingJsonResponse(rawText, filename, minutesLanguage);

    return res.json({
      success: true,
      modelUsed,
      fileUriUsed: audioPart.fileData?.fileUri || null,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error generating minutes with Gemini:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred while analyzing the audio file with Gemini.',
    });
  } finally {
    // 1. Delete local temporary file
    cleanupLocalFile(tempFilePath);

    // 2. Asynchronously delete remote file from Gemini File API after processing
    if (uploadedFileResource?.name) {
      try {
        const ai = getAIClient();
        ai.files.delete({ name: uploadedFileResource.name }).catch((err: any) => {
          console.warn('[File API] Could not delete remote Gemini file:', err?.message);
        });
      } catch (cleanupErr) {
        console.warn('[File API] Remote file cleanup warning:', cleanupErr);
      }
    }
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
