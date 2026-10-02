import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { Rss } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/common/pagination'
import { ProductGrid } from '@/components/product/product-grid'
import { productsByIds } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('account.nav.feed'), robots: { index: false } }
}

const PAGE = 24

// personal_feed() explains each pick in English; show it in the visitor's language.
const REASON_KEYS: Record<string, MessageKey> = {
  'From a brand you follow': 'account.feed.reasons.brand',
  'In a category you follow': 'account.feed.reasons.category',
  'Similar to products you saved': 'account.feed.reasons.similar',
  'Trending now': 'account.feed.reasons.trending',
}

export default async function FeedPage({ searchParams }: PageProps<'/account/feed'>) {
  const sp = await searchParams
  const page = Math.max(1, Math.min(10, Number(sp.page) || 1))
  const supabase = await createClient()
  const t = await getT()
  const { data } = await supabase.rpc('personal_feed', { result_limit: PAGE + 1, result_offset: (page - 1) * PAGE })
  const rows = (data ?? []).slice(0, PAGE)
  const products = await productsByIds(rows.map((r) => r.product_id))
  const reasons = new Map(rows.map((r) => [r.product_id, REASON_KEYS[r.reason] ? t(REASON_KEYS[r.reason]) : r.reason]))

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{sp.welcome ? t('account.feed.welcome') : t('account.nav.feed')}</h1>
          <p className="mt-1 text-muted-foreground">{t('account.feed.intro')}</p>
        </div>
        <Button asChild variant="outline"><Link href="/account/preferences">{t('account.feed.editInterests')}</Link></Button>
      </div>
      {products.length === 0 ? (
        <EmptyState icon={Rss} title={t('account.feed.emptyTitle')} description={t('account.feed.emptyBody')} action={<Button asChild><Link href="/categories">{t('account.feed.browseCategories')}</Link></Button>} />
      ) : (
        <>
          <ProductGrid products={products} columns={3} reasons={reasons} priorityCount={3} />
          <Pagination className="mt-12" page={page} pageCount={(data ?? []).length > PAGE ? page + 1 : page} hrefFor={(p) => `/account/feed?page=${p}`} />
        </>
      )}
    </div>
  )
}
