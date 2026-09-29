'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
      toast.success('Collection created')
      setOpen(false)
      router.push(`/account/collections/${res.data.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg"><Plus />New collection</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>You can add products from any product page.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="col-title">Name</Label>
            <Input id="col-title" name="title" required minLength={2} maxLength={80} placeholder="My dream desk setup" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="col-desc">Description (optional)</Label>
            <Textarea id="col-desc" name="description" maxLength={600} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="col-public" name="public" />
            <Label htmlFor="col-public" className="font-normal">Public — show on my profile and allow sharing</Label>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" size="lg" disabled={pending}>{pending ? 'Creating…' : 'Create collection'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
