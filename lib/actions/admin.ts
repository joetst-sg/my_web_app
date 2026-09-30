'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionResult } from '@/lib/errors'
import { randomSuffix, slugify } from '@/lib/format'
import { optionalHttpsUrl } from '@/lib/validation'

const uuid = z.string().uuid()
const FORBIDDEN = "You don't have permission to perform this action."

// Every admin action re-checks the role on the server; the database checks
// it again through RLS and the SECURITY DEFINER functions.
async function staff(adminOnly = false) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false as const }
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  const list = (roles ?? []).map((r) => r.role)
  const ok = adminOnly ? list.includes('admin') : list.includes('admin') || list.includes('editor')
  return { supabase, ok, userId: user.id }
}

function done(paths: string[], message?: string): ActionResult {
  for (const p of paths) revalidatePath(p, 'layout')
  return { ok: true, message }
}

// ---------------------------------------------------------------------------
// Submission workflow
// ---------------------------------------------------------------------------

const transitionSchema = z.object({
  submissionId: uuid,
  action: z.enum(['start_review', 'request_changes', 'approve', 'reject', 'schedule', 'publish', 'archive']),
  message: z.string().trim().max(4000).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
})

export async function reviewSubmission(input: z.input<typeof transitionSchema>): Promise<ActionResult> {
  const parsed = transitionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check the form.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { submissionId, action, message, scheduledFor } = parsed.data
  const { error } = await supabase.rpc('transition_submission', {
    submission_id: submissionId,
    action,
    message: message || undefined,
    scheduled_for: scheduledFor,
  })
  if (error) return { ok: false, error: friendlyError(error) }
  const msg = {
    start_review: 'Review started',
    request_changes: 'Changes requested — the seller has been notified',
    approve: 'Approved',
    reject: 'Rejected — the seller has been notified',
    schedule: 'Scheduled',
    publish: 'Published',
    archive: 'Archived',
  }[action]
  return done(['/admin', '/seller', '/'], msg)
}

export async function sendEditorMessage(submissionId: string, body: string): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, body: z.string().trim().min(1).max(4000) }).safeParse({ id: submissionId, body })
  if (!parsed.success) return { ok: false, error: 'Write a message.' }
  const { supabase, ok, userId } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { error } = await supabase.from('submission_messages').insert({ submission_id: submissionId, author_id: userId, body: parsed.data.body })
  if (error) return { ok: false, error: friendlyError(error) }
  return done([`/admin/submissions/${submissionId}`], 'Message sent')
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

const productEditSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.').max(120),
  tagline: z.string().trim().max(200).optional().transform((v) => v || null),
  description: z.string().trim().max(20000).optional().transform((v) => v || null),
  external_url: optionalHttpsUrl.transform((v) => v ?? null),
  price: z.union([z.coerce.number().min(0), z.literal('').transform(() => null)]).nullable(),
  original_price: z.union([z.coerce.number().min(0), z.literal('').transform(() => null)]).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  availability: z.enum(['available', 'coming_soon', 'preorder', 'crowdfunding', 'sold_out', 'discontinued']),
  seo_title: z.string().trim().max(70).optional().transform((v) => v || null),
  seo_description: z.string().trim().max(170).optional().transform((v) => v || null),
  category_id: uuid.optional().or(z.literal('').transform(() => undefined)),
})

export async function updateProductAdmin(productId: string, input: z.input<typeof productEditSchema>): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const parsed = productEditSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { category_id, ...fields } = parsed.data
  const { error } = await supabase.from('products').update(fields).eq('id', productId)
  if (error) return { ok: false, error: error.code === '23505' ? 'That URL slug is already used by another product.' : friendlyError(error) }
  if (category_id) {
    await supabase.from('product_categories').update({ is_primary: false }).eq('product_id', productId)
    const { error: catError } = await supabase.from('product_categories').upsert({ product_id: productId, category_id, is_primary: true })
    if (catError) return { ok: false, error: friendlyError(catError) }
  }
  return done(['/admin/products', `/products/${fields.slug}`], 'Product saved')
}

const scoreSchema = z.object({
  overall: z.coerce.number().min(0).max(10),
  design: z.coerce.number().min(0).max(10).nullable().optional(),
  innovation: z.coerce.number().min(0).max(10).nullable().optional(),
  usability: z.coerce.number().min(0).max(10).nullable().optional(),
  value: z.coerce.number().min(0).max(10).nullable().optional(),
  features: z.coerce.number().min(0).max(10).nullable().optional(),
  verdict: z.string().trim().max(600).optional().transform((v) => v || null),
})

export async function setProductScore(productId: string, input: z.input<typeof scoreSchema> | null): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { supabase, ok, userId } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  if (input === null) {
    const { error } = await supabase.from('product_scores').delete().eq('product_id', productId)
    if (error) return { ok: false, error: friendlyError(error) }
    return done(['/admin/products'], 'Score removed')
  }
  const parsed = scoreSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Scores must be between 0 and 10.' }
  const round = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10) / 10)
  const d = parsed.data
  const { error } = await supabase.from('product_scores').upsert({
    product_id: productId,
    overall: round(d.overall)!,
    design: round(d.design),
    innovation: round(d.innovation),
    usability: round(d.usability),
    value: round(d.value),
    features: round(d.features),
    verdict: d.verdict,
    reviewed_by: userId,
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/products', '/products'], 'Score saved')
}

const placements = ['hero', 'featured_today', 'featured_this_week', 'trending', 'editors_pick', 'new', 'coming_soon', 'deal'] as const

export async function setFeatured(productId: string, placement: (typeof placements)[number], on: boolean, endsAt?: string | null): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success || !placements.includes(placement)) return { ok: false, error: 'Unknown placement.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  if (on) {
    const { data: last } = await supabase.from('featured_products').select('position').eq('placement', placement).order('position', { ascending: false }).limit(1).maybeSingle()
    const { error } = await supabase.from('featured_products').upsert(
      { product_id: productId, placement, position: (last?.position ?? -1) + 1, ends_at: endsAt || null, starts_at: new Date().toISOString() },
      { onConflict: 'product_id,placement' },
    )
    if (error) return { ok: false, error: friendlyError(error) }
  } else {
    const { error } = await supabase.from('featured_products').delete().eq('product_id', productId).eq('placement', placement)
    if (error) return { ok: false, error: friendlyError(error) }
  }
  return done(['/', '/admin/featured', '/admin/products'], on ? 'Featured' : 'Removed from placement')
}

export async function moveFeatured(placement: (typeof placements)[number], productIds: string[]): Promise<ActionResult> {
  if (!placements.includes(placement) || !z.array(uuid).max(100).safeParse(productIds).success) return { ok: false, error: 'Unknown item.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  await Promise.all(productIds.map((id, position) => supabase.from('featured_products').update({ position }).eq('product_id', id).eq('placement', placement)))
  return done(['/', '/admin/featured'], 'Order saved')
}

const dealSchema = z
  .object({
    productId: uuid,
    title: z.string().trim().max(120).optional().transform((v) => v || null),
    deal_price: z.coerce.number().min(0),
    original_price: z.union([z.coerce.number().min(0), z.literal('').transform(() => null)]).nullable().optional(),
    coupon_code: z.string().trim().max(40).optional().transform((v) => v || null),
    starts_at: z.string().min(1),
    ends_at: z.string().optional().transform((v) => v || null),
  })
  .refine((v) => !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at), { message: 'The deal must end after it starts.', path: ['ends_at'] })

export async function createDeal(input: z.input<typeof dealSchema>): Promise<ActionResult> {
  const parsed = dealSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the deal.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const d = parsed.data
  const { error } = await supabase.from('deals').insert({
    product_id: d.productId,
    title: d.title,
    deal_price: d.deal_price,
    original_price: d.original_price ?? null,
    coupon_code: d.coupon_code,
    starts_at: new Date(d.starts_at).toISOString(),
    ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
  })
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/deals', '/admin/products', '/'], 'Deal created')
}

export async function deleteDeal(dealId: string): Promise<ActionResult> {
  if (!uuid.safeParse(dealId).success) return { ok: false, error: 'Unknown deal.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { error } = await supabase.from('deals').delete().eq('id', dealId)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/deals', '/admin/products'], 'Deal removed')
}

export async function deleteProduct(productId: string): Promise<ActionResult> {
  if (!uuid.safeParse(productId).success) return { ok: false, error: 'Unknown product.' }
  const { supabase, ok } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can delete products.' }
  const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', productId)
  const { error, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', productId)
  if (error) return { ok: false, error: friendlyError(error) }
  if (!count) return { ok: false, error: 'Product not found.' }
  if (images?.length) await supabase.storage.from('product-images').remove(images.map((i) => i.storage_path))
  return done(['/admin/products', '/'], 'Product deleted')
}

// ---------------------------------------------------------------------------
// Brands, categories, collections
// ---------------------------------------------------------------------------

export async function setBrandFlags(brandId: string, flags: { is_published?: boolean; is_verified?: boolean }): Promise<ActionResult> {
  if (!uuid.safeParse(brandId).success) return { ok: false, error: 'Unknown brand.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { error } = await supabase.from('brands').update(flags).eq('id', brandId)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/brands', '/brands'], 'Brand updated')
}

const categorySchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.').max(60).optional().or(z.literal('')),
  description: z.string().trim().max(600).optional().transform((v) => v || null),
  parent_id: uuid.optional().or(z.literal('').transform(() => null)).nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('').transform(() => null)).nullable(),
  icon: z.string().trim().max(40).optional().transform((v) => v || null),
  seo_title: z.string().trim().max(70).optional().transform((v) => v || null),
  seo_description: z.string().trim().max(170).optional().transform((v) => v || null),
  is_featured: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(1000).optional(),
})

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { id, slug, ...rest } = parsed.data
  const row = { ...rest, slug: slug || slugify(rest.name) }
  const { error } = id ? await supabase.from('categories').update(row).eq('id', id) : await supabase.from('categories').insert(row)
  if (error) return { ok: false, error: error.code === '23505' ? 'A category with that slug already exists.' : friendlyError(error) }
  return done(['/admin/categories', '/categories', '/'], id ? 'Category saved' : 'Category created')
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Unknown category.' }
  const { supabase, ok } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can delete categories.' }
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/categories', '/categories'], 'Category deleted')
}

export async function setCollectionFlags(id: string, flags: { is_featured?: boolean; is_editorial?: boolean; visibility?: 'public' | 'private' }): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Unknown collection.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { error } = await supabase.from('collections').update(flags).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/collections', '/collections', '/'], 'Collection updated')
}

export async function createEditorialCollection(title: string, description: string): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ title: z.string().trim().min(2).max(80), description: z.string().trim().max(600) }).safeParse({ title, description })
  if (!parsed.success) return { ok: false, error: 'Give the collection a name (2–80 characters).' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { data, error } = await supabase
    .from('collections')
    .insert({ title: parsed.data.title, description: parsed.data.description || null, slug: `${slugify(parsed.data.title)}-${randomSuffix(4)}`, visibility: 'public', is_editorial: true })
    .select('id')
    .single()
  if (error) return { ok: false, error: friendlyError(error) }
  revalidatePath('/admin/collections')
  return { ok: true, data, message: 'Collection created' }
}

export async function deleteCollectionAdmin(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Unknown collection.' }
  const { supabase, ok } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can delete other users’ collections.' }
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/collections', '/collections'], 'Collection deleted')
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

const articleSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(160).optional().or(z.literal('')),
  excerpt: z.string().trim().max(400).optional().transform((v) => v || null),
  content: z.string().max(100_000),
  type: z.enum(['review', 'hands_on', 'buying_guide', 'news', 'roundup', 'how_to', 'interview']),
  status: z.enum(['draft', 'review', 'scheduled', 'published', 'archived']),
  featured_image_url: z.string().url().optional().or(z.literal('').transform(() => null)).nullable(),
  seo_title: z.string().trim().max(70).optional().transform((v) => v || null),
  seo_description: z.string().trim().max(170).optional().transform((v) => v || null),
  scheduled_for: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
  category_ids: z.array(uuid).max(10).default([]),
  product_ids: z.array(uuid).max(30).default([]),
})

export async function saveArticle(input: z.input<typeof articleSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = articleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the article.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { id, slug, category_ids, product_ids, ...rest } = parsed.data
  if (rest.status === 'scheduled' && (!rest.scheduled_for || new Date(rest.scheduled_for) <= new Date())) {
    return { ok: false, error: 'Choose a publish time in the future.' }
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (rest.featured_image_url && !rest.featured_image_url.startsWith(`${base}/storage/v1/object/public/article-images/`)) {
    return { ok: false, error: 'Upload the featured image here instead of linking to another site.' }
  }
  const words = rest.content.split(/\s+/).filter(Boolean).length
  const row = {
    ...rest,
    slug: slug || slugify(rest.title),
    reading_minutes: Math.max(1, Math.round(words / 220)),
    ...(rest.status === 'published' && { published_at: new Date().toISOString() }),
  }
  let articleId = id
  if (id) {
    const { data: existing } = await supabase.from('articles').select('published_at').eq('id', id).single()
    const { error } = await supabase.from('articles').update({ ...row, ...(existing?.published_at && rest.status === 'published' && { published_at: existing.published_at }) }).eq('id', id)
    if (error) return { ok: false, error: error.code === '23505' ? 'Another article already uses that slug.' : friendlyError(error) }
  } else {
    const { data, error } = await supabase.from('articles').insert(row).select('id').single()
    if (error) return { ok: false, error: error.code === '23505' ? 'Another article already uses that slug.' : friendlyError(error) }
    articleId = data.id
  }
  await supabase.from('article_categories').delete().eq('article_id', articleId!)
  if (category_ids.length) await supabase.from('article_categories').insert(category_ids.map((category_id) => ({ article_id: articleId!, category_id })))
  await supabase.from('article_products').delete().eq('article_id', articleId!)
  if (product_ids.length) await supabase.from('article_products').insert(product_ids.map((product_id, position) => ({ article_id: articleId!, product_id, position })))
  revalidatePath('/magazine', 'layout')
  revalidatePath('/admin/articles')
  return { ok: true, data: { id: articleId! }, message: 'Article saved' }
}

export async function deleteArticle(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Unknown article.' }
  const { supabase, ok } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can delete articles. Archive it instead.' }
  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/articles', '/magazine'], 'Article deleted')
}

// ---------------------------------------------------------------------------
// Homepage CMS
// ---------------------------------------------------------------------------

const sectionSchema = z.object({
  id: uuid.optional(),
  type: z.enum(['hero', 'trending_products', 'featured_categories', 'new_products', 'featured_collections', 'magazine', 'product_list', 'deals', 'editors_picks']),
  title: z.string().trim().max(80).optional().transform((v) => v || null),
  subtitle: z.string().trim().max(200).optional().transform((v) => v || null),
  limit: z.coerce.number().int().min(1).max(24).optional(),
  product_ids: z.array(uuid).max(24).optional(),
  is_enabled: z.boolean().default(true),
})

export async function saveHomepageSection(input: z.input<typeof sectionSchema>): Promise<ActionResult> {
  const parsed = sectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please check the section.' }
  const { supabase, ok, userId } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { id, limit, product_ids, ...rest } = parsed.data
  const config = { ...(limit && { limit }), ...(product_ids && { product_ids }) }
  if (id) {
    const { error } = await supabase.from('homepage_sections').update({ ...rest, config, updated_by: userId, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return { ok: false, error: friendlyError(error) }
  } else {
    const { data: last } = await supabase.from('homepage_sections').select('position').order('position', { ascending: false }).limit(1).maybeSingle()
    const { error } = await supabase.from('homepage_sections').insert({ ...rest, config, position: (last?.position ?? -1) + 1, updated_by: userId })
    if (error) return { ok: false, error: friendlyError(error) }
  }
  return done(['/', '/admin/content'], 'Section saved')
}

export async function reorderHomepageSections(ids: string[]): Promise<ActionResult> {
  if (!z.array(uuid).max(50).safeParse(ids).success) return { ok: false, error: 'Unknown section.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  await Promise.all(ids.map((id, position) => supabase.from('homepage_sections').update({ position }).eq('id', id)))
  return done(['/', '/admin/content'], 'Order saved')
}

export async function deleteHomepageSection(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Unknown section.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { error } = await supabase.from('homepage_sections').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/', '/admin/content'], 'Section removed')
}

// ---------------------------------------------------------------------------
// Reports, users, settings
// ---------------------------------------------------------------------------

export async function updateReport(id: string, status: 'open' | 'reviewing' | 'resolved' | 'dismissed', note?: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Unknown report.' }
  const { supabase, ok } = await staff()
  if (!ok) return { ok: false, error: FORBIDDEN }
  const { error } = await supabase.from('reports').update({ status, resolution_note: note?.slice(0, 2000) || null }).eq('id', id)
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/reports'], 'Report updated')
}

export async function setUserRole(userId: string, role: 'seller' | 'editor' | 'admin', enabled: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: 'Unknown user.' }
  const { supabase, ok } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can change roles.' }
  const { error } = await supabase.rpc('set_user_role', { target_user: userId, role, enabled })
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/users'], enabled ? `Added ${role} role` : `Removed ${role} role`)
}

export async function setUserSuspended(userId: string, suspended: boolean, reason?: string): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: 'Unknown user.' }
  const { supabase, ok } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can suspend accounts.' }
  const { error } = await supabase.rpc('set_user_suspended', { target_user: userId, suspended, reason: reason?.slice(0, 500) })
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/users'], suspended ? 'Account suspended' : 'Account reactivated')
}

export async function saveSetting(key: string, value: unknown): Promise<ActionResult> {
  if (!/^[a-z0-9_.]+$/.test(key)) return { ok: false, error: 'Unknown setting.' }
  const { supabase, ok, userId } = await staff(true)
  if (!ok) return { ok: false, error: 'Only administrators can change settings.' }
  const { error } = await supabase.from('site_settings').upsert({ key, value: value as never, updated_by: userId, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: friendlyError(error) }
  return done(['/admin/settings'], 'Setting saved')
}
