import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Mic, 
  MicOff, 
  FileAudio, 
  Sparkles, 
  X, 
  CheckCircle2, 
  Radio, 
  Layers, 
  Info,
  Clock,
  Loader2
} from 'lucide-react';
import { formatFileSize, formatTime, fileToBase64, createSyntheticWavBlob } from '../utils/audioUtils';
import { SampleMeeting, AudioSelectionData } from '../types';

interface AudioUploaderProps {
  onAudioSelected: (data: AudioSelectionData) => void;
  onClearAudio: () => void;
  currentAudioName: string | null;
  isProcessing: boolean;
  meetingContext: string;
  setMeetingContext: (val: string) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onAudioSelected,
  onClearAudio,
  currentAudioName,
  isProcessing,
  meetingContext,
  setMeetingContext,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [samples, setSamples] = useState<SampleMeeting[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'record' | 'sample'>('upload');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  // Fetch sample meetings on mount
  useEffect(() => {
    fetch('/api/samples')
      .then(res => res.json())
      .then(data => {
        if (data.samples) setSamples(data.samples);
      })
      .catch(err => console.error('Failed to load samples:', err));
  }, []);

  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string>('');
  const [compressionProgressPercent, setCompressionProgressPercent] = useState<number>(0);
  const [compressionStats, setCompressionStats] = useState<{
    originalFormatted: string;
    compressedFormatted: string;
    ratio: number;
  } | null>(null);

  const handleFileProcess = async (file: File) => {
    try {
      setCompressionStats(null);
      setIsCompressing(true);
      setCompressionProgressPercent(10);
      setCompressionStatus('Compressing audio file for upload... (reading audio file)');

      try {
        const { compressAudioTo16kHzMono } = await import('../utils/audioCompressor');
        const result = await compressAudioTo16kHzMono(file, file.name, (p) => {
          setCompressionProgressPercent(p.percent);
          setCompressionStatus(p.message);
        });

        const objectUrl = URL.createObjectURL(result.compressedBlob);
        setCompressionStats({
          originalFormatted: formatFileSize(result.originalSize),
          compressedFormatted: formatFileSize(result.compressedSize),
          ratio: result.compressionRatio,
        });

        onAudioSelected({
          file: result.compressedFile,
          base64: '',
          mimeType: 'audio/mp3',
          name: result.compressedFile.name,
          sizeFormatted: formatFileSize(result.compressedSize),
          originalSizeFormatted: formatFileSize(result.originalSize),
          compressionRatio: result.compressionRatio,
          objectUrl,
        });
      } catch (compressionErr) {
        console.warn('In-browser audio compression fallback:', compressionErr);
        // Fallback: use original file if decoding is unsupported
        const objectUrl = URL.createObjectURL(file);
        onAudioSelected({
          file,
          base64: '',
          mimeType: file.type || 'audio/mp3',
          name: file.name,
          sizeFormatted: formatFileSize(file.size),
          objectUrl,
        });
      } finally {
        setIsCompressing(false);
      }
    } catch (err) {
      console.error('Error processing audio file:', err);
      setIsCompressing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Recording management
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const base64 = await fileToBase64(audioBlob);
        const objectUrl = URL.createObjectURL(audioBlob);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        onAudioSelected({
          file: audioBlob,
          base64,
          mimeType: 'audio/webm',
          name: `Live_Recording_${timestamp}.webm`,
          sizeFormatted: formatFileSize(audioBlob.size),
          objectUrl,
        });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access was denied or is unavailable. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    }
  };

  // Handle selection of pre-made sample meeting
  const handleSelectSample = async (sample: SampleMeeting) => {
    setIsGeneratingSample(true);
    try {
      // First attempt: generate via server Gemini TTS
      const res = await fetch('/api/generate-sample-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId: sample.id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          // Convert base64 to Blob for object URL
          const byteCharacters = atob(data.audioBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/wav' });
          const objectUrl = URL.createObjectURL(blob);

          onAudioSelected({
            file: blob,
            base64: data.audioBase64,
            mimeType: 'audio/wav',
            name: `${sample.title}.wav`,
            sizeFormatted: formatFileSize(blob.size),
            objectUrl,
            sampleMetadata: sample,
          });
          setMeetingContext(`Sample Meeting: ${sample.title} (${sample.scenario})`);
          setIsGeneratingSample(false);
          return;
        }
      }

      // Fallback: create in-browser audio blob
      const fallbackBlob = await createSyntheticWavBlob(5);
      const fallbackBase64 = await fileToBase64(fallbackBlob);
      const objectUrl = URL.createObjectURL(fallbackBlob);
      onAudioSelected({
        file: fallbackBlob,
        base64: fallbackBase64,
        mimeType: 'audio/wav',
        name: `${sample.title}.wav`,
        sizeFormatted: formatFileSize(fallbackBlob.size),
        objectUrl,
        sampleMetadata: sample,
      });
      setMeetingContext(`Sample Meeting: ${sample.title} (${sample.scenario})`);
    } catch (err) {
      console.warn('Sample audio error fallback:', err);
      // Fallback to synthetic browser audio
      const fallbackBlob = await createSyntheticWavBlob(4);
      const fallbackBase64 = await fileToBase64(fallbackBlob);
      const objectUrl = URL.createObjectURL(fallbackBlob);
      onAudioSelected({
        file: fallbackBlob,
        base64: fallbackBase64,
        mimeType: 'audio/wav',
        name: `${sample.title}.wav`,
        sizeFormatted: formatFileSize(fallbackBlob.size),
        objectUrl,
        sampleMetadata: sample,
      });
      setMeetingContext(`Sample Meeting: ${sample.title}`);
    } finally {
      setIsGeneratingSample(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'record'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Record Voice</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sample')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sample'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mauritian Samples</span>
          </button>
        </div>

        {currentAudioName && (
          <button
            type="button"
            onClick={onClearAudio}
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Audio</span>
          </button>
        )}
      </div>

      {/* Upload Zone */}
      {activeTab === 'upload' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/x-m4a,audio/aac,audio/webm,audio/ogg"
            onChange={handleFileChange}
            className="hidden"
          />

          {isCompressing ? (
            <div className="border border-sky-500/40 bg-sky-950/30 rounded-xl p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center animate-pulse">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-sky-200">
                  Compressing audio file for upload...
                </p>
                <p className="text-xs text-slate-300 font-mono">
                  {compressionStatus || 'Downsampling to 16kHz Mono • 64kbps MP3'}
                </p>
              </div>
              <div className="w-full max-w-sm bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 to-teal-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(8, compressionProgressPercent)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Downsampling raw audio directly in browser memory to ensure lightweight, fast transmission under server limits.
              </p>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                isDragging
                  ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                  : currentAudioName
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-sky-500/50 hover:bg-slate-800/40'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform ${
                  currentAudioName
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-sky-500/10 text-sky-400'
                }`}
              >
                {currentAudioName ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <FileAudio className="w-7 h-7" />
                )}
              </div>

              {currentAudioName ? (
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    Audio file ready for analysis
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Click or drag another file to replace
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    <span className="text-sky-400 font-semibold">Click to upload</span> or drag and drop audio
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Supports MP3, WAV, M4A, AAC, WEBM, OGG (auto-compressed to 16kHz Mono)
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      .MP3
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      .WAV
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      .M4A (80MB+ OK)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {compressionStats && !isCompressing && (
            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  In-browser compressed: <strong>{compressionStats.originalFormatted}</strong> → <strong className="text-emerald-200">{compressionStats.compressedFormatted}</strong>
                </span>
              </div>
              <span className="font-mono bg-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-bold">
                -{compressionStats.ratio}% (16kHz Mono MP3)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Record Live Voice Zone */}
      {activeTab === 'record' && (
        <div className="border border-slate-800 bg-slate-950 rounded-xl p-8 text-center flex flex-col items-center">
          <div className="mb-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-400 ring-4 ring-rose-500/30 animate-pulse'
                  : 'bg-sky-500/10 text-sky-400'
              }`}
            >
              <Mic className="w-8 h-8" />
            </div>
          </div>

          {isRecording ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-xl font-bold">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span>{formatTime(recordDuration)}</span>
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Recording your meeting... Speak in Mauritian Creole, French, or English code-switching.
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="mt-3 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-600/30 flex items-center gap-2 mx-auto transition-transform active:scale-95"
              >
                <MicOff className="w-4 h-4" />
                <span>Stop Recording</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-200">
                Record Meeting Audio Directly
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Use your device microphone to capture live speech or dictate a quick multi-language summary in Creole/French.
              </p>
              <button
                type="button"
                onClick={startRecording}
                disabled={isProcessing}
                className="mt-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm shadow-lg shadow-sky-500/25 flex items-center gap-2 mx-auto transition-transform active:scale-95"
              >
                <Radio className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Preloaded Mauritian Samples Zone */}
      {activeTab === 'sample' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Test instantly with realistic Mauritian meetings featuring natural Creole, French, and English code-switching:
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {samples.map((sample) => (
              <div
                key={sample.id}
                className="bg-slate-950 border border-slate-800 hover:border-sky-500/40 rounded-xl p-4 flex flex-col justify-between transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      {sample.title}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {sample.durationEst}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 line-clamp-2">
                    {sample.scenario}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2 font-mono flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    {sample.languageBreakdown}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isGeneratingSample || isProcessing}
                  onClick={() => handleSelectSample(sample)}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-slate-700/60"
                >
                  {isGeneratingSample ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading Sample Audio...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Load This Meeting Audio</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional Context Box */}
      <div className="mt-4 pt-4 border-t border-slate-800/80">
        <label className="block text-xs font-medium text-slate-300 mb-1.5">
          Meeting Context or Attendee Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={meetingContext}
          onChange={(e) => setMeetingContext(e.target.value)}
          placeholder="e.g., Weekly Dev Sync with Kevin (Backend) & Sarah (Product), Port Louis"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>
    </div>
  );
};
