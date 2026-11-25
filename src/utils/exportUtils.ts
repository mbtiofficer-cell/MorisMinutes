import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  PageBreak,
  ShadingType,
} from 'docx';
import { MeetingAnalysisResult } from '../types';
import { cleanVerbatimTranscript } from './transcriptCleaner';

function sanitizeForPdf(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2014]/g, ' - ')
    .replace(/[\u2013]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u2022\u25E6\u2219]/g, '*')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function getTranscriptSource(result: MeetingAnalysisResult): string {
  const cleanedVerbatim = cleanVerbatimTranscript(result.verbatimTranscript || '').trim();
  if (cleanedVerbatim.length > 0) {
    return cleanedVerbatim;
  }
  const fallbackMarkdown = (result.fullMarkdownOutput || '').trim();
  if (fallbackMarkdown.length > 0) {
    return fallbackMarkdown;
  }
  return 'No verbatim transcript recorded.';
}

function generateMarkdownString(result: MeetingAnalysisResult): string {
  const lines: string[] = [];
  lines.push(`# ${result.meetingTitle || 'Meeting Minutes'}`);
  lines.push(`- **Date:** ${result.meetingDate || 'Not Specified'}`);
  lines.push(`- **Time:** ${result.timeWindow || 'Not Specified'}`);
  lines.push(`- **Venue:** ${result.venue || 'Not Specified'}`);
  lines.push(`- **Attendees:** ${result.attendeesPresent || 'Not Specified'}`);
  lines.push('');
  lines.push('## 1. Executive Meeting Minutes');
  lines.push(result.executiveMinutes?.meetingOverview || '');
  lines.push('');
  lines.push('## 2. Verbatim Transcript');
  lines.push(getTranscriptSource(result));
  return lines.join('\n');
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

export async function exportToWord(result: MeetingAnalysisResult): Promise<void> {
  const safeTitle = (result.meetingTitle || 'Meeting_Minutes')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');

  const titleText = result.meetingTitle || 'Executive Meeting Minutes';
  const dateText = result.meetingDate || 'Not Specified';
  const timeText =
    result.timeWindow && result.timeWindow !== 'Not Specified'
      ? result.timeWindow
      : result.timeStarted || result.timeEnded
      ? `${result.timeStarted || ''}${result.timeStarted && result.timeEnded ? ' – ' : ''}${result.timeEnded || ''}`.trim()
      : 'Not Specified';
  const venueText = result.venue || 'Not Specified';
  const countText =
    result.attendeesCount ||
    (result.speakersIdentified?.length ? `${result.speakersIdentified.length} Attendees` : 'Not Specified');
  const presentText =
    result.attendeesPresent ||
    (result.speakersIdentified?.length ? result.speakersIdentified.join(', ') : 'Not Specified');

  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: titleText,
          bold: true,
          size: 36,
          color: '0284C7',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Metadata Table
  const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const tableBorders = {
    top: cellBorder,
    bottom: cellBorder,
    left: cellBorder,
    right: cellBorder,
    insideHorizontal: cellBorder,
    insideVertical: cellBorder,
  };

  const makeMetaCell = (text: string, bold = false, shaded = false, colSpan?: number) =>
    new TableCell({
      columnSpan: colSpan,
      shading: shaded ? { type: ShadingType.CLEAR, fill: 'F1F5F9' } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold,
              size: 20,
              font: 'Calibri',
              color: '1E293B',
            }),
          ],
        }),
      ],
    });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [
        new TableRow({
          children: [
            makeMetaCell('Meeting Date:', true, true),
            makeMetaCell(dateText),
            makeMetaCell('Time Window:', true, true),
            makeMetaCell(timeText),
          ],
        }),
        new TableRow({
          children: [
            makeMetaCell('Venue / Location:', true, true),
            makeMetaCell(venueText),
            makeMetaCell('Attendance:', true, true),
            makeMetaCell(countText),
          ],
        }),
        new TableRow({
          children: [
            makeMetaCell('Attendees Present:', true, true),
            makeMetaCell(presentText, false, false, 3),
          ],
        }),
      ],
    })
  );

  // Section 1 Heading
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      children: [
        new TextRun({
          text: '1. Executive Meeting Minutes',
          bold: true,
          size: 28,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    })
  );

  // Meeting Overview
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 160, after: 80 },
      children: [
        new TextRun({
          text: 'Meeting Overview',
          bold: true,
          size: 24,
          color: '0369A1',
          font: 'Calibri',
        }),
      ],
    })
  );

  const overviewRaw = result.executiveMinutes?.meetingOverview || 'Overview recorded in session audio.';
  const overviewLines = overviewRaw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of overviewLines) {
    const isBullet = /^[•\-\*]/.test(line);
    children.push(
      new Paragraph({
        bullet: isBullet ? { level: 0 } : undefined,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: line.replace(/^[•\-\*]\s*/, ''),
            size: 21,
            font: 'Calibri',
            color: '1E293B',
          }),
        ],
      })
    );
  }

  // Key Topics Discussed
  if (result.executiveMinutes?.keyTopicsDiscussed?.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: 'Key Topics Discussed',
            bold: true,
            size: 24,
            color: '0369A1',
            font: 'Calibri',
          }),
        ],
      })
    );

    result.executiveMinutes.keyTopicsDiscussed.forEach((t, idx) => {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: `${idx + 1}. ${t.topic}`,
              bold: true,
              size: 22,
              color: '0284C7',
              font: 'Calibri',
            }),
          ],
        })
      );

      if (t.summary) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: t.summary,
                size: 21,
                font: 'Calibri',
                color: '334155',
              }),
            ],
          })
        );
      }

      if (t.discussionPoints?.length) {
        for (const dp of t.discussionPoints) {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 50 },
              children: [
                new TextRun({
                  text: dp,
                  size: 20,
                  font: 'Calibri',
                  color: '334155',
                }),
              ],
            })
          );
        }
      }
    });
  }

  // Decisions Agreed
  if (result.executiveMinutes?.decisions?.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: 'Decisions Agreed',
            bold: true,
            size: 24,
            color: '0369A1',
            font: 'Calibri',
          }),
        ],
      })
    );

    for (const d of result.executiveMinutes.decisions) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: '[AGREED] ',
              bold: true,
              size: 20,
              color: '059669',
              font: 'Calibri',
            }),
            new TextRun({
              text: d,
              size: 21,
              color: '1E293B',
              font: 'Calibri',
            }),
          ],
        })
      );
    }
  }

  // Action Items Table
  if (result.executiveMinutes?.actionItems?.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: 'Action Items Table',
            bold: true,
            size: 24,
            color: '0369A1',
            font: 'Calibri',
          }),
        ],
      })
    );

    const headerCell = (label: string) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: '0F172A' },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 20,
                color: 'FFFFFF',
                font: 'Calibri',
              }),
            ],
          }),
        ],
      });

    const actionRows = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('Priority'),
          headerCell('Task Description'),
          headerCell('Designated Owner'),
          headerCell('Target Due Date'),
        ],
      }),
      ...result.executiveMinutes.actionItems.map(
        (a) =>
          new TableRow({
            children: [
              makeMetaCell(`[${a.priority || 'Medium'}]`, true),
              makeMetaCell(a.task || ''),
              makeMetaCell(a.owner || 'Unassigned'),
              makeMetaCell(a.deadline || 'TBD'),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: actionRows,
      })
    );
  }

  // Next Steps
  if (result.executiveMinutes?.nextSteps?.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: 'Next Steps',
            bold: true,
            size: 24,
            color: '0369A1',
            font: 'Calibri',
          }),
        ],
      })
    );

    for (const ns of result.executiveMinutes.nextSteps) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: ns,
              size: 21,
              color: '1E293B',
              font: 'Calibri',
            }),
          ],
        })
      );
    }
  }

  // Page Break -> Section 2: Verbatim Transcript
  children.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: '2. Verbatim Multilingual Transcript',
          bold: true,
          size: 28,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    })
  );

  const transcriptLines = getTranscriptSource(result)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of transcriptLines) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: line,
            size: 20,
            font: 'Consolas',
            color: '1E293B',
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeTitle}.docx`;
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

export function generateMeetingPDFDoc(result: MeetingAnalysisResult): jsPDF {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const topMargin = 54;
  const bottomMargin = 54;
  const maxY = pageHeight - bottomMargin;

  let cursorY = topMargin;

  const addNewPage = () => {
    doc.addPage();
    cursorY = topMargin;
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > maxY) {
      addNewPage();
    }
  };

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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199);
  doc.text('MORISMINUTES • EXECUTIVE LEADERSHIP MINUTES', margin, cursorY);
  cursorY += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const titleText = sanitizeForPdf(result.meetingTitle || 'Meeting Minutes');
  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  for (const line of titleLines) {
    doc.text(line, margin, cursorY);
    cursorY += 22;
  }
  cursorY += 2;

  const timeStr = result.timeWindow && result.timeWindow !== 'Not Specified'
    ? result.timeWindow
    : (result.timeStarted || result.timeEnded
      ? `${result.timeStarted || ''}${result.timeStarted && result.timeEnded ? ' – ' : ''}${result.timeEnded || ''}`.trim()
      : 'Not Specified');
  const venueStr = result.venue || 'Not Specified';
  const dateStr = result.meetingDate || 'Not Specified';
  const countStr = result.attendeesCount || (result.speakersIdentified?.length ? `${result.speakersIdentified.length} Attendees` : 'Not Specified');
  const presentStr = result.attendeesPresent || (result.speakersIdentified?.length ? result.speakersIdentified.join(', ') : 'Not Specified');

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Date:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(sanitizeForPdf(dateStr), margin + 44, boxCursorY);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Time Window:', col2X, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(sanitizeForPdf(timeStr), col2X + 68, boxCursorY);

  boxCursorY += row1Height;

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

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Attendees:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  presentLines.forEach((pLine: string, pIdx: number) => {
    doc.text(pLine, margin + 66, boxCursorY + (pIdx * 11));
  });

  boxCursorY += row3Height;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('Languages:', margin + 10, boxCursorY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const langStr = `Section 1: Corporate English Minutes • Section 2: Exact Spoken Creole/French/English (${result.speakersIdentified?.length || 0} Speakers)`;
  doc.text(sanitizeForPdf(langStr), margin + 66, boxCursorY);

  cursorY = boxTop + boxHeight + 14;

  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text('1. Executive Meeting Minutes', margin, cursorY);
  cursorY += 16;

  ensureSpace(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Meeting Overview', margin, cursorY);
  cursorY += 14;

  const overviewText = result.executiveMinutes?.meetingOverview || 'Overview recorded in session audio.';
  printWrappedLines(overviewText, margin, contentWidth, 13, {
    fontName: 'helvetica',
    fontStyle: 'normal',
    fontSize: 9.5,
    textColor: [51, 65, 85],
  });
  cursorY += 14;

  if (result.executiveMinutes?.keyTopicsDiscussed && result.executiveMinutes.keyTopicsDiscussed.length > 0) {
    ensureSpace(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Key Topics Discussed', margin, cursorY);
    cursorY += 14;

    result.executiveMinutes.keyTopicsDiscussed.forEach((topic, idx) => {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(3, 105, 161);
      const topicTitleLines = doc.splitTextToSize(sanitizeForPdf(`${idx + 1}. ${topic.topic}`), contentWidth - 8);
      for (const tLine of topicTitleLines) {
        if (cursorY + 13 > maxY) addNewPage();
        doc.text(tLine, margin + 4, cursorY);
        cursorY += 13;
      }

      if (topic.summary) {
        printWrappedLines(topic.summary, margin + 12, contentWidth - 16, 12, {
          fontName: 'helvetica',
          fontStyle: 'normal',
          fontSize: 9,
          textColor: [71, 85, 105],
        });
        cursorY += 4;
      }

      if (topic.discussionPoints && topic.discussionPoints.length > 0) {
        topic.discussionPoints.forEach((point) => {
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

  if (result.executiveMinutes?.decisions && result.executiveMinutes.decisions.length > 0) {
    ensureSpace(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Decisions Agreed', margin, cursorY);
    cursorY += 14;

    result.executiveMinutes.decisions.forEach((decision) => {
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
          doc.setTextColor(5, 150, 105);
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

  if (result.executiveMinutes?.actionItems && result.executiveMinutes.actionItems.length > 0) {
    ensureSpace(65);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Action Items Table', margin, cursorY);
    cursorY += 12;

    const colPriority = 54;
    const colOwner = 108;
    const colDue = 105;
    const colTask = contentWidth - (colPriority + colOwner + colDue);

    const col0X = margin;
    const col1X = margin + colPriority;
    const col2X = margin + colPriority + colTask;
    const col3X = margin + colPriority + colTask + colOwner;

    const padX = 6;
    const padY = 7;
    const lineStep = 11.5;
    const headerHeight = 20;

    const renderTableHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, cursorY, contentWidth, headerHeight, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);

      doc.text('Priority', col0X + padX, cursorY + 14);
      doc.text('Task Description', col1X + padX, cursorY + 14);
      doc.text('Designated Owner', col2X + padX, cursorY + 14);
      doc.text('Target Due Date', col3X + padX, cursorY + 14);

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

      const taskLines = doc.splitTextToSize(sanitizedTask, colTask - padX * 2);
      const ownerLines = doc.splitTextToSize(sanitizedOwner, colOwner - padX * 2);
      const dueLines = doc.splitTextToSize(sanitizedDue, colDue - padX * 2);

      const maxLineCount = Math.max(taskLines.length, ownerLines.length, dueLines.length, 1);
      const rowHeight = Math.max(maxLineCount * lineStep + padY * 2, 22);

      if (cursorY + rowHeight > maxY) {
        addNewPage();
        renderTableHeader();
      }

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, cursorY, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.rect(margin, cursorY, contentWidth, rowHeight, 'S');

      doc.line(col1X, cursorY, col1X, cursorY + rowHeight);
      doc.line(col2X, cursorY, col2X, cursorY + rowHeight);
      doc.line(col3X, cursorY, col3X, cursorY + rowHeight);

      const baselineY = cursorY + padY + 8;

      if (priorityLabel.includes('HIGH')) {
        doc.setTextColor(225, 29, 72);
      } else if (priorityLabel.includes('LOW')) {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`[${priorityLabel.slice(0, 4)}]`, col0X + padX, baselineY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      taskLines.forEach((tLine: string, lineIdx: number) => {
        doc.text(tLine, col1X + padX, baselineY + lineIdx * lineStep);
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      ownerLines.forEach((oLine: string, lineIdx: number) => {
        doc.text(oLine, col2X + padX, baselineY + lineIdx * lineStep);
      });

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

  if (result.executiveMinutes?.nextSteps && result.executiveMinutes.nextSteps.length > 0) {
    ensureSpace(45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Next Steps', margin, cursorY);
    cursorY += 14;

    result.executiveMinutes.nextSteps.forEach((step) => {
      ensureSpace(20);
      const sanitizedStep = sanitizeForPdf(step);
      const stepLines = doc.splitTextToSize(`- ${sanitizedStep}`, contentWidth - 14);
      for (let sIdx = 0; sIdx < stepLines.length; sIdx++) {
        if (cursorY + 12 > maxY) {
          addNewPage();
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(stepLines[sIdx], margin + 8, cursorY);
        cursorY += 12;
      }
      cursorY += 3;
    });
    cursorY += 10;
  }

  addNewPage();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text('2. Verbatim Multilingual Transcript', margin, cursorY);
  cursorY += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Sentence-by-sentence dialogue preserving authentic Creole, French & English verbatim line-by-line.',
    margin,
    cursorY
  );
  cursorY += 12;

  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.0);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 16;

  const rawTranscriptLines = getTranscriptSource(result)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  rawTranscriptLines.forEach((rawLine) => {
    const cleanLine = sanitizeForPdf(rawLine);
    if (!cleanLine) return;

    const timestampMatch = cleanLine.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\])\s*/);
    const timestamp = timestampMatch ? timestampMatch[1] : null;
    let remainder = timestampMatch ? cleanLine.substring(timestampMatch[0].length).trim() : cleanLine;

    const speakerColonMatch = remainder.match(/^(\[?[^:\]]+\]?[^:]*):\s*(.*)$/);

    if (speakerColonMatch) {
      const speakerHeader = speakerColonMatch[1].trim();
      const dialogueBody = speakerColonMatch[2].trim();

      ensureSpace(34);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(3, 105, 161);

      const fullSpeakerLabel = timestamp ? `${timestamp} ${speakerHeader}:` : `${speakerHeader}:`;
      const wrappedHeader = doc.splitTextToSize(fullSpeakerLabel, contentWidth);
      for (const hLine of wrappedHeader) {
        if (cursorY + 12 > maxY) addNewPage();
        doc.text(hLine, margin, cursorY);
        cursorY += 12;
      }

      if (dialogueBody) {
        printWrappedLines(dialogueBody, margin + 10, contentWidth - 10, 11.5, {
          fontName: 'helvetica',
          fontStyle: 'normal',
          fontSize: 8.5,
          textColor: [30, 41, 59],
        });
      }
      cursorY += 4;
    } else {
      printWrappedLines(cleanLine, margin, contentWidth, 11.5, {
        fontName: 'helvetica',
        fontStyle: 'normal',
        fontSize: 8.5,
        textColor: [30, 41, 59],
      });
      cursorY += 2;
    }
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MorisMinutes • Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 24,
      { align: 'right' }
    );
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