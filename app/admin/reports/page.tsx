import type { Metadata } from 'next'
import Link from 'next/link'
import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, StatusPill } from '@/components/common/basics'
import { ActionButton } from '@/components/admin/action-button'
import { updateReport } from '@/lib/actions/admin'
import { labels, timeAgo } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Reports' }

const tone = { open: 'warning', reviewing: 'info', resolved: 'success', dismissed: 'neutral' } as const

export default async function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  const sp = await searchParams
  const showAll = sp.all === '1'
  const supabase = await createClient()
  let q = supabase.from('reports').select('id, reason, details, status, created_at, resolution_note, product:products ( id, name, slug )')
  if (!showAll) q = q.in('status', ['open', 'reviewing'])
  const { data } = await q.order('created_at', { ascending: false }).limit(200)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Reports</h1>
        <nav className="flex gap-1" aria-label="Filter reports">
          <Link href="/admin/reports" className={cn('rounded-full px-3 py-1.5 text-sm', !showAll ? 'bg-primary text-primary-foreground' : 'bg-background')}>Open</Link>
          <Link href="/admin/reports?all=1" className={cn('rounded-full px-3 py-1.5 text-sm', showAll ? 'bg-primary text-primary-foreground' : 'bg-background')}>All</Link>
        </nav>
      </div>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Flag} title="No open reports" description="Reports from users about broken links, wrong information or suspicious listings appear here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {data!.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={tone[r.status]}>{r.status}</StatusPill>
                <span className="font-medium">{labels.reportReason[r.reason]}</span>
                <span className="text-sm text-muted-foreground">on <Link href={`/admin/products/${r.product?.id}`} className="underline">{r.product?.name}</Link> · {timeAgo(r.created_at)}</span>
              </div>
              {r.details && <p className="mt-2 text-sm">{r.details}</p>}
              {r.resolution_note && <p className="mt-2 text-sm text-muted-foreground">Note: {r.resolution_note}</p>}
              {(r.status === 'open' || r.status === 'reviewing') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status === 'open' && <ActionButton size="sm" action={updateReport.bind(null, r.id, 'reviewing', undefined)}>Mark reviewing</ActionButton>}
                  <ActionButton size="sm" action={updateReport.bind(null, r.id, 'resolved', undefined)}>Resolve</ActionButton>
                  <ActionButton size="sm" variant="ghost" action={updateReport.bind(null, r.id, 'dismissed', undefined)}>Dismiss</ActionButton>
                  <Link href={`/products/${r.product?.slug}`} className="inline-flex h-7 items-center px-2 text-sm underline underline-offset-4">View listing</Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
