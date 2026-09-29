'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendSubmissionMessage } from '@/lib/actions/seller'

export function MessageForm({ submissionId, placeholder = 'Write a message…' }: { submissionId: string; placeholder?: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await sendSubmissionMessage(submissionId, body)
          if (!res.ok) toast.error(res.error)
          else {
            setBody('')
            toast.success('Message sent')
            router.refresh()
          }
        })
      }}
      className="flex flex-col gap-2"
    >
      <Label htmlFor="message" className="sr-only">Message</Label>
      <Textarea id="message" value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} rows={3} maxLength={4000} />
      <Button type="submit" className="self-end" disabled={pending || !body.trim()}>{pending ? 'Sending…' : 'Send message'}</Button>
    </form>
  )
}
