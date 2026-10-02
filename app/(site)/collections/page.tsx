import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { PageHeader } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { Pagination } from '@/components/common/pagination'
import { cn } from '@/lib/utils'
import { publicCollections } from '@/lib/db/content'
import { alternatesFor, getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('nav.collections'), description: t('pages.collections.meta'), alternates: await alternatesFor('/collections') }
}

const PAGE = 24

export default async function CollectionsPage({ searchParams }: PageProps<'/collections'>) {
  const sp = await searchParams
  const tab = sp.tab === 'community' ? 'community' : sp.tab === 'editorial' ? 'editorial' : 'all'
  const page = Math.max(1, Number(sp.page) || 1)
  const t = await getT()
  const { items, total } = await publicCollections({
    editorial: tab === 'all' ? undefined : tab === 'editorial',
    limit: PAGE,
    offset: (page - 1) * PAGE,
  })
  const tabs: [string, MessageKey][] = [['all', 'pages.collections.all'], ['editorial', 'pages.collections.editorial'], ['community', 'pages.collections.community']]
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow={t('pages.collections.eyebrow')}
        title={t('nav.collections')}
        description={t('pages.collections.description')}
        actions={<Link href="/account/collections" className="text-sm font-medium underline underline-offset-4">{t('pages.collections.yours')}</Link>}
        className="mb-8"
      />
      <nav aria-label={t('pages.collections.type')} className="mb-8 flex gap-1">
        {tabs.map(([value, label]) => (
          <Link
            key={value}
            href={value === 'all' ? '/collections' : `/collections?tab=${value}`}
            aria-current={tab === value ? 'page' : undefined}
            className={cn('rounded-full px-4 py-2 text-sm font-medium', tab === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {t(label)}
          </Link>
        ))}
      </nav>
      <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((c) => <CollectionCard key={c.id} collection={c} images={c.images} ownerName={c.ownerName} />)}
      </div>
      <Pagination
        className="mt-12"
        page={page}
        pageCount={Math.ceil(total / PAGE)}
        hrefFor={(p) => `/collections?${new URLSearchParams({ ...(tab !== 'all' && { tab }), ...(p > 1 && { page: String(p) }) })}`}
      />
    </div>
  )
}
