import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Locale } from '@/lib/i18n/config'
import { localized } from '@/lib/i18n/content'
import type { MessageKey } from '@/lib/i18n/translate'

// A product with everything the wizard and previews need. RLS limits this
// to the seller's own products (or staff).
export const getEditableProduct = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(`
      id, slug, name, tagline, description, translations, key_features, benefits, external_url, sku, currency, price, original_price,
      sale_starts_at, sale_ends_at, availability, status, published_at, updated_at, seller_id, seo_title, seo_description, save_count, view_count,
      brand:brands ( id, slug, name, tagline, description, logo_url, website_url, social_links, is_verified, follower_count, owner_id ),
      images:product_images ( id, storage_path, alt, width, height, position ),
      videos:product_videos ( id, url, provider, title, position ),
      specs:product_specifications ( id, label, value, position ),
      categories:product_categories ( is_primary, category:categories ( id, slug, name, parent_id, translations ) ),
      tags:product_tags ( tag:tags ( slug, name ) ),
      score:product_scores ( overall, design, innovation, usability, value, features, verdict ),
      submission:submissions ( id, status, submitted_at, last_action_at, scheduled_for )
    `)
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const submission = Array.isArray(data.submission) ? data.submission[0] : data.submission
  return {
    ...data,
    submission,
    images: [...(data.images ?? [])].sort((a, b) => a.position - b.position),
    videos: [...(data.videos ?? [])].sort((a, b) => a.position - b.position),
    specs: [...(data.specs ?? [])].sort((a, b) => a.position - b.position),
    primaryCategory: data.categories?.find((c) => c.is_primary)?.category ?? data.categories?.[0]?.category ?? null,
    pricing: null,
  }
})

export type EditableProduct = NonNullable<Awaited<ReturnType<typeof getEditableProduct>>>

export async function wizardOptions(userId: string, locale: Locale = 'en') {
  const supabase = await createClient()
  const [{ data: brands }, { data: categories }] = await Promise.all([
    supabase.from('brands').select('id, name').eq('owner_id', userId).order('name'),
    supabase.from('categories').select('id, name, parent_id, sort_order, translations').order('sort_order'),
  ])
  return {
    brands: brands ?? [],
    categories: (categories ?? []).map(({ translations, ...c }) => ({ ...c, name: localized({ translations, name: c.name }, 'name', locale) })),
  }
}

// What's still missing before a product can be submitted (mirrors the
// database check in transition_submission, so sellers see it up front).
export function missingFields(p: EditableProduct) {
  const missing: MessageKey[] = []
  if ((p.tagline ?? '').length < 10) missing.push('seller.missing.tagline')
  if ((p.description ?? '').length < 80) missing.push('seller.missing.description')
  if (!p.external_url) missing.push('seller.missing.url')
  if (!p.brand) missing.push('seller.missing.brand')
  if (p.price === null) missing.push('seller.missing.price')
  if (!p.categories?.length) missing.push('seller.missing.category')
  if (!p.images.length) missing.push('seller.missing.image')
  return missing
}
