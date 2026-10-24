import React, { useState } from 'react';
import { 
  Briefcase, 
  CheckCircle, 
  ListTodo, 
  FileCheck2, 
  Layers, 
  Calendar, 
  User, 
  Clock, 
  AlertCircle,
  Copy,
  Check,
  FileDown,
  FileCode,
  FileText,
  MapPin,
  Users
} from 'lucide-react';
import { MeetingAnalysisResult, ActionItem } from '../types';
import { exportToPDF, exportToMarkdown, exportToWord } from '../utils/exportUtils';

interface ExecutiveMinutesProps {
  result: MeetingAnalysisResult;
}

export const ExecutiveMinutes: React.FC<ExecutiveMinutesProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>(
    result.executiveMinutes.actionItems || []
  );

  const toggleActionItem = (index: number) => {
    setActionItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleCopyMinutes = () => {
    const textToCopy = `
MEETING TITLE: ${result.meetingTitle}
DATE: ${result.meetingDate || 'Not Specified'}
TIME: ${result.timeStarted || 'Not Specified'} - ${result.timeEnded || 'Not Specified'}
VENUE: ${result.venue || 'Not Specified'}

1. OVERVIEW:
${result.executiveMinutes.meetingOverview}

2. KEY TOPICS DISCUSSED:
${result.executiveMinutes.keyTopicsDiscussed
  .map(
    t => `• ${t.topic}:
  ${t.summary}
  ${t.discussionPoints.map(p => `  - ${p}`).join('\n')}`
  )
  .join('\n\n')}

3. DECISIONS AGREED:
${result.executiveMinutes.decisions.map(d => `• ${d}`).join('\n')}

4. ACTION ITEMS:
${actionItems
  .map(
    a =>
      `• [${a.priority || 'Medium'}] ${a.task} | Owner: ${a.owner || 'Unassigned'} | Due: ${a.deadline || 'TBD'}`
  )
  .join('\n')}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            High Priority
          </span>
        );
      case 'low':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Low Priority
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Medium Priority
          </span>
        );
    }
  };

  const completedCount = actionItems.filter(i => i.completed).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <h3 className="text-base font-bold text-slate-100">
              Executive Meeting Minutes
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
              English Executive Standard
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {result.meetingDate || 'October 2026'}
            </span>
            <span>•</span>
            <span className="text-slate-300 font-medium truncate max-w-sm">
              {result.meetingTitle}
            </span>
          </div>
        </div>

        {/* Export Toolbar */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyMinutes}
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
                <span>Copy Text</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => exportToPDF(result)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-sky-500/20"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => exportToWord(result)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm shadow-blue-600/25"
            title="Download Word Document (.doc)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Word (.doc)</span>
          </button>

          <button
            type="button"
            onClick={() => exportToMarkdown(result)}
            title="Download Markdown"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <FileCode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent Meeting Metadata Header Card */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4 shadow-inner space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            Official Meeting Parameters & Attendance
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Mauritian Executive Record
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
              <span className="font-semibold text-slate-100 text-xs block mt-0.5 truncate" title={result.venue || 'Not Specified'}>
                {result.venue || 'Not Specified'}
              </span>
            </div>
          </div>

          {/* Number of Attendees */}
          <div className="flex items-start gap-2.5 bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Attendees Count
              </span>
              <span className="font-semibold text-slate-100 text-xs block mt-0.5 truncate">
                {result.attendeesCount || (result.speakersIdentified && result.speakersIdentified.length > 0
                  ? `${result.speakersIdentified.length} Attendees`
                  : 'Not Specified')}
              </span>
            </div>
          </div>
        </div>

        {/* Names of Attendees / Present Row */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-2.5 flex items-start gap-2.5 text-xs">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-0.5">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
              Names of Attendees / Present:
            </span>
            <p className="font-medium text-slate-200 mt-0.5 leading-relaxed">
              {result.attendeesPresent || (result.speakersIdentified && result.speakersIdentified.length > 0
                ? result.speakersIdentified.join(', ')
                : 'Not Specified (Inferred from audio introduction)')}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Meeting Overview */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
          <Briefcase className="w-4 h-4" />
          <span>Meeting Overview</span>
        </div>
        {result.executiveMinutes.meetingOverview.includes('\n') || /^[•\-\*]/m.test(result.executiveMinutes.meetingOverview) ? (
          <ul className="space-y-2">
            {result.executiveMinutes.meetingOverview
              .split('\n')
              .map(l => l.trim())
              .filter(l => l.length > 0)
              .map((line, lIdx) => {
                const clean = line.replace(/^[•\-\*]\s*/, '').trim();
                return (
                  <li key={lIdx} className="text-slate-200 text-sm leading-relaxed flex items-start gap-2">
                    <span className="text-sky-400 text-sm leading-none mt-1">•</span>
                    <span>{clean}</span>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="text-slate-200 text-sm leading-relaxed">
            {result.executiveMinutes.meetingOverview}
          </p>
        )}
      </div>

      {/* 2. Key Topics Discussed */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>Key Topics Discussed ({result.executiveMinutes.keyTopicsDiscussed.length})</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {result.executiveMinutes.keyTopicsDiscussed.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition-all"
            >
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                {item.topic}
              </h4>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {item.summary}
              </p>

              {item.discussionPoints && item.discussionPoints.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/60">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Discussion Points:
                  </span>
                  <ul className="space-y-1">
                    {item.discussionPoints.map((point, pIdx) => (
                      <li
                        key={pIdx}
                        className="text-xs text-slate-300 flex items-start gap-2"
                      >
                        <span className="text-sky-400 text-sm leading-none mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Decisions Made */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
          <CheckCircle className="w-4 h-4" />
          <span>Decisions Made ({result.executiveMinutes.decisions.length})</span>
        </div>

        <div className="space-y-2">
          {result.executiveMinutes.decisions.map((decision, dIdx) => (
            <div
              key={dIdx}
              className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                {decision}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Action Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-wider">
            <ListTodo className="w-4 h-4" />
            <span>Action Items & Deliverables ({actionItems.length})</span>
          </div>
          {actionItems.length > 0 && (
            <span className="text-xs text-slate-400">
              {completedCount} of {actionItems.length} completed
            </span>
          )}
        </div>

        <div className="overflow-hidden border border-slate-800 rounded-xl bg-slate-950/70">
          <div className="divide-y divide-slate-800/80">
            {actionItems.map((item, aIdx) => (
              <div
                key={aIdx}
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  item.completed ? 'bg-slate-900/40 opacity-70' : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={!!item.completed}
                    onChange={() => toggleActionItem(aIdx)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500/20 cursor-pointer accent-sky-500"
                  />
                  <div className="space-y-1">
                    <p
                      className={`text-xs sm:text-sm font-medium ${
                        item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                      }`}
                    >
                      {item.task}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {item.owner && (
                        <span className="flex items-center gap-1 text-slate-300">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{item.owner}</span>
                        </span>
                      )}
                      {item.deadline && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{item.deadline}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="self-end sm:self-center shrink-0">
                  {getPriorityBadge(item.priority)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
