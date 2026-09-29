import type { Metadata } from 'next'
import Link from 'next/link'
import { FileClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/basics'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { requireViewer } from '@/lib/auth'
import { formatDate, timeAgo } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Submissions', robots: { index: false } }

export default async function SellerSubmissionsPage() {
  const viewer = await requireViewer('/seller/submissions')
  const supabase = await createClient()
  const { data } = await supabase
    .from('submissions')
    .select('id, status, submitted_at, last_action_at, scheduled_for, product:products ( id, name )')
    .eq('seller_id', viewer.id)
    .order('last_action_at', { ascending: false })
  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Submissions</h1>
      <p className="mb-8 mt-1 text-muted-foreground">Track each product through editorial review.</p>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={FileClock} title="You haven't submitted any products yet." action={<Button asChild><Link href="/seller/products/new">Create a product</Link></Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs text-muted-foreground">
              <tr><th className="p-4 font-medium">Product</th><th className="p-4 font-medium">Status</th><th className="p-4 font-medium">Submitted</th><th className="p-4 font-medium">Last update</th></tr>
            </thead>
            <tbody className="divide-y">
              {data!.map((s) => (
                <tr key={s.id} className="hover:bg-surface">
                  <td className="p-4"><Link href={`/seller/submissions/${s.id}`} className="font-medium hover:underline">{s.product?.name}</Link></td>
                  <td className="p-4"><SubmissionStatusBadge status={s.status} />{s.status === 'scheduled' && s.scheduled_for && <span className="ml-2 text-xs text-muted-foreground">{formatDate(s.scheduled_for)}</span>}</td>
                  <td className="p-4 text-muted-foreground">{s.submitted_at ? formatDate(s.submitted_at) : '—'}</td>
                  <td className="p-4 text-muted-foreground">{timeAgo(s.last_action_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
