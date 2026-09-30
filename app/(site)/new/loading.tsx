import { ProductGridSkeleton } from '@/components/product/product-grid'

export default function Loading() {
  return (
    <div className="container-page py-10" aria-busy="true">
      <div className="mb-8 h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <ProductGridSkeleton count={8} />
    </div>
  )
}
