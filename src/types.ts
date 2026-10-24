export interface ActionItem {
  task: string;
  owner?: string;
  deadline?: string;
  priority?: 'High' | 'Medium' | 'Low';
  completed?: boolean;
}

export interface KeyTopic {
  topic: string;
  summary: string;
  discussionPoints: string[];
}

export interface CreoleExpression {
  phrase: string;
  literalOrMeaning: string;
  context: string;
  expression?: string;
  translation?: string;
}

export interface LanguageAnalysis {
  primaryLanguages: string[];
  codeSwitchingSummary: string;
  creoleExpressionsIdentified: CreoleExpression[];
}

export interface ExecutiveMinutes {
  meetingOverview: string;
  keyTopicsDiscussed: KeyTopic[];
  decisions: string[];
  actionItems: ActionItem[];
  nextSteps?: string[];
}

export interface MeetingMetadata {
  meetingDate?: string;
  timeWindow?: string;
  timeStarted?: string;
  timeEnded?: string;
  venue?: string;
  attendeesCount?: string;
  attendeesPresent?: string;
}

export interface MeetingAnalysisResult {
  meetingTitle: string;
  meetingDate: string;
  timeStarted?: string;
  timeEnded?: string;
  timeWindow?: string;
  venue?: string;
  attendeesCount?: string;
  attendeesPresent?: string;
  meetingMetadata?: MeetingMetadata;
  speakersIdentified?: string[];
  languageAnalysis?: LanguageAnalysis;
  verbatimTranscript: string;
  executiveMinutes: ExecutiveMinutes;
  fullMarkdownOutput?: string;
}

export interface SampleMeeting {
  id: string;
  title: string;
  scenario: string;
  languageBreakdown: string;
  durationEst: string;
  sampleTranscriptText: string;
}

export interface AudioSelectionData {
  file: File | Blob;
  base64: string;
  mimeType: string;
  name: string;
  sizeFormatted: string;
  objectUrl: string;
  originalSizeFormatted?: string;
  compressionRatio?: number;
  sampleMetadata?: SampleMeeting;
}

export type CreoleDialect =
  | 'auto'
  | 'mauritian'
  | 'haitian'
  | 'seychellois'
  | 'french'
  | 'english';

export type MinutesLanguage =
  | 'Auto-Detect Creole Dialect'
  | 'Mauritian Creole (Kréol Morisien)'
  | 'Haitian Creole (Kreyòl Ayisyen)'
  | 'Seychellois Creole (Seselwa)'
  | 'French'
  | 'English'
  | 'Mauritian Creole';

export type TranscriptFormat =
  | 'original'
  | 'english_translation'
  | 'french_translation'
  | 'dual_original_english';

export type MinutesTone = 'diplomatic' | 'direct';

export interface GenerationOptions {
  minutesLanguage: MinutesLanguage;
  transcriptFormat: TranscriptFormat;
  minutesTone: MinutesTone;
  meetingMetadata?: MeetingMetadata;
}


