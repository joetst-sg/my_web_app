import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// The email templates pass {{ .RedirectTo }} as `next`, which is a full URL
// like https://site/auth/confirm?next=/onboarding. Reduce it to a local path.
function resolveNext(raw: string | null) {
  if (raw && /^https?:\/\//.test(raw)) {
    try {
      const u = new URL(raw)
      if (u.pathname === '/auth/confirm') return safeNext(u.searchParams.get('next'), '/')
      return safeNext(u.pathname + u.search, '/')
    } catch {
      return '/'
    }
  }
  return safeNext(raw, '/')
}

// Handles links from Supabase emails (sign-up confirmation, password reset,
// email change). Supports both token_hash links (our templates in
// supabase/templates) and PKCE ?code= links (Supabase default templates).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = resolveNext(searchParams.get('next'))

  const supabase = await createClient()
  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }

  const url = request.nextUrl.clone()
  url.search = ''
  if (!ok) {
    url.pathname = '/login'
    url.searchParams.set('error', 'link')
    return NextResponse.redirect(url)
  }
  url.pathname = type === 'recovery' ? '/reset-password' : next
  return NextResponse.redirect(url)
}
