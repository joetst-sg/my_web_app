import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { ProductDetailView } from '@/components/product/product-detail-view'
import { requireViewer } from '@/lib/auth'
import { toProductView } from '@/lib/db/product-view'
import { getEditableProduct } from '@/lib/db/seller'
import type { ProductDetail } from '@/lib/db/products'
import { DeleteDraftButton } from './delete-draft'
import { getI18n, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.stats.product'), robots: { index: false } }
}

export default async function SellerProductPage({ params }: PageProps<'/seller/products/[id]'>) {
  const { id } = await params
  await requireViewer(`/seller/products/${id}`)
  const product = await getEditableProduct(id)
  if (!product) notFound()
  const { t, f, locale } = await getI18n()
  const editable = product.status === 'draft' || product.status === 'changes_requested'
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/seller/products" className="hover:text-foreground">{t('seller.nav.products')}</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.submission?.scheduled_for && product.submission.status === 'scheduled' && <>{t('seller.product.goesLive', { date: f.dateTime(product.submission.scheduled_for) })} · </>}
            {product.published_at && <>{t('seller.product.published', { date: f.dateTime(product.published_at) })} · </>}
            {t('seller.product.counts', { views: f.number(product.view_count), saves: f.number(product.save_count) })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {product.submission && <SubmissionStatusBadge status={product.submission.status} />}
          {editable && <Button asChild><Link href={`/seller/products/${product.id}/edit`}>{t('common.edit')}</Link></Button>}
          {product.submission && <Button asChild variant="outline"><Link href={`/seller/submissions/${product.submission.id}`}>{t('seller.product.submissionLink')}</Link></Button>}
          {product.status === 'published' && <Button asChild variant="outline"><Link href={`/products/${product.slug}`}>{t('common.viewLive')}</Link></Button>}
          {product.status === 'draft' && <DeleteDraftButton productId={product.id} />}
        </div>
      </div>
      <div className="rounded-3xl border p-4 sm:p-8">
        <ProductDetailView product={toProductView(product as unknown as ProductDetail, locale)} preview />
      </div>
    </div>
  )
}
