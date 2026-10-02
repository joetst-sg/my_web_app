import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/i18n/link'
import { Tag } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill } from '@/components/common/basics'
import { DiscountBadge, PriceDisplay } from '@/components/product/price'
import { cn } from '@/lib/utils'
import { dealCards } from '@/lib/db/content'
import { alternatesFor, getI18n } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { fromTranslations, localizeCard } from '@/lib/i18n/content'
import { productImageUrl } from '@/lib/images'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t('nav.deals'), description: t('pages.deals.meta'), alternates: await alternatesFor('/deals') }
}

const statuses = [['active', 'deals.active'], ['upcoming', 'deals.upcoming'], ['expired', 'deals.expired']] as const

export default async function DealsPage({ searchParams }: PageProps<'/deals'>) {
  const sp = await searchParams
  const { t, f, locale } = await getI18n()
  const status = (statuses.find(([s]) => s === sp.status)?.[0] ?? 'active') as 'active' | 'upcoming' | 'expired'
  const category = typeof sp.category === 'string' && /^[a-z0-9-]+$/.test(sp.category) ? sp.category : undefined
  const deals = (await dealCards({ status, category, limit: 60 })).map((d) => localizeCard(d, locale))
  const categories = [...new Map((await dealCards({ status, limit: 200 })).map((d) => [d.category_slug, fromTranslations(d.category_translations, 'name', locale, d.category_name)])).entries()]

  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('nav.deals')} title={t('pages.deals.title')} description={t('pages.deals.description')} className="mb-8" />
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {statuses.map(([value, label]) => (
          <Link
            key={value}
            href={value === 'active' ? '/deals' : `/deals?status=${value}`}
            aria-current={status === value ? 'page' : undefined}
            className={cn('rounded-full px-4 py-2 text-sm font-medium', status === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {t(label as MessageKey)}
          </Link>
        ))}
        <span className="mx-2 h-6 w-px bg-border" aria-hidden />
        {categories.map(([slug, name]) => (
          <Link
            key={slug}
            href={`/deals?${new URLSearchParams({ ...(status !== 'active' && { status }), ...(category !== slug && slug && { category: slug }) })}`}
            aria-current={category === slug ? 'true' : undefined}
            className={cn('rounded-full border px-3 py-1.5 text-sm', category === slug ? 'border-foreground bg-muted font-medium' : 'hover:border-foreground/30')}
          >
            {name}
          </Link>
        ))}
      </div>
      {deals.length === 0 ? (
        <EmptyState icon={Tag} title={t(`pages.deals.empty_${status}` as MessageKey)} description={t('pages.deals.emptyHint')} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <article key={d.deal_id} className="group relative flex flex-col overflow-hidden rounded-2xl border">
              {d.image_path && (
                <Image src={productImageUrl(d.image_path)!} alt={d.image_alt ?? d.name ?? ''} width={1200} height={900} sizes="(min-width: 1024px) 33vw, 50vw" className="aspect-[16/10] w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{d.brand_name}</span>
                  <StatusPill tone={d.deal_status === 'active' ? 'success' : d.deal_status === 'upcoming' ? 'info' : 'neutral'}>
                    {t(`deals.${d.deal_status}` as MessageKey)}
                  </StatusPill>
                </div>
                <h2 className="font-sans text-lg font-semibold leading-snug tracking-normal">
                  <Link href={`/products/${d.slug}`} className="after:absolute after:inset-0 hover:underline">{d.name}</Link>
                </h2>
                {d.title && <p className="text-sm text-muted-foreground">{d.title}</p>}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <PriceDisplay price={d.deal_price} originalPrice={d.original_price} currency={d.currency} />
                  <DiscountBadge percent={d.discount_percent} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.deal_status === 'upcoming' ? t('deals.startsOn', { date: f.date(d.starts_at) }) : d.ends_at ? t(d.deal_status === 'expired' ? 'deals.endedOn' : 'deals.endsOn', { date: f.date(d.ends_at) }) : t('deals.noEnd')}
                  {d.coupon_code && d.deal_status === 'active' && <> · {t('deals.code')} <span className="font-mono font-semibold text-foreground">{d.coupon_code}</span></>}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
