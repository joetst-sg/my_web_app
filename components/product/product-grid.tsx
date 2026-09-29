import { cn } from '@/lib/utils'
import type { ProductCardData } from '@/lib/db/products'
import { viewerProductState } from '@/lib/db/products'
import { ProductCard, type ProductCardProps } from './product-card'

// Server component: renders cards with the viewer's saved/reminder state
// fetched in one query (no N+1).
export async function ProductGrid({
  products,
  columns = 4,
  className,
  cardProps,
  reasons,
  priorityCount = 0,
}: {
  products: ProductCardData[]
  columns?: 2 | 3 | 4
  className?: string
  cardProps?: Partial<ProductCardProps>
  reasons?: Map<string, string>
  priorityCount?: number
}) {
  const { saved, reminded } = await viewerProductState(products.map((p) => p.id!).filter(Boolean))
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6',
        columns === 4 && 'md:grid-cols-3 xl:grid-cols-4',
        columns === 3 && 'md:grid-cols-3',
        columns === 2 && 'md:grid-cols-2',
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          product={p}
          isSaved={saved.has(p.id!)}
          hasReminder={reminded.has(p.id!)}
          priority={i < priorityCount}
          reason={reasons?.get(p.id!)}
          {...cardProps}
        />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
