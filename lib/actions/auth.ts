'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { localizePath } from '@/lib/i18n/config'
import { fieldErrorTranslator, translateAuthError } from '@/lib/i18n/errors'
import { getI18n, redirect } from '@/lib/i18n/server'
import { safeNext } from '@/lib/validation'
import { site } from '@/lib/site'

export type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string[] | undefined> } | null

async function origin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : site.url
}

// Validation messages are dictionary keys (translated by fieldErrorTranslator).
const email = z.string().trim().toLowerCase().email('v.email').max(254)
const newPassword = z
  .string()
  .min(8, 'v.passwordMin')
  .max(72, 'v.passwordMax')
  .regex(/[a-zA-Z]/, 'v.passwordLetter')
  .regex(/[0-9]/, 'v.passwordNumber')

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, 'v.passwordRequired') }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { fieldErrors: (await fieldErrorTranslator())(parsed.error.flatten().fieldErrors) }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: translateAuthError(error.message, (await getI18n()).t) }
  return redirect(safeNext(formData.get('next') as string | null, '/'))
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      email,
      password: newPassword,
      displayName: z.string().trim().min(1, 'v.nameRequired').max(80),
      terms: z.literal('on', { error: 'v.termsRequired' }),
    })
    .safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      displayName: formData.get('displayName'),
      terms: formData.get('terms'),
    })
  if (!parsed.success) return { fieldErrors: (await fieldErrorTranslator())(parsed.error.flatten().fieldErrors) }
  const { t, locale } = await getI18n()
  const supabase = await createClient()
  const next = safeNext(formData.get('next') as string | null, '/onboarding')
  const target = localizePath(next === '/' ? '/onboarding' : next, locale)
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, locale },
      emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(target)}`,
    },
  })
  if (error) return { error: translateAuthError(error.message, t) }
  // With email confirmation on, there is no session yet.
  if (!data.session) return redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`)
  return redirect('/onboarding')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect('/')
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: (await fieldErrorTranslator())(parsed.error.flatten().fieldErrors) }
  const { t, locale } = await getI18n()
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(localizePath('/reset-password', locale))}`,
  })
  // Same answer whether or not the account exists (no account enumeration).
  if (error && !/rate limit/i.test(error.message)) console.error('[loupe] reset error', error.message)
  if (error && /rate limit/i.test(error.message)) return { error: translateAuthError(error.message, t) }
  return { message: t('auth.resetSent') }
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'v.passwordMismatch', path: ['confirm'] })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') })
  if (!parsed.success) return { fieldErrors: (await fieldErrorTranslator())(parsed.error.flatten().fieldErrors) }
  const { t } = await getI18n()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: t('auth.resetExpired') }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: translateAuthError(error.message, t) }
  return { message: t('auth.passwordUpdated') }
}

export async function resendVerification(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: (await fieldErrorTranslator())(parsed.error.flatten().fieldErrors) }
  const { t, locale } = await getI18n()
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(localizePath('/onboarding', locale))}` },
  })
  if (error) return { error: translateAuthError(error.message, t) }
  return { message: t('auth.resent') }
}

export async function changeEmail(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: (await fieldErrorTranslator())(parsed.error.flatten().fieldErrors) }
  const { t, locale } = await getI18n()
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(localizePath('/account/security', locale))}` },
  )
  if (error) return { error: translateAuthError(error.message, t) }
  return { message: t('auth.emailChangeSent') }
}
