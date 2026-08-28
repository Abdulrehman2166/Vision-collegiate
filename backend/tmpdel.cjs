require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const ids = [4, 5, 6, 22, 23, 24, 25];
  const del = await p.query('DELETE FROM attendance WHERE student_id = ANY($1::int[])', [ids]);
  const r = await p.query('DELETE FROM students WHERE id = ANY($1::int[]) RETURNING id, name', [ids]);
  console.log('attendance rows deleted:', del.rowCount);
  console.log('students deleted:', JSON.stringify(r.rows));
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });