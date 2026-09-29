import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/format'

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
  const now = formatPrice(price, currency ?? 'USD')
  if (!now) return <span className={cn('text-sm text-muted-foreground', className)}>Price TBA</span>
  const was = originalPrice && price !== null && price !== undefined && originalPrice > price ? formatPrice(originalPrice, currency ?? 'USD') : null
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-mono tabular-nums', className)}>
      <span className={cn('font-semibold', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-base')}>{now}</span>
      {was && (
        <s className={cn('text-muted-foreground', size === 'lg' ? 'text-lg' : 'text-xs')}>
          <span className="sr-only">was </span>
          {was}
        </s>
      )}
    </span>
  )
}

export function DiscountBadge({ percent, className }: { percent: number | null | undefined; className?: string }) {
  if (!percent || percent <= 0) return null
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full bg-destructive px-2 text-xs font-semibold text-white tabular-nums', className)}>
      {percent}% off
    </span>
  )
}

export function RatingBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  if (score === null || score === undefined) return null
  return (
    <span
      className={cn('inline-flex h-6 items-center gap-1 rounded-full bg-highlight px-2 text-xs font-semibold text-highlight-foreground tabular-nums', className)}
      title={`Editorial score ${Number(score).toFixed(1)} out of 10`}
    >
      <Star className="size-3 fill-current" aria-hidden />
      {Number(score).toFixed(1)}
      <span className="sr-only"> out of 10</span>
    </span>
  )
}
