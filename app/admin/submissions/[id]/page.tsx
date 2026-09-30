import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ExternalLink, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { SubmissionTimeline } from '@/components/common/submission-timeline'
import { ProductDetailView } from '@/components/product/product-detail-view'
import { toProductView } from '@/lib/db/product-view'
import { getEditableProduct } from '@/lib/db/seller'
import { getSubmission } from '@/lib/db/submissions'
import type { ProductDetail } from '@/lib/db/products'
import { formatDateTime, formatPrice, labels } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'
import { EditorMessage } from './editor-message'
import { ReviewActions } from './review-actions'

export const metadata: Metadata = { title: 'Review submission' }

export default async function ReviewSubmissionPage({ params }: PageProps<'/admin/submissions/[id]'>) {
  const { id } = await params
  const data = await getSubmission(id)
  if (!data) notFound()
  const { submission: s, timeline } = data
  const product = await getEditableProduct(s.product_id)
  if (!product) notFound()
  const supabase = await createClient()
  const [{ data: contact }, { data: dupes }] = await Promise.all([
    supabase.rpc('submission_seller_contact', { _submission_id: s.id }),
    supabase.rpc('find_duplicate_products', { _product_id: product.id }),
  ])
  const seller = contact?.[0]
  const view = toProductView(product as unknown as ProductDetail)

  const rows: [string, React.ReactNode][] = [
    ['Submission ID', <span key="id" className="font-mono text-xs">{s.id}</span>],
    ['Seller', seller ? <span key="s">{seller.company_name ?? '—'}<span className="block text-xs text-muted-foreground">{seller.contact_email ?? seller.email}</span></span> : 'Editorial'],
    ['Submitted', s.submitted_at ? formatDateTime(s.submitted_at) : '—'],
    ['Brand', product.brand?.name ?? '—'],
    ['Category', product.categories?.map((c) => c.category?.name).filter(Boolean).join(', ') || '—'],
    ['Price', `${formatPrice(product.price, product.currency) ?? '—'}${product.original_price ? ` (was ${formatPrice(product.original_price, product.currency)})` : ''}`],
    ['Availability', labels.availability[product.availability as keyof typeof labels.availability]],
    ['External URL', product.external_url ? <a key="u" href={product.external_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">{product.external_url}</a> : '—'],
    ['SKU / model', product.sku ?? '—'],
    ['Tags', (product.tags ?? []).map((t) => t.tag?.name).filter(Boolean).join(', ') || '—'],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/admin/submissions" className="hover:text-foreground">Submissions</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubmissionStatusBadge status={s.status} />
          {s.status === 'scheduled' && s.scheduled_for && <span className="text-sm text-muted-foreground">Goes live {formatDateTime(s.scheduled_for)} UTC</span>}
          <Button asChild variant="outline"><Link href={`/admin/products/${product.id}`}><Pencil />Edit product</Link></Button>
          {product.status === 'published' && <Button asChild variant="outline"><Link href={`/products/${product.slug}`}><ExternalLink />View live</Link></Button>}
        </div>
      </div>

      <section className="rounded-2xl border bg-background p-4">
        <h2 className="sr-only">Review actions</h2>
        <ReviewActions submissionId={s.id} status={s.status} />
      </section>

      <div className="grid gap-6 2xl:grid-cols-[minmax(380px,0.8fr)_1.2fr]">
        {/* LEFT: submitted information */}
        <div className="flex flex-col gap-6">
          {(dupes ?? []).length > 0 && (
            <section role="status" className="rounded-2xl border border-warning/50 bg-[oklch(0.97_0.04_80)] p-4">
              <h2 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal"><AlertTriangle className="size-4" />Possible duplicates</h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {dupes!.map((d) => (
                  <li key={d.product_id}>
                    <Link href={`/admin/products/${d.product_id}`} className="font-medium underline">{d.name}</Link>
                    {d.brand_name && ` (${d.brand_name})`} · {labels.productStatus[d.status as keyof typeof labels.productStatus]} · {d.reasons.join(', ')} · {Math.round(d.similarity * 100)}% name match
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Not rejected automatically. Reject as a duplicate, or approve if it’s a different product.</p>
            </section>
          )}
          <section className="rounded-2xl border bg-background">
            <h2 className="border-b p-4 font-sans text-base font-semibold tracking-normal">Submitted information</h2>
            <dl className="divide-y text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-2xl border bg-background p-4">
            <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Images ({product.images.length})</h2>
            <ul className="grid grid-cols-3 gap-2">
              {product.images.map((img) => (
                <li key={img.id}>
                  <a href={productImageUrl(img.storage_path)!} target="_blank" rel="noopener noreferrer">
                    <Image src={productImageUrl(img.storage_path)!} alt={img.alt ?? ''} width={300} height={225} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  </a>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">{img.width}×{img.height}{img.alt ? '' : ' · no alt text'}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border bg-background p-4">
            <h2 className="mb-2 font-sans text-base font-semibold tracking-normal">Description</h2>
            <p className="whitespace-pre-line text-sm">{product.description}</p>
          </section>
          <section className="flex flex-col gap-4 rounded-2xl border bg-background p-4">
            <h2 className="font-sans text-base font-semibold tracking-normal">Review history & messages</h2>
            <SubmissionTimeline entries={timeline} />
            <EditorMessage submissionId={s.id} />
          </section>
        </div>

        {/* RIGHT: live preview */}
        <section aria-label="Live preview" className="rounded-2xl border bg-background p-4 sm:p-6 2xl:sticky 2xl:top-20 2xl:max-h-[calc(100dvh-6rem)] 2xl:overflow-y-auto">
          <p className="eyebrow mb-4">Live preview — what visitors will see</p>
          <ProductDetailView product={view} preview />
        </section>
      </div>
    </div>
  )
}
