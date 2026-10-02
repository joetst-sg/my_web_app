'use client'

import { FolderPlus, Loader2, Lock } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { LoginPrompt } from '@/components/common/login-prompt'
import { createCollection, listMyCollections, setInCollection } from '@/lib/actions/engagement'
import { LOGIN_REQUIRED } from '@/lib/errors'
import { useT } from '@/components/i18n/provider'

type Row = { id: string; title: string; visibility: string; product_count: number; contains: boolean }

export function AddToCollectionButton({ productId, productName, className }: { productId: string; productName: string; className?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [loading, startLoading] = useTransition()
  const [saving, startSaving] = useTransition()

  function openDialog() {
    startLoading(async () => {
      const res = await listMyCollections(productId)
      if (!res.ok) {
        if (res.error === LOGIN_REQUIRED) setLoginOpen(true)
        else toast.error(res.error)
        return
      }
      setRows(res.data)
      setOpen(true)
    })
  }

  function toggle(row: Row, include: boolean) {
    setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, contains: include } : r)) ?? null)
    startSaving(async () => {
      const res = await setInCollection(row.id, productId, include)
      if (!res.ok) {
        setRows((rs) => rs?.map((r) => (r.id === row.id ? { ...r, contains: !include } : r)) ?? null)
        toast.error(res.error)
      } else toast.success(t(include ? 'collections.addedTo' : 'collections.removedFrom', { title: row.title }))
    })
  }

  function create(e: React.FormEvent) {
    e.preventDefault()
    startSaving(async () => {
      const res = await createCollection({ title, visibility: isPublic ? 'public' : 'private', productId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setRows((rs) => [{ id: res.data.id, title, visibility: isPublic ? 'public' : 'private', product_count: 1, contains: true }, ...(rs ?? [])])
      setTitle('')
      toast.success(t('collections.createdAndAdded', { title, name: productName }))
    })
  }

  return (
    <>
      <Button variant="outline" size="lg" onClick={openDialog} disabled={loading} className={className}>
        {loading ? <Loader2 className="animate-spin" /> : <FolderPlus />}
        {t('collections.addTo')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('collections.addTo')}</DialogTitle>
            <DialogDescription>{t('collections.chooseFor', { name: productName })}</DialogDescription>
          </DialogHeader>
          {rows && rows.length > 0 ? (
            <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Checkbox id={`c-${r.id}`} checked={r.contains} onCheckedChange={(v) => toggle(r, Boolean(v))} disabled={saving} />
                  <Label htmlFor={`c-${r.id}`} className="flex-1 font-normal">
                    {r.title}
                    {r.visibility === 'private' && <Lock className="size-3 text-muted-foreground" aria-label={t('common.private')} />}
                  </Label>
                  <span className="text-xs text-muted-foreground">{r.product_count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('collections.createFirst')}</p>
          )}
          <form onSubmit={create} className="flex flex-col gap-3 border-t pt-4">
            <Label htmlFor="new-collection">{t('collections.new')}</Label>
            <div className="flex gap-2">
              <Input id="new-collection" placeholder={t('collections.namePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
              <Button type="submit" disabled={saving || title.trim().length < 2}>{t('common.create')}</Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="new-collection-public" checked={isPublic} onCheckedChange={setIsPublic} />
              <Label htmlFor="new-collection-public" className="font-normal">{t('collections.publicHint')}</Label>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} reason="loginPrompt.reasonCollections" />
    </>
  )
}
