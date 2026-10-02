import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/common/basics'
import { ProductGrid } from '@/components/product/product-grid'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters, productsForPlacement } from '@/lib/db/products'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('pages.discover.metaTitle'), description: t('pages.discover.meta'), alternates: await alternatesFor('/discover') }
}

export default async function DiscoverPage({ searchParams }: PageProps<'/discover'>) {
  const [filters, t] = await Promise.all([searchParams.then(parseFilters), getT()])
  const filtered = Object.entries(filters).some(([k, v]) => k !== 'sort' && k !== 'page' && v !== undefined && v !== false)
  const featured = filtered ? [] : await productsForPlacement('featured_this_week', 4)
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('nav.discover')} title={t('pages.discover.title')} description={t('pages.discover.description')} className="mb-10" />
      {featured.length > 0 && (
        <section className="mb-16">
          <SectionHeader title={t('pages.discover.featuredWeek')} />
          <ProductGrid products={featured} priorityCount={4} />
        </section>
      )}
      <ProductListing filters={filters} basePath="/discover" />
    </div>
  )
}
