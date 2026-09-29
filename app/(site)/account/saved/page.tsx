import type { Metadata } from 'next'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { Button } from '@/components/ui/button'
import { requireViewer } from '@/lib/auth'
import { productsByIds } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'
import { SavedList } from './saved-list'

export const metadata: Metadata = { title: 'Saved products', robots: { index: false } }

export default async function SavedPage({ searchParams }: PageProps<'/account/saved'>) {
  const viewer = await requireViewer('/account/saved')
  const sp = await searchParams
  const sort = sp.sort === 'price_asc' || sp.sort === 'price_desc' || sp.sort === 'name' ? sp.sort : 'recent'
  const category = typeof sp.category === 'string' ? sp.category : undefined
  const supabase = await createClient()
  const { data: saves } = await supabase
    .from('product_saves')
    .select('product_id, created_at')
    .eq('user_id', viewer.id)
    .order('created_at', { ascending: false })
  const all = (await productsByIds((saves ?? []).map((s) => s.product_id))).filter((p) => p.status === 'published')
  const categories = [...new Map(all.filter((p) => p.category_slug).map((p) => [p.category_slug!, p.category_name!])).entries()]
  let items = category ? all.filter((p) => p.category_slug === category) : all
  if (sort === 'price_asc') items = [...items].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  if (sort === 'price_desc') items = [...items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
  if (sort === 'name') items = [...items].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))

  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Saved products</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{all.length} saved. Select products to move them into a collection.</p>
      {all.length === 0 ? (
        <EmptyState icon={Bookmark} title="Your saved products will appear here." description="Tap the bookmark on any product to save it for later." action={<Button asChild><Link href="/discover">Discover products</Link></Button>} />
      ) : (
        <SavedList products={items} categories={categories} sort={sort} category={category} />
      )}
    </div>
  )
}
