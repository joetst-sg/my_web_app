'use client'

import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createCollection } from '@/lib/actions/engagement'

export function NewCollectionButton() {
  const router = useLocalizedRouter()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(formData: FormData) {
    setError(null)
    start(async () => {
      const res = await createCollection({
        title: String(formData.get('title') ?? ''),
        description: String(formData.get('description') ?? ''),
        visibility: formData.get('public') === 'on' ? 'public' : 'private',
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      toast.success(t('act.collectionCreated'))
      setOpen(false)
      router.push(`/account/collections/${res.data.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg"><Plus />{t('collections.new')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('collections.new')}</DialogTitle>
          <DialogDescription>{t('account.collections.addHint')}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="col-title">{t('account.collections.name')}</Label>
            <Input id="col-title" name="title" required minLength={2} maxLength={80} placeholder={t('collections.namePlaceholder')} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="col-desc">{t('account.collections.description')} {t('common.optional')}</Label>
            <Textarea id="col-desc" name="description" maxLength={600} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="col-public" name="public" />
            <Label htmlFor="col-public" className="font-normal">{t('account.collections.publicProfile')}</Label>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>{pending ? t('account.collections.creating') : t('account.collections.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
