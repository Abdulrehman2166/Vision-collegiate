require('dotenv').config();
const { Pool } = require('pg');
const conn = process.env.DATABASE_URL;
const p = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
(async () => {
  const r = await p.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='parent_user_id'",
  );
  if (r.rows.length) {
    console.log('parent_user_id already exists — nothing to do');
  } else {
    await p.query('ALTER TABLE students ADD COLUMN parent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    console.log('Added parent_user_id column');
  }
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });