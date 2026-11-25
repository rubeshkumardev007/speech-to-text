const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://stt:stt@localhost:5432/stt',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transcriptions (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT '',
      text        TEXT NOT NULL,
      language    TEXT NOT NULL DEFAULT 'auto',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS transcriptions_created_idx ON transcriptions (created_at DESC);
  `);
}

module.exports = { pool, migrate };
