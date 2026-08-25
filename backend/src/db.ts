import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Use individual config fields so the password is never URL-parsed.
// This avoids issues with special characters like [ ] @ # in passwords.
const pool = (() => {
  const connStr = process.env.DATABASE_URL ?? '';

  if (!connStr || connStr.includes('[YOUR')) {
    console.warn(
      '\n⚠️  DATABASE_URL is not configured.\n' +
      '   Edit backend/.env and set your Supabase connection string.\n',
    );
    // Return a dummy pool — queries will fail but the server won't crash on startup
    return new Pool({ connectionString: 'postgresql://localhost/placeholder' });
  }

  // Parse the connection string manually so we can pass the password raw
  // Format: postgresql://user:password@host:port/database
  try {
    // We extract by splitting on known delimiters carefully
    // pattern: postgresql://USER:PASS@HOST:PORT/DB
    const withoutScheme = connStr.replace(/^postgresql:\/\//, '');
    // Split user:pass from host:port/db at the LAST @ before the host
    const atIdx = withoutScheme.lastIndexOf('@');
    const userPass = withoutScheme.slice(0, atIdx);
    const hostPart = withoutScheme.slice(atIdx + 1);

    const colonIdx = userPass.indexOf(':');
    const user     = userPass.slice(0, colonIdx);
    const password = decodeURIComponent(userPass.slice(colonIdx + 1));

    const [hostPort, database] = hostPart.split('/');
    const lastColon = hostPort.lastIndexOf(':');
    const host = hostPort.slice(0, lastColon);
    const port = parseInt(hostPort.slice(lastColon + 1), 10);

    return new Pool({
      user,
      password,   // passed directly — special chars preserved
      host,
      port,
      database,
      ssl: { rejectUnauthorized: false }, // required for Supabase pooler
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  } catch (e) {
    console.error('Failed to parse DATABASE_URL:', (e as Error).message);
    return new Pool({ connectionString: connStr });
  }
})();

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

export { pool };
