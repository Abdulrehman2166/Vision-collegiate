/**
 * seed.ts – creates the first admin user.
 * Run once with:  npx ts-node src/seed.ts
 */
import bcrypt from 'bcryptjs';
import { pool } from './db';

async function seed() {
  const email    = 'admin@visioncollegiate.com';
  const password = 'Admin@1234';
  const name     = 'Admin';
  const role     = 'admin';

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    console.log(`✅ Admin already exists (email: ${email})`);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const res  = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
    [name, email, hash, role],
  );

  console.log('✅ Admin user created:');
  console.table(res.rows[0]);
  console.log(`\n   Email:    ${email}`);
  console.log(`   Password: ${password}\n`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
