'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { updateProfile } from '@/lib/actions/account'
import { useFormatters, useT } from '@/components/i18n/provider'

type Defaults = { username: string; display_name: string; bio: string; website: string; instagram: string; x: string; is_public: boolean }

export function ProfileForm({ defaults, memberSince }: { defaults: Defaults; memberSince: string | null }) {
  const [state, action] = useActionState(updateProfile, null)
  const fe = state?.fieldErrors
  const t = useT()
  const f = useFormatters()
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
      {field('display_name', t('account.profile.displayName'), { required: true, maxLength: 80 })}
      {field('username', t('account.profile.username'), { required: true, pattern: '[a-zA-Z0-9_]{3,30}' })}
      <div className="flex flex-col gap-2">
        <Label htmlFor="bio">{t('account.profile.bio')}</Label>
        <Textarea id="bio" name="bio" defaultValue={defaults.bio} maxLength={500} rows={3} />
      </div>
      {field('website', t('common.website'), { type: 'url', placeholder: 'https://…' })}
      <div className="grid gap-5 sm:grid-cols-2">
        {field('instagram', t('account.profile.instagram'), { type: 'url', placeholder: 'https://instagram.com/…' })}
        {field('x', t('account.profile.x'), { type: 'url', placeholder: 'https://x.com/…' })}
      </div>
      <div className="flex items-center gap-2">
        <Switch id="is_public" name="is_public" defaultChecked={defaults.is_public} />
        <Label htmlFor="is_public" className="font-normal">{t('account.profile.public')}</Label>
      </div>
      {memberSince && <p className="text-sm text-muted-foreground">{t('account.profile.memberSince', { date: f.date(memberSince) })}</p>}
      <div><SubmitButton pendingLabel={t('common.saving')}>{t('account.profile.save')}</SubmitButton></div>
    </form>
  )
}
