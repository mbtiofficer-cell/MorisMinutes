import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  FastForward,
  UserCheck,
  Sparkles,
  Trash2,
  Database,
  Mic
} from 'lucide-react';
import {
  getAllVoiceProfiles,
  saveVoiceProfile,
  deleteVoiceProfile,
  extractAudioSnippet,
  SavedVoiceProfile,
} from '../utils/voiceVault';

interface PreGenerationVoiceTaggerProps {
  audioUrl: string;
  audioBlob: Blob | null;
  disabled?: boolean;
  onVoiceSaved?: (savedName: string) => void;
}

function formatSec(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '00:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PreGenerationVoiceTagger: React.FC<PreGenerationVoiceTaggerProps> = ({
  audioUrl,
  audioBlob,
  disabled = false,
  onVoiceSaved,
}) => {
  const [speakerName, setSpeakerName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFastScanning, setIsFastScanning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [savedProfiles, setSavedProfiles] = useState<SavedVoiceProfile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getAllVoiceProfiles().then(setSavedProfiles);
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setIsFastScanning(false);
    setCurrentTime(0);
  }, [audioUrl]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.playbackRate = 1.0;
    }
    setIsPlaying(false);
    setIsFastScanning(false);
  };

  const handleTogglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && !isFastScanning) {
      stopPlayback();
    } else {
      try {
        audio.muted = false;
        audio.volume = 1.0;
        audio.playbackRate = 1.0;
        await audio.play();
        setIsPlaying(true);
        setIsFastScanning(false);
      } catch (err) {
        console.warn('Pre-gen audio play error:', err);
      }
    }
  };

  const handleToggleFastScan = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isFastScanning) {
      audio.playbackRate = 1.0;
      setIsFastScanning(false);
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      }
    } else {
      try {
        audio.muted = false;
        audio.volume = 1.0;
        audio.playbackRate = 3.0;
        await audio.play();
        setIsPlaying(true);
        setIsFastScanning(true);
      } catch (err) {
        console.warn('Pre-gen fast scan error:', err);
      }
    }
  };

  const handleSliderScrub = (newSec: number) => {
    setCurrentTime(newSec);
    if (audioRef.current) {
      audioRef.current.currentTime = newSec;
    }
  };

  const handleCaptureAndTag = async () => {
    const trimmed = speakerName.trim();
    if (!trimmed || !audioBlob) return;

    setIsSaving(true);
    try {
      const startSec = audioRef.current ? audioRef.current.currentTime : currentTime;
      const snippetBlob = await extractAudioSnippet(audioBlob, startSec, 6);
      await saveVoiceProfile(trimmed, snippetBlob);
      const updated = await getAllVoiceProfiles();
      setSavedProfiles(updated);
      setSpeakerName('');
      onVoiceSaved?.(trimmed);
      setToast(`Saved "${trimmed}" (${formatSec(startSec)}) to Voice Vault! Gemini will use this name when generating.`);
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.warn('Could not save pre-gen voice sample:', err);
      setToast('Could not extract voice sample. Try playing the audio first.');
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    await deleteVoiceProfile(id);
    const updated = await getAllVoiceProfiles();
    setSavedProfiles(updated);
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/30 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        onLoadedMetadata={(e) => {
          if (isFinite(e.currentTarget.duration)) {
            setAudioDuration(e.currentTarget.duration);
          }
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setIsFastScanning(false);
        }}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <UserCheck className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-100">
              Pre-Tag Voices Before Generating (Optional)
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>Voice Vault: {savedProfiles.length}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Use <strong className="text-amber-300">Fast Scan 3x</strong> to scan your recording right now, stop on any speaker&apos;s voice, and enter their name so Gemini labels them automatically during generation.
          </p>
        </div>

        {toast && (
          <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {toast}
          </div>
        )}
      </div>

      {/* Fast Scan & Scrubber Controls */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={handleTogglePlayPause}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isPlaying && !isFastScanning
                  ? 'bg-rose-500 text-white'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
              } disabled:opacity-50`}
            >
              {isPlaying && !isFastScanning ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Play 1x</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={handleToggleFastScan}
              title="Click once to continuously fast-forward at 3x speed; click again to stop fast-scan and listen at 1x speed"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                isFastScanning
                  ? 'bg-amber-400 text-slate-950 border-amber-300 animate-pulse shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-amber-500/20 text-amber-300 border-amber-500/40'
              } disabled:opacity-50`}
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>{isFastScanning ? 'Stop Scan (Back to 1x)' : 'Fast Scan 3x'}</span>
            </button>
          </div>

          <span className="text-xs font-mono text-sky-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            {formatSec(currentTime)} / {formatSec(audioDuration)}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={audioDuration > 0 ? audioDuration : 100}
          step={0.5}
          disabled={disabled}
          value={currentTime}
          onChange={(e) => handleSliderScrub(parseFloat(e.target.value))}
          aria-label="Seek through recording to tag speakers"
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
        />

        {/* Capture Current Voice Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="flex items-center gap-2 flex-1 bg-slate-900 border border-slate-700/80 focus-within:border-sky-400 rounded-lg px-3 py-1.5">
            <Mic className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <input
              type="text"
              disabled={disabled || isSaving}
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCaptureAndTag();
                }
              }}
              placeholder={`Enter name of speaker heard at ${formatSec(currentTime)} (e.g., Ps Govin, Pasteur Kevin)...`}
              className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={disabled || isSaving || !speakerName.trim() || !audioBlob}
            onClick={handleCaptureAndTag}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving Voice...' : `Tag Voice @ ${formatSec(currentTime)}`}</span>
          </button>
        </div>
      </div>

      {/* Saved Voices in Vault */}
      {savedProfiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-[11px] font-semibold text-purple-300">
            Active Voices in Vault:
          </span>
          {savedProfiles.map((vp) => (
            <div
              key={vp.id}
              className="flex items-center gap-1.5 bg-slate-950 border border-purple-500/30 rounded-lg px-2.5 py-1 text-xs text-purple-200"
            >
              <UserCheck className="w-3 h-3 text-emerald-400" />
              <span className="font-semibold">{vp.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDeleteProfile(vp.id)}
                title={`Remove ${vp.name}`}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-0.5"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};