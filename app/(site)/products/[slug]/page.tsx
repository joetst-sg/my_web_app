import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronRight } from 'lucide-react'
import Link from '@/components/i18n/link'
import { SectionHeader } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { TrackOnMount } from '@/components/common/track'
import { ProductDetailView } from '@/components/product/product-detail-view'
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid'
import { getViewer } from '@/lib/auth'
import { collectionsContainingProduct } from '@/lib/db/content'
import { toProductView } from '@/lib/db/product-view'
import { getProductBySlug, productsByIds } from '@/lib/db/products'
import { localizePath } from '@/lib/i18n/config'
import { localizeProduct } from '@/lib/i18n/content'
import { alternatesFor, getI18n } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { productImageUrl } from '@/lib/images'
import { site } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [raw, { t, locale }] = await Promise.all([getProductBySlug(slug), getI18n()])
  const p = raw && localizeProduct(raw, locale)
  if (!p || p.status !== 'published') return { title: t('productPage.notFound'), robots: { index: false } }
  const title = p.seo_title || (p.brand ? t('productPage.titleWithBrand', { name: p.name, brand: p.brand.name }) : p.name)
  const description = p.seo_description || p.tagline || undefined
  const image = productImageUrl(p.images[0]?.storage_path)
  const alternates = await alternatesFor(`/products/${p.slug}`)
  return {
    title,
    description,
    alternates,
    openGraph: {
      type: 'website',
      title,
      description,
      url: alternates.canonical,
      images: image ? [{ url: image, width: 1200, height: 900, alt: p.name }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  }
}

export default async function ProductPage({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params
  const [raw, { t, locale }] = await Promise.all([getProductBySlug(slug), getI18n()])
  // Unpublished products are visible only to their seller and staff (RLS);
  // they get a notice so it's clear the public can't see them yet.
  if (!raw) notFound()
  const product = localizeProduct(raw, locale)

  const view = toProductView(product, locale)
  const viewer = await getViewer()
  const supabase = await createClient()

  const viewerState = viewer
    ? await Promise.all([
        supabase.from('product_saves').select('product_id').eq('user_id', viewer.id).eq('product_id', product.id).maybeSingle(),
        supabase.from('reminders').select('id').eq('user_id', viewer.id).eq('product_id', product.id).eq('status', 'pending').limit(1),
        product.brand
          ? supabase.from('brand_followers').select('brand_id').eq('user_id', viewer.id).eq('brand_id', product.brand.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]).then(([s, r, f]) => ({ saved: Boolean(s.data), reminded: (r.data ?? []).length > 0, followsBrand: Boolean(f.data) }))
    : undefined

  const url = `${site.url}${localizePath(`/products/${product.slug}`, locale)}`
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.tagline ?? undefined,
      image: view.images.map((i) => i.src),
      sku: product.sku ?? undefined,
      brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
      category: view.category?.name,
      url,
      offers:
        view.price !== null && product.external_url
          ? {
              '@type': 'Offer',
              price: view.price,
              priceCurrency: view.currency,
              url: product.external_url,
              availability:
                product.availability === 'sold_out' ? 'https://schema.org/SoldOut'
                : product.availability === 'preorder' ? 'https://schema.org/PreOrder'
                : product.availability === 'discontinued' ? 'https://schema.org/Discontinued'
                : 'https://schema.org/InStock',
            }
          : undefined,
      review: view.score
        ? {
            '@type': 'Review',
            author: { '@type': 'Organization', name: site.name },
            reviewRating: { '@type': 'Rating', ratingValue: view.score.overall, bestRating: 10, worstRating: 0 },
          }
        : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('productPage.home'), item: `${site.url}${localizePath('/', locale)}` },
        ...(view.category ? [{ '@type': 'ListItem', position: 2, name: view.category.name, item: `${site.url}${localizePath(`/categories/${view.category.slug}`, locale)}` }] : []),
        { '@type': 'ListItem', position: view.category ? 3 : 2, name: product.name, item: url },
      ],
    },
  ]

  return (
    <div className="container-page py-6 sm:py-10">
      {product.status === 'published' ? (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
          <TrackOnMount event={{ event: 'product_view', productId: product.id }} />
        </>
      ) : (
        <div role="status" className="mb-6 rounded-xl border border-warning/40 bg-[oklch(0.97_0.04_80)] px-4 py-3 text-sm">
          {t('productPage.notPublic', { status: t(`labels.productStatus.${product.status}` as MessageKey) })}
        </div>
      )}
      <nav aria-label={t('productPage.breadcrumb')} className="mb-6 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link href="/" className="hover:text-foreground">{t('productPage.home')}</Link></li>
          {view.category && (
            <li className="flex items-center gap-1">
              <ChevronRight className="size-3.5" aria-hidden />
              <Link href={`/categories/${view.category.slug}`} className="hover:text-foreground">{view.category.name}</Link>
            </li>
          )}
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            <span aria-current="page" className="truncate text-foreground">{product.name}</span>
          </li>
        </ol>
      </nav>

      <ProductDetailView product={view} shareUrl={url} viewer={viewerState} />

      <Suspense fallback={<div className="mt-20"><ProductGridSkeleton count={4} /></div>}>
        <RelatedSections productId={product.id} />
      </Suspense>
    </div>
  )
}

// Streamed after the main product content.
async function RelatedSections({ productId }: { productId: string }) {
  const supabase = await createClient()
  const [{ data: related }, collections, { t }] = await Promise.all([
    supabase.rpc('related_products', { _product_id: productId, result_limit: 8 }),
    collectionsContainingProduct(productId),
    getI18n(),
  ])
  const relatedCards = await productsByIds((related ?? []).map((r) => r.product_id))
  return (
    <>
      {relatedCards.length > 0 && (
        <section className="mt-20">
          <SectionHeader title={t('productPage.related')} subtitle={t('productPage.relatedHint')} />
          <ProductGrid products={relatedCards.slice(0, 8)} />
        </section>
      )}
      {collections.length > 0 && (
        <section className="mt-20">
          <SectionHeader title={t('productPage.inCollections')} />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {collections.map((c) => <CollectionCard key={c.id} collection={c} images={c.images} ownerName={c.ownerName} />)}
          </div>
        </section>
      )}
    </>
  )
}
