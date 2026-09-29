import type { Metadata } from 'next'
import Link from 'next/link'
import { ArticleCard } from '@/components/common/cards'
import { PageHeader } from '@/components/common/basics'
import { Pagination } from '@/components/common/pagination'
import { cn } from '@/lib/utils'
import { latestArticles } from '@/lib/db/content'
import { labels } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Magazine',
  description: 'Reviews, hands-on impressions, buying guides, news and interviews from the Loupe editors.',
  alternates: { canonical: '/magazine' },
}

const PAGE = 12

export default async function MagazinePage({ searchParams }: PageProps<'/magazine'>) {
  const sp = await searchParams
  const type = typeof sp.type === 'string' && sp.type in labels.articleType ? sp.type : undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const { items, total } = await latestArticles(PAGE, (page - 1) * PAGE, type)
  const [lead, ...rest] = items
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Magazine" title="Reviews, guides & stories" description="Written by editors who use the products before we write about them." className="mb-8" />
      <nav aria-label="Article type" className="mb-10 flex flex-wrap gap-1">
        <Link href="/magazine" aria-current={!type ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-sm font-medium', !type ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>All</Link>
        {Object.entries(labels.articleType).map(([value, label]) => (
          <Link key={value} href={`/magazine?type=${value}`} aria-current={type === value ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-sm font-medium', type === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
            {label}
          </Link>
        ))}
      </nav>
      {lead && page === 1 && (
        <ArticleCard article={lead} authorName={lead.authorName} className="mb-14 md:grid md:grid-cols-[1.4fr_1fr] md:items-center md:gap-10 [&_h3]:text-3xl" />
      )}
      <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {(page === 1 ? rest : items).map((a) => <ArticleCard key={a.id} article={a} authorName={a.authorName} />)}
      </div>
      <Pagination className="mt-12" page={page} pageCount={Math.ceil(total / PAGE)} hrefFor={(p) => `/magazine?${new URLSearchParams({ ...(type && { type }), ...(p > 1 && { page: String(p) }) })}`} />
    </div>
  )
}
