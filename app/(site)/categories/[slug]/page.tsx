import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { SectionHeader } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { CategoryIcon } from '@/components/common/category-icon'
import { FollowButton } from '@/components/common/follow-button'
import { TrackOnMount } from '@/components/common/track'
import { ProductGrid } from '@/components/product/product-grid'
import { ProductListing } from '@/components/product/product-listing'
import { getViewer } from '@/lib/auth'
import { withCollectionImages } from '@/lib/db/content'
import { categoryIdsForSlug, CARD_COLUMNS, parseFilters, type ProductCardData } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'

const getCategory = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name, description, color, icon, parent_id, seo_title, seo_description, follower_count')
    .eq('slug', slug)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: PageProps<'/categories/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const c = await getCategory(slug)
  if (!c) return { title: 'Category not found' }
  return {
    title: c.seo_title || `${c.name} products`,
    description: c.seo_description || c.description || undefined,
    alternates: { canonical: `/categories/${c.slug}` },
    openGraph: { title: c.seo_title || c.name, description: c.seo_description || c.description || undefined },
  }
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/categories/[slug]'>) {
  const { slug } = await params
  const category = await getCategory(slug)
  if (!category) notFound()
  const filters = parseFilters(await searchParams)
  const supabase = await createClient()
  const viewer = await getViewer()
  const ids = await categoryIdsForSlug(slug)

  const [{ data: children }, { data: parent }, { data: siblings }, { data: trending }, following, { data: links }] = await Promise.all([
    supabase.from('categories').select('slug, name').eq('parent_id', category.id).order('sort_order'),
    category.parent_id ? supabase.from('categories').select('slug, name').eq('id', category.parent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('categories').select('slug, name').is('parent_id', null).neq('id', category.id).order('sort_order').limit(8),
    supabase.from('product_cards').select(CARD_COLUMNS).eq('status', 'published').overlaps('category_ids', ids).order('popularity_score', { ascending: false }).limit(4),
    viewer
      ? supabase.from('category_followers').select('category_id').eq('user_id', viewer.id).eq('category_id', category.id).maybeSingle().then((r) => Boolean(r.data))
      : Promise.resolve(false),
    supabase.from('product_categories').select('product_id').in('category_id', ids).limit(200),
  ])

  // Public collections featuring products from this category.
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
  const collections = await withCollectionImages(cols ?? [])
  const unfiltered = !Object.entries(filters).some(([k, v]) => k !== 'page' && v !== undefined && v !== false)

  return (
    <div>
      <TrackOnMount event={{ event: 'page_view', categoryId: category.id }} />
      <section className="border-b" style={{ background: `color-mix(in oklch, ${category.color ?? '#475467'} 9%, white)` }}>
        <div className="container-page flex flex-col gap-6 py-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            {parent && (
              <Link href={`/categories/${parent.slug}`} className="eyebrow hover:text-foreground">{parent.name}</Link>
            )}
            <div className="mt-2 flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl text-white" style={{ background: category.color ?? '#475467' }}>
                <CategoryIcon name={category.icon} className="size-7" />
              </span>
              <h1 className="font-display text-4xl font-bold sm:text-5xl">{category.name}</h1>
            </div>
            {category.description && <p className="mt-4 text-lg text-muted-foreground">{category.description}</p>}
            {(children ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {children!.map((c) => (
                  <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium hover:border-foreground/30">{c.name}</Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{category.follower_count} followers</span>
            <FollowButton kind="category" id={category.id} name={category.name} initialFollowing={following} />
          </div>
        </div>
      </section>

      <div className="container-page flex flex-col gap-16 py-12">
        {unfiltered && (trending ?? []).length > 0 && (
          <section>
            <SectionHeader title={`Trending in ${category.name}`} />
            <ProductGrid products={(trending ?? []) as ProductCardData[]} priorityCount={4} />
          </section>
        )}
        <section>
          <SectionHeader title={`All ${category.name}`} />
          <ProductListing filters={filters} fixed={{ category: slug }} basePath={`/categories/${slug}`} />
        </section>
        {collections.length > 0 && (
          <section>
            <SectionHeader title="Collections" />
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {collections.map((c) => <CollectionCard key={c.id} collection={c} images={c.images} ownerName={c.ownerName} />)}
            </div>
          </section>
        )}
        <section>
          <h2 className="eyebrow mb-3">Related categories</h2>
          <div className="flex flex-wrap gap-2">
            {(siblings ?? []).map((c) => (
              <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-foreground/30">{c.name}</Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
