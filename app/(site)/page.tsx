import type { Metadata } from 'next'
import Image from 'next/image'
import { Suspense } from 'react'
import Link from '@/components/i18n/link'
import { SectionHeader } from '@/components/common/basics'
import { CategoryCard } from '@/components/common/cards'
import { Hero } from '@/components/home/hero'
import { ProductGrid, ProductGridSkeleton } from '@/components/product/product-grid'
import { DiscountBadge, PriceDisplay } from '@/components/product/price'
import { dealCards, featuredCategories, homepageSections } from '@/lib/db/content'
import {
  newestProducts, productsByIds, productsForPlacement, trendingProducts, viewerProductState, type ProductCardData,
} from '@/lib/db/products'
import { localized } from '@/lib/i18n/content'
import { alternatesFor, getI18n } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { productImageUrl } from '@/lib/images'

type Section = Awaited<ReturnType<typeof homepageSections>>[number]
type Config = { limit?: number; product_ids?: string[] }

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await alternatesFor('/') }
}

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

// Each section is configured in the admin CMS (/admin/content). Titles come
// from the database (with translations) or a translated default per type.
async function HomeSection({ section: s }: { section: Section }) {
  const { t, f, locale } = await getI18n()
  const config = (s.config ?? {}) as Config
  const limit = Math.min(config.limit ?? 8, 24)
  const title = localized(s, 'title', locale) || t(`home.sections.${s.type}` as MessageKey)
  const subtitle = localized(s, 'subtitle', locale) || null
  const viewAll = t('common.viewAll')

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
          <SectionHeader title={title} subtitle={subtitle} href="/categories" linkLabel={viewAll} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {cats.map((c) => <CategoryCard key={c.id} category={c} className="min-h-40" />)}
          </div>
        </section>
      )
    }
    case 'trending_products':
      return <ProductSection title={title} subtitle={subtitle} href="/trending" linkLabel={viewAll} products={await trendingProducts(limit)} />
    case 'new_products':
      return <ProductSection title={title} subtitle={subtitle} href="/new" linkLabel={viewAll} products={await newestProducts(limit)} />
    case 'editors_picks':
      return (
        <ProductSection
          title={title}
          subtitle={subtitle}
          href="/discover?featured=1"
          linkLabel={viewAll}
          products={await productsForPlacement('editors_pick', limit)}
          columns={3}
        />
      )
    case 'product_list':
      return <ProductSection title={title} subtitle={subtitle} products={await productsByIds((config.product_ids ?? []).slice(0, limit))} />
    case 'deals': {
      const deals = await dealCards({ status: 'active', limit })
      if (deals.length === 0) return null
      return (
        <section className="bg-surface py-14">
          <div className="container-page">
            <SectionHeader title={title} subtitle={subtitle} href="/deals" linkLabel={viewAll} />
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
                    {d.ends_at && <span className="text-xs text-muted-foreground">{t('deals.endsOn', { date: f.date(d.ends_at) })}</span>}
                  </div>
                </Link>
              ))}
            </div>
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
  linkLabel,
  products,
  columns = 4,
}: {
  title: string
  subtitle?: string | null
  href?: string
  linkLabel?: string
  products: ProductCardData[]
  columns?: 3 | 4
}) {
  if (products.length === 0) return null
  return (
    <section className="container-page">
      <SectionHeader title={title} subtitle={subtitle} href={href} linkLabel={linkLabel} />
      <ProductGrid products={products} columns={columns} />
    </section>
  )
}
