require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const s = await p.query("SELECT id, name, roll_number, status FROM students WHERE name ILIKE '%test%' OR name ILIKE '%delete me%' ORDER BY id");
  console.log('TEST STUDENTS:', JSON.stringify(s.rows));
  const a = await p.query("SELECT id, student_id, batch_id, date, status FROM attendance ORDER BY id");
  console.log('ALL ATTENDANCE:', JSON.stringify(a.rows));
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });