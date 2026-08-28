require('dotenv').config();
const { Pool } = require('pg');
const conn = process.env.DATABASE_URL;
const p = new Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
p.query("SELECT column_name FROM information_schema.columns WHERE table_name='students' ORDER BY ordinal_position")
  .then((r) => {
    console.log('students columns:', r.rows.map((x) => x.column_name).join(', '));
    return p.end();
  })
  .catch((e) => { console.error('ERR', e.message); process.exit(1); });