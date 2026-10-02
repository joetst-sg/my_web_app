'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from '@/lib/i18n/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { type ActionResult } from '@/lib/errors'
import { i18nAction } from '@/lib/i18n/errors'
import type { FormState } from './auth'
import { optionalHttpsUrl } from '@/lib/validation'

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')
  return { supabase, user }
}

const username = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,30}$/, 'v.username')

export async function completeOnboarding(_: FormState, formData: FormData): Promise<FormState> {
  const { t, err, fe } = await i18nAction()
  const parsed = z
    .object({
      username,
      interests: z.array(z.string().uuid()).min(1, 'v.interests').max(20),
    })
    .safeParse({ username: formData.get('username'), interests: formData.getAll('interests') })
  if (!parsed.success) return { fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await me()

  const { error: profileError } = await supabase.from('profiles').update({ username: parsed.data.username }).eq('id', user.id)
  if (profileError?.code === '23505') return { fieldErrors: { username: [t('v.usernameTaken')] } }
  if (profileError) return { error: err(profileError) }

  const { error: followError } = await supabase
    .from('category_followers')
    .upsert(parsed.data.interests.map((category_id) => ({ user_id: user.id, category_id })), { ignoreDuplicates: true })
  if (followError) return { error: err(followError) }

  const { error } = await supabase.from('user_settings').update({ onboarded_at: new Date().toISOString() }).eq('user_id', user.id)
  if (error) return { error: err(error) }
  return redirect('/account/feed?welcome=1')
}

const profileSchema = z.object({
  username,
  display_name: z.string().trim().min(1, 'v.displayName').max(80),
  bio: z.string().trim().max(500).optional().transform((v) => v || null),
  website: optionalHttpsUrl.transform((v) => v ?? null),
  instagram: optionalHttpsUrl,
  x: optionalHttpsUrl,
  is_public: z.enum(['on']).optional(),
})

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { t, err, fe } = await i18nAction()
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: fe(parsed.error.flatten().fieldErrors) }
  const { supabase, user } = await me()
  const { instagram, x, is_public, ...rest } = parsed.data
  const social_links = Object.fromEntries(Object.entries({ instagram, x }).filter(([, v]) => v))
  const { error } = await supabase.from('profiles').update({ ...rest, social_links, is_public: is_public === 'on' }).eq('id', user.id)
  if (error?.code === '23505') return { fieldErrors: { username: [t('v.usernameTaken')] } }
  if (error) return { error: err(error) }
  revalidatePath('/', 'layout')
  return { message: t('act.profileSaved') }
}

// Avatar files are uploaded from the browser straight to Storage (the
// bucket policy only allows the user's own folder); this saves the URL.
export async function setAvatar(url: string | null): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  const { supabase, user } = await me()
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`
  if (url !== null && !url.startsWith(base)) return { ok: false, error: t('errors.uploadFailed') }
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/', 'layout')
  return { ok: true, message: url ? t('act.avatarUpdated') : t('act.avatarRemoved') }
}

export async function updatePreferences(_: FormState, formData: FormData): Promise<FormState> {
  const { t, err } = await i18nAction()
  const { supabase, user } = await me()
  const flag = (k: string) => formData.get(k) === 'on'
  const { error } = await supabase
    .from('user_settings')
    .update({
      notification_prefs: {
        email: flag('email'),
        in_app: flag('in_app'),
        product_updates: flag('product_updates'),
        deals: flag('deals'),
      },
    })
    .eq('user_id', user.id)
  if (error) return { error: err(error) }
  return { message: t('act.preferencesSaved') }
}

export async function setInterests(categoryIds: string[]): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  if (!z.array(z.string().uuid()).max(40).safeParse(categoryIds).success) return { ok: false, error: t('errors.unknownItem') }
  const { supabase, user } = await me()
  const { data: current } = await supabase.from('category_followers').select('category_id').eq('user_id', user.id)
  const have = new Set((current ?? []).map((c) => c.category_id))
  const want = new Set(categoryIds)
  const add = categoryIds.filter((id) => !have.has(id))
  const remove = [...have].filter((id) => !want.has(id))
  if (add.length) {
    const { error } = await supabase.from('category_followers').insert(add.map((category_id) => ({ user_id: user.id, category_id })))
    if (error) return { ok: false, error: err(error) }
  }
  if (remove.length) {
    const { error } = await supabase.from('category_followers').delete().eq('user_id', user.id).in('category_id', remove)
    if (error) return { ok: false, error: err(error) }
  }
  revalidatePath('/account', 'layout')
  return { ok: true, message: t('act.interestsUpdated') }
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { t, err } = await i18nAction()
  const { supabase, user } = await me()
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  if (ids?.length) {
    if (!z.array(z.string().uuid()).max(200).safeParse(ids).success) return { ok: false, error: t('errors.unknownItem') }
    q = q.in('id', ids)
  }
  const { error } = await q
  if (error) return { ok: false, error: err(error) }
  revalidatePath('/account/notifications')
  revalidatePath('/', 'layout')
  return { ok: true }
}
