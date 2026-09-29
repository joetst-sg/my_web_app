import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { requireViewer } from '@/lib/auth'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { MarkAllRead, MarkReadLink } from './mark-read'

export const metadata: Metadata = { title: 'Notifications', robots: { index: false } }

export default async function NotificationsPage({ searchParams }: PageProps<'/account/notifications'>) {
  const viewer = await requireViewer('/account/notifications')
  const sp = await searchParams
  const unreadOnly = sp.filter === 'unread'
  const supabase = await createClient()
  let q = supabase.from('notifications').select('id, type, title, body, link, read_at, created_at').eq('user_id', viewer.id)
  if (unreadOnly) q = q.is('read_at', null)
  const { data } = await q.order('created_at', { ascending: false }).limit(100)
  const unread = (data ?? []).filter((n) => !n.read_at).length

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Notifications</h1>
          <p className="mt-1 text-muted-foreground">
            <Link href="/account/notifications" className={cn(!unreadOnly && 'font-medium text-foreground')}>All</Link> ·{' '}
            <Link href="/account/notifications?filter=unread" className={cn(unreadOnly && 'font-medium text-foreground')}>Unread</Link>
          </p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </div>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Bell} title={unreadOnly ? "You're all caught up" : 'No notifications yet'} description="Reminders, price drops and submission updates appear here." />
      ) : (
        <ul className="divide-y rounded-2xl border">
          {data!.map((n) => (
            <li key={n.id} className={cn('flex gap-3 p-4', !n.read_at && 'bg-surface')}>
              <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-highlight')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {n.link ? <MarkReadLink id={n.id} href={n.link} unread={!n.read_at}>{n.title}</MarkReadLink> : n.title}
                  {!n.read_at && <span className="sr-only"> (unread)</span>}
                </p>
                {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
