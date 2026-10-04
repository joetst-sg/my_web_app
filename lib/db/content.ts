import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function featuredCategories(limit = 12) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, description, color, icon, follower_count, translations')
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
    .select('id, slug, name, description, color, icon, parent_id, follower_count, sort_order, translations')
    .order('sort_order')
  return data ?? []
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
    .select('id, type, title, subtitle, config, position, translations')
    .eq('is_enabled', true)
    .order('position')
  return data ?? []
}
