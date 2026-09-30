import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusPill } from '@/components/common/basics'
import { ActionButton } from '@/components/admin/action-button'
import { setUserRole, setUserSuspended } from '@/lib/actions/admin'
import { requireAdmin } from '@/lib/auth'
import { formatDateTime, labels } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'User' }

export default async function AdminUserPage({ params }: PageProps<'/admin/users/[id]'>) {
  const me = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: rows } = await supabase.rpc('admin_list_users', { page_limit: 200 })
  const user = rows?.find((u) => u.id === id)
  if (!user) notFound()
  const [{ data: seller }, { data: products }, { data: audit }, { data: settings }] = await Promise.all([
    supabase.from('seller_profiles').select('company_name, website, contact_email').eq('user_id', id).maybeSingle(),
    supabase.from('products').select('id, name, status').eq('seller_id', id).order('updated_at', { ascending: false }).limit(20),
    supabase.from('audit_logs').select('id, action, entity_type, metadata, created_at, actor_id').or(`actor_id.eq.${id},entity_id.eq.${id}`).order('created_at', { ascending: false }).limit(20),
    supabase.from('user_settings').select('suspended_reason').eq('user_id', id).maybeSingle(),
  ])
  const isSelf = me.id === id
  const roles = ['seller', 'editor', 'admin'] as const

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <p className="eyebrow"><Link href="/admin/users" className="hover:text-foreground">Users</Link></p>
        <h1 className="mt-1 font-display text-3xl font-bold">{user.display_name || user.username || user.email}</h1>
        <p className="text-muted-foreground">{user.email}{user.username && ` · @${user.username}`} · joined {formatDateTime(user.created_at)}</p>
      </div>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Roles</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const has = user.roles.includes(r)
            return (
              <ActionButton
                key={r}
                variant={has ? 'default' : 'outline'}
                action={setUserRole.bind(null, user.id, r, !has)}
                confirm={r === 'admin' || r === 'editor' ? { title: `${has ? 'Remove' : 'Grant'} ${r} role?`, description: r === 'admin' ? 'Admins have full access to everything.' : 'Editors can review, edit and publish any product.' } : undefined}
              >
                {has ? `✓ ${r}` : `+ ${r}`}
              </ActionButton>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Every account keeps the basic user role. Changes are recorded in the audit log.</p>
      </section>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Account status</h2>
        {user.suspended_at ? (
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill tone="danger">Suspended {formatDateTime(user.suspended_at)}</StatusPill>
            {settings?.suspended_reason && <span className="text-sm text-muted-foreground">{settings.suspended_reason}</span>}
            <ActionButton action={setUserSuspended.bind(null, user.id, false, undefined)}>Reactivate</ActionButton>
          </div>
        ) : isSelf ? (
          <p className="text-sm text-muted-foreground">This is your account.</p>
        ) : (
          <ActionButton variant="destructive" action={setUserSuspended.bind(null, user.id, true, 'Suspended by an administrator')} confirm={{ title: 'Suspend this account?', description: 'They can still log in and browse, but cannot save, submit, comment or upload.', confirmLabel: 'Suspend' }}>
            Suspend account
          </ActionButton>
        )}
      </section>
      {seller && (
        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Seller: {seller.company_name}</h2>
          <p className="text-sm text-muted-foreground">{seller.contact_email} {seller.website && `· ${seller.website}`}</p>
          <ul className="mt-3 divide-y rounded-xl border text-sm">
            {(products ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3">
                <Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link>
                <span className="text-muted-foreground">{labels.productStatus[p.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Recent audit log</h2>
        {(audit ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No recorded actions.</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {audit!.map((a) => (
              <li key={a.id} className="flex gap-3"><span className="w-40 shrink-0 text-muted-foreground">{formatDateTime(a.created_at)}</span><span className="font-mono text-xs">{a.action}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
