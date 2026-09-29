'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { markNotificationsRead } from '@/lib/actions/account'

export function MarkAllRead() {
  const [pending, start] = useTransition()
  return (
    <Button variant="outline" disabled={pending} onClick={() => start(async () => void (await markNotificationsRead()))}>
      <CheckCheck />
      Mark all as read
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
