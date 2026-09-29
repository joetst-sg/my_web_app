import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { labels } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import type { ProductCardData } from '@/lib/db/products'
import { DiscountBadge, PriceDisplay, RatingBadge } from './price'
import { SaveButton } from './save-button'
import { ReminderButton } from './reminder-button'

export type ProductCardProps = {
  product: ProductCardData
  isSaved?: boolean
  hasReminder?: boolean
  showSave?: boolean
  showReminder?: boolean
  showPrice?: boolean
  priority?: boolean
  size?: 'default' | 'large'
  reason?: string | null
  className?: string
}

export function ProductCard({
  product: p,
  isSaved = false,
  hasReminder = false,
  showSave = true,
  showReminder = true,
  showPrice = true,
  priority = false,
  size = 'default',
  reason,
  className,
}: ProductCardProps) {
  const img = productImageUrl(p.image_path)
  const flag =
    p.availability && p.availability !== 'available'
      ? labels.availability[p.availability as keyof typeof labels.availability]
      : p.is_featured
        ? 'Featured'
        : p.is_trending
          ? 'Trending'
          : p.is_new
            ? 'New'
            : null

  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="relative overflow-hidden rounded-2xl bg-muted">
        <Link href={`/products/${p.slug}`} className="block focus-visible:outline-offset-4" tabIndex={-1} aria-hidden>
          {img ? (
            <Image
              src={img}
              alt={p.image_alt || p.name || ''}
              width={1200}
              height={900}
              priority={priority}
              sizes={size === 'large' ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw'}
              className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="aspect-[4/3] w-full" />
          )}
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {flag && (
            <span className="rounded-full bg-background/90 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide backdrop-blur">
              {flag}
            </span>
          )}
          <DiscountBadge percent={p.discount_percent} />
        </div>
        {(showSave || showReminder) && p.id && (
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:has-[[aria-pressed=true]]:opacity-100">
            {showSave && <SaveButton productId={p.id} productName={p.name ?? ''} initialSaved={isSaved} />}
            {showReminder && (
              <ReminderButton productId={p.id} productName={p.name ?? ''} availability={p.availability} initialSet={hasReminder} />
            )}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {p.brand_name}
            {p.category_name && <span aria-hidden> · </span>}
            {p.category_name}
          </span>
          <RatingBadge score={p.score} className="h-5" />
        </div>
        <h3 className={cn('font-sans font-semibold leading-snug tracking-normal', size === 'large' ? 'text-xl' : 'text-[0.95rem]')}>
          <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4">
            {p.name}
          </Link>
        </h3>
        {size === 'large' && p.tagline && <p className="text-sm text-muted-foreground">{p.tagline}</p>}
        {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
        {showPrice && (
          <PriceDisplay price={p.price} originalPrice={p.compare_at_price} currency={p.currency} size="sm" className="mt-auto pt-1" />
        )}
      </div>
    </article>
  )
}
