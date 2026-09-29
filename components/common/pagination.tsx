import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  pageCount,
  hrefFor,
  className,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  className?: string
}) {
  if (pageCount <= 1) return null
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount))
  const sorted = [...pages].sort((a, b) => a - b)
  const item = 'grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-medium'
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, 'hover:bg-muted')} rel="prev" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, 'text-muted-foreground/50')} aria-hidden>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && sorted[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
          {p === page ? (
            <span aria-current="page" className={cn(item, 'bg-primary text-primary-foreground')}>{p}</span>
          ) : (
            <Link href={hrefFor(p)} className={cn(item, 'hover:bg-muted')}>{p}</Link>
          )}
        </span>
      ))}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(item, 'hover:bg-muted')} rel="next" aria-label="Next page">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, 'text-muted-foreground/50')} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  )
}
