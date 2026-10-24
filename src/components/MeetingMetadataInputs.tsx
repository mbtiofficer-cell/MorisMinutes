import React from 'react';
import { Calendar, Clock, MapPin, Sparkles, X, Users, UserCheck } from 'lucide-react';
import { MeetingMetadata } from '../types';

interface MeetingMetadataInputsProps {
  metadata: MeetingMetadata;
  onChange: (updated: MeetingMetadata) => void;
  disabled?: boolean;
}

export const MeetingMetadataInputs: React.FC<MeetingMetadataInputsProps> = ({
  metadata,
  onChange,
  disabled = false,
}) => {
  const updateField = (field: keyof MeetingMetadata, value: string) => {
    onChange({
      ...metadata,
      [field]: value,
    });
  };

  const handleSetToday = () => {
    const today = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    updateField('meetingDate', today);
  };

  const hasAnyValues = Boolean(
    metadata.meetingDate ||
    metadata.timeWindow ||
    metadata.timeStarted ||
    metadata.timeEnded ||
    metadata.venue ||
    metadata.attendeesCount ||
    metadata.attendeesPresent
  );

  const currentTimeWindow = metadata.timeWindow ||
    (metadata.timeStarted || metadata.timeEnded
      ? `${metadata.timeStarted || ''}${metadata.timeStarted && metadata.timeEnded ? ' – ' : ''}${metadata.timeEnded || ''}`
      : '');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">
                Meeting Metadata & Attendance Parameters
              </h3>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 border border-slate-700/60 px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Provide scheduled details to print in Executive Minutes, PDF, and Word reports
            </p>
          </div>
        </div>

        {hasAnyValues && !disabled && (
          <button
            type="button"
            onClick={() =>
              onChange({
                meetingDate: '',
                timeWindow: '',
                timeStarted: '',
                timeEnded: '',
                venue: '',
                attendeesCount: '',
                attendeesPresent: '',
              })
            }
            className="self-start sm:self-auto text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-rose-500/10 border border-slate-700/60 hover:border-rose-500/20"
          >
            <X className="w-3 h-3" />
            <span>Reset Fields</span>
          </button>
        )}
      </div>

      {/* Grid Inputs for Date, Time Start, Time End, Venue, Attendee Count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* 1. Meeting Date */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Meeting Date</span>
            </label>
            <button
              type="button"
              onClick={handleSetToday}
              disabled={disabled}
              className="text-[10px] text-sky-400 hover:text-sky-300 font-medium hover:underline disabled:opacity-50 cursor-pointer"
            >
              Set Today
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={metadata.meetingDate || ''}
              onChange={(e) => updateField('meetingDate', e.target.value)}
              disabled={disabled}
              placeholder="e.g. October 9, 2026"
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-[10px] text-slate-400">
            e.g. October 9, 2026
          </p>
        </div>

        {/* 2. Time Start */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>Time Start</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const newStart = '09:00 AM';
                  const newEnd = metadata.timeEnded || '';
                  const newWindow = newStart && newEnd ? `${newStart} – ${newEnd}` : newStart;
                  onChange({
                    ...metadata,
                    timeStarted: newStart,
                    timeEnded: newEnd,
                    timeWindow: newWindow,
                  });
                }}
                disabled={disabled}
                className="text-[9px] text-teal-400 hover:text-teal-300 font-medium px-1.5 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-colors disabled:opacity-50"
              >
                09:00 AM
              </button>
              <button
                type="button"
                onClick={() => {
                  const newStart = '10:00 AM';
                  const newEnd = metadata.timeEnded || '';
                  const newWindow = newStart && newEnd ? `${newStart} – ${newEnd}` : newStart;
                  onChange({
                    ...metadata,
                    timeStarted: newStart,
                    timeEnded: newEnd,
                    timeWindow: newWindow,
                  });
                }}
                disabled={disabled}
                className="text-[9px] text-teal-400 hover:text-teal-300 font-medium px-1.5 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-colors disabled:opacity-50"
              >
                10:00 AM
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              value={metadata.timeStarted || ''}
              onChange={(e) => {
                const newStart = e.target.value;
                const newEnd = metadata.timeEnded || '';
                const newWindow = newStart && newEnd
                  ? `${newStart} – ${newEnd}`
                  : (newStart || (newEnd ? `Until ${newEnd}` : ''));
                onChange({
                  ...metadata,
                  timeStarted: newStart,
                  timeEnded: newEnd,
                  timeWindow: newWindow,
                });
              }}
              disabled={disabled}
              placeholder="e.g. 09:00 AM"
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>{metadata.timeStarted ? 'Manual start time set' : 'Defaults to Not Specified'}</span>
            {metadata.timeStarted && !disabled && (
              <button
                type="button"
                onClick={() => {
                  const newStart = '';
                  const newEnd = metadata.timeEnded || '';
                  const newWindow = newEnd ? `Until ${newEnd}` : '';
                  onChange({
                    ...metadata,
                    timeStarted: newStart,
                    timeEnded: newEnd,
                    timeWindow: newWindow,
                  });
                }}
                className="text-[9px] text-rose-400 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </p>
        </div>

        {/* 3. Time End */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              <span>Time End</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const newEnd = '11:30 AM';
                  const newStart = metadata.timeStarted || '';
                  const newWindow = newStart ? `${newStart} – ${newEnd}` : `Until ${newEnd}`;
                  onChange({
                    ...metadata,
                    timeStarted: newStart,
                    timeEnded: newEnd,
                    timeWindow: newWindow,
                  });
                }}
                disabled={disabled}
                className="text-[9px] text-teal-300 hover:text-teal-200 font-medium px-1.5 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-colors disabled:opacity-50"
              >
                11:30 AM
              </button>
              <button
                type="button"
                onClick={() => {
                  const newEnd = '12:00 PM';
                  const newStart = metadata.timeStarted || '';
                  const newWindow = newStart ? `${newStart} – ${newEnd}` : `Until ${newEnd}`;
                  onChange({
                    ...metadata,
                    timeStarted: newStart,
                    timeEnded: newEnd,
                    timeWindow: newWindow,
                  });
                }}
                disabled={disabled}
                className="text-[9px] text-teal-300 hover:text-teal-200 font-medium px-1.5 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 transition-colors disabled:opacity-50"
              >
                12:00 PM
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              value={metadata.timeEnded || ''}
              onChange={(e) => {
                const newEnd = e.target.value;
                const newStart = metadata.timeStarted || '';
                const newWindow = newStart && newEnd
                  ? `${newStart} – ${newEnd}`
                  : (newEnd ? `Until ${newEnd}` : (newStart || ''));
                onChange({
                  ...metadata,
                  timeStarted: newStart,
                  timeEnded: newEnd,
                  timeWindow: newWindow,
                });
              }}
              disabled={disabled}
              placeholder="e.g. 11:30 AM"
              className="w-full bg-slate-950 border border-slate-800 focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>{metadata.timeEnded ? 'Manual end time set' : 'Defaults to Not Specified'}</span>
            {metadata.timeEnded && !disabled && (
              <button
                type="button"
                onClick={() => {
                  const newEnd = '';
                  const newStart = metadata.timeStarted || '';
                  const newWindow = newStart || '';
                  onChange({
                    ...metadata,
                    timeStarted: newStart,
                    timeEnded: newEnd,
                    timeWindow: newWindow,
                  });
                }}
                className="text-[9px] text-rose-400 hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </p>
        </div>

        {/* 4. Venue / Location */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Venue / Location</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={metadata.venue || ''}
              onChange={(e) => updateField('venue', e.target.value)}
              disabled={disabled}
              placeholder="e.g. Federation HQ, Port Louis"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {metadata.venue ? 'Manual venue set' : 'Defaults to Not Specified'}
          </p>
        </div>

        {/* 5. Number of Attendees */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Attendance Count</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={metadata.attendeesCount || ''}
              onChange={(e) => updateField('attendeesCount', e.target.value)}
              disabled={disabled}
              placeholder="e.g. 12 Pastors / Delegates"
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {metadata.attendeesCount ? 'Manual count set' : 'Inferred dynamically'}
          </p>
        </div>
      </div>

      {/* 5. Names of Attendees / Present (Multi-line Text Box) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Names of Attendees / Present</span>
          </label>
          <span className="text-[10px] text-slate-400">
            Multi-line or comma-separated list
          </span>
        </div>
        <textarea
          rows={2}
          value={metadata.attendeesPresent || ''}
          onChange={(e) => updateField('attendeesPresent', e.target.value)}
          disabled={disabled}
          placeholder="e.g. Pasteur Govin, Pasteur Kevin, Pasteur Gary, Frère Patrick, Sœur Marie... (Leave blank to let AI infer dynamically from recording)"
          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed resize-none leading-relaxed"
        />
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>
            <strong>AI Auto-Inference:</strong> If left blank, the AI will dynamically detect and infer speaker names and attendees from audio greetings, vocatives, and introductions.
          </span>
        </div>
      </div>
    </div>
  );
};
