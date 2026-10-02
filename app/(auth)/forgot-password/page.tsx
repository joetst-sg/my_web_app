'use client'

import Link from '@/components/i18n/link'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { requestPasswordReset } from '@/lib/actions/auth'
import { useT } from '@/components/i18n/provider'

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, null)
  const t = useT()
  return (
    <>
      <title>{`${t('auth.forgot.heading')} · Loupe`}</title>
      <h1 className="font-display text-3xl font-bold">{t('auth.forgot.heading')}</h1>
      <p className="mb-6 mt-1 text-muted-foreground">{t('auth.forgot.intro')}</p>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage error={state?.error} message={state?.message} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" aria-describedby="email-error" />
          <FieldError id="email-error" messages={state?.fieldErrors?.email} />
        </div>
        <SubmitButton pendingLabel={t('auth.sending')}>{t('auth.forgot.submit')}</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.forgot.remembered')} <Link href="/login" className="font-medium text-foreground underline underline-offset-4">{t('auth.login.submit')}</Link>
      </p>
    </>
  )
}
