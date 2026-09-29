// Turns database/auth errors into messages that are safe to show users.
// Our SQL functions raise 'LOUPE:<CODE>' with a human-readable DETAIL; those
// details are written for users. Anything else becomes a generic message and
// is logged on the server — raw database errors are never shown.

type MaybeError = { message?: string; details?: string | null; code?: string } | null | undefined

// Returned by server actions when the visitor must log in first.
export const LOGIN_REQUIRED = 'LOGIN_REQUIRED'

export const genericError = 'Something went wrong. Please try again.'

export function friendlyError(error: MaybeError, fallback = genericError): string {
  if (!error) return fallback
  if (error.message?.startsWith('LOUPE:')) {
    return error.details || fallback
  }
  switch (error.code) {
    case '23505':
      return 'That already exists.'
    case '42501':
    case 'PGRST301':
      return "You don't have permission to perform this action."
    case '23514':
      return 'Some of the values are not valid. Please check the form.'
  }
  console.error('[loupe] unexpected error:', error)
  return fallback
}

export function authErrorMessage(message?: string): string {
  if (!message) return genericError
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link.'
  if (m.includes('already registered')) return 'An account with this email already exists. Try logging in.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.'
  if (m.includes('password should')) return 'Please choose a stronger password (at least 8 characters, with letters and numbers).'
  if (m.includes('expired') || m.includes('invalid') && m.includes('token')) return 'This link has expired. Please request a new one.'
  console.error('[loupe] auth error:', message)
  return genericError
}

export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> }
