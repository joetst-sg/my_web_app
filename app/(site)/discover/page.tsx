import type { Metadata } from 'next'
import { PageHeader, SectionHeader } from '@/components/common/basics'
import { ProductGrid } from '@/components/product/product-grid'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters, productsForPlacement } from '@/lib/db/products'

export const metadata: Metadata = {
  title: 'Discover',
  description: "This week's featured products, editor's picks and everything else worth a closer look.",
  alternates: { canonical: '/discover' },
}

export default async function DiscoverPage({ searchParams }: PageProps<'/discover'>) {
  const filters = parseFilters(await searchParams)
  const filtered = Object.entries(filters).some(([k, v]) => k !== 'sort' && k !== 'page' && v !== undefined && v !== false)
  const featured = filtered ? [] : await productsForPlacement('featured_this_week', 4)
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Discover" title="Worth a closer look" description="Featured products this week, then the full catalogue ranked by what people are exploring right now." className="mb-10" />
      {featured.length > 0 && (
        <section className="mb-16">
          <SectionHeader title="Featured this week" />
          <ProductGrid products={featured} priorityCount={4} />
        </section>
      )}
      <ProductListing filters={filters} basePath="/discover" />
    </div>
  )
}
