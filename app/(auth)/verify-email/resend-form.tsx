'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { resendVerification } from '@/lib/actions/auth'
import { useT } from '@/components/i18n/provider'

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerification, null)
  const t = useT()
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <FormMessage error={state?.error} message={state?.message} />
      <Label htmlFor="email" className="sr-only">{t('auth.email')}</Label>
      <Input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" className="h-11" />
      <FieldError id="email-error" messages={state?.fieldErrors?.email} />
      <SubmitButton variant="outline" pendingLabel={t('auth.sending')}>{t('auth.verify.resend')}</SubmitButton>
    </form>
  )
}
