require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const s = await p.query('SELECT id, name, roll_number, status FROM students WHERE id = 3');
  console.log('STUDENT 3:', JSON.stringify(s.rows));
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });