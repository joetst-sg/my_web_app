import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters } from '@/lib/db/products'

export const metadata: Metadata = {
  title: 'All products',
  description: 'Browse every product on Loupe. Filter by category, brand, price, score and availability.',
  alternates: { canonical: '/products' },
}

export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const filters = parseFilters(await searchParams)
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Catalogue" title="All products" description="Every product our editors have reviewed and published." className="mb-8" />
      <ProductListing filters={filters} basePath="/products" />
    </div>
  )
}
