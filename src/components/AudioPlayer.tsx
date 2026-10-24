import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Gauge } from 'lucide-react';
import { formatTime } from '../utils/audioUtils';

interface AudioPlayerProps {
  audioUrl: string | null;
  filename?: string;
  filesize?: string;
  originalFilesize?: string;
  compressionRatio?: number;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  audioUrl, 
  filename, 
  filesize,
  originalFilesize,
  compressionRatio 
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 0.75];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!audioUrl) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg text-slate-100">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            {/* Animated Waveform Bars */}
            <div className="flex items-center gap-0.5 h-5">
              {[40, 70, 100, 60, 85].map((height, i) => (
                <span
                  key={i}
                  className={`w-0.5 bg-sky-400 rounded-full transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : 'opacity-40'
                  }`}
                  style={{
                    height: isPlaying ? `${height}%` : '30%',
                    animationDelay: `${i * 120}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100 truncate max-w-xs md:max-w-md">
              {filename || 'Meeting Audio Recording'}
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              {filesize && <span className="font-medium text-slate-300">{filesize}</span>}
              {originalFilesize && compressionRatio !== undefined && compressionRatio > 0 && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Compressed from {originalFilesize} (-{compressionRatio}%)
                </span>
              )}
              <span>•</span>
              <span className="text-sky-400 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleRestart}
            title="Restart playback"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSpeedCycle}
            title="Change playback speed"
            className="flex items-center gap-1 text-xs px-2 py-1 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md font-mono transition-colors"
          >
            <Gauge className="w-3.5 h-3.5 text-sky-400" />
            <span>{playbackRate}x</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Scrubber & Play button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center shadow-md shadow-sky-500/25 transition-transform active:scale-95 shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 focus:outline-none"
          />
        </div>

        <span className="text-xs font-mono text-slate-400 w-12 text-right">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
