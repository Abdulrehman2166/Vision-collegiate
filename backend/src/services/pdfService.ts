/**
 * pdfService – generates PDFs from HTML.
 * Uses Puppeteer (core) with the @sparticuz/chromium binary on serverless hosts
 * (Vercel/AWS Lambda), and falls back to raw HTML buffer when Chromium is
 * unavailable (some local setups).
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

export async function resolveChromiumExecutable(): Promise<string | undefined> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.platform === 'linux') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sparticuz = require('@sparticuz/chromium') as {
      default?: { executablePath: () => Promise<string>; args?: string[] };
      executablePath?: () => Promise<string>;
      args?: string[];
    };
    const chromium = sparticuz.default ?? sparticuz;
    if (chromium?.executablePath) {
      return await chromium.executablePath();
    }
    return undefined;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  const { existsSync } = await import('node:fs');
  return candidates.find((p) => existsSync(p));
}

async function htmlToPdf(html: string): Promise<Buffer> {
  // Try puppeteer first
  let browser: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer-core') as any;
    const executablePath = await resolveChromiumExecutable();
    if (!executablePath) {
      throw new Error('No Chromium executable found');
    }
    browser = await puppeteer.launch({
      headless: process.platform === 'linux' ? 'shell' : true,
      executablePath,
      timeout: 60000,
      args: process.platform === 'linux'
        ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
        : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });
    return Buffer.from(pdf);
  } catch (err) {
    logger.error('PDF rendering failed. Falling back to HTML document.', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      platform: process.platform,
    });
    throw new Error('PDF_RENDERING_UNAVAILABLE');
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* browser already closed or crashed */ }
    }
  }
}

/**
 * Convert HTML to Buffer (fallback for when PDF rendering is unavailable).
 * Returns the HTML as a UTF-8 encoded buffer for download.
 */
function htmlToHtmlBuffer(html: string): Buffer {
  return Buffer.from(html, 'utf-8');
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
        <td style="text-align:center"><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status).toUpperCase()}</span></td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; margin: 0; padding: 24px; color: #1a1a2e; background: #fff; }
  h1 { text-align: center; font-size: 22px; margin: 0 0 2px 0; color: #0f172a; }
  h2 { text-align: center; font-size: 14px; color: #475569; margin: 0 0 20px 0; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  th { background: #1e3a5f; color: #ffffff; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:nth-child(odd) { background: #ffffff; }
  tr:hover { background: #f1f5f9; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; min-width: 80px; text-align: center; }
  .present { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .absent  { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .late    { background: #fef9c3; color: #a16207; border: 1px solid #fde047; }
  .holiday { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .footer  { margin-top: 24px; font-size: 10px; text-align: right; color: #94a3b8; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Attendance Slip – ${escapeHtml(records[0]?.date)}</h2>
  <table>
    <thead>
      <tr><th>Roll No.</th><th>Student Name</th><th>Batch</th><th style="text-align:center">Status</th></tr>
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
        <td style="text-align:center"><span class="badge ${escapeHtml(r.status)}">${escapeHtml(r.status).toUpperCase()}</span></td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; padding: 24px; color: #1a1a2e; background: #fff; }
  h1 { text-align: center; font-size: 22px; margin: 0 0 2px 0; color: #0f172a; }
  h2 { text-align: center; font-size: 14px; color: #475569; margin: 0 0 16px 0; font-weight: normal; }
  .info { font-size: 13px; color: #334155; margin-bottom: 16px; line-height: 1.8; }
  .info strong { color: #0f172a; }
  .summary { font-size: 15px; font-weight: 700; margin: 16px 0; padding: 12px 16px; background: #eff6ff; color: #1e40af; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center; }
  table { width: 60%; margin: 0 auto; border-collapse: collapse; }
  th { background: #1e3a5f; color: #ffffff; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:nth-child(odd) { background: #ffffff; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; min-width: 80px; text-align: center; }
  .present { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .absent  { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .late    { background: #fef9c3; color: #a16207; border: 1px solid #fde047; }
  .holiday { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Monthly Attendance Card – ${escapeHtml(data.month)}</h2>
  <div class="info">
    <strong>Name:</strong> ${escapeHtml(data.studentName)} &nbsp;&bull;&nbsp;
    <strong>Roll No.:</strong> ${escapeHtml(data.rollNumber)} &nbsp;&bull;&nbsp;
    <strong>Batch:</strong> ${escapeHtml(data.batchName)}
  </div>
  <div class="summary">Present: ${data.presentDays} / ${data.totalDays} days &nbsp;|&nbsp; Attendance: ${percentage}%</div>
  <table>
    <thead><tr><th>Date</th><th style="text-align:center">Status</th></tr></thead>
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
  const html = buildAttendanceSlipHtml(records);
  try {
    return await htmlToPdf(html);
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for attendance slip');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
}

export async function generateMonthlyCardPdf(data: MonthlyAttendanceData): Promise<Buffer> {
  logger.info(`Generating monthly card for ${data.studentName}`);
  const html = buildMonthlyCardHtml(data);
  try {
    return await htmlToPdf(html);
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for monthly card');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
}

export async function generateTestPaperPdf(
  meta: TestPaperMeta,
  questions: TestQuestion[],
  includeAnswers: boolean,
): Promise<Buffer> {
  logger.info(`Generating test paper: ${meta.title}, answers=${includeAnswers}`);
  const html = buildTestPaperHtml(meta, questions, includeAnswers);
  try {
    return await htmlToPdf(html);
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for test paper');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
}
