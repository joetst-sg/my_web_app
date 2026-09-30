'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
type Result = { ok: true; message?: string } | { ok: false; error: string }

// Runs a bound server action, shows the result as a toast and refreshes.
export function ActionButton({
  action,
  children,
  confirm,
  variant = 'outline',
  size = 'default',
  className,
}: {
  action: () => Promise<Result>
  children: React.ReactNode
  confirm?: { title: string; description?: string; confirmLabel?: string }
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  className?: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = () =>
    start(async () => {
      const res = await action()
      if (!res.ok) toast.error(res.error)
      else {
        if (res.message) toast.success(res.message)
        router.refresh()
      }
    })

  if (confirm) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={variant} size={size} disabled={pending} className={className}>
            {pending && <Loader2 className="animate-spin" />}
            {children}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            {confirm.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run}>{confirm.confirmLabel ?? 'Confirm'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }
  return (
    <Button variant={variant} size={size} disabled={pending} onClick={run} className={className}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  )
}
