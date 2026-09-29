import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { ProductDetailView } from '@/components/product/product-detail-view'
import { requireViewer } from '@/lib/auth'
import { toProductView } from '@/lib/db/product-view'
import { getEditableProduct } from '@/lib/db/seller'
import type { ProductDetail } from '@/lib/db/products'
import { formatDateTime } from '@/lib/format'
import { DeleteDraftButton } from './delete-draft'

export const metadata: Metadata = { title: 'Product', robots: { index: false } }

export default async function SellerProductPage({ params }: PageProps<'/seller/products/[id]'>) {
  const { id } = await params
  await requireViewer(`/seller/products/${id}`)
  const product = await getEditableProduct(id)
  if (!product) notFound()
  const editable = product.status === 'draft' || product.status === 'changes_requested'
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/seller/products" className="hover:text-foreground">Products</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.submission?.scheduled_for && product.submission.status === 'scheduled' && <>Goes live {formatDateTime(product.submission.scheduled_for)} UTC · </>}
            {product.published_at && <>Published {formatDateTime(product.published_at)} · </>}
            {product.view_count} views · {product.save_count} saves
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {product.submission && <SubmissionStatusBadge status={product.submission.status} />}
          {editable && <Button asChild><Link href={`/seller/products/${product.id}/edit`}>Edit</Link></Button>}
          {product.submission && <Button asChild variant="outline"><Link href={`/seller/submissions/${product.submission.id}`}>Submission & messages</Link></Button>}
          {product.status === 'published' && <Button asChild variant="outline"><Link href={`/products/${product.slug}`}>View live</Link></Button>}
          {product.status === 'draft' && <DeleteDraftButton productId={product.id} />}
        </div>
      </div>
      <div className="rounded-3xl border p-4 sm:p-8">
        <ProductDetailView product={toProductView(product as unknown as ProductDetail)} preview />
      </div>
    </div>
  )
}
