'use client'

import { useActionState, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CategoryIcon } from '@/components/common/category-icon'
import { FieldError, FormMessage, SubmitButton } from '@/components/common/form-bits'
import { completeOnboarding } from '@/lib/actions/account'

type Cat = { id: string; slug: string; name: string; icon: string | null; color: string | null }

export function OnboardingForm({ categories, suggestedUsername }: { categories: Cat[]; suggestedUsername: string }) {
  const [state, action] = useActionState(completeOnboarding, null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  return (
    <form action={action} className="mt-8 flex flex-col gap-8">
      <FormMessage error={state?.error} />
      <fieldset>
        <legend className="sr-only">Interests</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {categories.map((c) => {
            const on = picked.has(c.id)
            return (
              <label
                key={c.id}
                className={cn(
                  'relative flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                  on ? 'border-foreground bg-surface' : 'hover:border-foreground/30',
                )}
              >
                <input
                  type="checkbox"
                  name="interests"
                  value={c.id}
                  checked={on}
                  onChange={(e) => {
                    const next = new Set(picked)
                    if (e.target.checked) next.add(c.id)
                    else next.delete(c.id)
                    setPicked(next)
                  }}
                  className="sr-only"
                />
                <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: c.color ?? '#475467' }}>
                  <CategoryIcon name={c.icon} className="size-4" />
                </span>
                <span className="font-medium">{c.name}</span>
                {on && <Check className="absolute right-3 top-3 size-4" aria-hidden />}
              </label>
            )
          })}
        </div>
        <FieldError id="interests-error" messages={state?.fieldErrors?.interests} />
      </fieldset>
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor="username">Choose a username</Label>
        <div className="flex items-center rounded-lg border focus-within:border-foreground/40">
          <span className="pl-3 text-muted-foreground">@</span>
          <Input id="username" name="username" defaultValue={suggestedUsername} required pattern="[a-zA-Z0-9_]{3,30}" className="h-11 border-0 shadow-none focus-visible:ring-0" aria-describedby="username-hint username-error" />
        </div>
        <p id="username-hint" className="text-xs text-muted-foreground">Shown on your public collections. Letters, numbers and underscores.</p>
        <FieldError id="username-error" messages={state?.fieldErrors?.username} />
      </div>
      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Saving…" disabled={picked.size === 0}>
          Continue{picked.size > 0 && ` with ${picked.size} interest${picked.size === 1 ? '' : 's'}`}
        </SubmitButton>
      </div>
    </form>
  )
}
