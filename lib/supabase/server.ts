import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See ENVIRONMENT.md.')
  }
  return { url, key }
}

// Per-request client that acts as the signed-in user (RLS applies).
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = supabaseEnv()
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component: the proxy refreshes sessions instead.
        }
      },
    },
  })
}

// Cookie-less client for public, cacheable reads (sitemap, feeds). Acts as
// an anonymous visitor, so RLS only returns published content.
export function createPublicClient() {
  const { url, key } = supabaseEnv()
  return createPlainClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Service-role client for trusted server jobs only (email outbox). Returns
// null when the key is not configured.
export function createServiceClient() {
  const { url } = supabaseEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createPlainClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
