import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import type { Database } from '@/lib/supabase/database.types'

export type ProductCardRow = Database['public']['Views']['product_cards']['Row']

export const CARD_COLUMNS =
  'id, slug, name, tagline, currency, price, compare_at_price, discount_percent, availability, status, brand_name, brand_slug, category_name, category_slug, image_path, image_alt, score, is_featured, is_new, is_trending, trending_rank, deal_id, deal_ends_at, published_at, save_count, popularity_score' as const

export type ProductCardData = Pick<
  ProductCardRow,
  | 'id' | 'slug' | 'name' | 'tagline' | 'currency' | 'price' | 'compare_at_price' | 'discount_percent' | 'availability' | 'status'
  | 'brand_name' | 'brand_slug' | 'category_name' | 'category_slug' | 'image_path' | 'image_alt' | 'score' | 'is_featured'
  | 'is_new' | 'is_trending' | 'trending_rank' | 'deal_id' | 'deal_ends_at' | 'published_at' | 'save_count' | 'popularity_score'
>

export { sortOptions, filterSchema, parseFilters, filtersToSearchParams, type ProductFilters } from '@/lib/filters'
import { type ProductFilters } from '@/lib/filters'

// Category slug -> ids of the category and its subcategories.
export const categoryIdsForSlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', slug).maybeSingle()
  if (!cat) return []
  const { data: children } = await supabase.from('categories').select('id').eq('parent_id', cat.id)
  return [cat.id, ...(children ?? []).map((c) => c.id)]
})

export async function listProducts(filters: ProductFilters, { pageSize = 24 }: { pageSize?: number } = {}) {
  const supabase = await createClient()
  const page = filters.page ?? 1
  const sort = filters.sort ?? (filters.q ? 'relevance' : 'trending')

  let rankedIds: string[] | null = null
  if (filters.q && filters.q.length >= 2) {
    const { data, error } = await supabase.rpc('search_products', { q: filters.q, result_limit: 200 })
    if (error) throw error
    rankedIds = (data ?? []).map((r) => r.product_id)
    if (rankedIds.length === 0) return { items: [] as ProductCardData[], total: 0, page, pageCount: 0 }
  }

  let query = supabase.from('product_cards').select(CARD_COLUMNS, { count: 'exact' }).eq('status', 'published')

  if (rankedIds) query = query.in('id', rankedIds)
  if (filters.category) {
    const ids = await categoryIdsForSlug(filters.category)
    if (ids.length === 0) return { items: [], total: 0, page, pageCount: 0 }
    query = query.overlaps('category_ids', ids)
  }
  if (filters.brand) query = query.eq('brand_slug', filters.brand)
  if (filters.price_min !== undefined) query = query.gte('price', filters.price_min)
  if (filters.price_max !== undefined) query = query.lte('price', filters.price_max)
  if (filters.rating !== undefined) query = query.gte('score', filters.rating)
  if (filters.availability) query = query.eq('availability', filters.availability)
  if (filters.crowdfunding) query = query.eq('availability', 'crowdfunding')
  if (filters.discount) query = query.gt('discount_percent', 0)
  if (filters.new) query = query.eq('is_new', true)
  if (filters.trending) query = query.not('trending_rank', 'is', null)
  if (filters.featured) query = query.eq('is_featured', true)
  if (filters.deal) query = query.not('deal_id', 'is', null)

  const relevanceSort = sort === 'relevance' && rankedIds
  switch (sort) {
    case 'newest': query = query.order('published_at', { ascending: false }); break
    case 'most_saved': query = query.order('save_count', { ascending: false }); break
    case 'rating': query = query.order('score', { ascending: false, nullsFirst: false }); break
    case 'price_asc': query = query.order('price', { ascending: true, nullsFirst: false }); break
    case 'price_desc': query = query.order('price', { ascending: false, nullsFirst: false }); break
    case 'discount': query = query.order('discount_percent', { ascending: false }); break
    default: query = query.order('popularity_score', { ascending: false })
  }
  query = query.order('id')

  if (relevanceSort) {
    // Fetch all matches (≤200) and order by search rank in memory.
    const { data, error, count } = await query
    if (error) throw error
    const order = new Map(rankedIds!.map((id, i) => [id, i]))
    const sorted = (data ?? []).sort((a, b) => (order.get(a.id!) ?? 0) - (order.get(b.id!) ?? 0))
    const total = count ?? sorted.length
    return {
      items: sorted.slice((page - 1) * pageSize, page * pageSize) as ProductCardData[],
      total,
      page,
      pageCount: Math.ceil(total / pageSize),
    }
  }

  const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw error
  const total = count ?? 0
  return { items: (data ?? []) as ProductCardData[], total, page, pageCount: Math.ceil(total / pageSize) }
}

export async function productsByIds(ids: string[]) {
  if (ids.length === 0) return [] as ProductCardData[]
  const supabase = await createClient()
  const { data, error } = await supabase.from('product_cards').select(CARD_COLUMNS).in('id', ids)
  if (error) throw error
  const order = new Map(ids.map((id, i) => [id, i]))
  return ((data ?? []) as ProductCardData[]).sort((a, b) => (order.get(a.id!) ?? 0) - (order.get(b.id!) ?? 0))
}

export async function productsForPlacement(placement: Database['public']['Enums']['feature_placement'], limit = 8) {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('featured_products')
    .select('product_id, position')
    .eq('placement', placement)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('position')
    .limit(limit)
  const cards = await productsByIds((data ?? []).map((f) => f.product_id))
  return cards.filter((c) => c.status === 'published')
}

export async function trendingProducts(limit = 8) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_cards')
    .select(CARD_COLUMNS)
    .eq('status', 'published')
    .order('popularity_score', { ascending: false })
    .limit(limit)
  return (data ?? []) as ProductCardData[]
}

export async function newestProducts(limit = 8) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_cards')
    .select(CARD_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as ProductCardData[]
}

// IDs of products (from a list) the viewer has saved / set reminders for.
export async function viewerProductState(productIds: string[]) {
  const user = await getAuthUser()
  if (!user || productIds.length === 0) return { saved: new Set<string>(), reminded: new Set<string>() }
  const supabase = await createClient()
  const [{ data: saves }, { data: reminders }] = await Promise.all([
    supabase.from('product_saves').select('product_id').eq('user_id', user.id).in('product_id', productIds),
    supabase.from('reminders').select('product_id').eq('user_id', user.id).eq('status', 'pending').in('product_id', productIds),
  ])
  return {
    saved: new Set((saves ?? []).map((s) => s.product_id)),
    reminded: new Set((reminders ?? []).map((r) => r.product_id)),
  }
}

export const getProductBySlug = cache(async (slug: string) => {
  const supabase = await createClient()
  // Both queries by slug, in parallel (one round trip instead of two).
  const [{ data: product }, { data: card }] = await Promise.all([
    supabase
      .from('products')
      .select(`
      id, slug, name, tagline, description, key_features, benefits, external_url, sku, currency, price, original_price,
      availability, status, published_at, updated_at, seller_id, seo_title, seo_description, save_count, view_count,
      brand:brands ( id, slug, name, tagline, description, logo_url, website_url, social_links, is_verified, follower_count ),
      images:product_images ( id, storage_path, alt, width, height, position ),
      videos:product_videos ( id, url, provider, title, position ),
      specs:product_specifications ( id, label, value, position ),
      categories:product_categories ( is_primary, category:categories ( id, slug, name, parent_id ) ),
      tags:product_tags ( tag:tags ( slug, name ) ),
      score:product_scores ( overall, design, innovation, usability, value, features, verdict )
    `)
      .eq('slug', slug)
      .maybeSingle(),
    supabase
      .from('product_cards')
      .select('price, compare_at_price, discount_percent, deal_id, deal_ends_at, is_new, is_trending, is_featured')
      .eq('slug', slug)
      .maybeSingle(),
  ])
  if (!product) return null
  return {
    ...product,
    images: [...(product.images ?? [])].sort((a, b) => a.position - b.position),
    videos: [...(product.videos ?? [])].sort((a, b) => a.position - b.position),
    specs: [...(product.specs ?? [])].sort((a, b) => a.position - b.position),
    primaryCategory:
      product.categories?.find((c) => c.is_primary)?.category ?? product.categories?.[0]?.category ?? null,
    pricing: card,
  }
})

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>
