'use client'

import { useSearchParams } from 'next/navigation'
import Link from '@/components/i18n/link'
import { useT } from '@/components/i18n/provider'
import { usePathname } from '@/components/i18n/use-pathname'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MessageKey } from '@/lib/i18n/translate'

export function LoginPrompt({
  open,
  onOpenChange,
  reason = 'loginPrompt.reasonDefault',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason?: MessageKey
}) {
  const t = useT()
  const pathname = usePathname()
  const search = useSearchParams()
  const next = encodeURIComponent(pathname + (search.size ? `?${search}` : ''))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('loginPrompt.title')}</DialogTitle>
          <DialogDescription>{t(reason)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button asChild size="lg">
            <Link href={`/signup?next=${next}`}>{t('nav.createAccount')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/login?next=${next}`}>{t('nav.login')}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
