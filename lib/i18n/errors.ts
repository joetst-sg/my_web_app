import 'server-only'
import type { Locale } from './config'
import { getI18n } from './server'
import type { MessageKey, Translate } from './translate'

type MaybeError = { message?: string; details?: string | null; code?: string } | null | undefined

// User-facing messages raised by our SQL functions (DETAIL of 'LOUPE:*'
// errors) mapped to dictionary keys, so they can be shown in any language.
const DETAIL_KEYS: Record<string, MessageKey> = {
  'Please log in to continue.': 'errors.loginRequired',
  'Your account is suspended.': 'errors.suspended',
  "You don't have permission to perform this action.": 'errors.forbidden',
  'This submission does not exist or you cannot access it.': 'errors.submissionNotFound',
  'This submission no longer exists.': 'errors.submissionNotFound',
  'Please include a message for the seller explaining why.': 'errors.messageRequired',
  'Choose a publish time in the future.': 'errors.futureTime',
  'You can submit up to 10 products a day. Please try again tomorrow.': 'errors.submitLimit',
  'You have sent a lot of reports recently. Please try again later.': 'errors.reportLimit',
  'You have created a lot of collections recently. Please try again later.': 'errors.collectionLimit',
  'New submissions are paused right now. Your draft is saved — please try again later.': 'errors.submissionsPaused',
  'Product status can only be changed through the review workflow.': 'errors.statusWorkflow',
  'Reminders can only be cancelled.': 'errors.reminderCancelOnly',
}

const CODE_KEYS: Record<string, MessageKey> = {
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  INVALID_TRANSITION: 'errors.invalidTransition',
  INVALID_INPUT: 'errors.invalidInput',
  INCOMPLETE: 'errors.incomplete',
  RATE_LIMITED: 'errors.rateLimited',
  UNAUTHENTICATED: 'errors.loginRequired',
  CLOSED: 'errors.submissionsPaused',
}

export function translateError(error: MaybeError, t: Translate, locale: Locale, fallback: MessageKey = 'errors.generic'): string {
  if (!error) return t(fallback)
  if (error.message?.startsWith('LOUPE:')) {
    const detail = error.details ?? ''
    // English keeps the database's specific wording (e.g. which fields are missing).
    if (locale === 'en' && detail) return detail
    const key = DETAIL_KEYS[detail] ?? CODE_KEYS[error.message.slice(6)] ?? fallback
    return t(key)
  }
  switch (error.code) {
    case '23505':
      return t('errors.duplicate')
    case '42501':
    case 'PGRST301':
      return t('errors.forbidden')
    case '23514':
      return t('errors.invalidValues')
  }
  console.error('[loupe] unexpected error:', error)
  return t(fallback)
}

// For server actions: const err = await errorTranslator(); err(error)
export async function errorTranslator() {
  const { t, locale } = await getI18n()
  return (error: MaybeError, fallback: MessageKey = 'errors.generic') => translateError(error, t, locale, fallback)
}

// Supabase Auth error messages → friendly, translated text.
export function translateAuthError(message: string | undefined, t: Translate): string {
  if (!message) return t('errors.generic')
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return t('auth.errors.invalidCredentials')
  if (m.includes('email not confirmed')) return t('auth.errors.notConfirmed')
  if (m.includes('already registered')) return t('auth.errors.alreadyRegistered')
  if (m.includes('only request this after') || m.includes('security purposes')) return t('auth.errors.waitBeforeResend')
  if (m.includes('rate limit') || m.includes('too many')) return t('auth.errors.rateLimited')
  if (m.includes('password should')) return t('auth.errors.weakPassword')
  if (m.includes('expired') || (m.includes('invalid') && m.includes('token'))) return t('auth.errors.linkExpired')
  console.error('[loupe] auth error:', message)
  return t('errors.generic')
}

// Zod messages in this app are dictionary keys ("v.*"). Anything else
// (zod's own English defaults) becomes a generic message outside English.
export function translateFieldErrors(
  fieldErrors: Record<string, string[] | undefined>,
  t: Translate,
  locale: Locale,
): Record<string, string[] | undefined> {
  const out: Record<string, string[] | undefined> = {}
  for (const [field, messages] of Object.entries(fieldErrors)) {
    out[field] = messages?.map((m) => (m.startsWith('v.') ? t(m as MessageKey) : locale === 'en' ? m : t('v.invalid')))
  }
  return out
}

export async function fieldErrorTranslator() {
  const { t, locale } = await getI18n()
  return (fieldErrors: Record<string, string[] | undefined>) => translateFieldErrors(fieldErrors, t, locale)
}

// Everything a server action needs to answer in the visitor's language.
export async function i18nAction() {
  const { t, locale } = await getI18n()
  return {
    t,
    locale,
    err: (error: MaybeError, fallback: MessageKey = 'errors.generic') => translateError(error, t, locale, fallback),
    fe: (fieldErrors: Record<string, string[] | undefined>) => translateFieldErrors(fieldErrors, t, locale),
    // Translates a single validation message that may be a "v.*" key.
    tm: (message: string) => (message.startsWith('v.') ? t(message as MessageKey) : message),
  }
}
