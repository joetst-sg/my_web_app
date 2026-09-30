import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { formatDate, timeAgo } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Submissions' }

const filters = [
  ['queue', 'Needs review', ['submitted', 'under_review']],
  ['changes_requested', 'Changes requested', ['changes_requested']],
  ['approved', 'Approved', ['approved']],
  ['scheduled', 'Scheduled', ['scheduled']],
  ['published', 'Published', ['published']],
  ['rejected', 'Rejected', ['rejected']],
  ['draft', 'Drafts', ['draft']],
  ['all', 'All', null],
] as const

export default async function AdminSubmissionsPage({ searchParams }: PageProps<'/admin/submissions'>) {
  const sp = await searchParams
  const current = filters.find(([k]) => k === sp.status) ?? filters[0]
  const supabase = await createClient()
  let q = supabase
    .from('submissions')
    .select('id, status, submitted_at, last_action_at, scheduled_for, seller_id, product:products ( id, name, images:product_images ( storage_path, position ), brand:brands ( name ) )')
  if (current[2]) q = q.in('status', [...current[2]])
  const { data } = await q.order(current[0] === 'queue' ? 'submitted_at' : 'last_action_at', { ascending: current[0] === 'queue', nullsFirst: false }).limit(200)
  const sellerIds = [...new Set((data ?? []).map((s) => s.seller_id).filter(Boolean))] as string[]
  const { data: sellers } = sellerIds.length ? await supabase.from('seller_profiles').select('user_id, company_name').in('user_id', sellerIds) : { data: [] }
  const sellerName = new Map((sellers ?? []).map((s) => [s.user_id, s.company_name]))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">Submissions</h1>
      <nav aria-label="Filter submissions" className="flex flex-wrap gap-1">
        {filters.map(([key, label]) => (
          <Link key={key} href={`/admin/submissions?status=${key}`} aria-current={current[0] === key ? 'page' : undefined} className={cn('rounded-full px-3 py-1.5 text-sm font-medium', current[0] === key ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-3 font-medium">Submission</th>
              <th className="p-3 font-medium">Product</th>
              <th className="p-3 font-medium">Seller</th>
              <th className="p-3 font-medium">Submitted</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Last action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).map((s) => {
              const img = [...(s.product?.images ?? [])].sort((a, b) => a.position - b.position)[0]
              return (
                <tr key={s.id} className="hover:bg-surface">
                  <td className="p-3 font-mono text-xs text-muted-foreground">{s.id.slice(0, 8)}</td>
                  <td className="p-3">
                    <Link href={`/admin/submissions/${s.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      {img ? <Image src={productImageUrl(img.storage_path)!} alt="" width={64} height={48} className="h-9 w-12 rounded object-cover" /> : <span className="h-9 w-12 rounded bg-muted" />}
                      <span>{s.product?.name}<span className="block text-xs font-normal text-muted-foreground">{s.product?.brand?.name}</span></span>
                    </Link>
                  </td>
                  <td className="p-3">{(s.seller_id && sellerName.get(s.seller_id)) ?? <span className="text-muted-foreground">Editorial</span>}</td>
                  <td className="p-3 text-muted-foreground">{s.submitted_at ? formatDate(s.submitted_at) : '—'}</td>
                  <td className="p-3"><SubmissionStatusBadge status={s.status} />{s.status === 'scheduled' && s.scheduled_for && <span className="ml-2 text-xs text-muted-foreground">{formatDate(s.scheduled_for)}</span>}</td>
                  <td className="p-3 text-muted-foreground">{timeAgo(s.last_action_at)}</td>
                </tr>
              )
            })}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No submissions here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
