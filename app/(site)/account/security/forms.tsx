'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { changeEmail, updatePassword } from '@/lib/actions/auth'

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, null)
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} message={state?.message} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" aria-describedby="pw-error" />
        <FieldError id="pw-error" messages={state?.fieldErrors?.password} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11" aria-describedby="confirm-error" />
        <FieldError id="confirm-error" messages={state?.fieldErrors?.confirm} />
      </div>
      <div><SubmitButton pendingLabel="Updating…">Update password</SubmitButton></div>
    </form>
  )
}

export function EmailForm({ current }: { current: string }) {
  const [state, action] = useActionState(changeEmail, null)
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} message={state?.message} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">New email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder={current} required className="h-11" aria-describedby="email-error" />
        <FieldError id="email-error" messages={state?.fieldErrors?.email} />
      </div>
      <div><SubmitButton variant="outline" pendingLabel="Sending…">Send confirmation</SubmitButton></div>
    </form>
  )
}
