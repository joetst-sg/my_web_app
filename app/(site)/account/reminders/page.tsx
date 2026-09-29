import type { Metadata } from 'next'
import Link from 'next/link'
import { BellRing } from 'lucide-react'
import { EmptyState, StatusPill } from '@/components/common/basics'
import { requireViewer } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { CancelReminder } from './cancel-reminder'

export const metadata: Metadata = { title: 'Reminders', robots: { index: false } }

const typeLabel = { launch: 'When it launches', sale: 'When it goes on sale', custom: 'On a date' } as const

export default async function RemindersPage() {
  const viewer = await requireViewer('/account/reminders')
  const supabase = await createClient()
  const { data } = await supabase
    .from('reminders')
    .select('id, type, remind_at, status, sent_at, created_at, product:products ( name, slug )')
    .eq('user_id', viewer.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  const pending = (data ?? []).filter((r) => r.status === 'pending')
  const sent = (data ?? []).filter((r) => r.status === 'sent')

  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Reminders</h1>
      <p className="mb-8 mt-1 text-muted-foreground">We notify you in the app, and by email if you have email updates on.</p>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={BellRing} title="No reminders yet" description="Use “Remind me” on a product to hear when it launches or goes on sale." />
      ) : (
        <div className="flex flex-col gap-10">
          {[['Active', pending], ['Sent', sent]].map(([title, rows]) =>
            (rows as typeof pending).length ? (
              <section key={title as string}>
                <h2 className="mb-3 font-sans text-lg font-semibold tracking-normal">{title as string}</h2>
                <ul className="divide-y rounded-2xl border">
                  {(rows as typeof pending).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${r.product?.slug}`} className="font-medium hover:underline">{r.product?.name}</Link>
                        <p className="text-sm text-muted-foreground">
                          {typeLabel[r.type]}
                          {r.type === 'custom' && r.remind_at && ` · ${formatDateTime(r.remind_at)} UTC`}
                          {r.sent_at && ` · sent ${formatDateTime(r.sent_at)}`}
                        </p>
                      </div>
                      <StatusPill tone={r.status === 'pending' ? 'info' : 'success'}>{r.status === 'pending' ? 'Waiting' : 'Sent'}</StatusPill>
                      {r.status === 'pending' && <CancelReminder id={r.id} />}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}
