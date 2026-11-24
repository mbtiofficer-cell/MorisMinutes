export interface SavedVoiceProfile {
  id: string;
  name: string;
  clipBlob: Blob;
  createdAt: number;
}

const DB_NAME = 'morisminutes_voice_vault';
const STORE_NAME = 'voice_profiles';
const DB_VERSION = 1;

function openVoiceDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllVoiceProfiles(): Promise<SavedVoiceProfile[]> {
  try {
    const db = await openVoiceDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as SavedVoiceProfile[];
        resolve(items.sort((a, b) => b.createdAt - a.createdAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not read Voice Vault from IndexedDB:', err);
    return [];
  }
}

export async function saveVoiceProfile(name: string, clipBlob: Blob): Promise<SavedVoiceProfile> {
  const cleanName = name.trim();
  const existing = await getAllVoiceProfiles();
  const match = existing.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());

  const profile: SavedVoiceProfile = {
    id: match ? match.id : `voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    clipBlob,
    createdAt: Date.now(),
  };

  const db = await openVoiceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(profile);
    req.onsuccess = () => resolve(profile);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVoiceProfile(id: string): Promise<void> {
  const db = await openVoiceDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Parses a [MM:SS] or [HH:MM:SS] timestamp string into seconds.
 */
export function parseTimestampToSeconds(ts: string | null): number {
  if (!ts) return 0;
  const clean = ts.replace(/[\[\]]/g, '').trim();
  const parts = clean.split(':').map((n) => parseInt(n, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/**
 * Slices a clean 16kHz Mono WAV snippet (default 6 seconds) starting at `startSeconds`
 * from the active meeting audio Blob so it can be previewed and stored in the Voice Vault.
 */
export async function extractAudioSnippet(
  audioBlob: Blob,
  startSeconds: number,
  durationSeconds = 6
): Promise<Blob> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = 16000;
    const safeStart = Math.max(0, Math.min(startSeconds, Math.max(0, decoded.duration - 1.5)));
    const actualDuration = Math.min(durationSeconds, decoded.duration - safeStart);
    const frameCount = Math.max(1, Math.floor(actualDuration * sampleRate));

    const offlineCtx = new OfflineAudioContext(1, frameCount, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0, safeStart, actualDuration);

    const rendered = await offlineCtx.startRendering();
    return audioBufferToWavBlob(rendered);
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const dataSize = samples.length * 2;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}