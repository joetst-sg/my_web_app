import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function featuredCategories(limit = 12) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, description, color, icon, follower_count')
    .is('parent_id', null)
    .order('is_featured', { ascending: false })
    .order('sort_order')
    .limit(limit)
  return data ?? []
}

export async function allCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, description, color, icon, parent_id, follower_count, sort_order')
    .order('sort_order')
  return data ?? []
}

type CollectionRow = {
  id: string
  slug: string
  title: string
  description: string | null
  product_count: number
  is_editorial: boolean
  visibility: string
  owner_id: string | null
  follower_count: number
  updated_at: string
}

// Collections with up to four product images each (two queries, no N+1).
export async function withCollectionImages<T extends CollectionRow>(collections: T[]) {
  if (collections.length === 0) return [] as (T & { images: string[]; ownerName: string | null })[]
  const supabase = await createClient()
  const ids = collections.map((c) => c.id)
  const ownerIds = [...new Set(collections.map((c) => c.owner_id).filter(Boolean))] as string[]
  const [{ data: links }, { data: owners }] = await Promise.all([
    supabase.from('collection_products').select('collection_id, product_id, position').in('collection_id', ids).order('position'),
    ownerIds.length ? supabase.from('profiles').select('id, display_name, username').in('id', ownerIds) : Promise.resolve({ data: [] }),
  ])
  const productIds = [...new Set((links ?? []).map((l) => l.product_id))]
  const { data: cards } = productIds.length
    ? await supabase.from('product_cards').select('id, image_path').in('id', productIds).eq('status', 'published')
    : { data: [] as { id: string | null; image_path: string | null }[] }
  const imageBy = new Map((cards ?? []).map((c) => [c.id, c.image_path]))
  const ownerBy = new Map((owners ?? []).map((o) => [o.id, o.display_name || o.username]))
  return collections.map((c) => ({
    ...c,
    images: (links ?? [])
      .filter((l) => l.collection_id === c.id)
      .map((l) => imageBy.get(l.product_id))
      .filter((x): x is string => Boolean(x))
      .slice(0, 4),
    ownerName: c.owner_id ? ownerBy.get(c.owner_id) ?? null : null,
  }))
}

const COLLECTION_COLUMNS = 'id, slug, title, description, product_count, is_editorial, visibility, owner_id, follower_count, updated_at' as const

export async function featuredCollections(limit = 4) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select(COLLECTION_COLUMNS)
    .eq('visibility', 'public')
    .eq('is_featured', true)
    .gt('product_count', 0)
    .order('updated_at', { ascending: false })
    .limit(limit)
  return withCollectionImages(data ?? [])
}

export async function publicCollections({ editorial, limit = 24, offset = 0 }: { editorial?: boolean; limit?: number; offset?: number } = {}) {
  const supabase = await createClient()
  let q = supabase
    .from('collections')
    .select(COLLECTION_COLUMNS, { count: 'exact' })
    .eq('visibility', 'public')
    .gt('product_count', 0)
  if (editorial !== undefined) q = q.eq('is_editorial', editorial)
  const { data, count } = await q
    .order('is_featured', { ascending: false })
    .order('follower_count', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return { items: await withCollectionImages(data ?? []), total: count ?? 0 }
}

export async function collectionsContainingProduct(productId: string, limit = 4) {
  const supabase = await createClient()
  const { data: links } = await supabase.from('collection_products').select('collection_id').eq('product_id', productId).limit(50)
  const ids = (links ?? []).map((l) => l.collection_id)
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('collections')
    .select(COLLECTION_COLUMNS)
    .in('id', ids)
    .eq('visibility', 'public')
    .order('is_editorial', { ascending: false })
    .order('follower_count', { ascending: false })
    .limit(limit)
  return withCollectionImages(data ?? [])
}

export async function latestArticles(limit = 3, offset = 0, type?: string) {
  const supabase = await createClient()
  let q = supabase
    .from('articles')
    .select('id, slug, title, excerpt, featured_image_url, type, published_at, reading_minutes, author_id', { count: 'exact' })
    .eq('status', 'published')
  if (type) q = q.eq('type', type as never)
  const { data, count } = await q.order('published_at', { ascending: false }).range(offset, offset + limit - 1)
  const authorIds = [...new Set((data ?? []).map((a) => a.author_id).filter(Boolean))] as string[]
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', authorIds)
    : { data: [] as { id: string; display_name: string | null }[] }
  const by = new Map((authors ?? []).map((a) => [a.id, a.display_name]))
  return { items: (data ?? []).map((a) => ({ ...a, authorName: a.author_id ? by.get(a.author_id) ?? null : null })), total: count ?? 0 }
}

export async function dealCards({ status = 'active', limit = 24, category }: { status?: 'active' | 'upcoming' | 'expired' | 'all'; limit?: number; category?: string } = {}) {
  const supabase = await createClient()
  let q = supabase.from('deal_cards').select('*')
  if (status !== 'all') q = q.eq('deal_status', status)
  if (category) q = q.eq('category_slug', category)
  const { data } = await q.order('discount_percent', { ascending: false }).limit(limit)
  return data ?? []
}

export async function homepageSections() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('homepage_sections')
    .select('id, type, title, subtitle, config, position')
    .eq('is_enabled', true)
    .order('position')
  return data ?? []
}
