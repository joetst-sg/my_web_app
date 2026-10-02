import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { BellRing } from 'lucide-react'
import { EmptyState, StatusPill } from '@/components/common/basics'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CancelReminder } from './cancel-reminder'
import { getI18n, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('account.nav.reminders'), robots: { index: false } }
}

const typeLabel = { launch: 'account.reminders.launch', sale: 'account.reminders.sale', custom: 'account.reminders.custom' } as const

export default async function RemindersPage() {
  const viewer = await requireViewer('/account/reminders')
  const supabase = await createClient()
  const { t, f } = await getI18n()
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
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('account.nav.reminders')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('account.reminders.intro')}</p>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={BellRing} title={t('account.reminders.emptyTitle')} description={t('account.reminders.emptyBody')} />
      ) : (
        <div className="flex flex-col gap-10">
          {[[t('account.reminders.active'), pending], [t('account.reminders.sent'), sent]].map(([title, rows]) =>
            (rows as typeof pending).length ? (
              <section key={title as string}>
                <h2 className="mb-3 font-sans text-lg font-semibold tracking-normal">{title as string}</h2>
                <ul className="divide-y rounded-2xl border">
                  {(rows as typeof pending).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${r.product?.slug}`} className="font-medium hover:underline">{r.product?.name}</Link>
                        <p className="text-sm text-muted-foreground">
                          {t(typeLabel[r.type])}
                          {r.type === 'custom' && r.remind_at && ` · ${f.dateTime(r.remind_at)} UTC`}
                          {r.sent_at && ` · ${t('account.reminders.sentAt', { date: f.dateTime(r.sent_at) })}`}
                        </p>
                      </div>
                      <StatusPill tone={r.status === 'pending' ? 'info' : 'success'}>{r.status === 'pending' ? t('account.reminders.waiting') : t('account.reminders.sent')}</StatusPill>
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
