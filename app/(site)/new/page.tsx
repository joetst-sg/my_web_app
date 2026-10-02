import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { ProductListing } from '@/components/product/product-listing'
import { parseFilters } from '@/lib/db/products'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('pages.new.metaTitle'), description: t('pages.new.meta'), alternates: await alternatesFor('/new') }
}

export default async function NewPage({ searchParams }: PageProps<'/new'>) {
  const [filters, t] = await Promise.all([searchParams.then(parseFilters), getT()])
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('nav.new')} title={t('pages.new.title')} description={t('pages.new.description')} className="mb-8" />
      <ProductListing filters={filters} basePath="/new" defaultSort="newest" />
    </div>
  )
}
