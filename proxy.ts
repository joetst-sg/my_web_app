import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except static files, images and the outbound redirect route
    // (which must stay fast and does its own tracking).
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|feed.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
}
