import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache, Suspense } from 'react'
import Link from '@/components/i18n/link'
import { SectionHeader } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { CategoryIcon } from '@/components/common/category-icon'
import { FollowButton } from '@/components/common/follow-button'
import { TrackOnMount } from '@/components/common/track'
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid'
import { ProductListing } from '@/components/product/product-listing'
import { getViewer } from '@/lib/auth'
import { withCollectionImages } from '@/lib/db/content'
import { categoryIdsForSlug, CARD_COLUMNS, parseFilters, type ProductCardData } from '@/lib/db/products'
import { localized } from '@/lib/i18n/content'
import { alternatesFor, getI18n } from '@/lib/i18n/server'
import { createClient } from '@/lib/supabase/server'

const getCategory = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, description, color, icon, parent_id, seo_title, seo_description, follower_count, translations')
    .eq('slug', slug)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: PageProps<'/categories/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [c, { t, locale }] = await Promise.all([getCategory(slug), getI18n()])
  if (!c) return { title: t('categoryPage.notFound') }
  const name = localized(c, 'name', locale)
  const title = localized(c, 'seo_title', locale) || t('categoryPage.metaTitle', { name })
  const description = localized(c, 'seo_description', locale) || localized(c, 'description', locale) || undefined
  return {
    title,
    description,
    alternates: await alternatesFor(`/categories/${c.slug}`),
    openGraph: { title, description },
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/categories/[slug]'>) {
  const { slug } = await params
  const [category, { t, locale }] = await Promise.all([getCategory(slug), getI18n()])
  if (!category) notFound()
  const filters = parseFilters(await searchParams)
  const supabase = await createClient()
  const viewer = await getViewer()
  const name = localized(category, 'name', locale)
  const description = localized(category, 'description', locale)

  const [{ data: children }, { data: parent }, following] = await Promise.all([
    supabase.from('categories').select('slug, name, translations').eq('parent_id', category.id).order('sort_order'),
    category.parent_id ? supabase.from('categories').select('slug, name, translations').eq('id', category.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    viewer
      ? supabase.from('category_followers').select('category_id').eq('user_id', viewer.id).eq('category_id', category.id).maybeSingle().then((r) => Boolean(r.data))
      : Promise.resolve(false),
  ])
  const unfiltered = !Object.entries(filters).some(([k, v]) => k !== 'page' && v !== undefined && v !== false)

  return (
    <div>
      <TrackOnMount event={{ event: 'page_view', categoryId: category.id }} />
      <section className="border-b" style={{ background: `color-mix(in oklch, ${category.color ?? '#475467'} 9%, white)` }}>
        <div className="container-page flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            {parent && (
              <Link href={`/categories/${parent.slug}`} className="eyebrow hover:text-foreground">{localized(parent, 'name', locale)}</Link>
            )}
            <div className="mt-2 flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: category.color ?? '#475467' }}>
                <CategoryIcon name={category.icon} className="size-7" />
              </span>
              <h1 className="font-display text-4xl font-bold sm:text-5xl">{name}</h1>
            </div>
            {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
            {(children ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {children!.map((c) => (
                  <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium hover:border-foreground/30">{localized(c, 'name', locale)}</Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{t(category.follower_count === 1 ? 'common.followersOne' : 'common.followersMany', { count: category.follower_count })}</span>
            <FollowButton kind="category" id={category.id} name={name} initialFollowing={following} />
          </div>
        </div>
      </section>

      <div className="container-page flex flex-col gap-16 py-12">
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <CategoryBody slug={slug} categoryId={category.id} name={name} filters={filters} unfiltered={unfiltered} />
        </Suspense>
      </div>
    </div>
  )
}

async function CategoryBody({ slug, categoryId, name, filters, unfiltered }: { slug: string; categoryId: string; name: string; filters: ReturnType<typeof parseFilters>; unfiltered: boolean }) {
  const supabase = await createClient()
  const [ids, { t, locale }] = await Promise.all([categoryIdsForSlug(slug), getI18n()])
  const [{ data: trending }, { data: siblings }] = await Promise.all([
    unfiltered
      ? supabase.from('product_cards').select(CARD_COLUMNS).eq('status', 'published').overlaps('category_ids', ids).order('popularity_score', { ascending: false }).limit(4)
      : Promise.resolve({ data: [] }),
    supabase.from('categories').select('slug, name, translations').is('parent_id', null).neq('id', categoryId).order('sort_order').limit(8),
  ])
  return (
    <>
      {unfiltered && (trending ?? []).length > 0 && (
        <section>
          <SectionHeader title={t('categoryPage.trendingIn', { name })} />
          <ProductGrid products={(trending ?? []) as ProductCardData[]} priorityCount={4} />
        </section>
      )}
      <section>
        <SectionHeader title={t('categoryPage.all', { name })} />
        <ProductListing filters={filters} fixed={{ category: slug }} basePath={`/categories/${slug}`} />
      </section>
      <Suspense fallback={null}>
        <CategoryCollections ids={ids} />
      </Suspense>
      <section>
        <h2 className="eyebrow mb-3">{t('categoryPage.related')}</h2>
        <div className="flex flex-wrap gap-2">
          {(siblings ?? []).map((c) => (
            <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-foreground/30">{localized(c, 'name', locale)}</Link>
          ))}
        </div>
      </section>
    </>
  )
}

// Public collections featuring products from this category.
async function CategoryCollections({ ids }: { ids: string[] }) {
  const supabase = await createClient()
  const { data: links } = await supabase.from('product_categories').select('product_id').in('category_id', ids).limit(200)
  const productIds = (links ?? []).map((l) => l.product_id)
  const { data: colLinks } = productIds.length
    ? await supabase.from('collection_products').select('collection_id').in('product_id', productIds).limit(200)
    : { data: [] }
  const collectionIds = [...new Set((colLinks ?? []).map((c) => c.collection_id))]
  const { data: cols } = collectionIds.length
    ? await supabase
        .from('collections')
        .select('id, slug, title, description, product_count, is_editorial, visibility, owner_id, follower_count, updated_at')
        .in('id', collectionIds)
        .eq('visibility', 'public')
        .order('is_editorial', { ascending: false })
        .limit(4)
    : { data: [] }
  const [collections, { t }] = await Promise.all([withCollectionImages(cols ?? []), getI18n()])
  if (collections.length === 0) return null
  return (
    <section>
      <SectionHeader title={t('nav.collections')} />
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {collections.map((c) => <CollectionCard key={c.id} collection={c} images={c.images} ownerName={c.ownerName} />)}
      </div>
    </section>
  )
}
