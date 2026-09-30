'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendEditorMessage } from '@/lib/actions/admin'

export function EditorMessage({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await sendEditorMessage(submissionId, body)
          if (!res.ok) toast.error(res.error)
          else {
            setBody('')
            toast.success('Message sent')
            router.refresh()
          }
        })
      }}
    >
      <Label htmlFor="editor-msg" className="sr-only">Message to seller</Label>
      <Textarea id="editor-msg" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message the seller (doesn't change the status)…" maxLength={4000} />
      <Button type="submit" variant="outline" className="self-end" disabled={pending || !body.trim()}>Send message</Button>
    </form>
  )
}
