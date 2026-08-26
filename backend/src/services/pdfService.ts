/**
 * pdfService – generates PDFs from HTML.
 * Uses Puppeteer when available (local dev), falls back to raw HTML buffer
 * in environments where Chromium cannot be installed (Render free tier).
 */
import { logger } from '../utils/logger';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function htmlToPdf(html: string): Promise<Buffer> {
  // Try puppeteer first
  try {
    // Use the bundled Chromium binary on Railway/Linux; use Puppeteer's local
    // browser on Windows development machines.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer = (process.platform === 'linux'
      ? require('puppeteer-core')
      : require('puppeteer')) as any;
    const chromium = process.platform === 'linux' ? require('@sparticuz/chromium') : undefined;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
      ?? (chromium ? await chromium.executablePath() : undefined);
    const browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      timeout: 30000,
      args: chromium?.args ?? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (err) {
    // Puppeteer not available in this environment — throw a clear error
    // rather than silently returning an HTML buffer with a .pdf extension
    logger.error('Puppeteer is not available. Cannot generate PDF.', {
      error: (err as Error).message,
      hint: 'Install puppeteer: npm install puppeteer',
    });
    const serviceErr: Error & { statusCode?: number } = new Error(
      'PDF generation is unavailable on the server. Ensure Chromium is installed and PUPPETEER_EXECUTABLE_PATH is configured if required.',
    );
    serviceErr.statusCode = 503;
    throw serviceErr;
  }
}

// ─── Attendance Slip ───────────────────────────────────────────────────────────

export interface AttendanceRecord {
  studentName: string;
  rollNumber: string;
  date: string;
  status: string;
  batchName: string;
  subject?: string;
}

export function buildAttendanceSlipHtml(records: AttendanceRecord[]): string {
  const rows = records
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.rollNumber)}</td>
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(r.batchName)}</td>
        <td class="${escapeHtml(r.status)}">${escapeHtml(r.status).toUpperCase()}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; }
  h1   { text-align: center; font-size: 18px; margin-bottom: 4px; color: #1e3a5f; }
  h2   { text-align: center; font-size: 13px; color: #555; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; }
  th { background: #1e3a5f; color: #fff; }
  tr:nth-child(even) { background: #f5f8ff; }
  .present { color: #16a34a; font-weight: bold; }
  .absent  { color: #dc2626; font-weight: bold; }
  .late    { color: #d97706; font-weight: bold; }
  .footer  { margin-top: 30px; font-size: 10px; text-align: right; color: #888; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Attendance Slip – ${escapeHtml(records[0]?.date)}</h2>
  <table>
    <thead>
      <tr><th>Roll No.</th><th>Student Name</th><th>Batch</th><th>Status</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
</body>
</html>`;
}

// ─── Monthly Attendance Card ───────────────────────────────────────────────────

export interface MonthlyAttendanceData {
  studentName: string;
  rollNumber: string;
  batchName: string;
  month: string;
  records: { date: string; status: string }[];
  totalDays: number;
  presentDays: number;
}

export function buildMonthlyCardHtml(data: MonthlyAttendanceData): string {
  const percentage = data.totalDays
    ? Math.round((data.presentDays / data.totalDays) * 100)
    : 0;

  const rows = data.records
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.date)}</td>
        <td class="${escapeHtml(r.status)}">${escapeHtml(r.status).toUpperCase()}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
  h1   { text-align: center; color: #1e3a5f; margin-bottom: 2px; }
  h2   { text-align: center; color: #555; margin-top: 0; font-size: 13px; }
  .summary { font-size: 14px; font-weight: bold; margin: 16px 0; color: #1e3a5f; }
  table { width: 50%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #1e3a5f; color: #fff; }
  tr:nth-child(even) { background: #f5f8ff; }
  .present { color: #16a34a; font-weight: bold; }
  .absent  { color: #dc2626; font-weight: bold; }
  .late    { color: #d97706; font-weight: bold; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Monthly Attendance Card – ${escapeHtml(data.month)}</h2>
  <p><strong>Name:</strong> ${escapeHtml(data.studentName)} &nbsp; <strong>Roll No.:</strong> ${escapeHtml(data.rollNumber)} &nbsp; <strong>Batch:</strong> ${escapeHtml(data.batchName)}</p>
  <div class="summary">Present: ${data.presentDays} / ${data.totalDays} days &nbsp;|&nbsp; Attendance: ${percentage}%</div>
  <table>
    <thead><tr><th>Date</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

// ─── Test Paper ────────────────────────────────────────────────────────────────

export interface TestQuestion {
  section?: string;
  question: string;
  answer?: string;
  marks: number;
  question_type: string;
  options?: string[];
  order_index: number;
}

export interface TestPaperMeta {
  title: string;
  subject: string;
  grade: string;
  stream?: string;
  totalMarks: number;
  durationMins: number;
  boardPattern?: string;
  testDate?: string;
}

export function buildTestPaperHtml(
  meta: TestPaperMeta,
  questions: TestQuestion[],
  includeAnswers: boolean,
): string {
  const sections = new Map<string, TestQuestion[]>();
  for (const q of questions) {
    const sec = q.section ?? 'General';
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(q);
  }

  let body = '';
  let qNum = 1;
  for (const [section, qs] of sections) {
    body += `<h3 class="section-header">${escapeHtml(section)}</h3>`;
    for (const q of qs) {
      body += `<div class="question">
        <p><strong>Q${qNum}.</strong> ${escapeHtml(q.question)} <span class="marks">[${q.marks} mark${q.marks > 1 ? 's' : ''}]</span></p>`;
      if (q.options?.length) {
        body += `<ol type="A">${q.options.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ol>`;
      }
      if (includeAnswers && q.answer) {
        body += `<p class="answer"><strong>Answer:</strong> ${escapeHtml(q.answer)}</p>`;
      }
      body += `</div>`;
      qNum++;
    }
  }

  const answerLabel = includeAnswers ? ' (with Answer Key)' : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body  { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
  h1   { text-align: center; color: #1e3a5f; margin-bottom: 2px; }
  .meta { text-align: center; color: #444; font-size: 11px; margin-bottom: 14px; }
  .section-header { margin-top: 20px; border-bottom: 1px solid #1e3a5f; color: #1e3a5f; }
  .question { margin: 12px 0 6px 0; }
  .marks { color: #888; font-size: 10px; }
  .answer { background: #fef9c3; border-left: 3px solid #d97706; padding: 4px 8px; margin-top: 4px; }
  ol { margin: 6px 0 6px 20px; }
</style>
</head>
<body>
  <h1>Vision Collegiate${escapeHtml(answerLabel)}</h1>
  <div class="meta">
    <strong>${escapeHtml(meta.title)}</strong> &nbsp;|&nbsp; ${escapeHtml(meta.subject)} &nbsp;|&nbsp;
    Grade: ${escapeHtml(meta.grade)}${meta.stream ? ' – ' + escapeHtml(meta.stream) : ''} &nbsp;|&nbsp;
    Total Marks: ${meta.totalMarks} &nbsp;|&nbsp; Duration: ${meta.durationMins} min
    ${meta.testDate ? `&nbsp;|&nbsp; Date: ${escapeHtml(meta.testDate)}` : ''}
  </div>
  <hr/>${body}
</body>
</html>`;
}

// ─── Exported generators ──────────────────────────────────────────────────────

export async function generateAttendanceSlipPdf(records: AttendanceRecord[]): Promise<Buffer> {
  logger.info(`Generating attendance slip for ${records.length} records`);
  return htmlToPdf(buildAttendanceSlipHtml(records));
}

export async function generateMonthlyCardPdf(data: MonthlyAttendanceData): Promise<Buffer> {
  logger.info(`Generating monthly card for ${data.studentName}`);
  return htmlToPdf(buildMonthlyCardHtml(data));
}

export async function generateTestPaperPdf(
  meta: TestPaperMeta,
  questions: TestQuestion[],
  includeAnswers: boolean,
): Promise<Buffer> {
  logger.info(`Generating test paper: ${meta.title}, answers=${includeAnswers}`);
  return htmlToPdf(buildTestPaperHtml(meta, questions, includeAnswers));
}
