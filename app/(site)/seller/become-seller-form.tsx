'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { becomeSeller, updateSellerProfile } from '@/lib/actions/seller'

type Defaults = { company_name?: string; website?: string; contact_email?: string; bio?: string; instagram?: string; x?: string; linkedin?: string }

export function BecomeSellerForm({ defaultEmail, defaults, mode = 'create' }: { defaultEmail: string; defaults?: Defaults; mode?: 'create' | 'edit' }) {
  const [state, action] = useActionState(mode === 'create' ? becomeSeller : updateSellerProfile, null)
  const fe = state?.fieldErrors
  const f = (name: keyof Defaults, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`s-${name}`}>{label}</Label>
      <Input id={`s-${name}`} name={name} defaultValue={defaults?.[name] ?? (name === 'contact_email' ? defaultEmail : '')} className="h-11" aria-invalid={Boolean(fe?.[name])} aria-describedby={`s-${name}-error`} {...props} />
      <FieldError id={`s-${name}-error`} messages={fe?.[name]} />
    </div>
  )
  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessage error={state?.error} message={state?.message} />
      {f('company_name', 'Company or maker name', { required: true })}
      {f('website', 'Company website', { type: 'url', placeholder: 'https://…' })}
      {f('contact_email', 'Contact email for editors', { type: 'email', required: true })}
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-bio">About your company (optional)</Label>
        <Textarea id="s-bio" name="bio" defaultValue={defaults?.bio} maxLength={1000} rows={4} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {f('instagram', 'Instagram', { type: 'url', placeholder: 'https://…' })}
        {f('x', 'X', { type: 'url', placeholder: 'https://…' })}
        {f('linkedin', 'LinkedIn', { type: 'url', placeholder: 'https://…' })}
      </div>
      <div><SubmitButton pendingLabel="Saving…">{mode === 'create' ? 'Create seller profile' : 'Save seller profile'}</SubmitButton></div>
    </form>
  )
}
