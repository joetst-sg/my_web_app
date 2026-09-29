'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth'
import { authErrorMessage, friendlyError } from '@/lib/errors'
import { site } from '@/lib/site'

export type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string[] | undefined> } | null

async function origin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : site.url
}

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254)
const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.')

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, 'Enter your password.') }).safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: authErrorMessage(error.message) }
  redirect(safeNext(formData.get('next') as string | null, '/'))
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      email,
      password: newPassword,
      displayName: z.string().trim().min(1, 'Tell us your name.').max(80),
      terms: z.literal('on', { error: 'Please accept the terms to continue.' }),
    })
    .safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
      displayName: formData.get('displayName'),
      terms: formData.get('terms'),
    })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const supabase = await createClient()
  const next = safeNext(formData.get('next') as string | null, '/onboarding')
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(next === '/' ? '/onboarding' : next)}`,
    },
  })
  if (error) return { error: authErrorMessage(error.message) }
  // With email confirmation on, there is no session yet.
  if (!data.session) redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`)
  redirect('/onboarding')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await origin()}/auth/confirm?next=/reset-password`,
  })
  // Same answer whether or not the account exists (no account enumeration).
  if (error && !/rate limit/i.test(error.message)) console.error('[loupe] reset error', error.message)
  if (error && /rate limit/i.test(error.message)) return { error: authErrorMessage(error.message) }
  return { message: 'If an account exists for that email, we sent a link to reset your password.' }
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password: newPassword, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match.', path: ['confirm'] })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Your reset link has expired. Please request a new one.' }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: authErrorMessage(error.message) }
  return { message: 'Your password has been updated.' }
}

export async function resendVerification(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${await origin()}/auth/confirm?next=/onboarding` },
  })
  if (error) return { error: authErrorMessage(error.message) }
  return { message: 'We sent a new confirmation link. Check your inbox (and spam folder).' }
}

export async function changeEmail(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get('email') })
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await origin()}/auth/confirm?next=/account/security` },
  )
  if (error) return { error: friendlyError({ message: error.message }, authErrorMessage(error.message)) }
  return { message: 'Check both your old and new inbox to confirm the change.' }
}
