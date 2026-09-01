/**
 * Database migration script.
 * Run with: npm run migrate
 * Creates all tables if they don't exist, safe to re-run.
 */
import { pool } from './db';

const sql = `
-- ─────────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL UNIQUE,
  password     TEXT        NOT NULL,
  role         VARCHAR(20) NOT NULL CHECK (role IN ('admin','teacher','parent','student')),
  phone        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- BATCHES (classes / streams)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id           SERIAL PRIMARY KEY,
  grade        VARCHAR(12) NOT NULL,           -- Juniors, IX, X, XI, XII
  stream       VARCHAR(50),                    -- Science, Commerce, Arts, NULL for IX-X
  name         TEXT        NOT NULL,           -- e.g. "Batch A – Science XI"
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP   NOT NULL DEFAULT now()
);

-- Junction: teachers ↔ batches
CREATE TABLE IF NOT EXISTS teacher_batches (
  teacher_id   INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  batch_id     INTEGER NOT NULL REFERENCES batches(id)  ON DELETE CASCADE,
  PRIMARY KEY (teacher_id, batch_id)
);

-- ─────────────────────────────────────────────
-- STUDENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  parent_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  roll_number     TEXT        UNIQUE,
  name            TEXT        NOT NULL,
  grade           VARCHAR(12) NOT NULL,
  stream          VARCHAR(50),
  batch_id        INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  parent_name     TEXT,
  parent_phone    TEXT,
  parent_email    TEXT,
  date_of_birth   DATE,
  address         TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','transferred')),
  created_at      TIMESTAMP   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- ATTENDANCE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id     INTEGER     NOT NULL REFERENCES batches(id)  ON DELETE CASCADE,
  date         DATE        NOT NULL,
  status       VARCHAR(10) NOT NULL CHECK (status IN ('present','absent','late','holiday')),
  marked_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMP   NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON attendance(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student    ON attendance(student_id);

-- ─────────────────────────────────────────────
-- TESTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
  id              SERIAL PRIMARY KEY,
  title           TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  grade           VARCHAR(12) NOT NULL,
  stream          VARCHAR(50),
  batch_id        INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  total_marks     INTEGER     NOT NULL DEFAULT 100,
  duration_mins   INTEGER     NOT NULL DEFAULT 180,
  test_date       DATE,
  board_pattern   VARCHAR(50),                -- CBSE, ICSE, State, Custom
  student_pdf_url TEXT,
  teacher_pdf_url TEXT,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP   NOT NULL DEFAULT now()
);

-- Questions bank for test papers
CREATE TABLE IF NOT EXISTS test_questions (
  id           SERIAL PRIMARY KEY,
  test_id      INTEGER     NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  section      TEXT,                          -- Section A, B, C
  question     TEXT        NOT NULL,
  answer       TEXT,                          -- teacher-only
  marks        INTEGER     NOT NULL DEFAULT 1,
  question_type VARCHAR(20) DEFAULT 'subjective' CHECK (question_type IN ('mcq','short','long','subjective')),
  options      JSONB,                         -- for MCQ: ["A","B","C","D"]
  order_index  INTEGER     NOT NULL DEFAULT 0
);

-- Scheduled WhatsApp dispatch for tests
CREATE TABLE IF NOT EXISTS test_schedules (
  id           SERIAL PRIMARY KEY,
  test_id      INTEGER     NOT NULL REFERENCES tests(id)    ON DELETE CASCADE,
  batch_id     INTEGER     REFERENCES batches(id)           ON DELETE SET NULL,
  dispatch_at  TIMESTAMP   NOT NULL,
  dispatched   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP   NOT NULL DEFAULT now()
);

-- Marks / results for tests (one row per student per test)
CREATE TABLE IF NOT EXISTS test_results (
  id             SERIAL PRIMARY KEY,
  test_id        INTEGER     NOT NULL REFERENCES tests(id)     ON DELETE CASCADE,
  student_id     INTEGER     NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  marks_obtained NUMERIC(6,2) NOT NULL,
  recorded_by    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  remarks        TEXT,
  created_at     TIMESTAMP   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP   NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_test_results_test    ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student ON test_results(student_id);

-- Per-student subject + "out of" total for marks entry (editable per student)
ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS subject      VARCHAR(120),
  ADD COLUMN IF NOT EXISTS total_marks  NUMERIC(6,2);

-- Backfill existing rows from their test (so old data stays consistent)
UPDATE test_results tr
SET subject     = t.subject,
    total_marks = t.total_marks
FROM tests t
WHERE t.id = tr.test_id
  AND (tr.subject IS NULL OR tr.total_marks IS NULL);

-- ─────────────────────────────────────────────
-- MASTER WEEKLY TEST SCHEDULE
-- Rotating monthly plan: 3 tests/week per class, Week 4 = Grand Revision Test
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_schedule (
  id       SERIAL PRIMARY KEY,
  grade    VARCHAR(12) NOT NULL,          -- IX, X, XI, XII
  week     INTEGER     NOT NULL,          -- 1-4
  day      VARCHAR(10) NOT NULL,          -- Mon, Tue, Wed, Thu, Fri, Sat
  subject  TEXT        NOT NULL,          -- e.g. "English", "Bio / CS", "Grand Test"
  teacher  TEXT,                          -- "Miss", "You", NULL
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (grade, week, day)
);

-- Seed the default rotating schedule (UPSERT, safe to re-run)
INSERT INTO test_schedule (grade, week, day, subject, teacher) VALUES
  -- Week 1
  ('IX','1','Tue','Chem','Miss'),    ('IX','1','Thu','English',NULL),   ('IX','1','Sat','Physics',NULL),
  ('X','1','Wed','Physics',NULL),    ('X','1','Fri','English',NULL),    ('X','1','Sat','Chem','Miss'),
  ('XI','1','Wed','Physics',NULL),   ('XI','1','Thu','English',NULL),   ('XI','1','Sat','Maths',NULL),
  ('XII','1','Mon','Chem','You'),    ('XII','1','Wed','English',NULL),  ('XII','1','Sat','Physics',NULL),
  -- Week 2
  ('IX','2','Tue','Physics',NULL),   ('IX','2','Thu','Urdu',NULL),      ('IX','2','Sat','Maths',NULL),
  ('X','2','Wed','Maths',NULL),      ('X','2','Fri','PST',NULL),        ('X','2','Sat','Bio','Miss'),
  ('XI','2','Wed','Chem','Miss'),    ('XI','2','Thu','Urdu',NULL),      ('XI','2','Sat','Physics',NULL),
  ('XII','2','Mon','Chem','You'),    ('XII','2','Wed','Urdu',NULL),     ('XII','2','Sat','Maths',NULL),
  -- Week 3
  ('IX','3','Tue','Chem','Miss'),    ('IX','3','Thu','Islamiat',NULL),  ('IX','3','Sat','Bio / CS',NULL),
  ('X','3','Wed','Physics',NULL),    ('X','3','Fri','Sindhi',NULL),     ('X','3','Sat','Maths',NULL),
  ('XI','3','Wed','Physics',NULL),   ('XI','3','Thu','Islamiat',NULL),  ('XI','3','Sat','Chem','Miss'),
  ('XII','3','Mon','Chem','You'),    ('XII','3','Wed','PST',NULL),      ('XII','3','Sat','Chem','You'),
  -- Week 4 (Grand Revision)
  ('IX','4','Tue','Maths',NULL),     ('IX','4','Thu','English',NULL),   ('IX','4','Sat','Grand Test',NULL),
  ('X','4','Wed','CS / English',NULL),('X','4','Fri','PST / Sindhi',NULL),('X','4','Sat','Grand Test',NULL),
  ('XI','4','Wed','CS / Chem',NULL), ('XI','4','Thu','Eng / Urdu',NULL),('XI','4','Sat','Grand Test',NULL),
  ('XII','4','Mon','Chem','You'),    ('XII','4','Wed','CS / Eng',NULL), ('XII','4','Sat','Grand Test',NULL)
ON CONFLICT (grade, week, day) DO UPDATE
  SET subject = EXCLUDED.subject, teacher = EXCLUDED.teacher, updated_at = now();

-- ─────────────────────────────────────────────
-- WHATSAPP LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id              SERIAL PRIMARY KEY,
  recipient_phone TEXT        NOT NULL,
  recipient_name  TEXT,
  message_id      TEXT,
  message_type    VARCHAR(30),               -- attendance_slip, monthly_card, test_paper
  reference_id    INTEGER,                   -- attendance.id or test.id
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  error_message   TEXT,
  payload         JSONB,
  created_at      TIMESTAMP   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP   NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- APP SETTINGS (key/value store, e.g. working_date)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- HELPER: auto-update updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users') THEN
    CREATE TRIGGER set_timestamp_users
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_students') THEN
    CREATE TRIGGER set_timestamp_students
      BEFORE UPDATE ON students
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_whatsapp_logs') THEN
    CREATE TRIGGER set_timestamp_whatsapp_logs
      BEFORE UPDATE ON whatsapp_logs
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_test_results') THEN
    CREATE TRIGGER set_timestamp_test_results
      BEFORE UPDATE ON test_results
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_test_schedule') THEN
    CREATE TRIGGER set_timestamp_test_schedule
      BEFORE UPDATE ON test_schedule
      FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END;
$$;
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations…');
    await client.query(sql);
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
