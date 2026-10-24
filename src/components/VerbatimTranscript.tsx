import React, { useState, useMemo } from 'react';
import { Search, Copy, Check, Download, Languages, Users, User, Filter, Volume2, Calendar, Clock, MapPin } from 'lucide-react';
import { MeetingAnalysisResult } from '../types';
import { cleanVerbatimTranscript } from '../utils/transcriptCleaner';

interface VerbatimTranscriptProps {
  transcript: string;
  speakersIdentified?: string[];
  result?: MeetingAnalysisResult;
}

const SPEAKER_PALETTES = [
  {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    avatar: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    border: 'border-l-sky-400 group-hover:border-sky-300',
    dot: 'bg-sky-400',
  },
  {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    avatar: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    border: 'border-l-emerald-400 group-hover:border-emerald-300',
    dot: 'bg-emerald-400',
  },
  {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    avatar: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    border: 'border-l-amber-400 group-hover:border-amber-300',
    dot: 'bg-amber-400',
  },
  {
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    avatar: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    border: 'border-l-purple-400 group-hover:border-purple-300',
    dot: 'bg-purple-400',
  },
  {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    avatar: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    border: 'border-l-rose-400 group-hover:border-rose-300',
    dot: 'bg-rose-400',
  },
  {
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    avatar: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    dot: 'bg-indigo-400',
  },
  {
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    avatar: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
    border: 'border-l-teal-400 group-hover:border-teal-300',
    dot: 'bg-teal-400',
  },
];

export const VerbatimTranscript: React.FC<VerbatimTranscriptProps> = ({ transcript, speakersIdentified = [], result }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Split lines and trim, with automatic anti-repetition cleaning
  const lines = useMemo(() => {
    const cleaned = cleanVerbatimTranscript(transcript || '');
    return cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }, [transcript]);

  // Helper to parse line for timestamp, dynamic speaker name, inline tags, and text
  const parseLine = (rawLine: string) => {
    const timestampMatch = rawLine.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\])/);
    const timestamp = timestampMatch ? timestampMatch[1] : null;
    let rest = timestampMatch ? rawLine.replace(timestampMatch[0], '').trim() : rawLine;

    const speakerMatch = rest.match(/^([^:]+):(.*)$/);
    if (speakerMatch) {
      let rawSpeaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();

      // Check for inline bracketed tag in speaker part, e.g. [Kreol], [Français], [English Trans.], [Original]
      let inlineTag: string | null = null;
      const tagMatch = rawSpeaker.match(/\[(.*?)\]/);
      if (tagMatch) {
        inlineTag = tagMatch[1].trim();
        rawSpeaker = rawSpeaker.replace(/\[.*?\]/, '').trim();
      }

      return {
        timestamp,
        speaker: rawSpeaker,
        inlineTag,
        text,
      };
    }

    return {
      timestamp,
      speaker: null,
      inlineTag: null,
      text: rest,
    };
  };

  // Extract all distinct speakers dynamically across transcript
  const { detectedSpeakers, speakerCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rawLine of lines) {
      const parsed = parseLine(rawLine);
      if (parsed.speaker && !parsed.speaker.toLowerCase().startsWith('↳')) {
        counts.set(parsed.speaker, (counts.get(parsed.speaker) || 0) + 1);
      }
    }
    // Include any passed from speakersIdentified
    for (const spk of speakersIdentified) {
      if (spk && !counts.has(spk)) {
        counts.set(spk, 0);
      }
    }
    return {
      detectedSpeakers: Array.from(counts.keys()),
      speakerCounts: counts,
    };
  }, [lines, speakersIdentified]);

  // Map each speaker to a consistent color palette index
  const speakerPaletteMap = useMemo(() => {
    const map = new Map<string, typeof SPEAKER_PALETTES[0]>();
    detectedSpeakers.forEach((spk, idx) => {
      // Check if speaker has an explicit number like "Speaker 2 - ..."
      const match = spk.match(/Speaker\s*(\d+)/i) || spk.match(/Intervenant\s*(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10) - 1;
        map.set(spk, SPEAKER_PALETTES[Math.abs(num) % SPEAKER_PALETTES.length]);
      } else {
        map.set(spk, SPEAKER_PALETTES[idx % SPEAKER_PALETTES.length]);
      }
    });
    return map;
  }, [detectedSpeakers]);

  // Filter lines by search term and selected speaker
  const filteredLines = useMemo(() => {
    return lines.filter(rawLine => {
      const parsed = parseLine(rawLine);

      // Speaker filter (allow dual translation subline through if parent speaker selected)
      if (selectedSpeaker) {
        const isSubline = rawLine.includes('↳') || /^\s*\[(english|français|trad)\]/i.test(rawLine);
        if (!isSubline && parsed.speaker !== selectedSpeaker) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return rawLine.toLowerCase().includes(term);
      }

      return true;
    });
  }, [lines, searchTerm, selectedSpeaker]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanVerbatimTranscript(transcript));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const cleaned = cleanVerbatimTranscript(transcript);
    const blob = new Blob([cleaned], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'verbatim_transcript_diarized.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to format spoken text and highlight search terms & bracketed annotations
  const renderTextContent = (text: string) => {
    // Break down text by [pause], [laughter], [inaudible], etc.
    const annotationRegex = /(\[(?:laughter|pause|laughter\/pause|rire|silence|inaudible|applause|crosstalk)\])/gi;
    const segments = text.split(annotationRegex);

    return segments.map((seg, segIdx) => {
      if (annotationRegex.test(seg)) {
        return (
          <span
            key={`ann-${segIdx}`}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/25 mx-1 italic"
          >
            {seg}
          </span>
        );
      }

      // Highlight search term inside regular text
      if (!searchTerm) return seg;
      const parts = seg.split(new RegExp(`(${searchTerm})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark key={`m-${segIdx}-${i}`} className="bg-amber-400 text-slate-950 font-bold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      );
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Verbatim Transcript
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium flex items-center gap-1">
              <Users className="w-3 h-3" />
              Dynamic Speaker Diarization
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sentence-by-sentence dialogue attributing distinct speakers dynamically from vocal context and introductions.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            title="Download as TXT"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent Meeting Metadata Header Card */}
      {result && (
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 shadow-inner space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Section 2 • Meeting Parameters &amp; Session Context
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              Verbatim Dialogue Record
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Meeting Date */}
            <div className="flex items-start gap-2.5 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Meeting Date
                </span>
                <span className="font-semibold text-slate-100 text-xs block mt-0.5 truncate">
                  {result.meetingDate || 'Not Specified'}
                </span>
              </div>
            </div>

            {/* Time Window */}
            <div className="flex items-start gap-2.5 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Time Window
                </span>
                <span className="font-semibold text-slate-100 text-xs block mt-0.5 truncate">
                  {result.timeWindow && result.timeWindow !== 'Not Specified'
                    ? result.timeWindow
                    : (result.timeStarted || result.timeEnded
                      ? `${result.timeStarted || ''}${result.timeStarted && result.timeEnded ? ' – ' : ''}${result.timeEnded || ''}`.trim()
                      : 'Not Specified')}
                </span>
              </div>
            </div>

            {/* Venue / Location */}
            <div className="flex items-start gap-2.5 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Venue / Location
                </span>
                <span className="font-semibold text-slate-100 text-xs block mt-0.5 truncate">
                  {result.venue || 'Not Specified'}
                </span>
              </div>
            </div>

            {/* Attendance Count */}
            <div className="flex items-start gap-2.5 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Attendance
                </span>
                <span className="font-semibold text-slate-100 text-xs block mt-0.5 truncate">
                  {result.attendeesCount || (result.speakersIdentified?.length ? `${result.speakersIdentified.length} Attendees` : 'Not Specified')}
                </span>
              </div>
            </div>
          </div>

          {/* Attendees Present */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5 flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Attendees Present / Inferred Roll Call
              </span>
              <p className="font-medium text-slate-200 text-xs mt-0.5 leading-relaxed">
                {result.attendeesPresent || (result.speakersIdentified?.length ? result.speakersIdentified.join(', ') : 'Not Specified')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Speaker Diarization Filter Chips */}
      {detectedSpeakers.length > 0 && (
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-sky-400" />
              Identified Speakers ({detectedSpeakers.length})
            </span>
            {selectedSpeaker && (
              <button
                type="button"
                onClick={() => setSelectedSpeaker(null)}
                className="text-sky-400 hover:text-sky-300 underline font-medium"
              >
                Reset Filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedSpeaker(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                selectedSpeaker === null
                  ? 'bg-sky-500 text-white font-semibold shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              All Speakers ({lines.length})
            </button>
            {detectedSpeakers.map((spk) => {
              const count = speakerCounts.get(spk) || 0;
              const palette = speakerPaletteMap.get(spk) || SPEAKER_PALETTES[0];
              const isSelected = selectedSpeaker === spk;
              return (
                <button
                  key={spk}
                  type="button"
                  onClick={() => setSelectedSpeaker(isSelected ? null : spk)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? `${palette.badge} ring-1 ring-white/20 font-bold shadow`
                      : 'bg-slate-800/70 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                  <span>{spk}</span>
                  {count > 0 && (
                    <span className="text-[10px] opacity-75 font-mono px-1 rounded bg-black/20">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search dialogue words, phrases, or names (e.g. 'Elim', 'dabor', 'urgent', 'bidze')..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-20 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-400 transition-colors"
        />
        {searchTerm && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-mono">
            {filteredLines.length} {filteredLines.length === 1 ? 'match' : 'matches'}
          </span>
        )}
      </div>

      {/* Transcript List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[600px] font-sans scrollbar-thin scrollbar-thumb-slate-800">
        {filteredLines.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            {selectedSpeaker
              ? `No lines recorded for "${selectedSpeaker}" matching "${searchTerm}"`
              : `No lines match your search filter "${searchTerm}"`}
          </div>
        ) : (
          filteredLines.map((rawLine, index) => {
            const parsed = parseLine(rawLine);
            const isCreole =
              /\[(kreol|creole)\]/i.test(rawLine) ||
              /(pa|pou|pe|ki|nou|zot|bizin|kapav|dabor|mem)/i.test(parsed.text);
            const isFrench =
              /\[(français|francais|french)\]/i.test(rawLine) ||
              /(nous|vous|pour|avec|notre|c'est|dans)/i.test(parsed.text);

            const isDualTranslationSubline =
              rawLine.includes('↳') || /^\s*\[(english|français|trad)\]/i.test(rawLine);

            const speakerPalette = parsed.speaker
              ? speakerPaletteMap.get(parsed.speaker) || SPEAKER_PALETTES[0]
              : null;

            return (
              <div
                key={index}
                className={`${
                  isDualTranslationSubline
                    ? 'bg-sky-950/20 border border-sky-500/25 ml-4 rounded-lg p-2.5'
                    : 'bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3'
                } transition-colors group`}
              >
                {!isDualTranslationSubline && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {parsed.timestamp && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {parsed.timestamp.replace(/[\[\]]/g, '')}
                        </span>
                      )}

                      {parsed.speaker ? (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                            speakerPalette?.badge || 'bg-slate-800 text-slate-200 border-slate-700'
                          }`}
                        >
                          <User className="w-3 h-3 opacity-80" />
                          <span>{parsed.speaker}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-slate-400">
                          Line #{index + 1}
                        </span>
                      )}

                      {parsed.inlineTag && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {parsed.inlineTag}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {isCreole && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                          Morisyen
                        </span>
                      )}
                      {isFrench && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono border border-blue-500/20">
                          Français
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <p
                  className={`text-xs sm:text-sm leading-relaxed ${
                    isDualTranslationSubline
                      ? 'text-sky-200 font-sans italic pl-1 flex items-start gap-1.5'
                      : `text-slate-200 pl-2 border-l-2 ${
                          speakerPalette?.border || 'border-slate-700'
                        }`
                  } transition-colors`}
                >
                  {renderTextContent(parsed.text)}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {lines.length} lines total • {detectedSpeakers.length} speaker{detectedSpeakers.length === 1 ? '' : 's'} identified
        </span>
        <div className="flex items-center gap-1 text-emerald-400">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Clean Spoken Intent • Anti-Stutter Filter Active</span>
        </div>
      </div>
    </div>
  );
};
