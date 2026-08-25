import { createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto'
import pg from 'pg'

const { Pool } = pg
const connectionString = process.env.DATABASE_URL?.trim()
const useSsl = process.env.DATABASE_SSL !== 'false'
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'

if (!connectionString) {
  throw new Error('DATABASE_URL is required. Add the cloud PostgreSQL connection URL to Where/.env.')
}

export const siteId = process.env.SITE_ID?.trim() || 'where-main'

const database = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized } : false,
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
})

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || `${row.username}@where-to-go.local`,
    provider: row.provider,
    profileImage: row.profile_image,
    sourceSite: row.source_site,
    createdAt: toIsoString(row.created_at),
  }
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') }
}

export async function initializeDatabase() {
  await database.query(`
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
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS source_site TEXT NOT NULL DEFAULT 'legacy'`)
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`)
  await database.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_user_id TEXT`)
  await database.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`)
  await database.query(`ALTER TABLE users ALTER COLUMN password_salt DROP NOT NULL`)
  await database.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_provider_identity_idx
    ON users (provider, provider_user_id)
    WHERE provider_user_id IS NOT NULL
  `)
  await database.query(`CREATE INDEX IF NOT EXISTS users_source_site_idx ON users (source_site)`)
  await database.query(`CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC)`)
}

export async function createPasswordUser({ username, name, password }) {
  const id = randomUUID()
  const { salt, hash } = passwordRecord(password)

  try {
    const result = await database.query(
      `INSERT INTO users
        (id, username, name, password_hash, password_salt, provider, profile_image, source_site)
       VALUES ($1, $2, $3, $4, $5, 'password', '', $6)
       RETURNING id, username, name, email, provider, profile_image, source_site, created_at`,
      [id, username, name, hash, salt, siteId],
    )
    return toUser(result.rows[0])
  } catch (error) {
    if (error?.code === '23505') {
      const duplicate = new Error('USERNAME_ALREADY_EXISTS')
      duplicate.code = 'USERNAME_ALREADY_EXISTS'
      throw duplicate
    }
    throw error
  }
}

function socialUsername(providerUserId) {
  const digest = createHash('sha256').update(`google:${providerUserId}`).digest('hex').slice(0, 18)
  return `g_${digest}`
}

function normalizedSocialName(name) {
  return Array.from(name?.trim().normalize('NFC') || 'Google 사용자').slice(0, 20).join('')
}

export async function upsertGoogleUser({ providerUserId, name, email, profileImage }) {
  const username = socialUsername(providerUserId)
  const result = await database.query(
    `INSERT INTO users
      (id, username, name, email, password_hash, password_salt, provider, provider_user_id, profile_image, source_site)
     VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8)
     ON CONFLICT (provider, provider_user_id) WHERE provider_user_id IS NOT NULL
     DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       profile_image = EXCLUDED.profile_image
     RETURNING id, username, name, email, provider, profile_image, source_site, created_at`,
    [
      randomUUID(),
      username,
      normalizedSocialName(name),
      email || null,
      'google',
      String(providerUserId),
      profileImage || '',
      siteId,
    ],
  )
  return toUser(result.rows[0])
}

export async function listUsers() {
  const result = await database.query(
    `SELECT id, name, username, provider, profile_image, source_site, created_at
     FROM users
     ORDER BY created_at DESC`,
  )
  return result.rows.map(toUser)
}

export async function closeDatabase() {
  await database.end()
}
