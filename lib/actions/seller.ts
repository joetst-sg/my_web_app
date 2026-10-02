'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from '@/lib/i18n/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_REQUIRED, type ActionResult } from '@/lib/errors'
import { i18nAction } from '@/lib/i18n/errors'
import { randomSuffix, slugify } from '@/lib/format'
import { httpsUrl, optionalHttpsUrl, videoProvider } from '@/lib/validation'
import type { FormState } from './auth'

const uuid = z.string().uuid()

async function seller() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

async function uniqueSlug(table: 'products' | 'brands' | 'tags', base: string) {
  const supabase = await createClient()
  const root = slugify(base) || 'item'
  const { data } = await supabase.from(table).select('slug').eq('slug', root).maybeSingle()
  return data ? `${root}-${randomSuffix(4)}` : root
}

// ---------------------------------------------------------------------------
// Seller profile
// ---------------------------------------------------------------------------

const sellerProfileSchema = z.object({
  company_name: z.string().trim().min(2, 'v.company').max(120),
  website: optionalHttpsUrl.transform((v) => v ?? null),
  contact_email: z.string().trim().email('v.email').max(254),
  bio: z.string().trim().max(1000).optional().transform((v) => v || null),
  instagram: optionalHttpsUrl,
  x: optionalHttpsUrl,
  linkedin: optionalHttpsUrl,
})

export async function becomeSeller(_: FormState, formData: FormData): Promise<FormState> {
  const { err, fe } = await i18nAction()
  const parsed = sellerProfileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await seller()
  if (!user) return redirect('/login?next=/seller')
  const { instagram, x, linkedin, ...rest } = parsed.data
  const { error } = await supabase.from('seller_profiles').insert({
    user_id: user.id,
    ...rest,
    social_links: Object.fromEntries(Object.entries({ instagram, x, linkedin }).filter(([, v]) => v)),
  })
  if (error && error.code !== '23505') return { error: err(error) }
  return redirect('/seller/dashboard?welcome=1')
}

export async function updateSellerProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { t, err, fe } = await i18nAction()
  const parsed = sellerProfileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await seller()
  if (!user) return { error: t('errors.loginAgain') }
  const { instagram, x, linkedin, ...rest } = parsed.data
  const { error } = await supabase
    .from('seller_profiles')
    .update({ ...rest, social_links: Object.fromEntries(Object.entries({ instagram, x, linkedin }).filter(([, v]) => v)) })
    .eq('user_id', user.id)
  if (error) return { error: err(error) }
  revalidatePath('/seller', 'layout')
  return { message: t('act.sellerProfileSaved') }
}

// ---------------------------------------------------------------------------
// Wizard step 1 — basic information (creates the draft)
// ---------------------------------------------------------------------------

const basicsSchema = z.object({
  name: z.string().trim().min(2, 'v.productName').max(120),
  brand_id: z.string().optional(),
  new_brand: z.string().trim().max(80).optional(),
  external_url: httpsUrl,
  tagline: z.string().trim().min(10, 'v.tagline').max(200),
  description: z.string().trim().min(80, 'v.description').max(20000),
  category_id: uuid.optional().or(z.literal('').transform(() => undefined)),
  subcategory_id: uuid.optional().or(z.literal('').transform(() => undefined)),
  tags: z.string().max(400).optional(),
  sku: z.string().trim().max(80).optional(),
})

export type BasicsInput = z.input<typeof basicsSchema>

async function resolveBrand(supabase: Awaited<ReturnType<typeof createClient>>, data: z.infer<typeof basicsSchema>) {
  const { t, err } = await i18nAction()
  if (data.brand_id && data.brand_id !== 'new') {
    if (!uuid.safeParse(data.brand_id).success) return { error: t('v.brand') }
    return { id: data.brand_id }
  }
  const name = data.new_brand?.trim()
  if (!name || name.length < 1) return { error: t('v.brandOrNew') }
  const { data: brand, error } = await supabase
    .from('brands')
    .insert({ name, slug: await uniqueSlug('brands', name) })
    .select('id')
    .single()
  if (error) return { error: err(error) }
  return { id: brand.id }
}

async function syncCategoriesAndTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  data: { category_id?: string; subcategory_id?: string; tags?: string },
) {
  const { err } = await i18nAction()
  await supabase.from('product_categories').delete().eq('product_id', productId)
  const cats = [
    data.category_id && { product_id: productId, category_id: data.category_id, is_primary: true },
    data.subcategory_id && data.subcategory_id !== data.category_id && { product_id: productId, category_id: data.subcategory_id, is_primary: false },
  ].filter(Boolean) as { product_id: string; category_id: string; is_primary: boolean }[]
  if (cats.length) {
    const { error } = await supabase.from('product_categories').insert(cats)
    if (error) return err(error)
  }

  const names = [...new Set((data.tags ?? '').split(',').map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && t.length <= 40))].slice(0, 12)
  await supabase.from('product_tags').delete().eq('product_id', productId)
  if (names.length) {
    const slugs = names.map((n) => slugify(n)).filter(Boolean)
    const { data: existing } = await supabase.from('tags').select('id, slug').in('slug', slugs)
    const missing = slugs.filter((s) => !existing?.some((e) => e.slug === s))
    let created: { id: string; slug: string }[] = []
    if (missing.length) {
      const { data: inserted } = await supabase
        .from('tags')
        .upsert(missing.map((slug) => ({ slug, name: slug.replace(/-/g, ' ') })), { onConflict: 'slug', ignoreDuplicates: true })
        .select('id, slug')
      created = inserted ?? []
      if (created.length < missing.length) {
        const { data: again } = await supabase.from('tags').select('id, slug').in('slug', missing)
        created = again ?? created
      }
    }
    const ids = [...(existing ?? []), ...created].map((t) => t.id)
    if (ids.length) {
      const { error } = await supabase.from('product_tags').insert(ids.map((tag_id) => ({ product_id: productId, tag_id })))
      if (error) return err(error)
    }
  }
  return null
}

export async function createProductDraft(input: BasicsInput): Promise<ActionResult<{ id: string }>> {
  const { t, err, fe } = await i18nAction()
  const parsed = basicsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('errors.fixFields'), fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }

  const brand = await resolveBrand(supabase, parsed.data)
  if ('error' in brand) return { ok: false, error: brand.error!, fieldErrors: { brand_id: [brand.error!] } }

  const d = parsed.data
  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name: d.name,
      slug: await uniqueSlug('products', d.name),
      brand_id: brand.id,
      external_url: d.external_url,
      tagline: d.tagline,
      description: d.description,
      sku: d.sku || null,
    })
    .select('id')
    .single()
  if (error?.code === '23514' && error.message.includes('external_url')) {
    const msg = t('v.httpsUrl')
    return { ok: false, error: msg, fieldErrors: { external_url: [msg] } }
  }
  if (error) return { ok: false, error: err(error, 'errors.draftNotSaved') }

  const catError = await syncCategoriesAndTags(supabase, product.id, d)
  if (catError) return { ok: false, error: catError }
  revalidatePath('/seller', 'layout')
  return { ok: true, data: { id: product.id }, message: t('act.draftSaved') }
}

export async function saveBasics(productId: string, input: BasicsInput): Promise<ActionResult> {
  const { t, err, fe } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const parsed = basicsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('errors.fixFields'), fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const brand = await resolveBrand(supabase, parsed.data)
  if ('error' in brand) return { ok: false, error: brand.error!, fieldErrors: { brand_id: [brand.error!] } }
  const d = parsed.data
  const { error, count } = await supabase
    .from('products')
    .update({ name: d.name, brand_id: brand.id, external_url: d.external_url, tagline: d.tagline, description: d.description, sku: d.sku || null }, { count: 'exact' })
    .eq('id', productId)
  if (error?.code === '23514' && error.message.includes('external_url')) {
    const msg = t('v.httpsUrl')
    return { ok: false, error: msg, fieldErrors: { external_url: [msg] } }
  }
  if (error) return { ok: false, error: err(error) }
  if (!count) return { ok: false, error: t('errors.notEditable') }
  const catError = await syncCategoriesAndTags(supabase, productId, d)
  if (catError) return { ok: false, error: catError }
  revalidatePath(`/seller/products/${productId}`, 'layout')
  return { ok: true, message: t('act.saved') }
}

// ---------------------------------------------------------------------------
// Step 2 — pricing
// ---------------------------------------------------------------------------

const money = z.coerce.number().min(0, 'v.priceNegative').max(1_000_000)
const pricingSchema = z
  .object({
    price: money,
    original_price: z.union([money, z.literal('').transform(() => null)]).nullable().optional(),
    currency: z.enum(['USD', 'EUR', 'GBP', 'HKD', 'JPY', 'CAD', 'AUD', 'SGD']),
    availability: z.enum(['available', 'coming_soon', 'preorder', 'crowdfunding', 'sold_out']),
    sale_starts_at: z.string().optional(),
    sale_ends_at: z.string().optional(),
  })
  .refine((v) => !v.original_price || v.original_price >= v.price, { message: 'v.originalPrice', path: ['original_price'] })
  .refine((v) => !v.sale_starts_at || !v.sale_ends_at || new Date(v.sale_ends_at) > new Date(v.sale_starts_at), { message: 'v.saleEnd', path: ['sale_ends_at'] })

export async function savePricing(productId: string, input: z.input<typeof pricingSchema>): Promise<ActionResult> {
  const { t, err, fe } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const parsed = pricingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('errors.fixFields'), fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const d = parsed.data
  const toIso = (v?: string) => (v ? new Date(v).toISOString() : null)
  const { error, count } = await supabase
    .from('products')
    .update(
      {
        price: d.price,
        original_price: d.original_price ?? null,
        currency: d.currency,
        availability: d.availability,
        sale_starts_at: toIso(d.sale_starts_at),
        sale_ends_at: toIso(d.sale_ends_at),
      },
      { count: 'exact' },
    )
    .eq('id', productId)
  if (error) return { ok: false, error: err(error) }
  if (!count) return { ok: false, error: t('errors.notEditable') }
  return { ok: true, message: t('act.saved') }
}

// ---------------------------------------------------------------------------
// Step 3 — media (files are uploaded from the browser to Storage; the
// storage policy only accepts paths for products this user may edit)
// ---------------------------------------------------------------------------

const imagePath = z.string().regex(/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/)

export async function addProductImage(
  productId: string,
  input: { path: string; width: number; height: number; alt?: string },
): Promise<ActionResult<{ id: string }>> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success || !imagePath.safeParse(input.path).success || !input.path.includes(productId)) {
    return { ok: false, error: t('errors.uploadFailed') }
  }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { count: existing } = await supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId)
  if ((existing ?? 0) >= 12) return { ok: false, error: t('errors.maxImages') }
  const { data: last } = await supabase.from('product_images').select('position').eq('product_id', productId).order('position', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: input.path,
      width: Math.round(input.width),
      height: Math.round(input.height),
      alt: input.alt?.slice(0, 200) || null,
      position: (last?.position ?? -1) + 1,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: err(error, 'errors.uploadFailed') }
  return { ok: true, data: { id: data.id } }
}

export async function reorderProductImages(productId: string, imageIds: string[]): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success || !z.array(uuid).max(12).safeParse(imageIds).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const results = await Promise.all(imageIds.map((id, position) => supabase.from('product_images').update({ position }).eq('id', id).eq('product_id', productId)))
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: err(failed.error) }
  return { ok: true }
}

export async function updateImageAlt(imageId: string, alt: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(imageId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase } = await seller()
  const { error } = await supabase.from('product_images').update({ alt: alt.trim().slice(0, 200) || null }).eq('id', imageId)
  if (error) return { ok: false, error: err(error) }
  return { ok: true }
}

export async function deleteProductImage(productId: string, imageId: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success || !uuid.safeParse(imageId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { data: img } = await supabase.from('product_images').select('storage_path').eq('id', imageId).eq('product_id', productId).maybeSingle()
  if (!img) return { ok: false, error: t('errors.unknownItem') }
  const { error, count } = await supabase.from('product_images').delete({ count: 'exact' }).eq('id', imageId)
  if (error) return { ok: false, error: err(error) }
  if (!count) return { ok: false, error: t('errors.forbidden') }
  await supabase.storage.from('product-images').remove([img.storage_path])
  return { ok: true, message: t('act.imageDeleted') }
}

const videosSchema = z.array(httpsUrl).max(4)

export async function saveVideos(productId: string, urls: string[]): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const parsed = videosSchema.safeParse(urls.map((u) => u.trim()).filter(Boolean))
  if (!parsed.success) return { ok: false, error: t('v.videoUrl') }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error: delError } = await supabase.from('product_videos').delete().eq('product_id', productId)
  if (delError) return { ok: false, error: err(delError) }
  if (parsed.data.length) {
    const { error } = await supabase
      .from('product_videos')
      .insert(parsed.data.map((url, position) => ({ product_id: productId, url, provider: videoProvider(url), position })))
    if (error) return { ok: false, error: err(error) }
  }
  return { ok: true, message: t('act.saved') }
}

// ---------------------------------------------------------------------------
// Step 4 — features and specifications
// ---------------------------------------------------------------------------

const featuresSchema = z.object({
  key_features: z.array(z.string().trim().min(2).max(160)).max(10),
  benefits: z.array(z.string().trim().min(2).max(160)).max(10),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(300) })).max(30),
})

export async function saveFeatures(productId: string, input: z.input<typeof featuresSchema>): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const clean = {
    key_features: input.key_features.map((s) => s.trim()).filter(Boolean),
    benefits: input.benefits.map((s) => s.trim()).filter(Boolean),
    specs: input.specs.filter((s) => s.label.trim() && s.value.trim()),
  }
  const parsed = featuresSchema.safeParse(clean)
  if (!parsed.success) return { ok: false, error: t('v.features') }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error, count } = await supabase
    .from('products')
    .update({ key_features: parsed.data.key_features, benefits: parsed.data.benefits }, { count: 'exact' })
    .eq('id', productId)
  if (error) return { ok: false, error: err(error) }
  if (!count) return { ok: false, error: t('errors.notEditable') }
  await supabase.from('product_specifications').delete().eq('product_id', productId)
  if (parsed.data.specs.length) {
    const { error: specError } = await supabase
      .from('product_specifications')
      .insert(parsed.data.specs.map((s, position) => ({ product_id: productId, ...s, position })))
    if (specError) return { ok: false, error: err(specError) }
  }
  return { ok: true, message: t('act.saved') }
}

// ---------------------------------------------------------------------------
// Step 5 — brand / seller information
// ---------------------------------------------------------------------------

const brandInfoSchema = z.object({
  brand_id: uuid,
  website_url: optionalHttpsUrl.transform((v) => v ?? null),
  tagline: z.string().trim().max(160).optional().transform((v) => v || null),
  description: z.string().trim().max(4000).optional().transform((v) => v || null),
  logo_url: z.string().url().optional().nullable(),
  instagram: optionalHttpsUrl,
  x: optionalHttpsUrl,
  youtube: optionalHttpsUrl,
})

export async function saveBrandInfo(input: z.input<typeof brandInfoSchema>): Promise<ActionResult> {
  const { t, err, fe } = await i18nAction()
  const parsed = brandInfoSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('errors.fixFields'), fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { brand_id, instagram, x, youtube, logo_url, ...rest } = parsed.data
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand-images/brands/${brand_id}/`
  if (logo_url && !logo_url.startsWith(base)) return { ok: false, error: t('errors.logoUpload') }
  const { error, count } = await supabase
    .from('brands')
    .update(
      { ...rest, ...(logo_url !== undefined && { logo_url }), social_links: Object.fromEntries(Object.entries({ instagram, x, youtube }).filter(([, v]) => v)) },
      { count: 'exact' },
    )
    .eq('id', brand_id)
  if (error) return { ok: false, error: err(error) }
  // Brands already approved by editors can only be edited by their owner.
  if (!count) return { ok: false, error: t('errors.brandNotEditable') }
  return { ok: true, message: t('act.saved') }
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function submitForReview(productId: string): Promise<ActionResult<{ duplicates: { name: string; slug: string }[] }>> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { data: sub } = await supabase.from('submissions').select('id').eq('product_id', productId).maybeSingle()
  if (!sub) return { ok: false, error: t('errors.submissionNotFound') }
  const { error } = await supabase.rpc('transition_submission', { submission_id: sub.id, action: 'submit' })
  if (error) return { ok: false, error: err(error, 'errors.draftSaved') }
  revalidatePath('/seller', 'layout')
  return { ok: true, data: { duplicates: [] }, message: t('act.submitted') }
}

export async function checkDuplicates(productId: string): Promise<ActionResult<{ name: string; slug: string; reasons: string[] }[]>> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase } = await seller()
  const { data, error } = await supabase.rpc('find_duplicate_products', { _product_id: productId })
  if (error) return { ok: false, error: err(error) }
  return { ok: true, data: (data ?? []).map((d) => ({ name: d.name, slug: d.slug, reasons: d.reasons })) }
}

export async function withdrawSubmission(submissionId: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(submissionId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase } = await seller()
  const { error } = await supabase.rpc('transition_submission', { submission_id: submissionId, action: 'withdraw' })
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/seller', 'layout')
  return { ok: true, message: t('act.withdrawn') }
}

export async function deleteDraft(productId: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', productId)
  const { error, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', productId)
  if (error) return { ok: false, error: err(error) }
  if (!count) return { ok: false, error: t('errors.onlyDrafts') }
  if (images?.length) await supabase.storage.from('product-images').remove(images.map((i) => i.storage_path))
  revalidatePath('/seller', 'layout')
  return { ok: true, message: t('act.draftDeleted') }
}

export async function sendSubmissionMessage(submissionId: string, body: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  const parsed = z.object({ id: uuid, body: z.string().trim().min(1, 'v.message').max(4000) }).safeParse({ id: submissionId, body })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'v.message' }
  const { supabase, user } = await seller()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } = await supabase.from('submission_messages').insert({ submission_id: submissionId, author_id: user.id, body: parsed.data.body })
  if (error) return { ok: false, error: err(error) }
  revalidatePath(`/seller/submissions/${submissionId}`)
  revalidatePath(`/admin/submissions/${submissionId}`)
  return { ok: true, message: t('messages.sent') }
}
