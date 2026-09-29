'use client'

import { Flag } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { LoginPrompt } from '@/components/common/login-prompt'
import { reportProduct } from '@/lib/actions/engagement'
import { LOGIN_REQUIRED } from '@/lib/errors'
import { labels } from '@/lib/format'

type Reason = keyof typeof labels.reportReason

export function ReportButton({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [reason, setReason] = useState<Reason | ''>('')
  const [details, setDetails] = useState('')
  const [pending, start] = useTransition()

  function submit() {
    if (!reason) return
    start(async () => {
      const res = await reportProduct({ productId, reason, details })
      if (!res.ok) {
        if (res.error === LOGIN_REQUIRED) {
          setOpen(false)
          setLoginOpen(true)
        } else toast.error(res.error)
        return
      }
      setOpen(false)
      setReason('')
      setDetails('')
      toast.success(res.message)
    })
  }

  return (
    <>
      <Button variant="link" className="h-auto px-0 text-muted-foreground" onClick={() => setOpen(true)}>
        <Flag />
        Report this listing
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report {productName}</DialogTitle>
            <DialogDescription>Tell our editors what&apos;s wrong. Reports are private.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as Reason)} className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(labels.reportReason) as Reason[]).map((r) => (
              <div key={r} className="flex items-center gap-2">
                <RadioGroupItem value={r} id={`report-${r}`} />
                <Label htmlFor={`report-${r}`} className="font-normal">{labels.reportReason[r]}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-details">Details (optional)</Label>
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="lg" onClick={submit} disabled={!reason || pending}>{pending ? 'Sending…' : 'Send report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} reason="report listings" />
    </>
  )
}
