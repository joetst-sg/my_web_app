'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function LoginPrompt({
  open,
  onOpenChange,
  reason = 'save products, build collections and get reminders',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: string
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  const next = encodeURIComponent(pathname + (search.size ? `?${search}` : ''))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log in to continue</DialogTitle>
          <DialogDescription>Create a free account to {reason}.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button asChild size="lg">
            <Link href={`/signup?next=${next}`}>Create account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/login?next=${next}`}>Log in</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
