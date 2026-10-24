import React from 'react';
import { Languages, FileText, Globe2, Check, ShieldCheck, Zap } from 'lucide-react';
import { MinutesLanguage, TranscriptFormat, MinutesTone } from '../types';

interface LanguageControlsProps {
  minutesLanguage: MinutesLanguage;
  setMinutesLanguage: (lang: MinutesLanguage) => void;
  transcriptFormat: TranscriptFormat;
  setTranscriptFormat: (format: TranscriptFormat) => void;
  minutesTone: MinutesTone;
  setMinutesTone: (tone: MinutesTone) => void;
  disabled?: boolean;
}

export const LanguageControls: React.FC<LanguageControlsProps> = ({
  minutesLanguage,
  setMinutesLanguage,
  transcriptFormat,
  setTranscriptFormat,
  minutesTone,
  setMinutesTone,
  disabled = false,
}) => {
  const minutesLanguageOptions: {
    value: MinutesLanguage;
    label: string;
    sublabel: string;
    flag: string;
  }[] = [
    {
      value: 'Auto-Detect Creole Dialect',
      label: 'Auto-Detect Creole Dialect',
      sublabel: 'Dynamic AI detection across Creole dialects & code-switching (Minutes in Corporate English)',
      flag: '🌐',
    },
    {
      value: 'Mauritian Creole (Kréol Morisien)',
      label: 'Mauritian Creole (Kréol Morisien)',
      sublabel: 'Acoustic focus: Kréol Morisien & code-switching (Minutes in Corporate English)',
      flag: '🇲🇺',
    },
    {
      value: 'Haitian Creole (Kreyòl Ayisyen)',
      label: 'Haitian Creole (Kreyòl Ayisyen)',
      sublabel: 'Acoustic focus: Kreyòl Ayisyen & code-switching (Minutes in Corporate English)',
      flag: '🇭🇹',
    },
    {
      value: 'Seychellois Creole (Seselwa)',
      label: 'Seychellois Creole (Seselwa)',
      sublabel: 'Acoustic focus: Kreol Seselwa & code-switching (Minutes in Corporate English)',
      flag: '🇸🇨',
    },
    {
      value: 'French',
      label: 'French',
      sublabel: 'Acoustic focus: French & bilingual dialogue (Minutes in Corporate English)',
      flag: '🇫🇷',
    },
    {
      value: 'English',
      label: 'English',
      sublabel: 'Acoustic focus: International English & accents (Minutes in Corporate English)',
      flag: '🇬🇧',
    },
  ];

  const transcriptFormatOptions: {
    value: TranscriptFormat;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: 'original',
      label: 'Original Verbatim (Exact Spoken Creole/French/English Line-by-Line)',
      description: 'Preserves the exact spoken language (Mauritian Creole / French / English) line-by-line as spoken in the recording',
      icon: '🎙️',
    },
    {
      value: 'english_translation',
      label: 'English Translation',
      description: 'Sentence-by-sentence dialogue translated into natural, fluent English',
      icon: '🇬🇧',
    },
    {
      value: 'french_translation',
      label: 'French Translation',
      description: 'Traduction intégrale phrase par phrase en français clair et naturel',
      icon: '🇫🇷',
    },
    {
      value: 'dual_original_english',
      label: 'Dual: Original Code-Switching + English Translation Side-by-Side',
      description: 'Original verbatim dialogue paired with its immediate English translation on paired sub-lines',
      icon: '🔀',
    },
  ];

  const toneOptions: {
    value: MinutesTone;
    label: string;
    badge: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: 'diplomatic',
      label: 'Diplomatic & Strategic (Default)',
      badge: 'Executive & Constructive',
      description:
        'Reframes complaints, poor attendance reproaches, and interpersonal criticisms into constructive organizational goals, lessons learned, and strategic action items in Corporate English.',
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    },
    {
      value: 'direct',
      label: 'Direct & Raw',
      badge: 'Unfiltered Transparency',
      description:
        'Captures exact unfiltered feedback, criticisms, accountability challenges, and blunt statements as expressed.',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
    },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Language & Dialect Configuration
            </h3>
            <p className="text-[11px] text-slate-400">
              Configure spoken audio dialect recognition and verbatim transcription rules
            </p>
          </div>
        </div>
      </div>

      {/* Mandatory Output Language Rule Banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs text-sky-200">
        <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-sky-100 flex items-center gap-2">
            <span>Strict Output Language Policy</span>
            <span className="text-[10px] font-mono bg-sky-400/20 text-sky-200 px-1.5 py-0.2 rounded">
              Enforced
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-0.5">
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
              <span>
                <strong className="text-white">Section 1 (Executive Minutes):</strong> ALWAYS output in clear, formal <strong>Corporate English</strong> (Overview, Key Topics, Decisions Agreed, Action Items Table) regardless of input dialect.
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong className="text-white">Section 2 (Verbatim Transcript):</strong> Preserves the <strong>exact spoken language</strong> (Mauritian Creole / French / English) line-by-line as spoken.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Control 1: Audio Dialect Recognition */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Spoken Dialect & Acoustic Focus</span>
            </label>
            <span className="text-[10px] text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
              Section 1: Always Corporate English
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {minutesLanguageOptions.map((opt) => {
              const isSelected = minutesLanguage === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setMinutesLanguage(opt.value)}
                  className={`relative flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-400 text-sky-100 shadow-sm shadow-sky-500/10 ring-1 ring-sky-400/30'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-sm">{opt.flag}</span>
                    {isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full bg-sky-400 text-slate-950 flex items-center justify-center text-[9px] font-bold">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold truncate leading-tight">
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                    {opt.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Control 2: Transcript Format & Language */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-teal-400" />
              <span>Transcript Format & Language</span>
            </label>
            <span className="text-[10px] text-teal-400 font-mono bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
              Section 2
            </span>
          </div>

          <div className="relative">
            <select
              value={transcriptFormat}
              disabled={disabled}
              onChange={(e) => setTranscriptFormat(e.target.value as TranscriptFormat)}
              className={`w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {transcriptFormatOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200 py-1">
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
            <span className="text-sm shrink-0">
              {transcriptFormatOptions.find((o) => o.value === transcriptFormat)?.icon}
            </span>
            <span className="leading-snug">
              {transcriptFormatOptions.find((o) => o.value === transcriptFormat)?.description}
            </span>
          </div>
        </div>
      </div>

      {/* Control 3: Minutes Tone & Sensitivity */}
      <div className="pt-2 border-t border-slate-800/70 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Minutes Tone & Sensitivity</span>
          </label>
          <span className="text-[10px] text-slate-400">
            Controls how criticisms and interpersonal friction are documented
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {toneOptions.map((opt) => {
            const isSelected = minutesTone === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => setMinutesTone(opt.value)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-slate-950 border-emerald-500/60 shadow-sm shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2">
                    {opt.icon}
                    <span className="text-xs font-bold text-slate-100">
                      {opt.label}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
