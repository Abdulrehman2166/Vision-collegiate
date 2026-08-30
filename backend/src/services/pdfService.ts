/**
 * pdfService – generates PDFs from HTML.
 * Uses Puppeteer (core) with the @sparticuz/chromium binary on serverless hosts
 * (Vercel/AWS Lambda), and falls back to raw HTML buffer when Chromium is
 * unavailable (some local setups).
 */
import { logger } from '../utils/logger';

// On Vercel (and similar serverless hosts) the @sparticuz/chromium package only
// extracts its bundled system libraries (libnss3.so, libnspr4.so, etc.) when it
// detects an AWS Lambda Node runtime. Vercel doesn't set this env var, so we set
// it BEFORE the module is imported (import-time env bootstrap happens above us).
function bootstrapChromiumEnv() {
  if (process.platform === 'linux' && (process.env.VERCEL || process.env.AWS_EXECUTION_ENV)) {
    process.env.AWS_LAMBDA_JS_RUNTIME ??= 'nodejs22.x';
    process.env.LD_LIBRARY_PATH = [
      '/tmp/al2023/lib',
      '/tmp/al2/lib',
      process.env.LD_LIBRARY_PATH,
    ]
      .filter(Boolean)
      .join(':');
  }
}
bootstrapChromiumEnv();

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
      default?: { executablePath: () => Promise<string>; setGraphicsMode?: (v: boolean) => void };
      executablePath?: () => Promise<string>;
      setGraphicsMode?: (v: boolean) => void;
    };
    const chromium = (sparticuz.default ?? sparticuz) as {
      executablePath: () => Promise<string>;
      setGraphicsMode?: (v: boolean) => void;
    };
    // Disable WebGL/graphics stack so the swiftshader libs aren't needed.
    chromium.setGraphicsMode?.(false);
    return await chromium.executablePath();
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

async function htmlToPdf(html: string, opts?: { landscape?: boolean }): Promise<Buffer> {
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
      landscape: opts?.landscape,
      printBackground: true,
      margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
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

// ─── Range / Weekly Attendance Slip ─────────────────────────────────────────────

export interface RangeSlipStudent {
  studentName: string;
  rollNumber: string;
  batchName: string;
  days: Record<string, string>;
}

export interface RangeSlipData {
  from: string;
  to: string;
  students: RangeSlipStudent[];
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = new Date(Date.UTC(fy, fm - 1, fd));
  const end   = new Date(Date.UTC(ty, tm - 1, td));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

function formatDateShort(dateStr: string): { day: string; month: string } {
  const [, m, d] = dateStr.split('-');
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return { day: d, month: monthNames[Number(m)] };
}

export function buildRangeSlipHtml(data: RangeSlipData): string {
  const dates = enumerateDates(data.from, data.to);

  const tableRows = data.students
    .map((s) => {
      const count = Object.values(s.days).filter((st) => st === 'present' || st === 'late').length;
      const cells = dates
        .map(
          (d) => {
            const st = s.days[d];
            return `<td style="text-align:center">
               ${st ? `<span class="badge ${escapeHtml(st)}">${st === 'present' ? 'P' : st === 'absent' ? 'A' : st === 'late' ? 'L' : 'H'}</span>` : '<span class="na">–</span>'}
             </td>`;
          },
        )
        .join('');
      return `<tr>
        <td>${escapeHtml(s.rollNumber)}</td>
        <td>${escapeHtml(s.studentName)}</td>
        <td>${escapeHtml(s.batchName)}</td>
        ${cells}
        <td style="text-align:center"><strong>${count}</strong></td>
      </tr>`;
    })
    .join('');

  const dateHeaders = dates
    .map((d) => {
      const { day, month } = formatDateShort(d);
      return `<th style="text-align:center;min-width:30px;">${day}<div style="font-size:9px;font-weight:400;opacity:.8">${month}</div></th>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #1a1a2e; background: #fff; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 2px 0; color: #0f172a; }
  h2 { text-align: center; font-size: 13px; color: #475569; margin: 0 0 16px 0; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 0; table-layout: fixed; }
  th { background: #1e3a5f; color: #ffffff; padding: 6px 6px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 6px 6px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; word-break: break-word; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:nth-child(odd) { background: #ffffff; }
  .col-roll { width: 7%; }
  .col-name { width: 20%; }
  .col-batch { width: 13%; }
  .col-count { width: 7%; }
  .badge { display: inline-block; width: 20px; line-height: 20px; border-radius: 50%; font-size: 10px; font-weight: 700; color: #fff; text-align: center; }
  .present { background: #16a34a; }
  .absent  { background: #dc2626; }
  .late    { background: #d97706; }
  .holiday { background: #64748b; }
  .na { color: #cbd5e1; }
  .footer { margin-top: 14px; font-size: 10px; text-align: right; color: #94a3b8; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Weekly Attendance – ${escapeHtml(data.from)} to ${escapeHtml(data.to)}</h2>
  <table>
    <colgroup>
      <col class="col-roll"><col class="col-name"><col class="col-batch">
      ${dates.map(() => '<col style="width:auto;">').join('')}
      <col class="col-count">
    </colgroup>
    <thead>
      <tr><th>Roll</th><th>Student Name</th><th>Batch</th>${dateHeaders}<th style="text-align:center">Present</th></tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">P = Present · A = Absent · L = Late · H = Holiday · – = Not marked · Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
</body>
</html>`;
}

export async function generateRangeSlipPdf(data: RangeSlipData): Promise<Buffer> {
  logger.info(`Generating range slip for ${data.students.length} students (${data.from} → ${data.to})`);
  const html = buildRangeSlipHtml(data);
  try {
    return await htmlToPdf(html, { landscape: true });
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for range slip');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
}

// ─── Monthly Analysis Report ───────────────────────────────────────────────────

export interface MonthlyReportRow {
  studentId: number;
  studentName: string;
  rollNumber: string;
  batchName: string;
  present: number;
  late: number;
  absent: number;
  holiday: number;
  totalDays: number;
  percentage: number;
}

export interface MonthlyReportData {
  month: string;
  rows: MonthlyReportRow[];
}

export function buildMonthlyReportHtml(data: MonthlyReportData): string {
  const rows = data.rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.rollNumber)}</td>
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(r.batchName)}</td>
        <td style="text-align:center">${r.present}</td>
        <td style="text-align:center">${r.late}</td>
        <td style="text-align:center">${r.absent}</td>
        <td style="text-align:center">${r.holiday}</td>
        <td style="text-align:center">${r.totalDays}</td>
        <td style="text-align:center"><span class="pct">${r.percentage}%</span></td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 0; padding: 24px; color: #1a1a2e; background: #fff; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 2px 0; color: #0f172a; }
  h2 { text-align: center; font-size: 13px; color: #475569; margin: 0 0 16px 0; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  th { background: #1e3a5f; color: #ffffff; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #0f172a; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:nth-child(odd) { background: #ffffff; }
  .pct { background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-weight: 700; }
  .footer { margin-top: 20px; font-size: 10px; text-align: right; color: #94a3b8; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Monthly Attendance Analysis – ${escapeHtml(data.month)}</h2>
  <table>
    <thead>
      <tr><th>Roll No.</th><th>Student Name</th><th>Batch</th><th style="text-align:center">Present</th><th style="text-align:center">Late</th><th style="text-align:center">Absent</th><th style="text-align:center">Holiday</th><th style="text-align:center">Total</th><th style="text-align:center">%</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
</body>
</html>`;
}

export async function generateMonthlyReportPdf(data: MonthlyReportData): Promise<Buffer> {
  logger.info(`Generating monthly analysis report for ${data.month}`);
  const html = buildMonthlyReportHtml(data);
  try {
    return await htmlToPdf(html, { landscape: true });
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for monthly analysis report');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
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

// ─── Monthly Test Analytics ───────────────────────────────────────────────────

export interface AnalyticsTestResult {
  date: string;           // YYYY-MM-DD
  week: number;           // 1-4 (week of month)
  subject: string;
  title: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;     // rounded to 1 decimal
}

export interface AnalyticsSubjectAverage {
  subject: string;
  count: number;
  percentage: number;     // rounded to 1 decimal
}

export interface AnalyticsStudentSummary {
  studentId: number;
  studentName: string;
  rollNumber: string;
  batchId: number;
  batchName: string;
  rank: number;                       // 1 = top of the month in scope
  testsAppeared: number;
  overallPercentage: number;          // rounded to 1 decimal
  weekAverages: (number | null)[];    // index 0-3 = week 1-4
  bestSubject: string;
  weakSubject: string;
  grandTestPercentage: number | null; // % in Week 4 Grand Test if present
}

export interface AnalyticsStudentDetail extends AnalyticsStudentSummary {
  results: AnalyticsTestResult[];
  subjectAverages: AnalyticsSubjectAverage[];
}

export interface MonthlyAnalyticsData {
  month: string;
  scopeLabel: string;   // batch name or 'All Batches'
  students: AnalyticsStudentDetail[];
}

export function buildMonthlyAnalyticsHtml(data: MonthlyAnalyticsData): string {
  const rows = data.students
    .map((s) => {
      const week = (i: number) =>
        s.weekAverages[i] == null ? '—' : `${s.weekAverages[i].toFixed(1)}%`;
      const progress =
        s.weekAverages[3] != null && s.weekAverages[0] != null
          ? s.weekAverages[3] > s.weekAverages[0] ? '▲ Improving' : s.weekAverages[3] < s.weekAverages[0] ? '▼ Declining' : '◆ Consistent'
          : '—';
      return `<tr>
        <td style="text-align:center"><span class="rank">#${s.rank}</span></td>
        <td>${escapeHtml(s.rollNumber)}</td>
        <td>${escapeHtml(s.studentName)}</td>
        <td style="text-align:center">${s.testsAppeared}</td>
        <td style="text-align:center"><span class="pct strong">${s.overallPercentage.toFixed(1)}%</span></td>
        <td style="text-align:center">${week(0)}</td>
        <td style="text-align:center">${week(1)}</td>
        <td style="text-align:center">${week(2)}</td>
        <td style="text-align:center">${week(3)}</td>
        <td>${escapeHtml(s.bestSubject)}</td>
        <td>${escapeHtml(s.weakSubject)}</td>
        <td style="text-align:center">${progress}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #1a1a2e; background: #fff; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 2px 0; color: #0f172a; }
  h2 { text-align: center; font-size: 13px; color: #475569; margin: 0 0 14px 0; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 0; }
  th { background: #1e3a5f; color: #ffffff; padding: 8px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:nth-child(odd) { background: #ffffff; }
  .pct { background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-weight: 700; }
  .pct.strong { background: #dcfce7; color: #15803d; }
  .rank { background: #fef9c3; color: #a16207; padding: 2px 8px; border-radius: 12px; font-weight: 700; }
  .top { background: #e0e7ff !important; }
  .footer { margin-top: 16px; font-size: 10px; text-align: right; color: #94a3b8; }
  .legend { margin-top: 12px; font-size: 10px; color: #64748b; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Monthly Test Analytics – ${escapeHtml(data.month)} · ${escapeHtml(data.scopeLabel)}</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:center">Rank</th><th>Roll No.</th><th>Student Name</th>
        <th style="text-align:center">Tests</th><th style="text-align:center">Overall</th>
        <th style="text-align:center">Week 1</th><th style="text-align:center">Week 2</th>
        <th style="text-align:center">Week 3</th><th style="text-align:center">Week 4</th>
        <th>Best Subject</th><th>Weak Subject</th><th style="text-align:center">Trend</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="legend">% = marks obtained ÷ total marks per subject test, averaged by week.</div>
  <div class="footer">Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
</body>
</html>`;
}

export async function generateMonthlyAnalyticsPdf(data: MonthlyAnalyticsData): Promise<Buffer> {
  logger.info(`Generating monthly test analytics for ${data.month} (${data.students.length} students)`);
  const html = buildMonthlyAnalyticsHtml(data);
  try {
    return await htmlToPdf(html, { landscape: true });
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for monthly analytics');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
}

export function buildStudentAnalyticsHtml(data: AnalyticsStudentDetail & { month: string; scopeLabel: string }): string {
  const testRows = data.results
    .map((r) => {
      const isGrand = /grand/i.test(r.title);
      const pctCls = r.percentage >= 80 ? 'good' : r.percentage >= 60 ? 'ok' : r.percentage >= 40 ? 'warn' : 'poor';
      return `<tr class="${isGrand ? 'grand' : ''}">
        <td>${escapeHtml(r.date)}</td>
        <td style="text-align:center">Week ${r.week}</td>
        <td>${escapeHtml(r.subject)}</td>
        <td style="text-align:center">${escapeHtml(r.title)}${isGrand ? ' <span class="tag">Grand</span>' : ''}</td>
        <td style="text-align:center">${r.marksObtained} / ${r.totalMarks}</td>
        <td style="text-align:center"><span class="pct ${pctCls}">${r.percentage.toFixed(1)}%</span></td>
      </tr>`;
    })
    .join('');

  const subjectRows = data.subjectAverages
    .map((s) => `<tr>
      <td>${escapeHtml(s.subject)}</td>
      <td style="text-align:center">${s.count}</td>
      <td style="text-align:center"><span class="pct">${s.percentage.toFixed(1)}%</span></td>
    </tr>`)
    .join('');

  const weekBlocks = data.weekAverages
    .map((w, i) => {
      const pct = w == null ? '—' : `${w.toFixed(1)}%`;
      return `<div class="week"><span class="week-label">Week ${i + 1}</span><span class="week-val">${pct}</span></div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; padding: 24px; color: #1a1a2e; background: #fff; }
  h1 { text-align: center; font-size: 20px; margin: 0 0 2px 0; color: #0f172a; }
  h2 { text-align: center; font-size: 13px; color: #475569; margin: 0 0 16px 0; font-weight: normal; }
  .info { font-size: 13px; color: #334155; margin-bottom: 4px; line-height: 1.8; }
  .info strong { color: #0f172a; }
  .summary { display: flex; gap: 10px; flex-wrap: wrap; margin: 14px 0; }
  .card { flex: 1 1 150px; padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; text-align: center; }
  .card .v { font-size: 18px; font-weight: 800; color: #1e3a5f; }
  .card .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-top: 2px; }
  .weeks { display: flex; gap: 8px; margin: 14px 0; }
  .week { flex: 1; padding: 10px; text-align: center; border-radius: 10px; background: #f1f5f9; border: 1px solid #e2e8f0; }
  .week-label { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; }
  .week-val { font-size: 16px; font-weight: 700; color: #0f172a; }
  h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e3a5f; margin: 18px 0 8px 0; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e3a5f; color: #ffffff; padding: 9px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #0f172a; }
  tr:nth-child(even) { background: #f8fafc; }
  .grand { background: #fef9c3 !important; }
  .tag { background: #d97706; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 8px; margin-left: 4px; }
  .pct { padding: 2px 8px; border-radius: 12px; font-weight: 700; }
  .good { background: #dcfce7; color: #15803d; }
  .ok   { background: #dbeafe; color: #1d4ed8; }
  .warn { background: #fed7aa; color: #c2410c; }
  .poor { background: #fee2e2; color: #b91c1c; }
  .flags { font-size: 13px; margin: 10px 0; }
  .flags span { display: inline-block; margin-right: 16px; padding: 6px 12px; border-radius: 8px; font-weight: 700; }
  .flag-best { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .flag-weak { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .footer { margin-top: 20px; font-size: 10px; text-align: right; color: #94a3b8; }
</style>
</head>
<body>
  <h1>Vision Collegiate</h1>
  <h2>Monthly Test Analytics – ${escapeHtml(data.month)}</h2>
  <div class="info">
    <strong>Name:</strong> ${escapeHtml(data.studentName)} &nbsp;&bull;&nbsp;
    <strong>Roll No.:</strong> ${escapeHtml(data.rollNumber)} &nbsp;&bull;&nbsp;
    <strong>Batch:</strong> ${escapeHtml(data.batchName)} &nbsp;&bull;&nbsp;
    <strong>Rank:</strong> #${data.rank} of ${escapeHtml(data.scopeLabel)}
  </div>

  <div class="summary">
    <div class="card"><div class="v">${data.overallPercentage.toFixed(1)}%</div><div class="k">Overall Average</div></div>
    <div class="card"><div class="v">${data.testsAppeared}</div><div class="k">Tests Appeared</div></div>
    <div class="card"><div class="v">${data.grandTestPercentage == null ? '—' : data.grandTestPercentage.toFixed(1) + '%'}</div><div class="k">Grand Test</div></div>
    <div class="card"><div class="v">#${data.rank}</div><div class="k">Class Position</div></div>
  </div>

  <h3>Weekly Trend</h3>
  <div class="weeks">${weekBlocks}</div>

  <div class="flags">
    ${data.bestSubject ? `<span class="flag-best">★ Best Subject: ${escapeHtml(data.bestSubject)}</span>` : ''}
    ${data.weakSubject ? `<span class="flag-weak">⚠ Weak Subject: ${escapeHtml(data.weakSubject)}</span>` : ''}
  </div>

  <h3>Subject-Wise Performance</h3>
  <table>
    <thead><tr><th>Subject</th><th style="text-align:center">Tests</th><th style="text-align:center">Average</th></tr></thead>
    <tbody>${subjectRows || '<tr><td colspan="3" style="text-align:center;color:#94a3b8">No results recorded for this month.</td></tr>'}</tbody>
  </table>

  <h3>Test Results</h3>
  <table>
    <thead><tr><th>Date</th><th style="text-align:center">Week</th><th>Subject</th><th>Test</th><th style="text-align:center">Marks</th><th style="text-align:center">%</th></tr></thead>
    <tbody>${testRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8">No results recorded for this month.</td></tr>'}</tbody>
  </table>

  <div class="footer">Generated on ${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
</body>
</html>`;
}

export async function generateStudentAnalyticsPdf(
  data: AnalyticsStudentDetail & { month: string; scopeLabel: string },
): Promise<Buffer> {
  logger.info(`Generating student test analytics for ${data.studentName} (${data.month})`);
  const html = buildStudentAnalyticsHtml(data);
  try {
    return await htmlToPdf(html);
  } catch (err) {
    if ((err as Error).message === 'PDF_RENDERING_UNAVAILABLE') {
      logger.warn('Falling back to HTML for student analytics');
      return htmlToHtmlBuffer(html);
    }
    throw err;
  }
}
