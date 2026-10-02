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
import { useT } from '@/components/i18n/provider'
import type { MessageKey } from '@/lib/i18n/translate'

const REASONS = ['broken_link', 'incorrect_information', 'offensive_content', 'misleading_information', 'copyright_concern', 'scam_suspicious', 'other'] as const
type Reason = (typeof REASONS)[number]

export function ReportButton({ productId, productName }: { productId: string; productName: string }) {
  const t = useT()
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
        {t('report.button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('report.title', { name: productName })}</DialogTitle>
            <DialogDescription>{t('report.description')}</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as Reason)} className="grid gap-2 sm:grid-cols-2">
            {REASONS.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <RadioGroupItem value={r} id={`report-${r}`} />
                <Label htmlFor={`report-${r}`} className="font-normal">{t(`labels.reportReason.${r}` as MessageKey)}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-details">{t('report.details')}</Label>
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button size="lg" onClick={submit} disabled={!reason || pending}>{pending ? t('common.sending') : t('report.send')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LoginPrompt open={loginOpen} onOpenChange={setLoginOpen} reason="loginPrompt.reasonReport" />
    </>
  )
}
