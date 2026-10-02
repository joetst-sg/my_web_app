'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelReminder } from '@/lib/actions/engagement'
import { useT } from '@/components/i18n/provider'

export function CancelReminder({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const t = useT()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelReminder(id)
          if (res.ok) toast.success(t('act.reminderCancelled'))
          else toast.error(res.error)
        })
      }
    >
      {t('common.cancel')}
    </Button>
  )
}
