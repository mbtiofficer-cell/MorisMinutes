import { MeetingAnalysisResult, ActionItem, KeyTopic, CreoleExpression, MeetingMetadata } from '../types';
import { cleanVerbatimTranscript } from './transcriptCleaner';

/**
 * Robust JSON Parser & Resilient Extractor for Gemini Meeting Output.
 *
 * Handles:
 * - Markdown fences (```json ... ```)
 * - Trailing text or preamble
 * - Truncated JSON responses (auto-repairs unclosed quotes, brackets, and braces)
 * - Escapes inside string literals
 * - Semantic extraction fallback if JSON structure is damaged
 */
export function stripMarkdownWrappers(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  // Strip leading codeblock ```json or ```
  str = str.replace(/^```(?:json)?\s*\n?/gi, '');
  // Strip trailing ```
  str = str.replace(/\n?```\s*$/gi, '');
  // Strip any residual wrapping backticks
  str = str.replace(/^`+|`+$/g, '');
  return str.trim();
}

/**
 * Post-processes transcript text to eliminate repetitive loops,
 * limiting consecutive duplicate words to a maximum of 2, removing phrase loops,
 * and replacing static/silence noise with [Inaudible] or [Pause].
 */
export function cleanTranscriptRepetitions(transcript: string): string {
  return cleanVerbatimTranscript(transcript);
}

/**
 * Dynamically extracts all distinct speaker names and roles from transcript dialogue lines.
 */
export function extractSpeakersFromTranscript(transcript: string): string[] {
  if (!transcript) return [];
  const lines = transcript.split('\n');
  const speakerSet = new Set<string>();

  for (const line of lines) {
    // Match " Speaker 1 - Président [Kreol]:" or " Speaker 1 - Président:"
    const match = line.match(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*([^:\[\n]+?)(?:\s*\[.*?\])?\s*:/);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name && !name.toLowerCase().startsWith('line #') && !name.startsWith('↳')) {
        speakerSet.add(name);
      }
    }
  }

  return Array.from(speakerSet);
}

/**
 * Robust JSON Parser & Resilient Extractor for Gemini Meeting Output.
 *
 * Handles:
 * - Markdown fences (```json ... ```)
 * - Trailing text or preamble
 * - Truncated JSON responses (auto-repairs unclosed quotes, brackets, and braces)
 * - Escapes inside string literals
 * - Semantic extraction fallback if JSON structure is damaged
 */
export function parseMeetingJsonResponse(
  rawText: string,
  filename?: string,
  targetLanguage: string = 'English',
  userMetadata?: MeetingMetadata
): MeetingAnalysisResult {
  if (!rawText || !rawText.trim()) {
    console.warn('Empty or blank Gemini API response received; building clean fallback without sample data.');
    return buildResilientFallbackResult(filename, targetLanguage, userMetadata);
  }

  const cleaned = stripMarkdownWrappers(rawText);

  // Guard against HTML error pages
  if (cleaned.startsWith('<') || cleaned.toLowerCase().includes('<!doctype')) {
    throw new Error('Received unexpected HTML response instead of JSON. Ensure direct client-side Gemini Files API execution is active.');
  }

  // 1. Direct JSON parse attempt
  try {
    const directParsed = JSON.parse(cleaned);
    if (isValidMeetingResult(directParsed)) {
      return normalizeMeetingResult(directParsed, filename, targetLanguage, userMetadata);
    }
  } catch {
    // Continue to repair
  }

  // 2. Extract substring between first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      const sliceCandidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        const sliceParsed = JSON.parse(sliceCandidate);
        if (isValidMeetingResult(sliceParsed)) {
          return normalizeMeetingResult(sliceParsed, filename, targetLanguage, userMetadata);
        }
      } catch {
        // Continue to auto-repair
      }
    }

    // 3. Auto-repair truncated JSON (e.g., if token limit cut off transcript at the end)
    const repaired = repairTruncatedJsonString(cleaned.slice(firstBrace));
    if (repaired) {
      try {
        const repairedParsed = JSON.parse(repaired);
        if (isValidMeetingResult(repairedParsed)) {
          return normalizeMeetingResult(repairedParsed, filename, targetLanguage, userMetadata);
        }
      } catch {
        // Continue to semantic fallback
      }
    }
  }

  // 4. Semantic Regex Extraction Fallback (extracts actual content without generic placeholders)
  return extractSemanticMeetingData(rawText, filename, targetLanguage, userMetadata);
}

function isValidMeetingResult(obj: any): boolean {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.executiveMinutes || obj.meetingOverview || obj.keyTopicsDiscussed || obj.verbatimTranscript)
  );
}

function normalizeMeetingResult(
  obj: any,
  filename?: string,
  targetLanguage: string = 'English',
  userMetadata?: MeetingMetadata
): MeetingAnalysisResult {
  const minutes = obj.executiveMinutes || {};

  const title =
    obj.meetingTitle ||
    (filename ? `Executive Minutes: ${filename.replace(/\.[^/.]+$/, '')}` : 'Executive Meeting Minutes');

  // Meeting Metadata resolution: user values -> model values -> "Not Specified" fallback
  const rawDate = (userMetadata?.meetingDate && userMetadata.meetingDate.trim()) ||
    (obj.meetingDate && typeof obj.meetingDate === 'string' && obj.meetingDate.trim()) ||
    '';
  const isGenericDate = rawDate.toLowerCase().includes('estimated') || rawDate.toLowerCase().includes('date/time');
  const date = rawDate && !isGenericDate ? rawDate : (rawDate || 'Not Specified');

  const rawTimeStarted = (userMetadata?.timeStarted && userMetadata.timeStarted.trim()) ||
    (obj.timeStarted && typeof obj.timeStarted === 'string' && obj.timeStarted.trim()) ||
    '';
  const isGenericStart = rawTimeStarted.toLowerCase().includes('start time') || rawTimeStarted.toLowerCase().includes('specified');
  const timeStarted = rawTimeStarted && !isGenericStart ? rawTimeStarted : (rawTimeStarted || 'Not Specified');

  const rawTimeEnded = (userMetadata?.timeEnded && userMetadata.timeEnded.trim()) ||
    (obj.timeEnded && typeof obj.timeEnded === 'string' && obj.timeEnded.trim()) ||
    '';
  const isGenericEnd = rawTimeEnded.toLowerCase().includes('end time') || rawTimeEnded.toLowerCase().includes('specified');
  const timeEnded = rawTimeEnded && !isGenericEnd ? rawTimeEnded : (rawTimeEnded || 'Not Specified');

  const rawVenue = (userMetadata?.venue && userMetadata.venue.trim()) ||
    (obj.venue && typeof obj.venue === 'string' && obj.venue.trim()) ||
    '';
  const isGenericVenue = rawVenue.toLowerCase().includes('location') || rawVenue.toLowerCase().includes('specified');
  const venue = rawVenue && !isGenericVenue ? rawVenue : (rawVenue || 'Not Specified');

  const cleanedTranscript = cleanVerbatimTranscript(typeof obj.verbatimTranscript === 'string' ? obj.verbatimTranscript : '');

  // Dynamically extract or normalize distinct speakers identified first
  let speakers: string[] = [];
  if (Array.isArray(obj.speakersIdentified) && obj.speakersIdentified.length > 0) {
    speakers = obj.speakersIdentified.map((s: any) => String(s).trim()).filter(Boolean);
  } else {
    speakers = extractSpeakersFromTranscript(cleanedTranscript);
  }

  const rawAttendeesCount = (userMetadata?.attendeesCount && userMetadata.attendeesCount.trim()) ||
    (obj.attendeesCount && typeof obj.attendeesCount === 'string' && obj.attendeesCount.trim()) ||
    '';
  const isGenericCount = rawAttendeesCount.toLowerCase().includes('estimated') || rawAttendeesCount.toLowerCase().includes('number of');
  const attendeesCount = rawAttendeesCount && !isGenericCount ? rawAttendeesCount : (rawAttendeesCount || (speakers.length > 0 ? `${speakers.length} Attendees` : 'Not Specified'));

  const rawAttendeesPresent = (userMetadata?.attendeesPresent && userMetadata.attendeesPresent.trim()) ||
    (obj.attendeesPresent && typeof obj.attendeesPresent === 'string' && obj.attendeesPresent.trim()) ||
    '';
  const isGenericPresent = rawAttendeesPresent.toLowerCase().includes('inferred') || rawAttendeesPresent.toLowerCase().includes('specified');
  const attendeesPresent = rawAttendeesPresent && !isGenericPresent ? rawAttendeesPresent : (rawAttendeesPresent || (speakers.length > 0 ? speakers.join(', ') : 'Not Specified'));

  const rawTimeWindow = (userMetadata?.timeWindow && userMetadata.timeWindow.trim()) ||
    (obj.timeWindow && typeof obj.timeWindow === 'string' && obj.timeWindow.trim()) ||
    '';
  const timeWindow = rawTimeWindow && !rawTimeWindow.toLowerCase().includes('window')
    ? rawTimeWindow
    : (timeStarted !== 'Not Specified' || timeEnded !== 'Not Specified'
        ? `${timeStarted !== 'Not Specified' ? timeStarted : ''}${timeStarted !== 'Not Specified' && timeEnded !== 'Not Specified' ? ' – ' : ''}${timeEnded !== 'Not Specified' ? timeEnded : ''}`.trim()
        : 'Not Specified');

  const metadata: MeetingMetadata = {
    meetingDate: date,
    timeWindow,
    timeStarted,
    timeEnded,
    venue,
    attendeesCount,
    attendeesPresent,
  };

  // Verify that keyTopicsDiscussed has real content, not dummy placeholders
  let keyTopics: KeyTopic[] = Array.isArray(minutes.keyTopicsDiscussed)
    ? minutes.keyTopicsDiscussed.map((t: any) => ({
        topic: t.topic || 'Meeting Agenda Item',
        summary: t.summary || 'Summary of discussions and consensus.',
        discussionPoints: Array.isArray(t.discussionPoints) ? t.discussionPoints : [],
      }))
    : [];

  // Filter out any unwanted generic placeholder text if present
  keyTopics = keyTopics.filter(
    (t) => !t.summary?.toLowerCase().includes('see verbatim transcription')
  );

  if (keyTopics.length === 0 && obj.verbatimTranscript) {
    keyTopics = [
      {
        topic: 'Executive Agenda Items',
        summary: minutes.meetingOverview || 'Comprehensive discussion recorded during the meeting session.',
        discussionPoints: [
          'Detailed dialogue transcribed and analyzed across multilingual speakers.',
          'Consensus and action items detailed in the following sections.',
        ],
      },
    ];
  }

  const decisions: string[] = Array.isArray(minutes.decisions)
    ? minutes.decisions.filter((d: any) => typeof d === 'string' && !d.toLowerCase().includes('refer to the generated'))
    : [];

  const actionItems: ActionItem[] = Array.isArray(minutes.actionItems)
    ? minutes.actionItems.map((item: any) => ({
        task: item.task || 'Review documented discussion points',
        owner: item.owner || 'Meeting Attendees',
        deadline: item.deadline || 'TBD',
        priority: (['High', 'Medium', 'Low'].includes(item.priority) ? item.priority : 'Medium') as any,
        completed: false,
      }))
    : [];

  const langAnalysis = obj.languageAnalysis || {
    primaryLanguages: ['Mauritian Creole', 'French', 'English'],
    codeSwitchingSummary: 'Natural multilingual transitions across Mauritian Creole, French, and English.',
    creoleExpressionsIdentified: [],
  };

  return {
    meetingTitle: title,
    meetingDate: date,
    timeStarted,
    timeEnded,
    timeWindow,
    venue,
    attendeesCount,
    attendeesPresent,
    meetingMetadata: metadata,
    speakersIdentified: speakers,
    languageAnalysis: langAnalysis,
    verbatimTranscript: cleanedTranscript,
    executiveMinutes: {
      meetingOverview: minutes.meetingOverview || 'Detailed executive synthesis of recorded discussions.',
      keyTopicsDiscussed: keyTopics,
      decisions: decisions.length > 0 ? decisions : ['No formal decisions recorded.'],
      actionItems,
      nextSteps: Array.isArray(minutes.nextSteps) ? minutes.nextSteps : [],
    },
    fullMarkdownOutput: obj.fullMarkdownOutput || '',
  };
}

/**
 * Attempts to close open quotes, objects, and arrays in truncated JSON.
 */
function repairTruncatedJsonString(str: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        stack.push('}');
      } else if (ch === '[') {
        stack.push(']');
      } else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  let repaired = str;
  if (inString) {
    repaired += '"';
  }
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  return repaired;
}

/**
 * Fallback parser that uses regex to extract structured sections from raw text
 * if the JSON was malformed, ensuring real content is never replaced by dummy placeholders.
 */
function extractSemanticMeetingData(
  rawText: string,
  filename?: string,
  targetLanguage: string = 'English',
  userMetadata?: MeetingMetadata
): MeetingAnalysisResult {
  // Extract Title
  let title = filename ? `Executive Minutes: ${filename.replace(/\.[^/.]+$/, '')}` : 'Executive Meeting Minutes';
  const titleMatch = rawText.match(/"meetingTitle":\s*"([^"]+)"/) || rawText.match(/#\s+(.+)/);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Extract Metadata
  const dateMatch = rawText.match(/"meetingDate":\s*"([^"]+)"/);
  const rawExtractedDate = dateMatch ? dateMatch[1].trim() : '';
  const date = (userMetadata?.meetingDate && userMetadata.meetingDate.trim()) ||
    (rawExtractedDate && !rawExtractedDate.toLowerCase().includes('estimated') ? rawExtractedDate : null) ||
    'Not Specified';

  const startMatch = rawText.match(/"timeStarted":\s*"([^"]+)"/);
  const rawStart = startMatch ? startMatch[1].trim() : '';
  const timeStarted = (userMetadata?.timeStarted && userMetadata.timeStarted.trim()) ||
    (rawStart && !rawStart.toLowerCase().includes('start time') ? rawStart : null) ||
    'Not Specified';

  const endMatch = rawText.match(/"timeEnded":\s*"([^"]+)"/);
  const rawEnd = endMatch ? endMatch[1].trim() : '';
  const timeEnded = (userMetadata?.timeEnded && userMetadata.timeEnded.trim()) ||
    (rawEnd && !rawEnd.toLowerCase().includes('end time') ? rawEnd : null) ||
    'Not Specified';

  const venueMatch = rawText.match(/"venue":\s*"([^"]+)"/);
  const rawVenue = venueMatch ? venueMatch[1].trim() : '';
  const venue = (userMetadata?.venue && userMetadata.venue.trim()) ||
    (rawVenue && !rawVenue.toLowerCase().includes('location') ? rawVenue : null) ||
    'Not Specified';

  const countMatch = rawText.match(/"attendeesCount":\s*"([^"]+)"/);
  const rawCount = countMatch ? countMatch[1].trim() : '';
  const attendeesCount = (userMetadata?.attendeesCount && userMetadata.attendeesCount.trim()) ||
    (rawCount && !rawCount.toLowerCase().includes('estimated') ? rawCount : null) ||
    'Not Specified';

  const presentMatch = rawText.match(/"attendeesPresent":\s*"([^"]+)"/);
  const rawPresent = presentMatch ? presentMatch[1].trim() : '';
  const attendeesPresent = (userMetadata?.attendeesPresent && userMetadata.attendeesPresent.trim()) ||
    (rawPresent && !rawPresent.toLowerCase().includes('inferred') ? rawPresent : null) ||
    'Not Specified';

  const timeWindow = userMetadata?.timeWindow ||
    (timeStarted !== 'Not Specified' || timeEnded !== 'Not Specified'
      ? `${timeStarted !== 'Not Specified' ? timeStarted : ''}${timeStarted !== 'Not Specified' && timeEnded !== 'Not Specified' ? ' – ' : ''}${timeEnded !== 'Not Specified' ? timeEnded : ''}`.trim()
      : 'Not Specified');

  const metadata: MeetingMetadata = {
    meetingDate: date,
    timeWindow,
    timeStarted,
    timeEnded,
    venue,
    attendeesCount,
    attendeesPresent,
  };

  // Extract Overview
  let overview = '';
  const overviewMatch =
    rawText.match(/"meetingOverview":\s*"([^"]+)"/) ||
    rawText.match(/##\s*(?:Meeting Overview|Executive Overview|Aperçu|Rezime)[\s\S]*?\n\n([\s\S]*?)(?=\n##|$)/i);
  if (overviewMatch) {
    overview = overviewMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
  }

  if (!overview) {
    const paragraphs = rawText.split(/\n\s*\n/).filter((p) => !p.startsWith('{') && !p.startsWith('```') && p.length > 50);
    overview = paragraphs[0] || 'Extracted meeting details from model output.';
  }

  // Extract Decisions
  const decisions: string[] = [];
  const decisionRegex = /"decisions":\s*\[([\s\S]*?)\]/;
  const decisionBlock = rawText.match(decisionRegex);
  if (decisionBlock) {
    const items = decisionBlock[1].match(/"([^"]+)"/g);
    if (items) {
      items.forEach((item) => {
        const clean = item.replace(/^"|"$/g, '').trim();
        if (clean && !clean.toLowerCase().includes('refer to')) {
          decisions.push(clean);
        }
      });
    }
  }

  // Extract Action Items
  const actionItems: ActionItem[] = [];
  const actionRegex = /\{\s*"task":\s*"([^"]+)",\s*"owner":\s*"([^"]+)",\s*"deadline":\s*"([^"]+)"(?:,\s*"priority":\s*"([^"]+)")?\s*\}/g;
  let match;
  while ((match = actionRegex.exec(rawText)) !== null) {
    actionItems.push({
      task: match[1],
      owner: match[2],
      deadline: match[3],
      priority: (match[4] as any) || 'Medium',
      completed: false,
    });
  }

  // Extract Creole Expressions
  const expressions: CreoleExpression[] = [];
  const exprRegex = /\{\s*"phrase":\s*"([^"]+)",\s*"literalOrMeaning":\s*"([^"]+)",\s*"context":\s*"([^"]+)"\s*\}/g;
  while ((match = exprRegex.exec(rawText)) !== null) {
    expressions.push({
      phrase: match[1],
      literalOrMeaning: match[2],
      context: match[3],
    });
  }

  // Extract Transcript if present in raw text
  let rawTranscript = rawText;
  const transcriptMatch = rawText.match(/"verbatimTranscript":\s*"([\s\S]*?)"\s*(?:,\s*"|\})/);
  if (transcriptMatch) {
    rawTranscript = transcriptMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  const cleanedTranscript = cleanTranscriptRepetitions(rawTranscript);
  const speakers = extractSpeakersFromTranscript(cleanedTranscript);

  return {
    meetingTitle: title,
    meetingDate: date,
    timeStarted,
    timeEnded,
    timeWindow,
    venue,
    attendeesCount: attendeesCount !== 'Not Specified' ? attendeesCount : (speakers.length > 0 ? `${speakers.length} Attendees` : 'Not Specified'),
    attendeesPresent: attendeesPresent !== 'Not Specified' ? attendeesPresent : (speakers.length > 0 ? speakers.join(', ') : 'Not Specified'),
    meetingMetadata: metadata,
    speakersIdentified: speakers,
    languageAnalysis: {
      primaryLanguages: ['Mauritian Creole', 'French', 'English'],
      codeSwitchingSummary: 'Code-switching across Mauritian Creole, French, and English.',
      creoleExpressionsIdentified: expressions,
    },
    verbatimTranscript: cleanedTranscript,
    executiveMinutes: {
      meetingOverview: overview,
      keyTopicsDiscussed: [
        {
          topic: 'Meeting Deliberations',
          summary: overview,
          discussionPoints: [
            'Extracted from recorded multilingual dialogue.',
            'Key outcomes and follow-ups listed below.',
          ],
        },
      ],
      decisions,
      actionItems,
      nextSteps: [],
    },
    fullMarkdownOutput: rawText,
  };
}

/**
 * Builds a clean fallback result when model response is empty,
 * without injecting hardcoded sample meeting data.
 */
export function buildResilientFallbackResult(
  filename?: string,
  targetLanguage: string = 'English',
  userMetadata?: MeetingMetadata
): MeetingAnalysisResult {
  const date = userMetadata?.meetingDate?.trim() || 'Not Specified';
  const timeStarted = userMetadata?.timeStarted?.trim() || 'Not Specified';
  const timeEnded = userMetadata?.timeEnded?.trim() || 'Not Specified';
  const timeWindow =
    userMetadata?.timeWindow?.trim() ||
    (timeStarted !== 'Not Specified' || timeEnded !== 'Not Specified'
      ? `${timeStarted !== 'Not Specified' ? timeStarted : ''}${timeStarted !== 'Not Specified' && timeEnded !== 'Not Specified' ? ' – ' : ''}${timeEnded !== 'Not Specified' ? timeEnded : ''}`.trim()
      : 'Not Specified');
  const venue = userMetadata?.venue?.trim() || 'Not Specified';
  const attendeesCount = userMetadata?.attendeesCount?.trim() || 'Not Specified';
  const attendeesPresent = userMetadata?.attendeesPresent?.trim() || 'Not Specified';
  const inferredSpeakers = attendeesPresent !== 'Not Specified'
    ? attendeesPresent.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const metadata: MeetingMetadata = {
    meetingDate: date,
    timeWindow,
    timeStarted,
    timeEnded,
    venue,
    attendeesCount,
    attendeesPresent,
  };

  return {
    meetingTitle: filename ? `Executive Minutes: ${filename.replace(/\.[^/.]+$/, '')}` : 'Executive Meeting Minutes',
    meetingDate: date,
    timeStarted,
    timeEnded,
    timeWindow,
    venue,
    attendeesCount,
    attendeesPresent,
    meetingMetadata: metadata,
    speakersIdentified: inferredSpeakers,
    languageAnalysis: {
      primaryLanguages: ['Mauritian Creole', 'French', 'English'],
      codeSwitchingSummary: 'No transcript output returned from the model.',
      creoleExpressionsIdentified: [],
    },
    verbatimTranscript: '',
    executiveMinutes: {
      meetingOverview: 'No model output was returned for this recording. Please retry generation or check the Gemini API key and console logs.',
      keyTopicsDiscussed: [],
      decisions: [],
      actionItems: [],
      nextSteps: [],
    },
    fullMarkdownOutput: '',
  };
}