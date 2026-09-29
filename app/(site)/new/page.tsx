import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters } from '@/lib/db/products'

export const metadata: Metadata = {
  title: 'New products',
  description: 'The latest products approved and published by our editors.',
  alternates: { canonical: '/new' },
}

export default async function NewPage({ searchParams }: PageProps<'/new'>) {
  const filters = parseFilters(await searchParams)
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="New" title="Just published" description="Recently approved and published, newest first." className="mb-8" />
      <ProductListing filters={filters} basePath="/new" defaultSort="newest" />
    </div>
  )
}
