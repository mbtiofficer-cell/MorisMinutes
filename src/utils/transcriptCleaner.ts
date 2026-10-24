/**
 * Utilities for cleaning and sanitizing verbatim transcripts.
 * Enforces the DRY (Don't Repeat Yourself) principle, limits consecutive
 * duplicate words to a maximum of 2, eliminates phrase loops, deduplicates
 * runaway line repetitions, and replaces ambient static loops with [Inaudible] or [Pause].
 */

/**
 * Collapses consecutive duplicate words in a sentence or phrase to at most 2 instances.
 * e.g. "nou nou nou nou nou" -> "nou nou [Pause]"
 * e.g. "oui, oui, oui, oui" -> "oui, oui [Pause]"
 * e.g. "wi wi" -> "wi wi" (preserved, max 2 allowed)
 */
export function cleanConsecutiveDuplicateWords(text: string): string {
  if (!text || text.trim().length === 0) return text;

  // Split line into tokens preserving separators (whitespace & common punctuation)
  // We match word characters (including accents, apostrophes) and non-word separators
  const tokenRegex = /([\p{L}\p{M}0-9'’]+)|([^\p{L}\p{M}0-9'’]+)/gu;
  const matches = Array.from(text.matchAll(tokenRegex));

  if (matches.length === 0) return text;

  const resultTokens: string[] = [];
  let lastWordNormalized = '';
  let repeatCount = 0;
  let skippedAny = false;

  for (const match of matches) {
    const word = match[1];
    const separator = match[2];

    if (word !== undefined) {
      const normalized = word.toLowerCase();

      if (normalized === lastWordNormalized) {
        repeatCount++;
        if (repeatCount <= 2) {
          resultTokens.push(word);
        } else {
          // Exceeds maximum 2 consecutive duplicate words
          skippedAny = true;
        }
      } else {
        // Different word
        if (skippedAny && repeatCount >= 3) {
          // If we had skipped 3+ repeated words, append a [Pause] indicator
          resultTokens.push(' [Pause] ');
          skippedAny = false;
        }
        lastWordNormalized = normalized;
        repeatCount = 1;
        resultTokens.push(word);
      }
    } else if (separator !== undefined) {
      // Only append separator if we haven't just suppressed a duplicate word
      if (repeatCount <= 2) {
        resultTokens.push(separator);
      } else {
        // Suppress separators between skipped duplicates
        skippedAny = true;
      }
    }
  }

  if (skippedAny && repeatCount >= 3) {
    resultTokens.push(' [Pause]');
  }

  // Clean up excessive whitespace
  return resultTokens.join('').replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.:;?!])/g, '$1').trim();
}

/**
 * Detects and collapses phrase-level loops (2 to 8 words repeating 3 or more times).
 * e.g. "nou pe bizin nou pe bizin nou pe bizin nou pe bizin" -> "nou pe bizin nou pe bizin [Pause]"
 */
export function cleanRepeatedPhrases(text: string): string {
  if (!text || text.length < 20) return text;

  let cleaned = text;

  // Test phrase lengths from 8 words down to 2 words
  for (let phraseLen = 8; phraseLen >= 2; phraseLen--) {
    // Find repeating sequences of phraseLen words
    // Word pattern: [\p{L}\p{M}0-9'’]+
    const words = cleaned.match(/[\p{L}\p{M}0-9'’]+/gu) || [];
    if (words.length < phraseLen * 3) continue;

    // Check for consecutive repeating sub-arrays
    let foundLoop = false;
    for (let i = 0; i <= words.length - phraseLen * 3; i++) {
      const phrase1 = words.slice(i, i + phraseLen).map(w => w.toLowerCase()).join(' ');
      const phrase2 = words.slice(i + phraseLen, i + phraseLen * 2).map(w => w.toLowerCase()).join(' ');
      const phrase3 = words.slice(i + phraseLen * 2, i + phraseLen * 3).map(w => w.toLowerCase()).join(' ');

      if (phrase1 === phrase2 && phrase2 === phrase3) {
        // We found a phrase repeating at least 3 times
        foundLoop = true;
        // Count how many times it repeats consecutively
        let k = 3;
        while (i + phraseLen * (k + 1) <= words.length) {
          const nextPhrase = words.slice(i + phraseLen * k, i + phraseLen * (k + 1)).map(w => w.toLowerCase()).join(' ');
          if (nextPhrase === phrase1) {
            k++;
          } else {
            break;
          }
        }

        // Build a regex to replace this specific phrase repeating k times with 2 instances + [Pause]
        // Escape special regex characters in the phrase words
        const escapedPhrase = words.slice(i, i + phraseLen)
          .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('[\\s,;.:\\-]+');
        
        const loopRegex = new RegExp(`(?:${escapedPhrase}[\\s,;.:\\-]*){3,}`, 'gi');
        const twoInstances = `${words.slice(i, i + phraseLen).join(' ')} ${words.slice(i, i + phraseLen).join(' ')} [Pause]`;
        cleaned = cleaned.replace(loopRegex, twoInstances);
        break;
      }
    }

    if (foundLoop) {
      // Re-evaluate from top if modified
      cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').trim();
    }
  }

  return cleaned;
}

/**
 * Checks if a line is an uninformative stutter loop or pure acoustic artifact.
 * e.g. "nou nou nou nou..." or "oui oui oui oui..."
 */
export function isRunawayArtifactLine(dialogue: string): boolean {
  if (!dialogue) return false;
  const words = dialogue.match(/[\p{L}\p{M}0-9'’]+/gu) || [];
  if (words.length === 0) return false;

  // If line has 6+ words and >80% are the same word, it's an artifact
  if (words.length >= 6) {
    const wordCounts = new Map<string, number>();
    for (const w of words) {
      const lower = w.toLowerCase();
      wordCounts.set(lower, (wordCounts.get(lower) || 0) + 1);
    }
    const maxFreq = Math.max(...wordCounts.values());
    if (maxFreq / words.length >= 0.75) {
      return true;
    }
  }

  return false;
}

/**
 * Processes a single line of verbatim transcript:
 * Extracts timestamp, speaker tag, and dialogue; applies word-level and phrase-level deduplication;
 * limits duplicate consecutive words to maximum 2; and handles static/silence markers.
 */
export function cleanTranscriptLine(rawLine: string): string {
  if (!rawLine || !rawLine.trim()) return '';

  const trimmed = rawLine.trim();

  // Match optional timestamp, e.g., "[00:15]" or "00:15"
  const timestampMatch = trimmed.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\]|\d{1,2}:\d{2})\s*/);
  const timestamp = timestampMatch ? timestampMatch[1].replace(/^(\d)/, '[$1').replace(/(\d)$/, '$1]') : '';
  const afterTimestamp = timestampMatch ? trimmed.substring(timestampMatch[0].length).trim() : trimmed;

  // Match speaker label, e.g. "Speaker 1 - Président [Kreol]:" or "Pasteur Kevin:"
  const speakerMatch = afterTimestamp.match(/^(\[?[^:\n\]]+\]?[^:]*):\s*(.*)$/);

  let prefix = '';
  let dialogue = afterTimestamp;

  if (speakerMatch) {
    const speakerHeader = speakerMatch[1].trim();
    dialogue = speakerMatch[2].trim();
    prefix = timestamp ? `${timestamp} ${speakerHeader}: ` : `${speakerHeader}: `;
  } else if (timestamp) {
    prefix = `${timestamp} `;
  }

  // Check if dialogue is a runaway artifact
  if (isRunawayArtifactLine(dialogue)) {
    const words = dialogue.match(/[\p{L}\p{M}0-9'’]+/gu) || [];
    const sampleWord = words[0] || 'speech';
    // Collapse to max 2 instances and mark pause
    dialogue = `${sampleWord} ${sampleWord} [Pause / Inaudible]`;
  } else {
    // 1. Clean consecutive duplicate words (max 2 instances)
    dialogue = cleanConsecutiveDuplicateWords(dialogue);
    // 2. Clean repeating phrase loops (3+ repetitions -> max 2 + [Pause])
    dialogue = cleanRepeatedPhrases(dialogue);
  }

  // Normalize silence / ambient markers
  dialogue = dialogue
    .replace(/\[(?:silence|static|noise|ambient|bruit)\]/gi, '[Inaudible]')
    .replace(/(?:\[Inaudible\]\s*){2,}/gi, '[Inaudible] ')
    .replace(/(?:\[Pause\]\s*){2,}/gi, '[Pause] ')
    .trim();

  return prefix ? `${prefix}${dialogue}` : dialogue;
}

/**
 * Full Verbatim Transcript Cleaner and Truncator:
 * - Truncates infinite loop degeneration
 * - Cleans consecutive duplicate words (max 2 instances)
 * - Cleans phrase loops (3+ phrase repetitions)
 * - Removes consecutive duplicate lines (max 2 similar consecutive lines)
 * - Filters out static loops and handles inaudible/pause gracefully
 */
export function cleanVerbatimTranscript(transcript: string | null | undefined): string {
  if (!transcript || typeof transcript !== 'string') {
    return '';
  }

  const rawLines = transcript.split('\n');
  const cleanedLines: string[] = [];
  let prevDialogueNormalized = '';
  let consecutiveSameLineCount = 0;

  for (const rawLine of rawLines) {
    const cleanLine = cleanTranscriptLine(rawLine);
    if (!cleanLine.trim()) continue;

    // Extract dialogue content for cross-line loop detection
    const colonIdx = cleanLine.indexOf(':');
    const dialogueOnly = (colonIdx !== -1 ? cleanLine.substring(colonIdx + 1) : cleanLine)
      .toLowerCase()
      .replace(/[^\p{L}0-9]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (dialogueOnly && dialogueOnly === prevDialogueNormalized) {
      consecutiveSameLineCount++;
      if (consecutiveSameLineCount <= 2) {
        // Allow at most 2 consecutive identical dialogue lines
        cleanedLines.push(cleanLine);
      } else if (consecutiveSameLineCount === 3) {
        // On 3rd identical line, truncate and append pause
        cleanedLines.push(`${cleanLine.split(':')[0]}: [Pause / Repetition Truncated]`);
      }
      // Skip 4th and beyond
    } else {
      consecutiveSameLineCount = 1;
      prevDialogueNormalized = dialogueOnly;
      cleanedLines.push(cleanLine);
    }
  }

  return cleanedLines.join('\n');
}
