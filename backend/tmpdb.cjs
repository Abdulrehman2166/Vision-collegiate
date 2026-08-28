require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const r = await p.query("SELECT id, name, batch_id, status FROM students WHERE status='active' ORDER BY roll_number");
  r.rows.forEach((x) => console.log(`id=${x.id} name=${x.name} batch=${x.batch_id}`));
  const noBatch = r.rows.filter((x) => x.batch_id == null);
  console.log('active with NO batch:', noBatch.length);
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });