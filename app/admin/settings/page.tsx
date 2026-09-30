import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'

export const metadata: Metadata = { title: 'Settings' }

export default async function AdminSettingsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ data: settings }, { data: audit }] = await Promise.all([
    supabase.from('site_settings').select('key, value, updated_at'),
    supabase.from('audit_logs').select('id, action, entity_type, entity_id, created_at, metadata').order('created_at', { ascending: false }).limit(40),
  ])
  const get = (k: string) => settings?.find((s) => s.key === k)?.value
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">Settings</h1>
      <SettingsForm
        initial={{
          name: String(get('site.name') ?? 'Loupe'),
          tagline: String(get('site.tagline') ?? ''),
          submissionsOpen: get('submissions.open') !== false,
        }}
      />
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-1 font-sans text-base font-semibold tracking-normal">Configuration outside the app</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          <li>Email sending: set <code>EMAIL_PROVIDER_API_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in Vercel (see ENVIRONMENT.md).</li>
          <li>Auth email templates and CAPTCHA: Supabase dashboard → Authentication (needs custom SMTP on the free plan).</li>
          <li>Scheduled jobs (publishing, reminders, trending): pg_cron in Supabase, see DATABASE.md.</li>
        </ul>
      </section>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Audit log (latest 40)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <tbody className="divide-y">
              {(audit ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-4 text-muted-foreground">{formatDateTime(a.created_at)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{a.action}</td>
                  <td className="py-2 text-xs text-muted-foreground">{(a.metadata as { product_name?: string; name?: string })?.product_name ?? (a.metadata as { name?: string })?.name ?? `${a.entity_type} ${a.entity_id?.slice(0, 8) ?? ''}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
