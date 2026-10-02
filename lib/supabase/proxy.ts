import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isLocalizablePath, isLocale, LOCALE_COOKIE, LOCALE_HEADER, localeFromAcceptLanguage, localePrefix, localizePath, splitLocale,
} from '@/lib/i18n/config'
import type { Database } from './database.types'

const protectedPrefixes = ['/account', '/seller', '/admin', '/onboarding']

// A real page navigation (not an RSC fetch, prefetch, server action or asset).
function isDocumentRequest(request: NextRequest) {
  return (
    request.method === 'GET' &&
    !request.headers.has('rsc') &&
    !request.headers.has('next-router-prefetch') &&
    !request.headers.has('next-action') &&
    (request.headers.get('accept') ?? '').includes('text/html')
  )
}

// Handles the language layer and refreshes the Supabase session.
//
// Language: "/zh/..." is rewritten internally to "/..." with the locale in a
// request header, so every page exists once and renders in either language.
// English URLs stay unprefixed. Visitors who previously chose Chinese (cookie),
// or whose browser prefers Traditional Chinese and who haven't chosen yet,
// are redirected from English pages to the /zh equivalent — never the other
// way round, and never against an explicit choice.
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Alternative language prefixes (/en/…, /zh-tw/…) permanently redirect to
  // the site's canonical URLs (/… and /zh/…).
  const alias = pathname.match(/^\/(en|zh-tw|zh-hk|zh-hant)(?=\/|$)/i)
  if (alias) {
    const url = request.nextUrl.clone()
    const rest = pathname.slice(alias[0].length) || '/'
    url.pathname = alias[1].toLowerCase() === 'en' ? rest : localizePath(rest, 'zh-HK')
    return NextResponse.redirect(url, 308)
  }

  const { locale, path } = splitLocale(pathname)

  // Language switcher links carry ?set-lang=<locale>: remember the choice and
  // go to the same page in that language (a full page load, so <html lang>
  // and the loaded dictionary change too).
  const setLang = request.nextUrl.searchParams.get('set-lang')
  if (setLang !== null) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('set-lang')
    if (isLocale(setLang)) url.pathname = localizePath(path, setLang)
    const res = NextResponse.redirect(url, 303)
    if (isLocale(setLang)) {
      res.cookies.set(LOCALE_COOKIE, setLang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    }
    return res
  }

  // Admin and API routes exist in one language only.
  if (locale !== 'en' && !isLocalizablePath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = path
    return NextResponse.redirect(url)
  }

  if (locale === 'en' && isLocalizablePath(pathname) && isDocumentRequest(request)) {
    const saved = request.cookies.get(LOCALE_COOKIE)?.value
    const preferred = isLocale(saved) ? saved : localeFromAcceptLanguage(request.headers.get('accept-language'))
    if (preferred && preferred !== 'en') {
      const url = request.nextUrl.clone()
      url.pathname = localizePath(pathname, preferred)
      const res = NextResponse.redirect(url, 307)
      res.headers.set('Vary', 'Accept-Language, Cookie')
      return res
    }
  }

  const rewriteTo = locale !== 'en' ? new URL(`${path}${search}`, request.url) : null
  // Never trust a locale header sent by the client.
  const makeResponse = () => {
    const headers = new Headers(request.headers)
    headers.set(LOCALE_HEADER, locale)
    return rewriteTo
      ? NextResponse.rewrite(rewriteTo, { request: { headers } })
      : NextResponse.next({ request: { headers } })
  }

  let response = makeResponse()

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
        response = makeResponse()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Do not put code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  if (!signedIn && protectedPrefixes.some((p) => path === p || path.startsWith(`${p}/`))) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = `${localePrefix[locale]}/login`
    loginUrl.search = ''
    loginUrl.searchParams.set('next', pathname + search)
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
