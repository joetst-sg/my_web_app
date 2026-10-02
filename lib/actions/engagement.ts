'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { LOGIN_REQUIRED, type ActionResult } from '@/lib/errors'
import { i18nAction } from '@/lib/i18n/errors'
import { randomSuffix, slugify } from '@/lib/format'

const uuid = z.string().uuid()

async function signedIn() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

export async function toggleSave(productId: string, save: boolean): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } = save
    ? await supabase.from('product_saves').upsert({ user_id: user.id, product_id: productId }, { ignoreDuplicates: true })
    : await supabase.from('product_saves').delete().eq('user_id', user.id).eq('product_id', productId)
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/account/saved')
  return { ok: true, message: save ? t('act.saved') : t('act.unsaved') }
}

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

export async function toggleFollow(kind: 'brand' | 'category', id: string, follow: boolean): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(id).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } =
    kind === 'brand'
      ? follow
        ? await supabase.from('brand_followers').upsert({ user_id: user.id, brand_id: id }, { ignoreDuplicates: true })
        : await supabase.from('brand_followers').delete().eq('user_id', user.id).eq('brand_id', id)
      : follow
        ? await supabase.from('category_followers').upsert({ user_id: user.id, category_id: id }, { ignoreDuplicates: true })
        : await supabase.from('category_followers').delete().eq('user_id', user.id).eq('category_id', id)
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/account/following')
  return { ok: true, message: follow ? t('act.following') : t('act.unfollowed') }
}

export async function toggleCollectionFollow(collectionId: string, follow: boolean): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(collectionId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } = follow
    ? await supabase.from('collection_followers').upsert({ user_id: user.id, collection_id: collectionId }, { ignoreDuplicates: true })
    : await supabase.from('collection_followers').delete().eq('user_id', user.id).eq('collection_id', collectionId)
  if (error) return { ok: false, error: err(error) }
  return { ok: true, message: follow ? t('act.collectionFollowed') : t('act.collectionUnfollowed') }
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

const reminderSchema = z
  .object({
    productId: uuid,
    type: z.enum(['launch', 'sale', 'custom']),
    remindAt: z.string().datetime({ offset: true }).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.type !== 'custom' || (v.remindAt && new Date(v.remindAt) > new Date()), {
    message: 'v.futureDate',
    path: ['remindAt'],
  })

export async function createReminder(input: z.input<typeof reminderSchema>): Promise<ActionResult> {
  const { t, err, tm } = await i18nAction()
  const parsed = reminderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: tm(parsed.error.issues[0]?.message ?? t('errors.checkForm')) }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { productId, type, remindAt, note } = parsed.data
  const { error } = await supabase.from('reminders').insert({
    user_id: user.id,
    product_id: productId,
    type,
    remind_at: type === 'custom' ? remindAt : null,
    note: note || null,
  })
  if (error?.code === '23505') return { ok: false, error: t('act.reminderExists') }
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/account/reminders')
  return {
    ok: true,
    message:
      type === 'launch' ? t('act.remindLaunch') : type === 'sale' ? t('act.remindSale') : t('act.remindCustom'),
  }
}

export async function cancelReminder(reminderId: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(reminderId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } = await supabase.from('reminders').update({ status: 'cancelled' }).eq('id', reminderId).eq('user_id', user.id)
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/account/reminders')
  return { ok: true, message: t('act.reminderCancelled') }
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

const collectionSchema = z.object({
  title: z.string().trim().min(2, 'v.collectionName').max(80),
  description: z.string().trim().max(600).optional(),
  visibility: z.enum(['public', 'private']).default('private'),
})

export async function createCollection(
  input: z.input<typeof collectionSchema> & { productId?: string },
): Promise<ActionResult<{ id: string; slug: string }>> {
  const { t, err, tm } = await i18nAction()
  const parsed = collectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: tm(parsed.error.issues[0]?.message ?? t('errors.checkForm')) }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const slug = `${slugify(parsed.data.title) || 'collection'}-${randomSuffix(5)}`
  const { data, error } = await supabase
    .from('collections')
    .insert({ ...parsed.data, description: parsed.data.description || null, slug, owner_id: user.id })
    .select('id, slug')
    .single()
  if (error) return { ok: false, error: err(error) }
  if (input.productId && uuid.safeParse(input.productId).success) {
    const { error: addError } = await supabase.from('collection_products').insert({ collection_id: data.id, product_id: input.productId })
    if (addError) return { ok: false, error: err(addError) }
  }
  revalidatePath('/account/collections')
  return { ok: true, data, message: t('act.collectionCreated') }
}

export async function updateCollection(
  collectionId: string,
  input: z.input<typeof collectionSchema>,
): Promise<ActionResult> {
  const { t, err, tm } = await i18nAction()
  const parsed = collectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: tm(parsed.error.issues[0]?.message ?? t('errors.checkForm')) }
  if (!uuid.safeParse(collectionId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } = await supabase
    .from('collections')
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq('id', collectionId)
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/account/collections')
  revalidatePath('/collections', 'layout')
  return { ok: true, message: t('act.collectionUpdated') }
}

export async function deleteCollection(collectionId: string): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(collectionId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error, count } = await supabase.from('collections').delete({ count: 'exact' }).eq('id', collectionId)
  if (error) return { ok: false, error: err(error) }
  if (!count) return { ok: false, error: t('errors.forbidden') }
  revalidatePath('/account/collections')
  return { ok: true, message: t('act.collectionDeleted') }
}

export async function listMyCollections(productId?: string): Promise<
  ActionResult<{ id: string; title: string; visibility: string; product_count: number; contains: boolean }[]>
> {
  const { err } = await i18nAction()
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { data, error } = await supabase
    .from('collections')
    .select('id, title, visibility, product_count')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
  if (error) return { ok: false, error: err(error) }
  let containing = new Set<string>()
  if (productId && uuid.safeParse(productId).success && data.length) {
    const { data: links } = await supabase
      .from('collection_products')
      .select('collection_id')
      .eq('product_id', productId)
      .in('collection_id', data.map((c) => c.id))
    containing = new Set((links ?? []).map((l) => l.collection_id))
  }
  return { ok: true, data: data.map((c) => ({ ...c, contains: containing.has(c.id) })) }
}

export async function setInCollection(collectionId: string, productId: string, include: boolean): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(collectionId).success || !uuid.safeParse(productId).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  if (include) {
    const { data: last } = await supabase
      .from('collection_products')
      .select('position')
      .eq('collection_id', collectionId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { error } = await supabase
      .from('collection_products')
      .upsert({ collection_id: collectionId, product_id: productId, position: (last?.position ?? 0) + 1 }, { ignoreDuplicates: true })
    if (error) return { ok: false, error: err(error) }
  } else {
    const { error } = await supabase.from('collection_products').delete().eq('collection_id', collectionId).eq('product_id', productId)
    if (error) return { ok: false, error: err(error) }
  }
  revalidatePath('/account/collections')
  return { ok: true, message: include ? t('act.addedToCollection') : t('act.removedFromCollection') }
}

export async function reorderCollection(collectionId: string, productIds: string[]): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!uuid.safeParse(collectionId).success || !z.array(uuid).max(500).safeParse(productIds).success) {
    return { ok: false, error: t('errors.unknownItem') }
  }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const results = await Promise.all(
    productIds.map((pid, i) =>
      supabase.from('collection_products').update({ position: i }).eq('collection_id', collectionId).eq('product_id', pid),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: err(failed.error) }
  return { ok: true, message: t('act.orderSaved') }
}

// ---------------------------------------------------------------------------
// Analytics (server-side so the anonymous id cookie stays httpOnly)
// ---------------------------------------------------------------------------

const trackSchema = z.object({
  event: z.enum(['page_view', 'product_view', 'product_share', 'search']),
  productId: uuid.optional(),
  categoryId: uuid.optional(),
  brandId: uuid.optional(),
  collectionId: uuid.optional(),
  articleId: uuid.optional(),
  query: z.string().max(100).optional(),
  channel: z.string().regex(/^[a-z_]{1,20}$/).optional(),
})

export async function trackEvent(input: z.input<typeof trackSchema>) {
  const parsed = trackSchema.safeParse(input)
  if (!parsed.success) return
  const cookieStore = await cookies()
  const anonId = cookieStore.get('loupe_aid')?.value
  const supabase = await createClient()
  const d = parsed.data
  await supabase.rpc('track_event', {
    event_type: d.event,
    anon_id: anonId,
    product_id: d.productId,
    category_id: d.categoryId,
    brand_id: d.brandId,
    collection_id: d.collectionId,
    article_id: d.articleId,
    query: d.query,
    channel: d.channel,
  })
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const reportSchema = z.object({
  productId: uuid,
  reason: z.enum(['broken_link', 'incorrect_information', 'offensive_content', 'misleading_information', 'copyright_concern', 'scam_suspicious', 'other']),
  details: z.string().trim().max(2000).optional(),
})

export async function reportProduct(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: t('v.reason') }
  const { supabase, user } = await signedIn()
  if (!user) return { ok: false, error: LOGIN_REQUIRED }
  const { error } = await supabase.from('reports').insert({
    product_id: parsed.data.productId,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  })
  if (error) return { ok: false, error: err(error) }
  return { ok: true, message: t('act.reportThanks') }
}
