'use client'

import { ArrowUpRight } from 'lucide-react'
import { useT } from '@/components/i18n/provider'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

// Goes through /go/product/[id], which validates the product, records the
// click and redirects to the maker's https URL.
export function BuyButton({
  productId,
  label,
  className,
  size = 'lg',
}: {
  productId: string
  label?: string
  className?: string
  size?: 'lg' | 'default'
}) {
  const t = useT()
  return (
    <a
      href={`/go/product/${productId}`}
      target="_blank"
      rel="nofollow noopener sponsored"
      className={cn(buttonVariants({ size }), size === 'lg' && 'h-11 rounded-full px-5 text-[0.95rem]', className)}
    >
      {label ?? t('product.buyNow')}
      <ArrowUpRight />
      <span className="sr-only"> {t('product.opensMakerSite')}</span>
    </a>
  )
}
