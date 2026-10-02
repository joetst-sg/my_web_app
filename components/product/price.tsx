'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormatters, useT } from '@/components/i18n/provider'

export function PriceDisplay({
  price,
  originalPrice,
  currency = 'USD',
  size = 'md',
  className,
}: {
  price: number | null | undefined
  originalPrice?: number | null
  currency?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const t = useT()
  const f = useFormatters()
  const now = f.price(price, currency ?? 'USD')
  if (!now) return <span className={cn('text-sm text-muted-foreground', className)}>{t('product.priceTba')}</span>
  const was = originalPrice && price !== null && price !== undefined && originalPrice > price ? f.price(originalPrice, currency ?? 'USD') : null
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-mono tabular-nums', className)}>
      <span className={cn('font-semibold', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-base')}>{now}</span>
      {was && (
        <s className={cn('text-muted-foreground', size === 'lg' ? 'text-lg' : 'text-xs')}>
          <span className="sr-only">{t('product.was')} </span>
          {was}
        </s>
      )}
    </span>
  )
}

export function DiscountBadge({ percent, className }: { percent: number | null | undefined; className?: string }) {
  const t = useT()
  if (!percent || percent <= 0) return null
  return (
    <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full bg-destructive px-2 text-xs font-semibold text-white tabular-nums', className)}>
      {t('product.percentOff', { percent })}
    </span>
  )
}

export function RatingBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const t = useT()
  if (score === null || score === undefined) return null
  const value = Number(score).toFixed(1)
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1 rounded-full bg-highlight px-2 text-xs font-semibold text-highlight-foreground tabular-nums', className)}
      title={t('product.scoreTitle', { score: value })}
    >
      <Star className="size-3 fill-current" aria-hidden />
      {value}
      <span className="sr-only"> {t('product.outOf10')}</span>
    </span>
  )
}
