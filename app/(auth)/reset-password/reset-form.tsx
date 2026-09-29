'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { updatePassword } from '@/lib/actions/auth'

export function ResetForm() {
  const [state, action] = useActionState(updatePassword, null)
  if (state?.message) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage message={state.message} />
        <Link href="/" className="font-medium underline underline-offset-4">Continue to Loupe</Link>
      </div>
    )
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage error={state?.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="h-11" aria-describedby="pw-hint pw-error" />
        <p id="pw-hint" className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
        <FieldError id="pw-error" messages={state?.fieldErrors?.password} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11" aria-describedby="confirm-error" />
        <FieldError id="confirm-error" messages={state?.fieldErrors?.confirm} />
      </div>
      <SubmitButton pendingLabel="Saving…">Update password</SubmitButton>
    </form>
  )
}
