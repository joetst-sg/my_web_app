'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, type ActionResult } from '@/lib/errors'
import type { FormState } from './auth'
import { optionalHttpsUrl } from '@/lib/validation'

async function me() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

const username = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,30}$/, 'Use 3–30 letters, numbers or underscores.')

export async function completeOnboarding(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      username,
      interests: z.array(z.string().uuid()).min(1, 'Pick at least one interest.').max(20),
    })
    .safeParse({ username: formData.get('username'), interests: formData.getAll('interests') })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const { supabase, user } = await me()

  const { error: profileError } = await supabase.from('profiles').update({ username: parsed.data.username }).eq('id', user.id)
  if (profileError?.code === '23505') return { fieldErrors: { username: ['That username is taken. Try another.'] } }
  if (profileError) return { error: friendlyError(profileError) }

  const { error: followError } = await supabase
    .from('category_followers')
    .upsert(parsed.data.interests.map((category_id) => ({ user_id: user.id, category_id })), { ignoreDuplicates: true })
  if (followError) return { error: friendlyError(followError) }

  const { error } = await supabase.from('user_settings').update({ onboarded_at: new Date().toISOString() }).eq('user_id', user.id)
  if (error) return { error: friendlyError(error) }
  redirect('/account/feed?welcome=1')
}

const profileSchema = z.object({
  username,
  display_name: z.string().trim().min(1, 'Enter a display name.').max(80),
  bio: z.string().trim().max(500).optional().transform((v) => v || null),
  website: optionalHttpsUrl.transform((v) => v ?? null),
  instagram: optionalHttpsUrl,
  x: optionalHttpsUrl,
  is_public: z.enum(['on']).optional(),
})

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const { supabase, user } = await me()
  const { instagram, x, is_public, ...rest } = parsed.data
  const social_links = Object.fromEntries(Object.entries({ instagram, x }).filter(([, v]) => v))
  const { error } = await supabase.from('profiles').update({ ...rest, social_links, is_public: is_public === 'on' }).eq('id', user.id)
  if (error?.code === '23505') return { fieldErrors: { username: ['That username is taken. Try another.'] } }
  if (error) return { error: friendlyError(error) }
  revalidatePath('/', 'layout')
  return { message: 'Profile saved.' }
}

// Avatar files are uploaded from the browser straight to Storage (the
// bucket policy only allows the user's own folder); this saves the URL.
export async function setAvatar(url: string | null): Promise<ActionResult> {
  const { supabase, user } = await me()
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`
  if (url !== null && !url.startsWith(base)) return { ok: false, error: 'Upload failed. Please try again.' }
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
  if (error) return { ok: false, error: friendlyError(error) }
  revalidatePath('/', 'layout')
  return { ok: true, message: url ? 'Avatar updated' : 'Avatar removed' }
}

export async function updatePreferences(_: FormState, formData: FormData): Promise<FormState> {
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
  if (error) return { error: friendlyError(error) }
  return { message: 'Preferences saved.' }
}

export async function setInterests(categoryIds: string[]): Promise<ActionResult> {
  if (!z.array(z.string().uuid()).max(40).safeParse(categoryIds).success) return { ok: false, error: 'Unknown category.' }
  const { supabase, user } = await me()
  const { data: current } = await supabase.from('category_followers').select('category_id').eq('user_id', user.id)
  const have = new Set((current ?? []).map((c) => c.category_id))
  const want = new Set(categoryIds)
  const add = categoryIds.filter((id) => !have.has(id))
  const remove = [...have].filter((id) => !want.has(id))
  if (add.length) {
    const { error } = await supabase.from('category_followers').insert(add.map((category_id) => ({ user_id: user.id, category_id })))
    if (error) return { ok: false, error: friendlyError(error) }
  }
  if (remove.length) {
    const { error } = await supabase.from('category_followers').delete().eq('user_id', user.id).in('category_id', remove)
    if (error) return { ok: false, error: friendlyError(error) }
  }
  revalidatePath('/account', 'layout')
  return { ok: true, message: 'Interests updated' }
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { supabase, user } = await me()
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  if (ids?.length) {
    if (!z.array(z.string().uuid()).max(200).safeParse(ids).success) return { ok: false, error: 'Unknown notification.' }
    q = q.in('id', ids)
  }
  const { error } = await q
  if (error) return { ok: false, error: friendlyError(error) }
  revalidatePath('/account/notifications')
  revalidatePath('/', 'layout')
  return { ok: true }
}
