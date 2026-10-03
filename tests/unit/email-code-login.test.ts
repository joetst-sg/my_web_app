import { beforeEach, describe, expect, it, vi } from 'vitest'

// Server actions for the email-code login, with Supabase and Next mocked.
const auth = { signInWithOtp: vi.fn(), verifyOtp: vi.fn() }
let onboarded: string | null = '2026-10-01T00:00:00Z'
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT ${path}`)
})

vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'www.joetangtst.com', 'x-forwarded-proto': 'https' }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarded_at: onboarded } }) }) }) }),
  }),
}))
vi.mock('@/lib/i18n/server', async () => {
  const { createTranslator } = await import('@/lib/i18n/translate')
  const { en } = await import('@/lib/i18n/dictionaries/en')
  const t = createTranslator('en', en, en)
  return { getI18n: async () => ({ t, locale: 'en' }), getT: async () => t, redirect }
})
vi.mock('@/lib/i18n/errors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/i18n/errors')>('@/lib/i18n/errors')
  const { createTranslator } = await import('@/lib/i18n/translate')
  const { en } = await import('@/lib/i18n/dictionaries/en')
  const t = createTranslator('en', en, en)
  return { ...actual, fieldErrorTranslator: async () => (fe: Record<string, string[] | undefined>) => actual.translateFieldErrors(fe, t, 'en') }
})

const form = (data: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(data)) f.set(k, v)
  return f
}

describe('email code login', () => {
  beforeEach(() => {
    auth.signInWithOtp.mockReset()
    auth.verifyOtp.mockReset()
    redirect.mockClear()
    onboarded = '2026-10-01T00:00:00Z'
  })

  it('sends a code and allows new accounts', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null })
    const { requestLoginCode } = await import('@/lib/actions/auth')
    const res = await requestLoginCode(null, form({ email: 'Amy@Example.com', next: '/products' }))
    expect(res?.message).toBe('We sent a 6-digit code to amy@example.com. It expires in 10 minutes.')
    const call = auth.signInWithOtp.mock.calls[0][0]
    expect(call).toMatchObject({ email: 'amy@example.com', options: { shouldCreateUser: true } })
    expect(call.options.emailRedirectTo).toBe('https://www.joetangtst.com/auth/confirm?next=%2Fproducts')
  })

  it('rejects an invalid email without contacting Supabase', async () => {
    const { requestLoginCode } = await import('@/lib/actions/auth')
    const res = await requestLoginCode(null, form({ email: 'not-an-email' }))
    expect(res?.fieldErrors?.email?.[0]).toBe('Enter a valid email address.')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('explains the resend wait', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { message: 'For security purposes, you can only request this after 52 seconds.' } })
    const { requestLoginCode } = await import('@/lib/actions/auth')
    expect((await requestLoginCode(null, form({ email: 'a@b.co' })))?.error).toBe('Please wait a minute before requesting another code.')
  })

  it('requires exactly 6 digits', async () => {
    const { verifyLoginCode } = await import('@/lib/actions/auth')
    const res = await verifyLoginCode(null, form({ email: 'a@b.co', token: '12ab' }))
    expect(res?.fieldErrors?.token?.[0]).toBe('Enter the 6-digit code from the email.')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('shows a clear message for a wrong or expired code', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'Token has expired or is invalid' } })
    const { verifyLoginCode } = await import('@/lib/actions/auth')
    const res = await verifyLoginCode(null, form({ email: 'a@b.co', token: '123456' }))
    expect(res?.fieldErrors?.token?.[0]).toMatch(/wrong or has expired/)
  })

  it('logs in and returns to the requested page (spaces in the code are ignored)', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const { verifyLoginCode } = await import('@/lib/actions/auth')
    await expect(verifyLoginCode(null, form({ email: 'a@b.co', token: '123 456', next: '/deals' }))).rejects.toThrow('REDIRECT /deals')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '123456', type: 'email' })
  })

  it('sends brand-new accounts to onboarding', async () => {
    onboarded = null
    auth.verifyOtp.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
    const { verifyLoginCode } = await import('@/lib/actions/auth')
    await expect(verifyLoginCode(null, form({ email: 'new@b.co', token: '654321' }))).rejects.toThrow('REDIRECT /onboarding')
  })
})
