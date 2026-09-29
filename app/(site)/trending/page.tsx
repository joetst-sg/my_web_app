import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters } from '@/lib/db/products'

export const metadata: Metadata = {
  title: 'Trending products',
  description: 'The products people are saving, sharing and clicking through to most right now.',
  alternates: { canonical: '/trending' },
}

export default async function TrendingPage({ searchParams }: PageProps<'/trending'>) {
  const filters = parseFilters(await searchParams)
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Trending"
        title="Trending now"
        description="Ranked by a popularity score that weighs saves, collection adds, click-throughs, shares and views, with recent activity counting most. Updated every 10 minutes."
        className="mb-8"
      />
      <ProductListing filters={filters} basePath="/trending" defaultSort="trending" />
    </div>
  )
}
