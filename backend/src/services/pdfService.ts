/**
 * pdfService – generates PDFs from HTML using Puppeteer.
 */
import puppeteer from 'puppeteer';
import { logger } from '../utils/logger';

async function getBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

/**
 * Render an HTML string to a PDF Buffer.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
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
        <td>${r.rollNumber}</td>
        <td>${r.studentName}</td>
        <td>${r.batchName}</td>
        <td class="${r.status}">${r.status.toUpperCase()}</td>
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
  <h2>Attendance Slip – ${records[0]?.date ?? ''}</h2>
  <table>
    <thead>
      <tr><th>Roll No.</th><th>Student Name</th><th>Batch</th><th>Status</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated on ${new Date().toLocaleString('en-IN')}</div>
</body>
</html>`;
}

// ─── Monthly Attendance Card ───────────────────────────────────────────────────

export interface MonthlyAttendanceData {
  studentName: string;
  rollNumber: string;
  batchName: string;
  month: string; // e.g. "January 2025"
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
        <td>${r.date}</td>
        <td class="${r.status}">${r.status.toUpperCase()}</td>
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
  .info { display: flex; gap: 30px; margin: 16px 0; }
  .info p { margin: 0; }
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
  <h2>Monthly Attendance Card – ${data.month}</h2>
  <div class="info">
    <p><strong>Name:</strong> ${data.studentName}</p>
    <p><strong>Roll No.:</strong> ${data.rollNumber}</p>
    <p><strong>Batch:</strong> ${data.batchName}</p>
  </div>
  <div class="summary">
    Present: ${data.presentDays} / ${data.totalDays} days &nbsp;|&nbsp; Attendance: ${percentage}%
  </div>
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
  // Group by section
  const sections = new Map<string, TestQuestion[]>();
  for (const q of questions) {
    const sec = q.section ?? 'General';
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(q);
  }

  let body = '';
  let qNum = 1;
  for (const [section, qs] of sections) {
    body += `<h3 class="section-header">${section}</h3>`;
    for (const q of qs) {
      body += `<div class="question">
        <p><strong>Q${qNum}.</strong> ${q.question} <span class="marks">[${q.marks} mark${q.marks > 1 ? 's' : ''}]</span></p>`;
      if (q.options?.length) {
        body += `<ol type="A">${q.options.map((o) => `<li>${o}</li>`).join('')}</ol>`;
      }
      if (includeAnswers && q.answer) {
        body += `<p class="answer"><strong>Answer:</strong> ${q.answer}</p>`;
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
  .footer { margin-top: 30px; font-size: 10px; color: #888; text-align: right; }
</style>
</head>
<body>
  <h1>Vision Collegiate${answerLabel}</h1>
  <div class="meta">
    <strong>${meta.title}</strong> &nbsp;|&nbsp;
    Subject: ${meta.subject} &nbsp;|&nbsp;
    Grade: ${meta.grade}${meta.stream ? ' – ' + meta.stream : ''} &nbsp;|&nbsp;
    ${meta.boardPattern ? 'Pattern: ' + meta.boardPattern + ' &nbsp;|&nbsp;' : ''}
    Total Marks: ${meta.totalMarks} &nbsp;|&nbsp;
    Duration: ${meta.durationMins} min
    ${meta.testDate ? `&nbsp;|&nbsp; Date: ${meta.testDate}` : ''}
  </div>
  <hr/>
  ${body}
  <div class="footer">Generated on ${new Date().toLocaleString('en-IN')}</div>
</body>
</html>`;
}

export async function generateAttendanceSlipPdf(records: AttendanceRecord[]): Promise<Buffer> {
  const html = buildAttendanceSlipHtml(records);
  logger.info(`Generating attendance slip PDF for ${records.length} records`);
  return htmlToPdf(html);
}

export async function generateMonthlyCardPdf(data: MonthlyAttendanceData): Promise<Buffer> {
  const html = buildMonthlyCardHtml(data);
  logger.info(`Generating monthly card PDF for ${data.studentName}`);
  return htmlToPdf(html);
}

export async function generateTestPaperPdf(
  meta: TestPaperMeta,
  questions: TestQuestion[],
  includeAnswers: boolean,
): Promise<Buffer> {
  const html = buildTestPaperHtml(meta, questions, includeAnswers);
  logger.info(`Generating test paper PDF: ${meta.title}, answers=${includeAnswers}`);
  return htmlToPdf(html);
}
