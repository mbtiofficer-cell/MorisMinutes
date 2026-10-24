import React, { useState } from 'react';
import { 
  Sparkles, 
  FileText, 
  Languages, 
  RotateCcw, 
  AlertTriangle, 
  Loader2, 
  Split, 
  AlignLeft, 
  CheckSquare, 
  FileCode,
  ShieldCheck,
  Headphones,
  Users,
  Check,
  FileDown
} from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { AudioPlayer } from './components/AudioPlayer';
import { VerbatimTranscript } from './components/VerbatimTranscript';
import { ExecutiveMinutes } from './components/ExecutiveMinutes';
import { CreoleGlossary } from './components/CreoleGlossary';
import { LanguageControls } from './components/LanguageControls';
import { MeetingMetadataInputs } from './components/MeetingMetadataInputs';
import { 
  MeetingAnalysisResult, 
  AudioSelectionData, 
  MinutesLanguage, 
  TranscriptFormat, 
  MinutesTone, 
  MeetingMetadata 
} from './types';
import { generateMinutesDirectly } from './utils/geminiClient';
import { exportToPDF, exportToWord } from './utils/exportUtils';

export default function App() {
  const [audioData, setAudioData] = useState<AudioSelectionData | null>(null);

  const [minutesLanguage, setMinutesLanguage] = useState<MinutesLanguage>('Auto-Detect Creole Dialect');
  const [transcriptFormat, setTranscriptFormat] = useState<TranscriptFormat>('original');
  const [minutesTone, setMinutesTone] = useState<MinutesTone>('diplomatic');
  const [meetingContext, setMeetingContext] = useState('');
  const [meetingMetadata, setMeetingMetadata] = useState<MeetingMetadata>({
    meetingDate: '',
    timeStarted: '',
    timeEnded: '',
    venue: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MeetingAnalysisResult | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'minutes' | 'transcript' | 'markdown'>('split');

  const processingSteps = [
    'Preparing audio payload (16kHz Mono)...',
    'Ingesting audio stream with Gemini Flash...',
    'Auto-detecting Creole dialect & code-switching verbatim line-by-line...',
    'Synthesizing executive meeting minutes with decisions & action items...',
    'Finalizing dynamic dialect insights, glossary, and metadata...',
  ];

  const handleAudioSelected = (data: AudioSelectionData) => {
    setAudioData(data);
    setError(null);
  };

  const handleClearAudio = () => {
    if (audioData?.objectUrl) {
      URL.revokeObjectURL(audioData.objectUrl);
    }
    setAudioData(null);
    setResult(null);
    setError(null);
  };

  const handleMetadataChange = (updated: MeetingMetadata) => {
    setMeetingMetadata(updated);
    if (result) {
      setResult(prev => {
        if (!prev) return null;
        const start = updated.timeStarted?.trim() || '';
        const end = updated.timeEnded?.trim() || '';
        const timeWindowVal = updated.timeWindow && updated.timeWindow.trim() !== '' && updated.timeWindow !== 'Not Specified'
          ? updated.timeWindow.trim()
          : (start || end
            ? `${start}${start && end ? ' – ' : ''}${end}`.trim()
            : 'Not Specified');
        return {
          ...prev,
          meetingDate: updated.meetingDate !== undefined ? updated.meetingDate : prev.meetingDate,
          timeStarted: updated.timeStarted !== undefined ? updated.timeStarted : prev.timeStarted,
          timeEnded: updated.timeEnded !== undefined ? updated.timeEnded : prev.timeEnded,
          timeWindow: timeWindowVal,
          venue: updated.venue !== undefined ? updated.venue : prev.venue,
          attendeesCount: updated.attendeesCount !== undefined ? updated.attendeesCount : prev.attendeesCount,
          attendeesPresent: updated.attendeesPresent !== undefined ? updated.attendeesPresent : prev.attendeesPresent,
          meetingMetadata: updated,
        };
      });
    }
  };

  const [isCompressingBeforeUpload, setIsCompressingBeforeUpload] = useState(false);
  const [compressionStatusText, setCompressionStatusText] = useState('Compressing audio file for upload...');
  const [compressionProgressPercent, setCompressionProgressPercent] = useState(0);
  const [clientDirectStatus, setClientDirectStatus] = useState('');
  const [markdownCopied, setMarkdownCopied] = useState(false);

  const handleGenerateMinutes = async () => {
    if (!audioData) return;

    setError(null);
    let targetFile = audioData.file;
    let targetMime = audioData.mimeType;
    let targetName = audioData.name;

    // 1. If audio is not yet aggressively compressed to 16kHz mono (or > 5MB), compress it first
    const isAlreadyCompressed = audioData.name.includes('_16k_');
    const isLarge = audioData.file.size > 5 * 1024 * 1024;

    if (!isAlreadyCompressed && isLarge) {
      setIsCompressingBeforeUpload(true);
      setCompressionStatusText('Compressing audio file for upload... (reading audio stream)');
      setCompressionProgressPercent(15);

      try {
        const { compressAudioTo16kHzMono } = await import('./utils/audioCompressor');
        const compResult = await compressAudioTo16kHzMono(audioData.file, audioData.name, (p) => {
          setCompressionStatusText(p.message);
          setCompressionProgressPercent(p.percent);
        });

        targetFile = compResult.compressedFile;
        targetMime = 'audio/mp3';
        targetName = compResult.compressedFile.name;

        // Update local state to reflect the compressed file
        setAudioData(prev => prev ? {
          ...prev,
          file: compResult.compressedFile,
          name: compResult.compressedFile.name,
          sizeFormatted: `${(compResult.compressedSize / (1024 * 1024)).toFixed(1)} MB`,
          originalSizeFormatted: `${(compResult.originalSize / (1024 * 1024)).toFixed(1)} MB`,
          compressionRatio: compResult.compressionRatio,
          mimeType: 'audio/mp3',
        } : null);
      } catch (compErr) {
        console.warn('In-browser audio compression fallback:', compErr);
      } finally {
        setIsCompressingBeforeUpload(false);
      }
    }

    // 2. Direct client-side Gemini API execution (bypasses intermediate server route)
    setIsProcessing(true);
    setProcessingStep(0);
    setClientDirectStatus('Connecting directly to Gemini API from browser...');

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => (prev < processingSteps.length - 1 ? prev + 1 : prev));
    }, 2800);

    try {
      console.log('[Client Direct] Transcribing directly with Gemini from client...', { minutesLanguage, transcriptFormat, minutesTone });
      const directResult = await generateMinutesDirectly(
        targetFile,
        targetName,
        {
          minutesLanguage,
          transcriptFormat,
          minutesTone,
          additionalContext: meetingContext,
          meetingMetadata,
        },
        (msg) => setClientDirectStatus(msg)
      );

      clearInterval(stepInterval);
      if (directResult.data) {
        setResult(directResult.data);
        // Sync any AI-inferred fields into the editable form state if empty
        setMeetingMetadata(prev => ({
          meetingDate: prev.meetingDate || directResult.data.meetingDate || '',
          timeStarted: prev.timeStarted || directResult.data.timeStarted || '',
          timeEnded: prev.timeEnded || directResult.data.timeEnded || '',
          timeWindow: prev.timeWindow || directResult.data.timeWindow || '',
          venue: prev.venue || directResult.data.venue || '',
          attendeesCount: prev.attendeesCount || directResult.data.attendeesCount || '',
          attendeesPresent: prev.attendeesPresent || directResult.data.attendeesPresent || '',
        }));
      } else {
        throw new Error('Received empty response from Gemini API.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Error generating minutes via direct Gemini Files API:', err);
      setError(
        err.message || 'Failed to generate meeting minutes with Gemini. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 via-indigo-500 to-rose-400 p-0.5 shadow-md shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-100">
                  MorisMinutes
                </h1>
                <div className="flex items-center gap-0.5 h-3.5 px-1.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block mr-0.5" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-0.5" />
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block mr-0.5" />
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1" />
                  <span>Mauritius</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Multilingual Creole & French Speech to Executive English Meeting Minutes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Header Language Dropdown Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg px-2.5 py-1 shadow-sm">
              <Languages className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <label htmlFor="header-language-select" className="sr-only">Spoken Dialect & Recognition</label>
              <select
                id="header-language-select"
                value={minutesLanguage}
                onChange={(e) => setMinutesLanguage(e.target.value as MinutesLanguage)}
                disabled={isProcessing || isCompressingBeforeUpload}
                className="bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer pr-1"
                title="Audio Dialect Recognition — Section 1 Executive Minutes are strictly generated in Corporate English; Section 2 Transcript preserves exact spoken language line-by-line."
              >
                <option value="Auto-Detect Creole Dialect" className="bg-slate-900 text-slate-100">
                  🌐 Auto-Detect Creole Dialect
                </option>
                <option value="Mauritian Creole (Kréol Morisien)" className="bg-slate-900 text-slate-100">
                  🇲🇺 Mauritian Creole (Kréol Morisien)
                </option>
                <option value="Haitian Creole (Kreyòl Ayisyen)" className="bg-slate-900 text-slate-100">
                  🇭🇹 Haitian Creole (Kreyòl Ayisyen)
                </option>
                <option value="Seychellois Creole (Seselwa)" className="bg-slate-900 text-slate-100">
                  🇸🇨 Seychellois Creole (Seselwa)
                </option>
                <option value="French" className="bg-slate-900 text-slate-100">
                  🇫🇷 French
                </option>
                <option value="English" className="bg-slate-900 text-slate-100">
                  🇬🇧 English
                </option>
              </select>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400 font-mono">
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Gemini 1.5 Flash</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Transcribe Multilingual Audio into{' '}
            <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              Executive Meeting Minutes
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Fluent in Mauritian Creole, Seychellois, Haitian, French, and English. Section 1 Executive Minutes are strictly output in formal Corporate English, while Section 2 preserves the exact spoken language verbatim line-by-line.
          </p>
        </div>

        {/* Input & Control Card */}
        <div className="space-y-4">
          <AudioUploader
            onAudioSelected={handleAudioSelected}
            onClearAudio={handleClearAudio}
            currentAudioName={audioData?.name || null}
            isProcessing={isProcessing}
            meetingContext={meetingContext}
            setMeetingContext={setMeetingContext}
          />

          {/* Audio Player preview if loaded */}
          {audioData && (
            <AudioPlayer
              audioUrl={audioData.objectUrl}
              filename={audioData.name}
              filesize={audioData.sizeFormatted}
              originalFilesize={audioData.originalSizeFormatted}
              compressionRatio={audioData.compressionRatio}
            />
          )}

          {/* Meeting Metadata & Venue Header Fields */}
          <MeetingMetadataInputs
            metadata={meetingMetadata}
            onChange={handleMetadataChange}
            disabled={isProcessing || isCompressingBeforeUpload}
          />

          {/* Language & Output Format Controls */}
          <LanguageControls
            minutesLanguage={minutesLanguage}
            setMinutesLanguage={setMinutesLanguage}
            transcriptFormat={transcriptFormat}
            setTranscriptFormat={setTranscriptFormat}
            minutesTone={minutesTone}
            setMinutesTone={setMinutesTone}
            disabled={isProcessing || isCompressingBeforeUpload}
          />

          {/* Error Message */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-xs sm:text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Processing Error</p>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              onClick={handleGenerateMinutes}
              disabled={!audioData || isProcessing || isCompressingBeforeUpload}
              className={`w-full sm:w-auto min-w-[260px] px-8 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all duration-200 ${
                !audioData || isProcessing || isCompressingBeforeUpload
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-sky-500 via-teal-500 to-sky-400 hover:from-sky-400 hover:to-teal-400 text-slate-950 shadow-sky-500/25 hover:shadow-sky-500/40 transform hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {isCompressingBeforeUpload ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Compressing Audio...</span>
                </>
              ) : isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Generating Minutes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-current text-slate-950" />
                  <span>Generate Minutes</span>
                </>
              )}
            </button>
          </div>

          {/* Active UI Status Indicator during In-Browser Compression */}
          {isCompressingBeforeUpload && (
            <div className="max-w-md mx-auto bg-slate-900 border border-sky-500/40 rounded-xl p-4 shadow-lg text-center space-y-2.5 animate-pulse">
              <div className="flex items-center justify-center gap-2 text-sky-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Compressing audio file for upload...</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 to-teal-400 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(12, compressionProgressPercent)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                {compressionStatusText}
              </p>
            </div>
          )}

          {/* Live Progress Indicator during Minutes Generation */}
          {isProcessing && !isCompressingBeforeUpload && (
            <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg text-center space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-sky-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Minutes... (Direct Client API)</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-sky-400 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${((processingStep + 1) / processingSteps.length) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                {clientDirectStatus || processingSteps[processingStep]}
              </p>
            </div>
          )}
        </div>

        {/* Results Presentation */}
        {result && (
          <div className="space-y-6 pt-4 border-t border-slate-800/80">
            {/* View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'split'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Split className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dual Split View</span>
                  <span className="sm:hidden">Dual</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('minutes')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'minutes'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Minutes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('transcript')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'transcript'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Transcript</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('markdown')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    viewMode === 'markdown'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Raw Markdown</span>
                </button>

                <div className="hidden sm:block h-4 w-[1px] bg-slate-800 mx-1" />

                <button
                  type="button"
                  onClick={() => exportToPDF(result)}
                  title="Export Complete Multi-Page PDF Document"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all shadow-sm shadow-sky-500/20 active:scale-95"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportToWord(result)}
                  title="Export Clean Microsoft Word Document (.docx)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm shadow-blue-600/20 active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Word (.docx)</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 px-2 text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-[11px] border border-sky-500/30">
                  Minutes: {minutesLanguage}
                </span>
                <span className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                  minutesTone === 'diplomatic'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  Tone: {minutesTone === 'diplomatic' ? 'Diplomatic & Strategic' : 'Direct & Raw'}
                </span>
                <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 font-mono text-[11px] border border-teal-500/30">
                  Transcript: {
                    transcriptFormat === 'original' ? 'Original Code-Switching' :
                    transcriptFormat === 'english_translation' ? 'English Translation' :
                    transcriptFormat === 'french_translation' ? 'French Translation' : 'Dual Side-by-Side'
                  }
                </span>
                {result.speakersIdentified && result.speakersIdentified.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono text-[11px] border border-purple-500/30 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{result.speakersIdentified.length} Speakers Diarized</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Structured & Verified</span>
                </span>
              </div>
            </div>

            {/* Language & Cultural Insights Card */}
            {result.languageAnalysis && (
              <CreoleGlossary analysis={result.languageAnalysis} />
            )}

            {/* Content Display based on View Mode */}
            {viewMode === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <VerbatimTranscript 
                  transcript={result.verbatimTranscript} 
                  speakersIdentified={result.speakersIdentified} 
                  result={result}
                />
                <ExecutiveMinutes result={result} />
              </div>
            )}

            {viewMode === 'minutes' && (
              <div className="max-w-4xl mx-auto">
                <ExecutiveMinutes result={result} />
              </div>
            )}

            {viewMode === 'transcript' && (
              <div className="max-w-4xl mx-auto">
                <VerbatimTranscript 
                  transcript={result.verbatimTranscript} 
                  speakersIdentified={result.speakersIdentified} 
                  result={result}
                />
              </div>
            )}

            {viewMode === 'markdown' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl max-w-4xl mx-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <h3 className="text-sm font-bold text-slate-200">
                    Full Formatted Markdown Output
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        result.fullMarkdownOutput || result.verbatimTranscript
                      );
                      setMarkdownCopied(true);
                      setTimeout(() => setMarkdownCopied(false), 2000);
                    }}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {markdownCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <span>Copy Markdown</span>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-slate-300 font-mono bg-slate-950 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[600px]">
                  {result.fullMarkdownOutput || result.verbatimTranscript}
                </pre>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">MorisMinutes</span>
            <span>—</span>
            <span>Mauritian Creole, French & English Code-Switching Speech Assistant</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Powered by Gemini 1.5 Flash</span>
            <span>•</span>
            <span>Verbatim Transcription & Executive Minutes</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
