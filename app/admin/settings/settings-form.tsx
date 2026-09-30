'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { saveSetting } from '@/lib/actions/admin'

export function SettingsForm({ initial }: { initial: { name: string; tagline: string; submissionsOpen: boolean } }) {
  const [v, setV] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-background p-5"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const results = await Promise.all([
            saveSetting('site.name', v.name),
            saveSetting('site.tagline', v.tagline),
            saveSetting('submissions.open', v.submissionsOpen),
          ])
          const failed = results.find((r) => !r.ok)
          if (failed && !failed.ok) toast.error(failed.error)
          else toast.success('Settings saved')
        })
      }}
    >
      <h2 className="font-sans text-base font-semibold tracking-normal">Site</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor="st-name">Site name (stored setting)</Label><Input id="st-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="st-tagline">Tagline</Label><Input id="st-tagline" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} /></div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="st-open" checked={v.submissionsOpen} onCheckedChange={(x) => setV({ ...v, submissionsOpen: x })} />
        <Label htmlFor="st-open" className="font-normal">Accept new product submissions</Label>
      </div>
      <p className="text-xs text-muted-foreground">The brand name shown in the header and emails comes from <code>lib/site.ts</code>; these stored settings are for operational switches.</p>
      <Button type="submit" className="self-start" disabled={pending}>Save settings</Button>
    </form>
  )
}
