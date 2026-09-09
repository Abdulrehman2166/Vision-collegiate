/**
 * seedDemo.ts – creates a demo STUDENT + PARENT login pair and links them to a
 * real, active student so the Progress Portal can be tested end-to-end.
 *
 * Run once with:  npx ts-node src/seedDemo.ts
 *
 * Credentials created:
 *   Student · student@visioncollegiate.com / Student@1234
 *   Parent  · parent@visioncollegiate.com  / Parent@1234
 *
 * The script is idempotent — safe to re-run.
 * If the chosen student has no data at all, a clearly-labelled "Demo Test – Portal"
 * and 14 days of attendance are seeded so the portal isn't empty.
 */
import bcrypt from 'bcryptjs';
import { pool } from './db';

const STUDENT_EMAIL = 'student@visioncollegiate.com';
const STUDENT_PASS  = 'Student@1234';
const PARENT_EMAIL  = 'parent@visioncollegiate.com';
const PARENT_PASS   = 'Parent@1234';

async function upsertUser(name: string, email: string, password: string, role: 'student' | 'parent'): Promise<number> {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    console.log(`   reuse existing ${role} user (${email})`);
    return existing.rows[0].id;
  }
  const hash = await bcrypt.hash(password, 12);
  const res = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email, hash, role],
  );
  console.log(`   created ${role} user (${email})`);
  return res.rows[0].id;
}

async function main() {
  console.log('\n── Demo Progress Portal accounts ──');

  const studentUserId = await upsertUser('Demo Student', STUDENT_EMAIL, STUDENT_PASS, 'student');
  const parentUserId  = await upsertUser('Demo Parent',  PARENT_EMAIL,  PARENT_PASS,  'parent');

  // Pick the most "data-rich" active student so the portal has real content.
  const pick = await pool.query(
    `SELECT s.id, s.name, s.roll_number AS "rollNumber", s.batch_id AS "batchId",
            b.grade, b.stream, x.att, x.res
     FROM students s
     LEFT JOIN batches b ON b.id = s.batch_id
     CROSS JOIN LATERAL (
       SELECT (SELECT COUNT(*)::int FROM attendance a WHERE a.student_id = s.id)  AS att,
              (SELECT COUNT(*)::int FROM test_results r WHERE r.student_id = s.id) AS res
     ) x
     WHERE s.status = 'active'
     ORDER BY x.att + x.res DESC, s.id
     LIMIT 1`,
  );

  let studentId: number;
  let linkedName = '';

  if (pick.rows.length) {
    const p = pick.rows[0];
    studentId = Number(p.id);
    linkedName = p.name;
    console.log(`\n   linked to existing student #${studentId} (${p.name}) — ${p.att} attendance, ${p.res} results`);

    await pool.query(
      `UPDATE students
       SET user_id = $1, parent_user_id = $2, parent_email = $3, parent_name = $4
       WHERE id = $5`,
      [studentUserId, parentUserId, PARENT_EMAIL, 'Demo Parent', studentId],
    );

    // Portal looked empty? Seed transparent demo data once.
    if (Number(p.att) === 0 && Number(p.res) === 0 && p.batchId) {
      console.log('   student has no data — seeding demo test + 14 days of attendance…');

      // demo test
      const test = await pool.query(
        `INSERT INTO tests (title, subject, grade, stream, batch_id, total_marks, duration_mins, test_date, board_pattern, created_by)
         VALUES ('Demo Test – Portal', 'Mathematics', $1, $2, $3, 100, 180,
                 to_char(now() AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD')::date, 'Custom',
                 (SELECT id FROM users WHERE role = 'admin' LIMIT 1))
         RETURNING id`,
        [p.grade ?? 'IX', p.stream ?? null, p.batchId],
      );
      const testId = test.rows[0].id;

      await pool.query(
        `INSERT INTO test_results (test_id, student_id, marks_obtained)
         VALUES ($1, $2, $3)`,
        [testId, studentId, Math.floor(55 + Math.random() * 38)],
      );

      // 14 school days of attendance (skip weekends)
      const iso = (dt: Date) =>
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const isWeekend = (dt: Date) => { const d = dt.getDay(); return d === 0 || d === 6; };

      const statuses: { d: Date; st: string }[] = [];
      let cursor = new Date();
      while (statuses.length < 14) {
        if (!isWeekend(cursor)) statuses.push({ d: cursor, st: Math.random() < 0.78 ? 'present' : (Math.random() < 0.6 ? 'late' : 'absent') });
        cursor = new Date(cursor.getTime() - 86400000);
      }
      for (const row of statuses) {
        await pool.query(
          `INSERT INTO attendance (student_id, batch_id, date, status)
           VALUES ($1, $2, $3::date, $4)
           ON CONFLICT (student_id, date) DO NOTHING`,
          [studentId, p.batchId, iso(row.d), row.st],
        );
      }
    }
  } else {
    // No students at all — create a demo one.
    const batch = await pool.query('SELECT id, grade, stream FROM batches WHERE is_active = TRUE LIMIT 1');
    const b = batch.rows[0];
    const bId = b?.id ?? null;
    const ins = await pool.query(
      `INSERT INTO students (name, roll_number, grade, stream, batch_id, status, user_id, parent_user_id, parent_email)
       VALUES ('Demo Student', 'DEMO-' || floor(random() * 900 + 100)::int, $2, $3, $4, 'active', $5, $6, $7)
       RETURNING id, name`,
      [null, b?.grade ?? 'IX', b?.stream ?? null, bId, studentUserId, parentUserId, PARENT_EMAIL],
    );
    studentId = ins.rows[0].id;
    linkedName = ins.rows[0].name;
    console.log(`   created fresh demo student #${studentId}`);
  }

  console.log('\n✅ Done.\n');
  console.table([
    { Role: 'Student', Email: STUDENT_EMAIL, Password: STUDENT_PASS, StudentId: studentId, LinkedTo: linkedName },
    { Role: 'Parent',  Email: PARENT_EMAIL,  Password: PARENT_PASS,  StudentId: studentId, LinkedTo: linkedName },
    { Role: 'Admin',   Email: 'admin@visioncollegiate.com', Password: 'Admin@1234', StudentId: '—', LinkedTo: 'all' },
  ]);
  console.log('\nStudent sees only themselves in My Progress; Parent sees Demo Student.\n');

  await pool.end();
}

main().catch((err) => {
  console.error('seedDemo failed:', err);
  process.exit(1);
});