'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { changeEmail, updatePassword } from '@/lib/actions/auth'
import { useT } from '@/components/i18n/provider'

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, null)
  const t = useT()
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} message={state?.message} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('auth.newPassword')}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" aria-describedby="pw-error" />
        <FieldError id="pw-error" messages={state?.fieldErrors?.password} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t('account.security.confirmNew')}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11" aria-describedby="confirm-error" />
        <FieldError id="confirm-error" messages={state?.fieldErrors?.confirm} />
      </div>
      <div><SubmitButton pendingLabel={t('account.security.updating')}>{t('auth.reset.submit')}</SubmitButton></div>
    </form>
  )
}

export function EmailForm({ current }: { current: string }) {
  const [state, action] = useActionState(changeEmail, null)
  const t = useT()
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} message={state?.message} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('account.security.newEmail')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder={current} required className="h-11" aria-describedby="email-error" />
        <FieldError id="email-error" messages={state?.fieldErrors?.email} />
      </div>
      <div><SubmitButton variant="outline" pendingLabel={t('auth.sending')}>{t('account.security.sendConfirmation')}</SubmitButton></div>
    </form>
  )
}
