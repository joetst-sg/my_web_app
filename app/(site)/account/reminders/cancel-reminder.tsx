'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cancelReminder } from '@/lib/actions/engagement'

export function CancelReminder({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelReminder(id)
          if (res.ok) toast.success('Reminder cancelled')
          else toast.error(res.error)
        })
      }
    >
      Cancel
    </Button>
  )
}
