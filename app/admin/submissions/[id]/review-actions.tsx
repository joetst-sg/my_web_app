'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Check, Eye, Loader2, MessageSquareWarning, Rocket, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { reviewSubmission } from '@/lib/actions/admin'

type Action = 'start_review' | 'request_changes' | 'approve' | 'reject' | 'schedule' | 'publish' | 'archive'

const allowed: Record<string, Action[]> = {
  submitted: ['start_review', 'approve', 'request_changes', 'reject', 'publish'],
  under_review: ['approve', 'request_changes', 'reject', 'publish'],
  changes_requested: ['reject'],
  approved: ['schedule', 'publish', 'request_changes', 'reject'],
  scheduled: ['schedule', 'publish', 'request_changes', 'reject'],
  published: ['archive'],
}

export function ReviewActions({ submissionId, status }: { submissionId: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dialog, setDialog] = useState<null | 'request_changes' | 'reject' | 'schedule'>(null)
  const [message, setMessage] = useState('')
  const [when, setWhen] = useState(() => new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16))
  const [error, setError] = useState<string | null>(null)
  const can = allowed[status] ?? []

  function run(action: Action, extra: { message?: string; scheduledFor?: string } = {}) {
    setError(null)
    start(async () => {
      const res = await reviewSubmission({ submissionId, action, ...extra })
      if (!res.ok) {
        setError(res.error)
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      setDialog(null)
      setMessage('')
      router.refresh()
    })
  }

  if (can.length === 0) return <p className="text-sm text-muted-foreground">No review actions are available in this state.</p>

  return (
    <div className="flex flex-wrap gap-2">
      {can.includes('start_review') && <Button variant="outline" disabled={pending} onClick={() => run('start_review')}><Eye />Start review</Button>}
      {can.includes('approve') && <Button disabled={pending} onClick={() => run('approve')}>{pending ? <Loader2 className="animate-spin" /> : <Check />}Approve</Button>}
      {can.includes('schedule') && <Button variant={status === 'approved' ? 'default' : 'outline'} disabled={pending} onClick={() => setDialog('schedule')}><CalendarClock />{status === 'scheduled' ? 'Reschedule' : 'Schedule'}</Button>}
      {can.includes('publish') && <Button variant="outline" disabled={pending} onClick={() => run('publish')}><Rocket />Publish now</Button>}
      {can.includes('request_changes') && <Button variant="outline" disabled={pending} onClick={() => setDialog('request_changes')}><MessageSquareWarning />Request changes</Button>}
      {can.includes('reject') && <Button variant="destructive" disabled={pending} onClick={() => setDialog('reject')}><X />Reject</Button>}
      {can.includes('archive') && <Button variant="outline" disabled={pending} onClick={() => run('archive')}>Archive</Button>}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog === 'schedule' ? 'Schedule publication' : dialog === 'reject' ? 'Reject submission' : 'Request changes'}</DialogTitle>
            <DialogDescription>
              {dialog === 'schedule'
                ? 'The product goes live automatically at this time (checked every minute).'
                : 'The seller sees this message and gets an email. Be specific about what to change.'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'schedule' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="when">Publish at (your local time)</Label>
              <Input id="when" type="datetime-local" value={when} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setWhen(e.target.value)} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="msg">Message to the seller</Label>
              <Textarea id="msg" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please upload higher-quality lifestyle images." maxLength={4000} />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog === 'reject' ? 'destructive' : 'default'}
              disabled={pending || (dialog !== 'schedule' && message.trim().length < 5)}
              onClick={() => (dialog === 'schedule' ? run('schedule', { scheduledFor: new Date(when).toISOString() }) : run(dialog!, { message }))}
            >
              {pending && <Loader2 className="animate-spin" />}
              {dialog === 'schedule' ? 'Schedule' : dialog === 'reject' ? 'Reject' : 'Send request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
