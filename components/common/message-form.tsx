'use client'

import { useLocalizedRouter } from '@/components/i18n/provider'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendSubmissionMessage } from '@/lib/actions/seller'
import { useT } from '@/components/i18n/provider'

export function MessageForm({ submissionId, placeholder }: { submissionId: string; placeholder?: string }) {
  const t = useT()
  const router = useLocalizedRouter()
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
            toast.success(t('messages.sent'))
            router.refresh()
          }
        })
      }}
      className="flex flex-col gap-2"
    >
      <Label htmlFor="message" className="sr-only">{t('messages.label')}</Label>
      <Textarea id="message" value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder ?? t('messages.placeholder')} rows={3} maxLength={4000} />
      <Button type="submit" className="self-end" disabled={pending || !body.trim()}>{pending ? t('common.sending') : t('messages.send')}</Button>
    </form>
  )
}
