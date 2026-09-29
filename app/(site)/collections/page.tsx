import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { Pagination } from '@/components/common/pagination'
import { cn } from '@/lib/utils'
import { publicCollections } from '@/lib/db/content'

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Curated sets of products from our editors and the community.',
  alternates: { canonical: '/collections' },
}

const PAGE = 24

export default async function CollectionsPage({ searchParams }: PageProps<'/collections'>) {
  const sp = await searchParams
  const tab = sp.tab === 'community' ? 'community' : sp.tab === 'editorial' ? 'editorial' : 'all'
  const page = Math.max(1, Number(sp.page) || 1)
  const { items, total } = await publicCollections({
    editorial: tab === 'all' ? undefined : tab === 'editorial',
    limit: PAGE,
    offset: (page - 1) * PAGE,
  })
  const tabs = [['all', 'All'], ['editorial', 'Editorial'], ['community', 'Community']] as const
  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Curated"
        title="Collections"
        description="Editorial round-ups and public collections from the community."
        actions={<Link href="/account/collections" className="text-sm font-medium underline underline-offset-4">Your collections</Link>}
        className="mb-8"
      />
      <nav aria-label="Collection type" className="mb-8 flex gap-1">
        {tabs.map(([value, label]) => (
          <Link
            key={value}
            href={value === 'all' ? '/collections' : `/collections?tab=${value}`}
            aria-current={tab === value ? 'page' : undefined}
            className={cn('rounded-full px-4 py-2 text-sm font-medium', tab === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {label}
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
