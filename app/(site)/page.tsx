import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { SectionHeader } from '@/components/common/basics'
import { ArticleCard, CategoryCard, CollectionCard } from '@/components/common/cards'
import { Hero } from '@/components/home/hero'
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid'
import { DiscountBadge, PriceDisplay } from '@/components/product/price'
import { dealCards, featuredCategories, featuredCollections, homepageSections, latestArticles } from '@/lib/db/content'
import {
  newestProducts, productsByIds, productsForPlacement, trendingProducts, viewerProductState, type ProductCardData,
} from '@/lib/db/products'
import { formatDate } from '@/lib/format'
import { productImageUrl } from '@/lib/images'

type Section = Awaited<ReturnType<typeof homepageSections>>[number]
type Config = { limit?: number; product_ids?: string[] }

export default async function HomePage() {
  const sections = await homepageSections()
  return (
    <div className="flex flex-col gap-20 pb-8">
      {sections.map((s) => (
        <Suspense key={s.id} fallback={s.type === 'hero' ? null : <div className="container-page"><ProductGridSkeleton count={4} /></div>}>
          <HomeSection section={s} />
        </Suspense>
      ))}
    </div>
  )
}

// Each section is configured in the admin CMS (/admin/content).
async function HomeSection({ section: s }: { section: Section }) {
  const config = (s.config ?? {}) as Config
  const limit = Math.min(config.limit ?? 8, 24)

  switch (s.type) {
    case 'hero': {
      const [hero] = await productsForPlacement('hero', 1)
      const product = hero ?? (await trendingProducts(1))[0]
      if (!product) return null
      const { saved } = await viewerProductState([product.id!])
      return <Hero product={product} isSaved={saved.has(product.id!)} />
    }
    case 'featured_categories': {
      const cats = await featuredCategories(limit)
      return (
        <section className="container-page">
          <SectionHeader title={s.title ?? 'Browse by category'} subtitle={s.subtitle} href="/categories" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {cats.map((c) => <CategoryCard key={c.id} category={c} className="min-h-40" />)}
          </div>
        </section>
      )
    }
    case 'trending_products':
      return <ProductSection title={s.title ?? 'Trending'} subtitle={s.subtitle} href="/trending" products={await trendingProducts(limit)} />
    case 'new_products':
      return <ProductSection title={s.title ?? 'New'} subtitle={s.subtitle} href="/new" products={await newestProducts(limit)} />
    case 'editors_picks':
      return (
        <ProductSection
          title={s.title ?? "Editor's picks"}
          subtitle={s.subtitle}
          href="/discover?featured=1"
          products={await productsForPlacement('editors_pick', limit)}
          columns={3}
        />
      )
    case 'product_list':
      return <ProductSection title={s.title ?? 'Products'} subtitle={s.subtitle} products={await productsByIds((config.product_ids ?? []).slice(0, limit))} />
    case 'featured_collections': {
      const cols = await featuredCollections(Math.min(limit, 8))
      if (cols.length === 0) return null
      return (
        <section className="container-page">
          <SectionHeader title={s.title ?? 'Collections'} subtitle={s.subtitle} href="/collections" />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {cols.map((c) => <CollectionCard key={c.id} collection={c} images={c.images} ownerName={c.ownerName} />)}
          </div>
        </section>
      )
    }
    case 'deals': {
      const deals = await dealCards({ status: 'active', limit })
      if (deals.length === 0) return null
      return (
        <section className="bg-surface py-14">
          <div className="container-page">
            <SectionHeader title={s.title ?? 'Deals'} subtitle={s.subtitle} href="/deals" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {deals.map((d) => (
                <Link key={d.deal_id} href={`/products/${d.slug}`} className="group flex gap-4 rounded-2xl border bg-background p-3 hover:border-foreground/30">
                  {d.image_path && (
                    <Image src={productImageUrl(d.image_path)!} alt="" width={240} height={180} className="aspect-[4/3] w-28 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="flex min-w-0 flex-col gap-1 py-1">
                    <span className="text-xs text-muted-foreground">{d.brand_name}</span>
                    <span className="line-clamp-2 font-semibold leading-snug group-hover:underline">{d.name}</span>
                    <span className="mt-auto flex flex-wrap items-center gap-2">
                      <PriceDisplay price={d.deal_price} originalPrice={d.original_price} currency={d.currency} size="sm" />
                      <DiscountBadge percent={d.discount_percent} className="h-5" />
                    </span>
                    {d.ends_at && <span className="text-xs text-muted-foreground">Ends {formatDate(d.ends_at)}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )
    }
    case 'magazine': {
      const { items } = await latestArticles(Math.min(limit, 6))
      if (items.length === 0) return null
      return (
        <section className="container-page">
          <SectionHeader title={s.title ?? 'Magazine'} subtitle={s.subtitle} href="/magazine" />
          <div className="grid gap-10 md:grid-cols-3">
            {items.map((a) => <ArticleCard key={a.id} article={a} authorName={a.authorName} />)}
          </div>
        </section>
      )
    }
    default:
      return null
  }
}

async function ProductSection({
  title,
  subtitle,
  href,
  products,
  columns = 4,
}: {
  title: string
  subtitle?: string | null
  href?: string
  products: ProductCardData[]
  columns?: 3 | 4
}) {
  if (products.length === 0) return null
  return (
    <section className="container-page">
      <SectionHeader title={title} subtitle={subtitle} href={href} />
      <ProductGrid products={products} columns={columns} />
    </section>
  )
}
