import React from 'react';
import { BookOpen, Sparkles, MessageSquareQuote } from 'lucide-react';
import { LanguageAnalysis } from '../types';

interface CreoleGlossaryProps {
  analysis?: LanguageAnalysis;
}

export const CreoleGlossary: React.FC<CreoleGlossaryProps> = ({ analysis }) => {
  if (!analysis) return null;

  const expressions = analysis.creoleExpressionsIdentified || [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h4 className="text-sm font-bold text-slate-100">
            Mauritian Multilingual & Code-Switching Insights
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-mono">
          <Sparkles className="w-3 h-3" />
          <span>Morisyen • Français • English</span>
        </div>
      </div>

      {analysis.codeSwitchingSummary && (
        <div className="mb-4 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5">
          <p className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-sky-400">Code-Switching Context: </span>
            {analysis.codeSwitchingSummary}
          </p>
        </div>
      )}

      {expressions.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Creole Idioms & Phrasing Identified:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {expressions.map((exp, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 border border-slate-800 hover:border-amber-500/30 rounded-xl p-3 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-300 font-mono">
                    "{exp.phrase}"
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-medium">
                  → {exp.literalOrMeaning}
                </p>
                {exp.context && (
                  <p className="text-[11px] text-slate-400 mt-1 italic">
                    Context: {exp.context}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
