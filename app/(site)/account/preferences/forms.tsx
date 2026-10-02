'use client'

import { useActionState, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FormMessage, SubmitButton } from '@/components/common/form-bits'
import { setInterests, updatePreferences } from '@/lib/actions/account'
import { useT } from '@/components/i18n/provider'

export function PrefsForm({ prefs }: { prefs: Record<'email' | 'in_app' | 'product_updates' | 'deals', boolean> }) {
  const [state, action] = useActionState(updatePreferences, null)
  const t = useT()
  const rows = [
    ['in_app', 'account.prefs.inApp', 'account.prefs.inAppHint'],
    ['email', 'account.prefs.email', 'account.prefs.emailHint'],
    ['product_updates', 'account.prefs.productUpdates', 'account.prefs.productUpdatesHint'],
    ['deals', 'account.prefs.deals', 'account.prefs.dealsHint'],
  ] as const
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage error={state?.error} message={state?.message} />
      {rows.map(([name, label, hint]) => (
        <div key={name} className="flex items-start justify-between gap-6 rounded-xl border p-4">
          <div>
            <Label htmlFor={`pref-${name}`}>{t(label)}</Label>
            <p className="mt-1 text-sm text-muted-foreground">{t(hint)}</p>
          </div>
          <Switch id={`pref-${name}`} name={name} defaultChecked={prefs[name]} />
        </div>
      ))}
      <div><SubmitButton pendingLabel={t('common.saving')}>{t('account.prefs.save')}</SubmitButton></div>
    </form>
  )
}

export function InterestsForm({ categories, selected }: { categories: { id: string; name: string }[]; selected: string[] }) {
  const [picked, setPicked] = useState(new Set(selected))
  const t = useT()
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('onboarding.interests')}>
        {categories.map((c) => {
          const on = picked.has(c.id)
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const next = new Set(picked)
                if (on) next.delete(c.id)
                else next.add(c.id)
                setPicked(next)
              }}
              className={cn('rounded-full border px-4 py-2 text-sm font-medium transition-colors', on ? 'border-foreground bg-primary text-primary-foreground' : 'hover:border-foreground/40')}
            >
              {c.name}
            </button>
          )
        })}
      </div>
      <div>
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setInterests([...picked])
              if (res.ok) toast.success(t('act.interestsUpdated'))
              else toast.error(res.error)
            })
          }
        >
          {t('account.prefs.saveInterests')}
        </Button>
      </div>
    </div>
  )
}
