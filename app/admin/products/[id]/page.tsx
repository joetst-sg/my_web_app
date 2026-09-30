import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, FileCheck2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SubmissionStatusBadge } from '@/components/common/submission-status'
import { MediaManager } from '@/components/seller/media-manager'
import { getEditableProduct } from '@/lib/db/seller'
import { createClient } from '@/lib/supabase/server'
import { ProductEditor } from './product-editor'

export const metadata: Metadata = { title: 'Edit product' }

export default async function AdminProductPage({ params }: PageProps<'/admin/products/[id]'>) {
  const { id } = await params
  const product = await getEditableProduct(id)
  if (!product) notFound()
  const supabase = await createClient()
  const [{ data: categories }, { data: featured }, { data: deals }] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id, sort_order').order('sort_order'),
    supabase.from('featured_products').select('placement').eq('product_id', id),
    supabase.from('deals').select('id, title, deal_price, starts_at, ends_at, coupon_code').eq('product_id', id).order('starts_at', { ascending: false }),
  ])
  const primary = product.categories?.find((c) => c.is_primary)?.category ?? product.categories?.[0]?.category
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow"><Link href="/admin/products" className="hover:text-foreground">Products</Link></p>
          <h1 className="mt-1 font-display text-3xl font-bold">{product.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {product.submission && <SubmissionStatusBadge status={product.submission.status} />}
          {product.submission && <Button asChild variant="outline"><Link href={`/admin/submissions/${product.submission.id}`}><FileCheck2 />Review & workflow</Link></Button>}
          {product.status === 'published' && <Button asChild variant="outline"><Link href={`/products/${product.slug}`}><ExternalLink />View live</Link></Button>}
          <Button asChild variant="outline"><Link href={`/seller/products/${product.id}/edit?step=4`}>Features & specs</Link></Button>
        </div>
      </div>
      <section aria-labelledby="images-h" className="rounded-2xl border bg-background p-5">
        <h2 id="images-h" className="mb-4 font-sans text-base font-semibold tracking-normal">Images & video</h2>
        <MediaManager
          mode="standalone"
          productId={product.id}
          initialImages={product.images}
          initialVideos={product.videos.map((v) => v.url)}
        />
      </section>
      <ProductEditor
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          tagline: product.tagline,
          description: product.description,
          external_url: product.external_url,
          price: product.price === null ? null : Number(product.price),
          original_price: product.original_price === null ? null : Number(product.original_price),
          currency: product.currency,
          availability: product.availability,
          seo_title: product.seo_title,
          seo_description: product.seo_description,
          category_id: primary?.id ?? null,
        }}
        categories={categories ?? []}
        score={product.score ? { ...product.score, overall: Number(product.score.overall) } as never : null}
        placements={(featured ?? []).map((f) => f.placement)}
        deals={(deals ?? []).map((d) => ({ ...d, deal_price: Number(d.deal_price) }))}
      />
    </div>
  )
}
