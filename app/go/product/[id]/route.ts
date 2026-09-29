import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Outbound "Buy now" redirect:
// 1. validate the product id and that the product is published,
// 2. record the click (rate limited, in the database),
// 3. redirect to the seller's URL — only plain https URLs are allowed.
export async function GET(request: NextRequest, ctx: RouteContext<'/go/product/[id]'>) {
  const { id } = await ctx.params
  const fallback = new URL('/products', request.url)

  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(fallback, 303)

  const supabase = await createClient()
  const anonId = request.cookies.get('loupe_aid')?.value
  const { data: url, error } = await supabase.rpc('record_outbound_click', { product_id: id, anon_id: anonId })
  if (error || !url) return NextResponse.redirect(fallback, 303)

  let target: URL
  try {
    target = new URL(url)
  } catch {
    return NextResponse.redirect(fallback, 303)
  }
  if (target.protocol !== 'https:' || target.username || target.password) {
    return NextResponse.redirect(fallback, 303)
  }

  const res = NextResponse.redirect(target, 302)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'origin')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
