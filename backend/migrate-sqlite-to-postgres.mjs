import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const { Pool } = pg
const connectionString = process.env.DATABASE_URL?.trim()
const useSsl = process.env.DATABASE_SSL !== 'false'
const defaultSiteId = process.env.SQLITE_MIGRATION_SITE_ID?.trim() || process.env.SITE_ID?.trim() || 'where-main'
const sqliteUrl = new URL('./data/where.sqlite', import.meta.url)

if (!connectionString) throw new Error('DATABASE_URL is required in Where/.env')
if (!existsSync(sqliteUrl)) throw new Error('backend/data/where.sqlite was not found')

const sqlite = new DatabaseSync(sqliteUrl, { readOnly: true })
const postgres = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 10_000,
})
const client = await postgres.connect()

try {
  const users = sqlite.prepare(`
    SELECT id, username, name, password_hash, password_salt, provider, profile_image, created_at
    FROM users
    ORDER BY created_at
  `).all()

  await client.query('BEGIN')
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      username VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(20) NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'password',
      profile_image TEXT NOT NULL DEFAULT '',
      source_site TEXT NOT NULL DEFAULT 'legacy',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS source_site TEXT NOT NULL DEFAULT 'legacy'`)

  let inserted = 0
  let skipped = 0
  for (const user of users) {
    const result = await client.query(
      `INSERT INTO users
        (id, username, name, password_hash, password_salt, provider, profile_image, source_site, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (username) DO NOTHING`,
      [
        user.id,
        user.username,
        user.name,
        user.password_hash,
        user.password_salt,
        user.provider,
        user.profile_image,
        defaultSiteId,
        user.created_at,
      ],
    )
    if (result.rowCount === 1) inserted += 1
    else skipped += 1
  }

  await client.query(`CREATE INDEX IF NOT EXISTS users_source_site_idx ON users (source_site)`)
  await client.query(`CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC)`)
  await client.query('COMMIT')
  console.log(`SQLite migration complete: inserted=${inserted}, skipped=${skipped}`)
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally {
  sqlite.close()
  client.release()
  await postgres.end()
}
