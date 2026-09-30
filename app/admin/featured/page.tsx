import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { X } from 'lucide-react'
import { ActionButton } from '@/components/admin/action-button'
import { moveFeatured, setFeatured } from '@/lib/actions/admin'
import { formatDate } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Featured' }

const placements = [
  ['hero', 'Homepage hero', 'The big product at the top of the homepage. Only the first is shown.'],
  ['featured_today', 'Featured today', 'Marked “Featured” on cards.'],
  ['featured_this_week', 'Featured this week', 'Shown at the top of Discover.'],
  ['editors_pick', "Editor's picks", 'Homepage editor’s picks section.'],
  ['coming_soon', 'Coming soon', 'Upcoming and crowdfunding products.'],
  ['trending', 'Trending (manual)', 'Optional manual boost; the Trending page itself is ranked automatically.'],
  ['new', 'New', 'Optional manual “New” placement.'],
  ['deal', 'Deal', 'Optional placement for deal promotions.'],
] as const

export default async function FeaturedPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('featured_products')
    .select('product_id, placement, position, ends_at, product:products ( name, slug, status, images:product_images ( storage_path, position ) )')
    .order('position')
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Featured content</h1>
        <p className="mt-1 text-muted-foreground">Placements are database fields, not hard-coded. Add products from a product’s edit page; reorder or remove them here.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {placements.map(([key, label, hint]) => {
          const items = (data ?? []).filter((f) => f.placement === key)
          const ids = items.map((i) => i.product_id)
          return (
            <section key={key} className="rounded-2xl border bg-background p-5">
              <h2 className="font-sans text-base font-semibold tracking-normal">{label} <span className="font-normal text-muted-foreground">({items.length})</span></h2>
              <p className="mb-3 text-sm text-muted-foreground">{hint}</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <ol className="divide-y rounded-xl border">
                  {items.map((f, i) => {
                    const img = [...(f.product?.images ?? [])].sort((a, b) => a.position - b.position)[0]
                    const up = [...ids]; if (i > 0) [up[i - 1], up[i]] = [up[i], up[i - 1]]
                    const down = [...ids]; if (i < ids.length - 1) [down[i + 1], down[i]] = [down[i], down[i + 1]]
                    return (
                      <li key={f.product_id} className="flex items-center gap-3 p-2.5">
                        <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                        {img && <Image src={productImageUrl(img.storage_path)!} alt="" width={64} height={48} className="h-8 w-11 rounded object-cover" />}
                        <span className="min-w-0 flex-1">
                          <Link href={`/admin/products/${f.product_id}`} className="block truncate text-sm font-medium hover:underline">{f.product?.name}</Link>
                          {(f.product?.status !== 'published' || f.ends_at) && (
                            <span className="text-xs text-muted-foreground">{f.product?.status !== 'published' ? 'Not published — hidden' : `Until ${formatDate(f.ends_at)}`}</span>
                          )}
                        </span>
                        <ActionButton size="icon-sm" variant="ghost" action={moveFeatured.bind(null, key, up)}><span aria-label="Move up">↑</span></ActionButton>
                        <ActionButton size="icon-sm" variant="ghost" action={moveFeatured.bind(null, key, down)}><span aria-label="Move down">↓</span></ActionButton>
                        <ActionButton size="icon-sm" variant="ghost" action={setFeatured.bind(null, f.product_id, key, false, null)}><X aria-label="Remove" /></ActionButton>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
