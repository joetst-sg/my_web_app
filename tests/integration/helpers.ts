import fs from 'node:fs'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Integration tests run against a real Supabase project using the demo
// accounts created by `npm run db:seed`. Credentials come from environment
// variables (TEST_<ROLE>_EMAIL / TEST_<ROLE>_PASSWORD) or, locally, from the
// git-ignored DEMO_ACCOUNTS.local.md file. Never point these at production
// data you care about: tests create and delete their own products.

const root = path.resolve(__dirname, '../..')

function env(name: string) {
  if (process.env[name]) return process.env[name]
  const file = path.join(root, '.env.local')
  if (!fs.existsSync(file)) return undefined
  return fs.readFileSync(file, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim()
}

export const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL')!
export const ANON_KEY = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')!

type Role = 'admin' | 'editor' | 'seller1' | 'seller2' | 'user1' | 'user2'

function credentials(role: Role) {
  const key = role.toUpperCase()
  const email = process.env[`TEST_${key}_EMAIL`]
  const password = process.env[`TEST_${key}_PASSWORD`]
  if (email && password) return { email, password }
  const file = path.join(root, 'DEMO_ACCOUNTS.local.md')
  if (!fs.existsSync(file)) throw new Error('No test credentials. Run `npm run db:seed` or set TEST_<ROLE>_EMAIL/PASSWORD.')
  const row = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`| ${role} |`))
  if (!row) throw new Error(`No demo account for ${role}`)
  const [, , e, p] = row.split('|').map((s) => s.trim())
  return { email: e, password: p.replace(/`/g, '') }
}

export const hasTestEnv = Boolean(SUPABASE_URL && ANON_KEY) &&
  (Boolean(process.env.TEST_SELLER1_EMAIL) || fs.existsSync(path.join(root, 'DEMO_ACCOUNTS.local.md')))

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function clientFor(role: Role) {
  const client = anonClient()
  const { data, error } = await client.auth.signInWithPassword(credentials(role))
  if (error) throw new Error(`Sign-in failed for ${role}: ${error.message}`)
  return { client, userId: data.user.id }
}

// A tiny valid WebP (1×1) for storage upload tests.
export const TINY_WEBP = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64')

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
