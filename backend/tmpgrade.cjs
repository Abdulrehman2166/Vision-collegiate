require('dotenv').config();
const { Pool } = require('pg');
const conn = process.env.DATABASE_URL;
const p = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
(async () => {
  for (const t of ['students', 'batches', 'tests']) {
    await p.query(`ALTER TABLE ${t} ALTER COLUMN grade TYPE VARCHAR(12)`);
    console.log(`widened grade on ${t}`);
  }
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });