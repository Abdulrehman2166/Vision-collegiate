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
