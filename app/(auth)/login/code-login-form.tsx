'use client'

import Link from '@/components/i18n/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { useT } from '@/components/i18n/provider'
import { requestLoginCode, verifyLoginCode } from '@/lib/actions/auth'

const RESEND_SECONDS = 60

// Two steps: email → 6-digit code. Works for existing and new accounts.
export function CodeLoginForm({ next }: { next: string }) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [wait, setWait] = useState(0)
  const [sendState, sendAction] = useActionState(requestLoginCode, null)
  const [verifyState, verifyAction] = useActionState(verifyLoginCode, null)
  const codeInput = useRef<HTMLInputElement>(null)

  // A code was sent: show the code step and start the resend countdown.
  useEffect(() => {
    if (sendState?.message) {
      setStep('code')
      setWait(RESEND_SECONDS)
      codeInput.current?.focus()
    }
  }, [sendState])

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  if (step === 'email') {
    return (
      <form action={sendAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <p className="text-sm text-muted-foreground">{t('auth.code.intro')}</p>
        <FormMessage error={sendState?.error} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="code-email">{t('auth.email')}</Label>
          <Input
            id="code-email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(sendState?.fieldErrors?.email)} aria-describedby="code-email-error" className="h-11"
          />
          <FieldError id="code-email-error" messages={sendState?.fieldErrors?.email} />
        </div>
        <SubmitButton pendingLabel={t('auth.sending')}>{t('auth.code.send')}</SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          {t('auth.code.termsBefore')}<Link href="/terms" className="underline">{t('auth.signup.terms')}</Link>{t('auth.signup.agreeAnd')}<Link href="/privacy" className="underline">{t('auth.signup.privacy')}</Link>{t('auth.code.termsAfter')}
        </p>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="rounded-lg bg-[oklch(0.95_0.05_155)] px-3 py-2 text-sm text-[oklch(0.35_0.09_155)]">{sendState?.message}</p>
      <form action={verifyAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <FormMessage error={verifyState?.error} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="code-token">{t('auth.code.codeLabel')}</Label>
          <Input
            ref={codeInput} id="code-token" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required
            aria-invalid={Boolean(verifyState?.fieldErrors?.token)} aria-describedby="code-token-error code-token-hint"
            className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
          />
          <FieldError id="code-token-error" messages={verifyState?.fieldErrors?.token} />
          <p id="code-token-hint" className="text-xs text-muted-foreground">{t('auth.code.checkSpam')}</p>
        </div>
        <SubmitButton pendingLabel={t('auth.code.verifying')}>{t('auth.code.verify')}</SubmitButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <form action={sendAction}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="ghost" size="sm" disabled={wait > 0}>
            {wait > 0 ? t('auth.code.resendIn', { seconds: wait }) : t('auth.code.resend')}
          </Button>
        </form>
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep('email')}>{t('auth.code.differentEmail')}</Button>
      </div>
    </div>
  )
}
