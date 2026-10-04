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
// Analytics (server-side so the anonymous id cookie stays httpOnly)
// ---------------------------------------------------------------------------

const trackSchema = z.object({
  event: z.enum(['page_view', 'product_view', 'product_share', 'search']),
  productId: uuid.optional(),
  categoryId: uuid.optional(),
  brandId: uuid.optional(),
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
