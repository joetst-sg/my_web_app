'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { signIn } from '@/lib/actions/auth'

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, null)
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage error={state?.error} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state?.fieldErrors?.email)} aria-describedby="email-error" className="h-11" />
        <FieldError id="email-error" messages={state?.fieldErrors?.email} />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">Forgot password?</Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(state?.fieldErrors?.password)} aria-describedby="password-error" className="h-11" />
        <FieldError id="password-error" messages={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
    </form>
  )
}
