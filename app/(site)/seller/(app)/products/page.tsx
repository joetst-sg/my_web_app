import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/basics'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { requireViewer } from '@/lib/auth'
import { formatPrice, timeAgo } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Your products', robots: { index: false } }

export default async function SellerProductsPage() {
  const viewer = await requireViewer('/seller/products')
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, slug, price, currency, status, updated_at, images:product_images ( storage_path, position ), submission:submissions ( id, status )')
    .eq('seller_id', viewer.id)
    .order('updated_at', { ascending: false })
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Products</h1>
          <p className="mt-1 text-muted-foreground">Drafts and changes-requested products can be edited. Others are locked while editors handle them.</p>
        </div>
        <Button asChild size="lg"><Link href="/seller/products/new"><Plus />New product</Link></Button>
      </div>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Package} title="You haven't submitted any products yet." action={<Button asChild><Link href="/seller/products/new">Create a product</Link></Button>} />
      ) : (
        <ul className="divide-y rounded-2xl border">
          {data!.map((p) => {
            const img = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]
            const sub = Array.isArray(p.submission) ? p.submission[0] : p.submission
            const editable = p.status === 'draft' || p.status === 'changes_requested'
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                {img ? (
                  <Image src={productImageUrl(img.storage_path)!} alt="" width={160} height={120} className="aspect-[4/3] w-24 rounded-lg object-cover" />
                ) : (
                  <div className="aspect-[4/3] w-24 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/seller/products/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                  <p className="text-sm text-muted-foreground">{formatPrice(p.price, p.currency) ?? 'No price yet'} · updated {timeAgo(p.updated_at)}</p>
                </div>
                {sub && <SubmissionStatusBadge status={sub.status} />}
                <div className="flex gap-2">
                  {editable && <Button asChild variant="outline"><Link href={`/seller/products/${p.id}/edit`}>Edit</Link></Button>}
                  {p.status === 'published' && <Button asChild variant="ghost"><Link href={`/products/${p.slug}`}>View live</Link></Button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
