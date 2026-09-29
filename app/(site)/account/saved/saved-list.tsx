'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PriceDisplay } from '@/components/product/price'
import { listMyCollections, setInCollection, toggleSave } from '@/lib/actions/engagement'
import { productImageUrl } from '@/lib/images'
import type { ProductCardData } from '@/lib/db/products'

export function SavedList({
  products,
  categories,
  sort,
  category,
}: {
  products: ProductCardData[]
  categories: [string, string][]
  sort: string
  category?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collections, setCollections] = useState<{ id: string; title: string }[] | null>(null)
  const [pending, start] = useTransition()

  function nav(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams({ ...(sort !== 'recent' && { sort }), ...(category && { category }) })
    for (const [k, v] of Object.entries(updates)) v ? sp.set(k, v) : sp.delete(k)
    router.replace(`${pathname}${sp.size ? `?${sp}` : ''}`)
  }

  function remove(ids: string[]) {
    start(async () => {
      const results = await Promise.all(ids.map((id) => toggleSave(id, false)))
      const failed = results.find((r) => !r.ok)
      if (failed && !failed.ok) toast.error(failed.error)
      else toast.success(ids.length === 1 ? 'Removed from saved' : `Removed ${ids.length} products`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function loadCollections() {
    if (collections) return
    start(async () => {
      const res = await listMyCollections()
      if (res.ok) setCollections(res.data)
    })
  }

  function moveTo(collectionId: string) {
    const ids = [...selected]
    start(async () => {
      const results = await Promise.all(ids.map((id) => setInCollection(collectionId, id, true)))
      const failed = results.find((r) => !r.ok)
      if (failed && !failed.ok) {
        toast.error(failed.error)
        return
      }
      const title = collections?.find((c) => c.id === collectionId)?.title
      toast.success(`Added ${ids.length} product${ids.length === 1 ? '' : 's'} to “${title}”`)
      setSelected(new Set())
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category ?? 'all'} onValueChange={(v) => nav({ category: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-10 w-48" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(([slug, name]) => <SelectItem key={slug} value={slug}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => nav({ sort: v === 'recent' ? undefined : v })}>
          <SelectTrigger className="h-10 w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently saved</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="price_asc">Lowest price</SelectItem>
            <SelectItem value="price_desc">Highest price</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Select onOpenChange={(o) => o && loadCollections()} onValueChange={moveTo}>
              <SelectTrigger className="h-10 w-52" aria-label="Move to collection"><SelectValue placeholder="Move to collection…" /></SelectTrigger>
              <SelectContent>
                {collections === null ? (
                  <SelectItem value="loading" disabled>Loading…</SelectItem>
                ) : collections.length === 0 ? (
                  <SelectItem value="none" disabled>Create a collection first</SelectItem>
                ) : (
                  collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <Button variant="destructive" className="h-10" disabled={pending} onClick={() => remove([...selected])}>
              <Trash2 />Remove
            </Button>
          </div>
        )}
      </div>
      <ul className="divide-y rounded-2xl border">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-4 p-3 sm:p-4">
            <Checkbox
              aria-label={`Select ${p.name}`}
              checked={selected.has(p.id!)}
              onCheckedChange={(v) => {
                const next = new Set(selected)
                if (v) next.add(p.id!)
                else next.delete(p.id!)
                setSelected(next)
              }}
            />
            {p.image_path && (
              <Image src={productImageUrl(p.image_path)!} alt="" width={160} height={120} className="aspect-[4/3] w-20 rounded-lg object-cover sm:w-28" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{p.brand_name} · {p.category_name}</p>
              <Link href={`/products/${p.slug}`} className="font-semibold hover:underline">{p.name}</Link>
              <div><PriceDisplay price={p.price} originalPrice={p.compare_at_price} currency={p.currency} size="sm" /></div>
            </div>
            <Button variant="ghost" size="icon-lg" aria-label={`Remove ${p.name} from saved`} disabled={pending} onClick={() => remove([p.id!])}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
