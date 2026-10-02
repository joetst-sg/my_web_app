'use client'

import Link from '@/components/i18n/link'
import { useTransition } from 'react'
import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markNotificationsRead } from '@/lib/actions/account'
import { useT } from '@/components/i18n/provider'

export function MarkAllRead() {
  const [pending, start] = useTransition()
  const t = useT()
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => void (await markNotificationsRead()))}>
      <CheckCheck />
      {t('account.notifications.markAll')}
    </Button>
  )
}

export function MarkReadLink({ id, href, unread, children }: { id: string; href: string; unread: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className="hover:underline" onClick={() => unread && void markNotificationsRead([id])}>
      {children}
    </Link>
  )
}
