'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createEditorialCollection } from '@/lib/actions/admin'

export function NewEditorialCollection() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pending, start] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus />New editorial collection</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New editorial collection</DialogTitle>
          <DialogDescription>Public, curated by the editors. Add products from any product page with “Add to collection”.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2"><Label htmlFor="ec-title">Title</Label><Input id="ec-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} /></div>
        <div className="flex flex-col gap-2"><Label htmlFor="ec-desc">Description</Label><Textarea id="ec-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} /></div>
        <DialogFooter>
          <Button
            disabled={pending || title.trim().length < 2}
            onClick={() =>
              start(async () => {
                const res = await createEditorialCollection(title, description)
                if (!res.ok) toast.error(res.error)
                else {
                  toast.success('Collection created')
                  setOpen(false)
                  router.push(`/account/collections/${res.data.id}`)
                }
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
