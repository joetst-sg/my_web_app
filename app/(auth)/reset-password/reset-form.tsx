'use client'

import Link from '@/components/i18n/link'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { updatePassword } from '@/lib/actions/auth'
import { useT } from '@/components/i18n/provider'

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, null)
  const t = useT()
  if (state?.message) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage message={state.message} />
        <Link href="/" className="font-medium underline underline-offset-4">{t('auth.reset.continue')}</Link>
      </div>
    )
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state?.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('auth.newPassword')}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" aria-describedby="pw-hint pw-error" />
        <p id="pw-hint" className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
        <FieldError id="pw-error" messages={state?.fieldErrors?.password} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t('auth.confirmPassword')}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11" aria-describedby="confirm-error" />
        <FieldError id="confirm-error" messages={state?.fieldErrors?.confirm} />
      </div>
      <SubmitButton pendingLabel={t('common.saving')}>{t('auth.reset.submit')}</SubmitButton>
    </form>
  )
}
