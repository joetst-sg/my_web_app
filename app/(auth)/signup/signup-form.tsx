'use client'

import Link from '@/components/i18n/link'
import { useActionState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { signUp } from '@/lib/actions/auth'
import { useT } from '@/components/i18n/provider'

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, null)
  const fe = state?.fieldErrors
  const t = useT()
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage error={state?.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">{t('auth.name')}</Label>
        <Input id="displayName" name="displayName" autoComplete="name" required maxLength={80} aria-invalid={Boolean(fe?.displayName)} aria-describedby="name-error" className="h-11" />
        <FieldError id="name-error" messages={fe?.displayName} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fe?.email)} aria-describedby="email-error" className="h-11" />
        <FieldError id="email-error" messages={fe?.email} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} aria-invalid={Boolean(fe?.password)} aria-describedby="password-hint password-error" className="h-11" />
        <p id="password-hint" className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
        <FieldError id="password-error" messages={fe?.password} />
      </div>
      <div className="flex items-start gap-2.5">
        <Checkbox id="terms" name="terms" aria-describedby="terms-error" className="mt-0.5" />
        <Label htmlFor="terms" className="font-normal leading-snug text-muted-foreground">
          {t('auth.signup.agreeBefore')}<Link href="/terms" className="underline">{t('auth.signup.terms')}</Link>{t('auth.signup.agreeAnd')}<Link href="/privacy" className="underline">{t('auth.signup.privacy')}</Link>{t('auth.signup.agreeAfter')}
        </Label>
      </div>
      <FieldError id="terms-error" messages={fe?.terms} />
      <SubmitButton pendingLabel={t('auth.signup.pending')}>{t('auth.signup.submit')}</SubmitButton>
    </form>
  )
}
