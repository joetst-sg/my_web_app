import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

// Goes through /go/product/[id], which validates the product, records the
// click and redirects to the maker's https URL.
export function BuyButton({
  productId,
  label = 'Buy now',
  className,
  size = 'lg',
}: {
  productId: string
  label?: string
  className?: string
  size?: 'lg' | 'default'
}) {
  return (
    <a
      href={`/go/product/${productId}`}
      target="_blank"
      rel="nofollow noopener sponsored"
      className={cn(buttonVariants({ size }), size === 'lg' && 'h-11 rounded-full px-5 text-[0.95rem]', className)}
    >
      {label}
      <ArrowUpRight />
      <span className="sr-only"> (opens the maker&apos;s website in a new tab)</span>
    </a>
  )
}
