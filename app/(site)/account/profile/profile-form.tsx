'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { updateProfile } from '@/lib/actions/account'
import { formatDate } from '@/lib/format'

type Defaults = { username: string; display_name: string; bio: string; website: string; instagram: string; x: string; is_public: boolean }

export function ProfileForm({ defaults, memberSince }: { defaults: Defaults; memberSince: string | null }) {
  const [state, action] = useActionState(updateProfile, null)
  const fe = state?.fieldErrors
  const field = (name: keyof Defaults, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={String(defaults[name])} aria-invalid={Boolean(fe?.[name])} aria-describedby={`${name}-error`} className="h-11" {...props} />
      <FieldError id={`${name}-error`} messages={fe?.[name]} />
    </div>
  )
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <FormMessage error={state?.error} message={state?.message} />
      {field('display_name', 'Display name', { required: true, maxLength: 80 })}
      {field('username', 'Username', { required: true, pattern: '[a-zA-Z0-9_]{3,30}' })}
      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" defaultValue={defaults.bio} maxLength={500} rows={3} />
      </div>
      {field('website', 'Website', { type: 'url', placeholder: 'https://…' })}
      <div className="grid gap-5 sm:grid-cols-2">
        {field('instagram', 'Instagram URL', { type: 'url', placeholder: 'https://instagram.com/…' })}
        {field('x', 'X URL', { type: 'url', placeholder: 'https://x.com/…' })}
      </div>
      <div className="flex items-center gap-2">
        <Switch id="is_public" name="is_public" defaultChecked={defaults.is_public} />
        <Label htmlFor="is_public" className="font-normal">Public profile — show my name on public collections</Label>
      </div>
      {memberSince && <p className="text-sm text-muted-foreground">Member since {formatDate(memberSince)}</p>}
      <div><SubmitButton pendingLabel="Saving…">Save profile</SubmitButton></div>
    </form>
  )
}
