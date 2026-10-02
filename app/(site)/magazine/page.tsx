import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { ArticleCard } from '@/components/common/cards'
import { PageHeader } from '@/components/common/basics'
import { Pagination } from '@/components/common/pagination'
import { cn } from '@/lib/utils'
import { latestArticles } from '@/lib/db/content'
import { alternatesFor, getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'

const ARTICLE_TYPES = ['review', 'hands_on', 'buying_guide', 'news', 'roundup', 'how_to', 'interview'] as const

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('nav.magazine'), description: t('pages.magazine.meta'), alternates: await alternatesFor('/magazine') }
}

const PAGE = 12

export default async function MagazinePage({ searchParams }: PageProps<'/magazine'>) {
  const sp = await searchParams
  const t = await getT()
  const type = typeof sp.type === 'string' && (ARTICLE_TYPES as readonly string[]).includes(sp.type) ? sp.type : undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const { items, total } = await latestArticles(PAGE, (page - 1) * PAGE, type)
  const [lead, ...rest] = items
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('nav.magazine')} title={t('pages.magazine.title')} description={t('pages.magazine.description')} className="mb-8" />
      <nav aria-label={t('pages.magazine.type')} className="mb-10 flex flex-wrap gap-1">
        <Link href="/magazine" aria-current={!type ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-sm font-medium', !type ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>{t('pages.collections.all')}</Link>
        {ARTICLE_TYPES.map((value) => (
          <Link key={value} href={`/magazine?type=${value}`} aria-current={type === value ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-sm font-medium', type === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
            {t(`labels.articleType.${value}` as MessageKey)}
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
