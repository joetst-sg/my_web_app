import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/common/basics'
import { Pagination } from '@/components/common/pagination'
import { requireAdmin } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Users' }

const PAGE = 50

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  await requireAdmin()
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : ''
  const page = Math.max(1, Number(sp.page) || 1)
  const supabase = await createClient()
  const { data } = await supabase.rpc('admin_list_users', { search: q || undefined, page_limit: PAGE, page_offset: (page - 1) * PAGE })
  const total = Number(data?.[0]?.total_count ?? 0)
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">Users <span className="text-lg font-normal text-muted-foreground">({total})</span></h1>
      <form className="flex gap-2" action="/admin/users">
        <label htmlFor="q" className="sr-only">Search users</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Email, username or name" className="h-9 w-72 bg-background" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b"><th className="p-3 font-medium">User</th><th className="p-3 font-medium">Roles</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Joined</th><th className="p-3 font-medium">Last sign-in</th></tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).map((u) => (
              <tr key={u.id} className="hover:bg-surface">
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.display_name || u.username || u.email}</Link>
                  <span className="block text-xs text-muted-foreground">{u.email}{u.username && ` · @${u.username}`}</span>
                </td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{u.roles.filter((r) => r !== 'user').map((r) => <StatusPill key={r} tone={r === 'admin' ? 'danger' : r === 'editor' ? 'info' : 'accent'}>{r}</StatusPill>)}</div></td>
                <td className="p-3">
                  {u.suspended_at ? <StatusPill tone="danger">Suspended</StatusPill> : u.email_confirmed_at ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="warning">Unconfirmed</StatusPill>}
                </td>
                <td className="p-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="p-3 text-muted-foreground">{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.ceil(total / PAGE)} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(q && { q }), page: String(p) })}`} />
    </div>
  )
}
