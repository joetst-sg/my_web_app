import { NextResponse, type NextRequest } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

// Autocomplete: products, brands and categories for a query, or popular
// searches when the query is empty. Public data only, so it is cacheable.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)
  const supabase = createPublicClient()

  if (q.length < 2) {
    const { data } = await supabase.rpc('popular_searches', { result_limit: 6 })
    return NextResponse.json(
      { products: [], brands: [], categories: [], popular: (data ?? []).map((r) => r.query) },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  }

  const { data, error } = await supabase.rpc('search_suggest', { q })
  if (error) return NextResponse.json({ products: [], brands: [], categories: [] }, { status: 200 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } })
}
