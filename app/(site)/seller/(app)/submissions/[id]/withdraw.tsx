'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { withdrawSubmission } from '@/lib/actions/seller'

export function WithdrawButton({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await withdrawSubmission(submissionId)
          if (!res.ok) toast.error(res.error)
          else {
            toast.success(res.message)
            router.refresh()
          }
        })
      }
    >
      Withdraw to edit
    </Button>
  )
}
