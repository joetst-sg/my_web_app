import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'

const protectedPrefixes = ['/account', '/seller', '/admin', '/onboarding']

// Refreshes the Supabase session cookie on every request and sends
// signed-out visitors on protected routes to the login page. Role checks
// happen again on the server (layouts and actions) and in the database (RLS).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return response

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Do not put code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  const path = request.nextUrl.pathname
  if (!signedIn && protectedPrefixes.some((p) => path === p || path.startsWith(`${p}/`))) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', path + request.nextUrl.search)
    const redirect = NextResponse.redirect(loginUrl)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  // Anonymous analytics id (random, no personal data) for de-duplicating views.
  if (!request.cookies.get('loupe_aid')) {
    response.cookies.set('loupe_aid', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
  }

  return response
}
