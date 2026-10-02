import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { BadgeCheck, Globe } from 'lucide-react'
import { BrandMark, SectionHeader } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { FollowButton } from '@/components/common/follow-button'
import { TrackOnMount } from '@/components/common/track'
import { Button } from '@/components/ui/button'
import { ProductGrid } from '@/components/product/product-grid'
import { ProductListing } from '@/components/product/product-listing'
import { getViewer } from '@/lib/auth'
import { withCollectionImages } from '@/lib/db/content'
import { CARD_COLUMNS, parseFilters, type ProductCardData } from '@/lib/db/products'
import { hueFor } from '@/lib/images'
import { alternatesFor, getT } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

const getBrand = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('brands')
    .select('id, slug, name, tagline, description, logo_url, cover_url, website_url, social_links, is_verified, follower_count')
    .eq('slug', slug)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: PageProps<'/brands/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [b, t] = await Promise.all([getBrand(slug), getT()])
  if (!b) return { title: t('pages.brand.notFound') }
  return {
    title: t('pages.brand.metaTitle', { name: b.name }),
    description: b.tagline || b.description?.slice(0, 160) || undefined,
    alternates: await alternatesFor(`/brands/${b.slug}`),
  }
}

export default async function BrandPage({ params, searchParams }: PageProps<'/brands/[slug]'>) {
  const { slug } = await params
  const brand = await getBrand(slug)
  if (!brand) notFound()
  const filters = parseFilters(await searchParams)
  const supabase = await createClient()
  const [viewer, t] = await Promise.all([getViewer(), getT()])

  const [{ data: latest }, following, { data: productRows }] = await Promise.all([
    supabase.from('product_cards').select(CARD_COLUMNS).eq('status', 'published').eq('brand_id', brand.id).order('published_at', { ascending: false }).limit(4),
    viewer
      ? supabase.from('brand_followers').select('brand_id').eq('user_id', viewer.id).eq('brand_id', brand.id).maybeSingle().then((r) => Boolean(r.data))
      : Promise.resolve(false),
    supabase.from('products').select('id').eq('brand_id', brand.id).eq('status', 'published'),
  ])
  const ids = (productRows ?? []).map((p) => p.id)
  const { data: links } = ids.length ? await supabase.from('collection_products').select('collection_id').in('product_id', ids) : { data: [] }
  const collectionIds = [...new Set((links ?? []).map((l) => l.collection_id))]
  const { data: cols } = collectionIds.length
    ? await supabase
        .from('collections')
        .select('id, slug, title, description, product_count, is_editorial, visibility, owner_id, follower_count, updated_at')
        .in('id', collectionIds)
        .eq('visibility', 'public')
        .limit(4)
    : { data: [] }
  const collections = await withCollectionImages(cols ?? [])
  const hue = hueFor(brand.name)
  const socials = Object.entries((brand.social_links ?? {}) as Record<string, string>).filter(([, u]) => typeof u === 'string' && u.startsWith('https://'))

  return (
    <div>
      <TrackOnMount event={{ event: 'page_view', brandId: brand.id }} />
      <div
        className="h-40 sm:h-56"
        style={brand.cover_url ? { backgroundImage: `url(${brand.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: `linear-gradient(120deg, oklch(0.93 0.03 ${hue}), oklch(0.85 0.06 ${hue + 40}))` }}
        aria-hidden
      />
      <div className="container-page">
        <div className="-mt-12 flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <BrandMark name={brand.name} logoUrl={brand.logo_url} size={104} className="rounded-3xl border-4 border-background shadow-sm" />
            <div>
              <h1 className="flex items-center gap-2 font-display text-4xl font-bold">
                {brand.name}
                {brand.is_verified && <BadgeCheck className="size-6 text-[oklch(0.55_0.15_250)]" aria-label={t('common.verifiedBrand')} />}
              </h1>
              {brand.tagline && <p className="mt-1 text-lg text-muted-foreground">{brand.tagline}</p>}
              <p className="mt-1 text-sm text-muted-foreground">{t(ids.length === 1 ? 'common.productsOne' : 'common.productsMany', { count: ids.length })} · {t(brand.follower_count === 1 ? 'common.followersOne' : 'common.followersMany', { count: brand.follower_count })}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FollowButton kind="brand" id={brand.id} name={brand.name} initialFollowing={following} />
            {brand.website_url && (
              <Button asChild variant="outline" size="lg">
                <a href={brand.website_url} target="_blank" rel="noopener noreferrer nofollow"><Globe />{t('common.website')}</a>
              </Button>
            )}
            {socials.map(([network, url]) => (
              <Button key={network} asChild variant="ghost" size="lg">
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="capitalize">{network === 'x' ? 'X' : network}</a>
              </Button>
            ))}
          </div>
        </div>
        {brand.description && <p className="mt-8 max-w-3xl text-lg leading-relaxed">{brand.description}</p>}

        <div className="flex flex-col gap-16 py-12">
          {(latest ?? []).length > 0 && (
            <section>
              <SectionHeader title={t('pages.brand.latest')} />
              <ProductGrid products={(latest ?? []) as ProductCardData[]} priorityCount={4} />
            </section>
          )}
          <section>
            <SectionHeader title={t('pages.products.title')} />
            <ProductListing filters={filters} fixed={{ brand: slug }} basePath={`/brands/${slug}`} defaultSort="newest" />
          </section>
          {collections.length > 0 && (
            <section>
              <SectionHeader title={t('pages.brand.inCollections')} />
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {collections.map((c) => <CollectionCard key={c.id} collection={c} images={c.images} ownerName={c.ownerName} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
