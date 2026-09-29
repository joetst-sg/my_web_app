'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { requestPasswordReset } from '@/lib/actions/auth'

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, null)
  return (
    <>
      <title>Reset your password · Loupe</title>
      <h1 className="font-display text-3xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-muted-foreground">Enter your account email and we&apos;ll send you a reset link.</p>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage error={state?.error} message={state?.message} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" aria-describedby="email-error" />
          <FieldError id="email-error" messages={state?.fieldErrors?.email} />
        </div>
        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it? <Link href="/login" className="font-medium text-foreground underline underline-offset-4">Log in</Link>
      </p>
    </>
  )
}
