'use client'

import Image from 'next/image'
import Link from '@/components/i18n/link'
import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import { usePathname } from '@/components/i18n/use-pathname'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PriceDisplay } from '@/components/product/price'
import { raisedOf } from '@/lib/raised'
import { toggleSave } from '@/lib/actions/engagement'
import { productImageUrl } from '@/lib/images'
import { useLocale } from '@/components/i18n/provider'
import { fromTranslations } from '@/lib/i18n/content'
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
  const router = useLocalizedRouter()
  const t = useT()
  const locale = useLocale()
  const pathname = usePathname()
  const [selected, setSelected] = useState<Set<string>>(new Set())
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
      else toast.success(ids.length === 1 ? t('act.unsaved') : t('account.saved.removedMany', { count: ids.length }))
      setSelected(new Set())
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={category ?? 'all'} onValueChange={(v) => nav({ category: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-10 w-48" aria-label={t('account.saved.filterCategory')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('account.saved.allCategories')}</SelectItem>
            {categories.map(([slug, name]) => <SelectItem key={slug} value={slug}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => nav({ sort: v === 'recent' ? undefined : v })}>
          <SelectTrigger className="h-10 w-44" aria-label={t('account.saved.sort')}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{t('account.saved.sortRecent')}</SelectItem>
            <SelectItem value="name">{t('account.saved.sortName')}</SelectItem>
            <SelectItem value="price_asc">{t('account.saved.sortLow')}</SelectItem>
            <SelectItem value="price_desc">{t('account.saved.sortHigh')}</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('account.saved.selected', { count: selected.size })}</span>
            <Button variant="destructive" className="h-10" disabled={pending} onClick={() => remove([...selected])}>
              <Trash2 />{t('common.remove')}
            </Button>
          </div>
        )}
      </div>
      <ul className="divide-y rounded-2xl border">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-4 p-3 sm:p-4">
            <Checkbox
              aria-label={t('account.saved.select', { name: p.name ?? '' })}
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
              <p className="text-xs text-muted-foreground">{p.brand_name} · {fromTranslations(p.category_translations, 'name', locale, p.category_name)}</p>
              <Link href={`/products/${p.slug}`} className="font-semibold hover:underline">{p.name}</Link>
              <div><PriceDisplay price={p.price} originalPrice={p.compare_at_price} currency={p.currency} raised={raisedOf(p)} size="sm" /></div>
            </div>
            <Button variant="ghost" size="icon-lg" aria-label={t('account.saved.removeOne', { name: p.name ?? '' })} disabled={pending} onClick={() => remove([p.id!])}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
