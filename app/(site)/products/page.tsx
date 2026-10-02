import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters } from '@/lib/db/products'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('pages.products.title'), description: t('pages.products.meta'), alternates: await alternatesFor('/products') }
}

export default async function ProductsPage({ searchParams }: PageProps<'/products'>) {
  const [filters, t] = await Promise.all([searchParams.then(parseFilters), getT()])
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('pages.products.eyebrow')} title={t('pages.products.title')} description={t('pages.products.description')} className="mb-8" />
      <ProductListing filters={filters} basePath="/products" />
    </div>
  )
}
