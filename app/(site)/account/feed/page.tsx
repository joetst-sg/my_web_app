import type { Metadata } from 'next'
import Link from 'next/link'
import { Rss } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/common/pagination'
import { ProductGrid } from '@/components/product/product-grid'
import { productsByIds } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Your feed', robots: { index: false } }

const PAGE = 24

export default async function FeedPage({ searchParams }: PageProps<'/account/feed'>) {
  const sp = await searchParams
  const page = Math.max(1, Math.min(10, Number(sp.page) || 1))
  const supabase = await createClient()
  const { data } = await supabase.rpc('personal_feed', { result_limit: PAGE + 1, result_offset: (page - 1) * PAGE })
  const rows = (data ?? []).slice(0, PAGE)
  const products = await productsByIds(rows.map((r) => r.product_id))
  const reasons = new Map(rows.map((r) => [r.product_id, r.reason]))

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{sp.welcome ? 'Welcome — here’s your feed' : 'Your feed'}</h1>
          <p className="mt-1 text-muted-foreground">Picked from the brands and categories you follow, what you save, and what you’ve viewed.</p>
        </div>
        <Button asChild variant="outline"><Link href="/account/preferences">Edit interests</Link></Button>
      </div>
      {products.length === 0 ? (
        <EmptyState icon={Rss} title="Your feed is empty" description="Follow some categories or brands, or save a few products, and we'll fill this in." action={<Button asChild><Link href="/categories">Browse categories</Link></Button>} />
      ) : (
        <>
          <ProductGrid products={products} columns={3} reasons={reasons} priorityCount={3} />
          <Pagination className="mt-12" page={page} pageCount={(data ?? []).length > PAGE ? page + 1 : page} hrefFor={(p) => `/account/feed?page=${p}`} />
        </>
      )}
    </div>
  )
}
