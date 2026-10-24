import { jsPDF } from 'jspdf';
import { MeetingAnalysisResult } from '../types';
import { cleanVerbatimTranscript } from './transcriptCleaner';

/**
 * Sanitizes typographic punctuation and unsupported Unicode characters
 * to standard ASCII equivalents so jsPDF standard fonts render cleanly.
 */
function sanitizeForPdf(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2014]/g, ' - ') // Em dash
    .replace(/[\u2013]/g, '-') // En dash
    .replace(/[\u2026]/g, '...') // Ellipsis
    .replace(/[\u00A0]/g, ' ') // Non-breaking space
    .replace(/[\u2022\u25E6\u2219]/g, '*') // Unicode bullets
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function escapeHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportToMarkdown(result: MeetingAnalysisResult): void {
  const mdContent = result.fullMarkdownOutput || generateMarkdownString(result);
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = (result.meetingTitle || 'Meeting_Minutes')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  link.download = `${safeTitle}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToWord(result: MeetingAnalysisResult): void {
  const safeTitle = (result.meetingTitle || 'Meeting_Minutes')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');

  const titleEsc = escapeHtml(result.meetingTitle || 'Executive Meeting Minutes');
  const dateEsc = escapeHtml(result.meetingDate || 'Not Specified');
  const timeStr = result.timeWindow && result.timeWindow !== 'Not Specified'
    ? result.timeWindow
    : (result.timeStarted || result.timeEnded
      ? `${result.timeStarted || ''}${result.timeStarted && result.timeEnded ? ' – ' : ''}${result.timeEnded || ''}`.trim()
      : 'Not Specified');
  const timeEsc = escapeHtml(timeStr);
  const venueEsc = escapeHtml(result.venue || 'Not Specified');
  const countEsc = escapeHtml(result.attendeesCount || (result.speakersIdentified?.length ? `${result.speakersIdentified.length} Attendees` : 'Not Specified'));
  const presentEsc = escapeHtml(result.attendeesPresent || (result.speakersIdentified?.length ? result.speakersIdentified.join(', ') : 'Not Specified'));

  const xmlContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Microsoft Word 15">
  <meta name="Originator" content="Microsoft Word 15">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
      <w:AllowPNG/>
      <w:Compatibility>
        <w:UseWord2002TableStyleRules/>
        <w:UseWord2010TableStyleRules/>
      </w:Compatibility>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <title>${titleEsc}</title>
  <style>
    @page Section1 {
      size: 595.3pt 841.9pt; /* A4 Portrait */
      margin: 54.0pt 54.0pt 54.0pt 54.0pt;
      mso-header-margin: 36.0pt;
      mso-footer-margin: 36.0pt;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      color: #0284c7;
      border-bottom: 2pt solid #0284c7;
      padding-bottom: 6pt;
      margin-top: 0pt;
      margin-bottom: 10pt;
      font-weight: bold;
    }
    h2 {
      font-size: 14pt;
      color: #0f172a;
      border-bottom: 1pt solid #cbd5e1;
      padding-bottom: 4pt;
      margin-top: 18pt;
      margin-bottom: 8pt;
      font-weight: bold;
    }
    h3 {
      font-size: 12pt;
      color: #0369a1;
      margin-top: 12pt;
      margin-bottom: 4pt;
      font-weight: bold;
    }
    h4 {
      font-size: 10.5pt;
      color: #0284c7;
      margin-top: 8pt;
      margin-bottom: 2pt;
      font-weight: bold;
    }
    p {
      margin: 4pt 0 6pt 0;
      font-size: 10.5pt;
    }
    ul {
      margin-top: 4pt;
      margin-bottom: 8pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 3pt;
      font-size: 10pt;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8pt 0 14pt 0;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      mso-padding-alt: 6pt 8pt 6pt 8pt;
    }
    th {
      background-color: #0f172a;
      color: #ffffff;
      font-weight: bold;
      text-align: left;
      padding: 6pt 8pt;
      border: 1pt solid #0f172a;
      font-size: 9.5pt;
    }
    td {
      padding: 6pt 8pt;
      border: 1pt solid #cbd5e1;
      font-size: 9.5pt;
      vertical-align: top;
    }
    .meta-table {
      width: 100%;
      background-color: #f8fafc;
      border: 1pt solid #cbd5e1;
      margin-bottom: 16pt;
    }
    .meta-table td {
      border: 1pt solid #e2e8f0;
      padding: 6pt 8pt;
      font-size: 9.5pt;
    }
    .meta-label {
      font-weight: bold;
      color: #0f172a;
      background-color: #f1f5f9;
      width: 20%;
    }
    .badge-high { color: #dc2626; font-weight: bold; }
    .badge-med { color: #d97706; font-weight: bold; }
    .badge-low { color: #16a34a; font-weight: bold; }
    .transcript-line {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 9.5pt;
      background-color: #f8fafc;
      border-left: 3pt solid #0284c7;
      padding: 4pt 8pt;
      margin-bottom: 4pt;
    }
    .page-break {
      page-break-before: always;
      mso-break-type: section-break;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <h1>${titleEsc}</h1>

    <table class="meta-table">
      <tr>
        <td class="meta-label">Meeting Date:</td>
        <td style="width: 30%;">${dateEsc}</td>
        <td class="meta-label">Time Window:</td>
        <td style="width: 30%;">${timeEsc}</td>
      </tr>
      <tr>
        <td class="meta-label">Venue / Location:</td>
        <td>${venueEsc}</td>
        <td class="meta-label">Attendance:</td>
        <td>${countEsc}</td>
      </tr>
      <tr>
        <td class="meta-label">Attendees Present:</td>
        <td colspan="3">${presentEsc}</td>
      </tr>
      <tr>
        <td class="meta-label">Language Standard:</td>
        <td colspan="3">Section 1: Corporate English Executive Minutes &bull; Section 2: Authentic Spoken Creole/French/English Verbatim</td>
      </tr>
    </table>

    <h2>1. Executive Meeting Minutes</h2>
    
    <h3>Meeting Overview</h3>
    ${result.executiveMinutes.meetingOverview.includes('\n') || /^[•\-\*]/m.test(result.executiveMinutes.meetingOverview)
      ? `<ul>${result.executiveMinutes.meetingOverview.split('\n').filter(l => l.trim()).map(line => `<li>${escapeHtml(line.replace(/^[•\-\*]\s*/, '').trim())}</li>`).join('')}</ul>`
      : `<p>${escapeHtml(result.executiveMinutes.meetingOverview)}</p>`}

    ${result.executiveMinutes.keyTopicsDiscussed && result.executiveMinutes.keyTopicsDiscussed.length > 0 ? `
      <h3>Key Topics Discussed</h3>
      ${result.executiveMinutes.keyTopicsDiscussed
        .map(
          (t, idx) => `
        <div style="margin-bottom: 12pt;">
          <h4>${idx + 1}. ${escapeHtml(t.topic)}</h4>
          <p>${escapeHtml(t.summary)}</p>
          ${t.discussionPoints && t.discussionPoints.length > 0 ? `
            <ul>
              ${t.discussionPoints.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `
        )
        .join('')}
    ` : ''}

    ${result.executiveMinutes.decisions && result.executiveMinutes.decisions.length > 0 ? `
      <h3>Decisions Agreed</h3>
      <ul>
        ${result.executiveMinutes.decisions.map(d => `<li><strong>[AGREED]</strong> ${escapeHtml(d)}</li>`).join('')}
      </ul>
    ` : ''}

    ${result.executiveMinutes.actionItems && result.executiveMinutes.actionItems.length > 0 ? `
      <h3>Action Items Table</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 14%;">Priority</th>
            <th style="width: 48%;">Task Description</th>
            <th style="width: 20%;">Designated Owner</th>
            <th style="width: 18%;">Target Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${result.executiveMinutes.actionItems
            .map(a => {
              const p = (a.priority || 'Medium').toUpperCase();
              const pClass = p.includes('HIGH') ? 'badge-high' : p.includes('LOW') ? 'badge-low' : 'badge-med';
              return `
            <tr>
              <td><span class="${pClass}">[${escapeHtml(a.priority || 'Medium')}]</span></td>
              <td>${escapeHtml(a.task)}</td>
              <td>${escapeHtml(a.owner || 'Unassigned')}</td>
              <td>${escapeHtml(a.deadline || 'TBD')}</td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>
    ` : ''}

    ${result.languageAnalysis?.creoleExpressionsIdentified && result.languageAnalysis.creoleExpressionsIdentified.length > 0 ? `
      <h3>Idioms &amp; Creole Expressions Identified</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Expression</th>
            <th style="width: 35%;">Direct Translation</th>
            <th style="width: 40%;">Contextual Meaning</th>
          </tr>
        </thead>
        <tbody>
          ${result.languageAnalysis.creoleExpressionsIdentified
            .map(
              e => `
            <tr>
              <td><strong>${escapeHtml(e.phrase || e.expression || '')}</strong></td>
              <td>${escapeHtml(e.literalOrMeaning || e.translation || '')}</td>
              <td>${escapeHtml(e.context || '')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    ` : ''}

    <br clear="all" class="page-break" style="page-break-before:always; mso-break-type:section-break" />

    <h2>2. Verbatim Multilingual Transcript</h2>
    <p style="font-size: 9pt; color: #64748b; margin-bottom: 8pt;">
      Exact spoken dialogue preserving authentic Creole, French &amp; English code-switching with dynamic speaker attribution and timestamps.
    </p>
    <div>
      ${cleanVerbatimTranscript(result.verbatimTranscript)
        .split('\n')
        .filter(l => l.trim())
        .map(line => `<div class="transcript-line">${escapeHtml(line)}</div>`)
        .join('')}
    </div>
  </div>
</body>
</html>
  `.trim();

  // Create UTF-8 BOM blob with clean HTML-MIME application/msword type
  const blob = new Blob(['\ufeff', xmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportToDoc(result: MeetingAnalysisResult): void {
  exportToWord(result);
}

export function exportToDocx(result: MeetingAnalysisResult): void {
  exportToWord(result);
}

/**
 * Generates an executive, professional multi-page PDF document using jsPDF:
 * - Line-by-line pagination ensures zero text cutoff across any number of pages.
 * - Explicit page break between Section 1 (Executive Minutes) and Section 2 (Transcript).
 * - Section 2 (Verbatim Transcript) expands across as many pages as necessary.
 * - Clean running headers, footers, and page numbers ("Page X of Y") render on all pages.
 */
export function generateMeetingPDFDoc(result: MeetingAnalysisResult): jsPDF {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 40;
  const contentWidth = pageWidth - margin * 2; // 515.28 pt

  // Safe vertical content margins (Header rule at 38pt, Footer rule at 807pt)
  const topMargin = 54;
  const bottomMargin = 54;
  const maxY = pageHeight - bottomMargin; // 787.89 pt (leaves 20pt buffer before footer)

  let cursorY = topMargin;

  // Add new page helper
  const addNewPage = () => {
    doc.addPage();
    cursorY = topMargin;
  };

  // Ensure enough vertical space exists; if not, wrap to new page (page-break-inside: avoid)
  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > maxY) {
      addNewPage();
    }
  };

  // Text writer that checks every line against maxY for seamless multi-page wrapping
  const printWrappedLines = (
    text: string,
    x: number,
    maxWidth: number,
    lineHeight: number,
    fontStyle: {
      fontName?: string;
      fontStyle?: string;
      fontSize?: number;
      textColor?: [number, number, number];
    } = {}
  ): void => {
    const sanitized = sanitizeForPdf(text);
    if (!sanitized) return;

    const applyStyle = () => {
      doc.setFont(fontStyle.fontName || 'helvetica', fontStyle.fontStyle || 'normal');
      if (fontStyle.fontSize) doc.setFontSize(fontStyle.fontSize);
      if (fontStyle.textColor) {
        doc.setTextColor(fontStyle.textColor[0], fontStyle.textColor[1], fontStyle.textColor[2]);
      }
    };

    applyStyle();
    const lines = doc.splitTextToSize(sanitized, maxWidth);

    for (const line of lines) {
      if (cursorY + lineHeight > maxY) {
        addNewPage();
        applyStyle();
      }
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    }
  };

  /* =====================================================================
     PAGE 1: DOCUMENT HEADER & METADATA
     ===================================================================== */

  // Top Organization Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('END-TIME WORSHIPPERS • EXECUTIVE LEADERSHIP MINUTES', margin, cursorY);
  cursorY += 16;

  // Main Meeting Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  const titleText = sanitizeForPdf(result.meetingTitle || 'Meeting Minutes');
  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  for (const line of titleLines) {
    doc.text(line, margin, cursorY);
    cursorY += 22;
  }
  cursorY += 2;

  // Prominent Executive Meeting Metadata Box
  const timeStr = result.timeWindow && result.timeWindow !== 'Not Specified'
    ? result.timeWindow
    : (result.timeStarted || result.timeEnded
      ? `${result.timeStarted || ''}${result.timeStarted && result.timeEnded ? ' – ' : ''}${result.timeEnded || ''}`.trim()
      : 'Not Specified');
  const venueStr = result.venue || 'Not Specified';
  const dateStr = result.meetingDate || 'Not Specified';
  const countStr = result.attendeesCount || (result.speakersIdentified?.length ? `${result.speakersIdentified.length} Attendees` : 'Not Specified');
  const presentStr = result.attendeesPresent || (result.speakersIdentified?.length ? result.speakersIdentified.join(', ') : 'Not Specified');

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.8);

  const colWidth = (contentWidth - 20) / 2;
  const col2X = margin + colWidth + 14;

  const venueLines = doc.splitTextToSize(sanitizeForPdf(venueStr), colWidth - 52);
  const countLines = doc.splitTextToSize(sanitizeForPdf(countStr), colWidth - 75);
  const presentLines = doc.splitTextToSize(sanitizeForPdf(presentStr), contentWidth - 76);

  const row1Height = 14;
  const row2Height = Math.max(venueLines.length * 11, countLines.length * 11, 14);
  const row3Height = Math.max(presentLines.length * 11, 14);
  const row4Height = 13;
  const boxPadding = 10;
  const boxHeight = (boxPadding * 2) + row1Height + row2Height + row3Height + row4Height + 6;

  ensureSpace(boxHeight + 20);
  const boxTop = cursorY;
  doc.roundedRect(margin, boxTop, contentWidth, boxHeight, 4, 4, 'FD');

  let boxCursorY = boxTop + boxPadding + 8;

  // Metadata Row 1: Date & Time Window
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('Date:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85); // slate-700
  doc.text(sanitizeForPdf(dateStr), margin + 44, boxCursorY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Time Window:', col2X, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(sanitizeForPdf(timeStr), col2X + 68, boxCursorY);

  boxCursorY += row1Height;

  // Metadata Row 2: Venue & Attendees Count
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Venue:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  venueLines.forEach((vLine: string, vIdx: number) => {
    doc.text(vLine, margin + 48, boxCursorY + (vIdx * 11));
  });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Attendance:', col2X, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  countLines.forEach((cLine: string, cIdx: number) => {
    doc.text(cLine, col2X + 62, boxCursorY + (cIdx * 11));
  });

  boxCursorY += row2Height;

  // Metadata Row 3: Attendees Present List
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Attendees:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  presentLines.forEach((pLine: string, pIdx: number) => {
    doc.text(pLine, margin + 66, boxCursorY + (pIdx * 11));
  });

  boxCursorY += row3Height;

  // Metadata Row 4: Source Languages & Diarization
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Languages:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const langStr = `Section 1: Corporate English Minutes • Section 2: Exact Spoken Creole/French/English (${result.speakersIdentified?.length || 0} Speakers)`;
  doc.text(sanitizeForPdf(langStr), margin + 66, boxCursorY);

  cursorY = boxTop + boxHeight + 14;

  // Decorative Accent Divider
  doc.setDrawColor(2, 132, 199); // sky-600
  doc.setLineWidth(1.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 20;

  /* =====================================================================
     SECTION 1: EXECUTIVE MEETING MINUTES
     ===================================================================== */

  // Section 1 Main Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('1. Executive Meeting Minutes', margin, cursorY);
  cursorY += 16;

  // --- 1.1 Meeting Overview ---
  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Meeting Overview', margin, cursorY);
  cursorY += 14;

  const overviewText = result.executiveMinutes.meetingOverview || 'Overview recorded in session audio.';
  printWrappedLines(overviewText, margin, contentWidth, 13, {
    fontName: 'helvetica',
    fontStyle: 'normal',
    fontSize: 9.5,
    textColor: [51, 65, 85], // slate-700
  });
  cursorY += 14;

  // --- 1.2 Key Topics Discussed ---
  if (result.executiveMinutes.keyTopicsDiscussed && result.executiveMinutes.keyTopicsDiscussed.length > 0) {
    ensureSpace(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('Key Topics Discussed', margin, cursorY);
    cursorY += 14;

    result.executiveMinutes.keyTopicsDiscussed.forEach((topic, idx) => {
      ensureSpace(40);

      // Topic title (wrapped to prevent any right-edge clipping)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(3, 105, 161); // sky-700
      const topicTitleLines = doc.splitTextToSize(sanitizeForPdf(`${idx + 1}. ${topic.topic}`), contentWidth - 8);
      for (const tLine of topicTitleLines) {
        if (cursorY + 13 > maxY) addNewPage();
        doc.text(tLine, margin + 4, cursorY);
        cursorY += 13;
      }

      // Topic summary
      if (topic.summary) {
        printWrappedLines(topic.summary, margin + 12, contentWidth - 16, 12, {
          fontName: 'helvetica',
          fontStyle: 'normal',
          fontSize: 9,
          textColor: [71, 85, 105],
        });
        cursorY += 4;
      }

      // Discussion bullet points
      if (topic.discussionPoints && topic.discussionPoints.length > 0) {
        topic.discussionPoints.forEach(point => {
          ensureSpace(16);
          const sanitizedPoint = sanitizeForPdf(point);
          const bulletLines = doc.splitTextToSize(`- ${sanitizedPoint}`, contentWidth - 24);
          for (let bIdx = 0; bIdx < bulletLines.length; bIdx++) {
            if (cursorY + 11.5 > maxY) {
              addNewPage();
            }
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text(bulletLines[bIdx], margin + 18, cursorY);
            cursorY += 11.5;
          }
        });
        cursorY += 4;
      }
      cursorY += 6;
    });
    cursorY += 8;
  }

  // --- 1.3 Decisions Agreed ---
  if (result.executiveMinutes.decisions && result.executiveMinutes.decisions.length > 0) {
    ensureSpace(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Decisions Agreed', margin, cursorY);
    cursorY += 14;

    result.executiveMinutes.decisions.forEach(decision => {
      ensureSpace(24);
      const sanitizedDec = sanitizeForPdf(decision);
      const decLines = doc.splitTextToSize(`[AGREED] ${sanitizedDec}`, contentWidth - 14);

      for (let dIdx = 0; dIdx < decLines.length; dIdx++) {
        if (cursorY + 12 > maxY) {
          addNewPage();
        }
        if (dIdx === 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(5, 150, 105); // emerald-600
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(30, 41, 59);
        }
        doc.text(decLines[dIdx], margin + 8, cursorY);
        cursorY += 12;
      }
      cursorY += 3;
    });
    cursorY += 10;
  }

  // --- 1.4 Action Items Table ---
  if (result.executiveMinutes.actionItems && result.executiveMinutes.actionItems.length > 0) {
    ensureSpace(65);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Action Items Table', margin, cursorY);
    cursorY += 12;

    // Explicit Column Widths matching contentWidth exactly (515.28 pt)
    const colPriority = 54;
    const colOwner = 108;
    const colDue = 105;
    const colTask = contentWidth - (colPriority + colOwner + colDue); // ~248.28 pt

    const col0X = margin;
    const col1X = margin + colPriority;
    const col2X = margin + colPriority + colTask;
    const col3X = margin + colPriority + colTask + colOwner;

    const padX = 6;
    const padY = 7;
    const lineStep = 11.5;
    const headerHeight = 20;

    // Render Table Header Row with column dividers
    const renderTableHeader = () => {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(margin, cursorY, contentWidth, headerHeight, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);

      doc.text('Priority', col0X + padX, cursorY + 14);
      doc.text('Task Description', col1X + padX, cursorY + 14);
      doc.text('Designated Owner', col2X + padX, cursorY + 14);
      doc.text('Target Due Date', col3X + padX, cursorY + 14);

      // Header column separator lines
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.5);
      doc.line(col1X, cursorY, col1X, cursorY + headerHeight);
      doc.line(col2X, cursorY, col2X, cursorY + headerHeight);
      doc.line(col3X, cursorY, col3X, cursorY + headerHeight);

      cursorY += headerHeight;
    };

    renderTableHeader();

    result.executiveMinutes.actionItems.forEach((item, index) => {
      const sanitizedTask = sanitizeForPdf(item.task);
      const sanitizedOwner = sanitizeForPdf(item.owner || 'Unassigned');
      const sanitizedDue = sanitizeForPdf(item.deadline || 'TBD');
      const priorityLabel = (item.priority || 'Medium').toUpperCase();

      // Word wrapping inside each cell's usable width
      const taskLines = doc.splitTextToSize(sanitizedTask, colTask - padX * 2);
      const ownerLines = doc.splitTextToSize(sanitizedOwner, colOwner - padX * 2);
      const dueLines = doc.splitTextToSize(sanitizedDue, colDue - padX * 2);

      const maxLineCount = Math.max(taskLines.length, ownerLines.length, dueLines.length, 1);
      const rowHeight = Math.max(maxLineCount * lineStep + padY * 2, 22);

      // Multi-page table wrapping: break cleanly and re-draw header
      if (cursorY + rowHeight > maxY) {
        addNewPage();
        renderTableHeader();
      }

      // Alternate row background shading
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(margin, cursorY, contentWidth, rowHeight, 'F');
      }

      // Outer row border
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.rect(margin, cursorY, contentWidth, rowHeight, 'S');

      // Vertical column dividers
      doc.line(col1X, cursorY, col1X, cursorY + rowHeight);
      doc.line(col2X, cursorY, col2X, cursorY + rowHeight);
      doc.line(col3X, cursorY, col3X, cursorY + rowHeight);

      const baselineY = cursorY + padY + 8;

      // Priority Column with colored badge
      if (priorityLabel.includes('HIGH')) {
        doc.setTextColor(225, 29, 72); // rose-600
      } else if (priorityLabel.includes('LOW')) {
        doc.setTextColor(16, 185, 129); // emerald-500
      } else {
        doc.setTextColor(217, 119, 6); // amber-600
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`[${priorityLabel.slice(0, 4)}]`, col0X + padX, baselineY);

      // Task Description Column (wrapped)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800
      taskLines.forEach((tLine: string, lineIdx: number) => {
        doc.text(tLine, col1X + padX, baselineY + lineIdx * lineStep);
      });

      // Owner Column (wrapped)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600
      ownerLines.forEach((oLine: string, lineIdx: number) => {
        doc.text(oLine, col2X + padX, baselineY + lineIdx * lineStep);
      });

      // Due Date Column (wrapped)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      dueLines.forEach((dLine: string, lineIdx: number) => {
        doc.text(dLine, col3X + padX, baselineY + lineIdx * lineStep);
      });

      cursorY += rowHeight;
    });
    cursorY += 12;
  }

  // --- 1.5 Idioms & Cultural Phrases ---
  if (result.languageAnalysis?.creoleExpressionsIdentified && result.languageAnalysis.creoleExpressionsIdentified.length > 0) {
    ensureSpace(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Idioms & Creole Expressions Identified', margin, cursorY);
    cursorY += 14;

    result.languageAnalysis.creoleExpressionsIdentified.forEach(item => {
      ensureSpace(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(180, 83, 9); // amber-700
      const exprName = item.phrase || item.expression || '';
      doc.text(`"${sanitizeForPdf(exprName)}"`, margin + 6, cursorY);
      cursorY += 12;

      const transl = item.literalOrMeaning || item.translation || '';
      const detail = `Meaning: ${transl}  |  Context: ${item.context || ''}`;
      printWrappedLines(detail, margin + 14, contentWidth - 18, 11, {
        fontName: 'helvetica',
        fontStyle: 'normal',
        fontSize: 8.5,
        textColor: [71, 85, 105],
      });
      cursorY += 4;
    });
    cursorY += 10;
  }

  /* =====================================================================
     EXPLICIT PAGE BREAK: SECTION 1 -> SECTION 2
     Requirement: Add explicit page break between Section 1 & Section 2
     ===================================================================== */
  addNewPage();
  const section2StartPage = doc.getNumberOfPages();

  /* =====================================================================
     SECTION 2: VERBATIM MULTILINGUAL TRANSCRIPT
     Requirement: Allow multi-page expansion across as many pages as needed
     ===================================================================== */

  // Section 2 Title Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('2. Verbatim Multilingual Transcript', margin, cursorY);
  cursorY += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    'Sentence-by-sentence dialogue preserving authentic Creole, French & English verbatim line-by-line.',
    margin,
    cursorY
  );
  cursorY += 12;

  // Transcript Header Rule
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.0);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 16;

  // Process and print all transcript lines across multi-page space (with anti-loop cleaning)
  const rawTranscriptLines = cleanVerbatimTranscript(result.verbatimTranscript || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  rawTranscriptLines.forEach(rawLine => {
    const cleanLine = sanitizeForPdf(rawLine);
    if (!cleanLine) return;

    // Check if line starts with timestamp like [00:01:23] or [01:23]
    const timestampMatch = cleanLine.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\])\s*/);
    const timestamp = timestampMatch ? timestampMatch[1] : null;
    let remainder = timestampMatch ? cleanLine.substring(timestampMatch[0].length).trim() : cleanLine;

    // Check if there is a speaker label (e.g. "Speaker 1 - Président:" or "Pasteur Kevin:")
    const speakerColonMatch = remainder.match(/^(\[?[^:\]]+\]?[^:]*):\s*(.*)$/);

    if (speakerColonMatch) {
      const speakerHeader = speakerColonMatch[1].trim();
      const dialogueBody = speakerColonMatch[2].trim();

      // Ensure space for speaker title + dialogue lines (avoid orphan speaker titles)
      ensureSpace(34);

      // Render Speaker Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(3, 105, 161); // sky-700

      const fullSpeakerLabel = timestamp ? `${timestamp} ${speakerHeader}:` : `${speakerHeader}:`;
      const wrappedHeader = doc.splitTextToSize(fullSpeakerLabel, contentWidth);
      for (const hLine of wrappedHeader) {
        if (cursorY + 12 > maxY) addNewPage();
        doc.text(hLine, margin, cursorY);
        cursorY += 12;
      }

      // Render Dialogue Text
      if (dialogueBody) {
        const isBracketAnnotation = dialogueBody.startsWith('[') && dialogueBody.endsWith(']');
        const dialogueLines = doc.splitTextToSize(dialogueBody, contentWidth - 14);

        for (const dLine of dialogueLines) {
          if (cursorY + 11.5 > maxY) {
            addNewPage();
          }
          if (isBracketAnnotation) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(148, 163, 184); // slate-400
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59); // slate-800
          }
          doc.text(dLine, margin + 12, cursorY);
          cursorY += 11.5;
        }
      }
      cursorY += 5;
    } else {
      // Line without explicit speaker colon
      const isDualSubLine = cleanLine.startsWith('Original:') || cleanLine.startsWith('English:') || cleanLine.startsWith('French:') || cleanLine.startsWith('↳');
      const isAnnotation = cleanLine.startsWith('[') && cleanLine.endsWith(']');

      const subLines = doc.splitTextToSize(cleanLine, contentWidth - (isDualSubLine ? 16 : 8));
      for (const sLine of subLines) {
        if (cursorY + 11 > maxY) {
          addNewPage();
        }
        if (isDualSubLine) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(cleanLine.startsWith('English:') ? 15 : 71, cleanLine.startsWith('English:') ? 118 : 85, cleanLine.startsWith('English:') ? 110 : 105);
          doc.text(sLine, margin + 16, cursorY);
        } else if (isAnnotation) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(148, 163, 184);
          doc.text(sLine, margin + 8, cursorY);
        } else {
          doc.setFont('courier', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(51, 65, 85);
          doc.text(sLine, margin + 8, cursorY);
        }
        cursorY += 11;
      }
      cursorY += 4;
    }
  });

  /* =====================================================================
     RUNNING HEADERS, FOOTERS & PAGE NUMBERS ACROSS ALL GENERATED PAGES
     ===================================================================== */
  const totalPages = doc.getNumberOfPages();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // 1. Running Top Header (rendered on pages 2 through totalPages)
    if (pageNum > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500

      // Left: Document Title
      const rawTitle = sanitizeForPdf(result.meetingTitle || 'Meeting Minutes');
      const headerTitle = rawTitle.length > 55 ? `${rawTitle.substring(0, 52)}...` : rawTitle;
      doc.text(headerTitle, margin, 32);

      // Right: Section Indicator
      const currentSection = pageNum < section2StartPage ? 'Section 1: Executive Minutes' : 'Section 2: Verbatim Transcript';
      doc.text(currentSection, pageWidth - margin, 32, { align: 'right' });

      // Header Divider Rule
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(margin, 38, pageWidth - margin, 38);
    }

    // 2. Running Bottom Footer (rendered on ALL pages)
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500

    // Left: Document Attribution & Confidentiality
    doc.text(
      'End-Time Worshippers • AI Multilingual Minutes • Confidential',
      margin,
      pageHeight - 20
    );

    // Right: Clean Page Number "Page X of Y"
    const pageNumStr = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageNumStr, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  return doc;
}

export function exportToPDF(result: MeetingAnalysisResult): void {
  const doc = generateMeetingPDFDoc(result);
  const safeTitle = (result.meetingTitle || 'Meeting_Minutes')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  doc.save(`${safeTitle}.pdf`);
}

function generateMarkdownString(result: MeetingAnalysisResult): string {
  let md = `# ${result.meetingTitle}\n\n`;
  md += `| Meeting Parameter | Detail |\n`;
  md += `|---|---|\n`;
  md += `| **Meeting Date** | ${result.meetingDate || 'Not Specified'} |\n`;
  md += `| **Time Window** | ${result.timeWindow || (result.timeStarted || result.timeEnded ? `${result.timeStarted || 'Not Specified'} – ${result.timeEnded || 'Not Specified'}` : 'Not Specified')} |\n`;
  md += `| **Venue / Location** | ${result.venue || 'Not Specified'} |\n`;
  md += `| **Number of Attendees** | ${result.attendeesCount || (result.speakersIdentified?.length ? `${result.speakersIdentified.length} Attendees` : 'Not Specified')} |\n`;
  md += `| **Attendees Present** | ${result.attendeesPresent || (result.speakersIdentified?.length ? result.speakersIdentified.join(', ') : 'Not Specified')} |\n`;
  md += `| **Multilingual Analysis** | Mauritian Creole, French & English Multilingual Processing |\n`;
  if (result.speakersIdentified && result.speakersIdentified.length > 0) {
    md += `| **Diarized Speakers** | ${result.speakersIdentified.join(' • ')} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 1. Executive Meeting Minutes\n\n`;
  md += `### Meeting Overview\n${result.executiveMinutes.meetingOverview}\n\n`;

  if (result.executiveMinutes.keyTopicsDiscussed && result.executiveMinutes.keyTopicsDiscussed.length > 0) {
    md += `### Key Topics Discussed\n`;
    result.executiveMinutes.keyTopicsDiscussed.forEach((t, i) => {
      md += `#### ${i + 1}. ${t.topic}\n${t.summary}\n\n`;
      if (t.discussionPoints && t.discussionPoints.length > 0) {
        md += `${t.discussionPoints.map(p => `- ${p}`).join('\n')}\n\n`;
      }
    });
  }

  if (result.executiveMinutes.decisions && result.executiveMinutes.decisions.length > 0) {
    md += `### Decisions Agreed\n`;
    md += `${result.executiveMinutes.decisions.map(d => `- **[AGREED]** ${d}`).join('\n')}\n\n`;
  }

  if (result.executiveMinutes.actionItems && result.executiveMinutes.actionItems.length > 0) {
    md += `### Action Items Table\n`;
    md += `| Priority | Task Description | Designated Owner | Target Due Date |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    md += `${result.executiveMinutes.actionItems
      .map(
        a =>
          `| ${a.priority || 'Medium'} | ${a.task} | ${a.owner || 'Unassigned'} | ${a.deadline || 'TBD'} |`
      )
      .join('\n')}\n\n`;
  }

  if (result.languageAnalysis?.creoleExpressionsIdentified && result.languageAnalysis.creoleExpressionsIdentified.length > 0) {
    md += `### Idioms & Mauritian Creole Expressions Identified\n`;
    md += `| Expression | Direct Translation | Contextual Meaning |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `${result.languageAnalysis.creoleExpressionsIdentified
      .map(e => `| **${e.phrase || e.expression || ''}** | ${e.literalOrMeaning || e.translation || ''} | ${e.context || ''} |`)
      .join('\n')}\n\n`;
  }

  md += `---\n\n`;
  md += `## 2. Verbatim Multilingual Transcript\n\n`;
  md += `\`\`\`text\n${cleanVerbatimTranscript(result.verbatimTranscript)}\n\`\`\`\n`;

  return md;
}
