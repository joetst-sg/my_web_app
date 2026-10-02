import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters } from '@/lib/db/products'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('pages.trending.metaTitle'), description: t('pages.trending.meta'), alternates: await alternatesFor('/trending') }
}

export default async function TrendingPage({ searchParams }: PageProps<'/trending'>) {
  const [filters, t] = await Promise.all([searchParams.then(parseFilters), getT()])
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('nav.trending')} title={t('pages.trending.title')} description={t('pages.trending.description')} className="mb-8" />
      <ProductListing filters={filters} basePath="/trending" defaultSort="trending" />
    </div>
  )
}
