import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Tag } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill } from '@/components/common/basics'
import { DiscountBadge, PriceDisplay } from '@/components/product/price'
import { cn } from '@/lib/utils'
import { dealCards } from '@/lib/db/content'
import { formatDate } from '@/lib/format'
import { productImageUrl } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Deals',
  description: 'Verified discounts and limited-time offers on products reviewed by our editors.',
  alternates: { canonical: '/deals' },
}

const statuses = [['active', 'Active'], ['upcoming', 'Upcoming'], ['expired', 'Expired']] as const

export default async function DealsPage({ searchParams }: PageProps<'/deals'>) {
  const sp = await searchParams
  const status = (statuses.find(([s]) => s === sp.status)?.[0] ?? 'active') as 'active' | 'upcoming' | 'expired'
  const category = typeof sp.category === 'string' && /^[a-z0-9-]+$/.test(sp.category) ? sp.category : undefined
  const deals = await dealCards({ status, category, limit: 60 })
  const categories = [...new Map((await dealCards({ status, limit: 200 })).map((d) => [d.category_slug, d.category_name])).entries()]

  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Deals" title="Deals worth knowing about" description="Price drops and offers on products we cover. We check every deal before listing it." className="mb-8" />
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {statuses.map(([value, label]) => (
          <Link
            key={value}
            href={value === 'active' ? '/deals' : `/deals?status=${value}`}
            aria-current={status === value ? 'page' : undefined}
            className={cn('rounded-full px-4 py-2 text-sm font-medium', status === value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {label}
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
        <EmptyState icon={Tag} title={`No ${status} deals right now`} description="Set a sale reminder on any product and we'll tell you when its price drops." />
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
                    {d.deal_status === 'active' ? 'Active' : d.deal_status === 'upcoming' ? 'Upcoming' : 'Expired'}
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
                  {d.deal_status === 'upcoming' ? `Starts ${formatDate(d.starts_at)}` : d.ends_at ? `${d.deal_status === 'expired' ? 'Ended' : 'Ends'} ${formatDate(d.ends_at)}` : 'No end date'}
                  {d.coupon_code && d.deal_status === 'active' && <> · Code <span className="font-mono font-semibold text-foreground">{d.coupon_code}</span></>}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
