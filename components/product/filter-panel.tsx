'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useT } from '@/components/i18n/provider'
import { fromTranslations } from '@/lib/i18n/content'
import type { MessageKey } from '@/lib/i18n/translate'
import { useState, useTransition } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type Option = { slug: string; name: string; parent?: string | null; translations?: unknown }

const toggles = [
  ['deal', 'filters.deal'],
  ['discount', 'filters.discount'],
  ['new', 'filters.new'],
  ['trending', 'filters.trending'],
  ['featured', 'filters.featured'],
  ['crowdfunding', 'filters.crowdfunding'],
] as const

const availability = [
  ['available', 'filters.availableNow'],
  ['preorder', 'labels.availability.preorder'],
  ['coming_soon', 'labels.availability.coming_soon'],
  ['sold_out', 'labels.availability.sold_out'],
] as const

function useFilterNav() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  function set(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    next.delete('page')
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }))
  }
  return { params, set, pending }
}

function Filters({ categories, brands, lockCategory, lockBrand }: { categories: Option[]; brands: Option[]; lockCategory?: boolean; lockBrand?: boolean }) {
  const t = useT()
  const locale = useLocale()
  const { params, set } = useFilterNav()
  const [min, setMin] = useState(params.get('price_min') ?? '')
  const [max, setMax] = useState(params.get('price_max') ?? '')

  return (
    <div className="flex flex-col gap-7">
      {!lockCategory && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-category">{t('filters.category')}</Label>
          <Select value={params.get('category') ?? 'all'} onValueChange={(v) => set({ category: v === 'all' ? null : v })}>
            <SelectTrigger id="f-category" className="w-full"><SelectValue placeholder={t('filters.allCategories')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>{c.parent ? `— ${fromTranslations(c.translations, 'name', locale, c.name)}` : fromTranslations(c.translations, 'name', locale, c.name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {!lockBrand && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="f-brand">{t('filters.brand')}</Label>
          <Select value={params.get('brand') ?? 'all'} onValueChange={(v) => set({ brand: v === 'all' ? null : v })}>
            <SelectTrigger id="f-brand" className="w-full"><SelectValue placeholder={t('filters.allBrands')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allBrands')}</SelectItem>
              {brands.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('filters.price')}</legend>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            set({ price_min: min || null, price_max: max || null })
          }}
        >
          <Label htmlFor="f-min" className="sr-only">{t('filters.minPrice')}</Label>
          <Input id="f-min" inputMode="numeric" placeholder={t('filters.min')} value={min} onChange={(e) => setMin(e.target.value.replace(/[^0-9]/g, ''))} />
          <span className="text-muted-foreground" aria-hidden>–</span>
          <Label htmlFor="f-max" className="sr-only">{t('filters.maxPrice')}</Label>
          <Input id="f-max" inputMode="numeric" placeholder={t('filters.max')} value={max} onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ''))} />
          <Button type="submit" variant="outline">{t('filters.go')}</Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {[[null, '100'], ['100', '300'], ['300', '600'], ['600', null]].map(([lo, hi]) => (
            <button
              key={`${lo}-${hi}`}
              type="button"
              onClick={() => {
                setMin(lo ?? '')
                setMax(hi ?? '')
                set({ price_min: lo, price_max: hi })
              }}
              className="rounded-full border px-2.5 py-1 text-xs hover:border-foreground/40"
            >
              {lo && hi ? `$${lo}–$${hi}` : lo ? `$${lo}+` : t('filters.under', { amount: `$${hi}` })}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="f-rating">{t('filters.score')}</Label>
        <Select value={params.get('rating') ?? 'any'} onValueChange={(v) => set({ rating: v === 'any' ? null : v })}>
          <SelectTrigger id="f-rating" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('filters.anyScore')}</SelectItem>
            <SelectItem value="9">{t('filters.andUp', { n: '9.0' })}</SelectItem>
            <SelectItem value="8.5">{t('filters.andUp', { n: '8.5' })}</SelectItem>
            <SelectItem value="8">{t('filters.andUp', { n: '8.0' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="f-availability">{t('filters.availability')}</Label>
        <Select value={params.get('availability') ?? 'any'} onValueChange={(v) => set({ availability: v === 'any' ? null : v })}>
          <SelectTrigger id="f-availability" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t('filters.anyAvailability')}</SelectItem>
            {availability.map(([v, l]) => <SelectItem key={v} value={v}>{t(l)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t('filters.showOnly')}</legend>
        {toggles.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2.5">
            <Checkbox id={`f-${key}`} checked={params.get(key) === '1'} onCheckedChange={(v) => set({ [key]: v ? '1' : null })} />
            <Label htmlFor={`f-${key}`} className="font-normal">{t(label)}</Label>
          </div>
        ))}
      </fieldset>
    </div>
  )
}

export function FilterSidebar(props: { categories: Option[]; brands: Option[]; lockCategory?: boolean; lockBrand?: boolean }) {
  const t = useT()
  return (
    <aside aria-label={t('filters.title')} className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-24">
        <Filters {...props} />
      </div>
    </aside>
  )
}

export function MobileFilterDrawer(props: { categories: Option[]; brands: Option[]; lockCategory?: boolean; lockBrand?: boolean; activeCount: number; total: number }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 rounded-full lg:hidden">
          <SlidersHorizontal />
          {t('filters.title')}{props.activeCount > 0 && ` (${props.activeCount})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{t('filters.title')}</SheetTitle>
          <SheetDescription>{t('filters.matching', { count: props.total })}</SheetDescription>
        </SheetHeader>
        <div className="px-4"><Filters {...props} /></div>
        <SheetFooter>
          <Button size="lg" onClick={() => setOpen(false)}>{t('filters.showN', { count: props.total })}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function SortSelect({ options, value }: { options: readonly { value: string; label: MessageKey }[]; value: string }) {
  const t = useT()
  const { set, pending } = useFilterNav()
  return (
    <div className={cn('flex items-center gap-2', pending && 'opacity-60')}>
      <Label htmlFor="sort" className="hidden whitespace-nowrap text-muted-foreground sm:block">{t('sort.label')}</Label>
      <Select value={value} onValueChange={(v) => set({ sort: v })}>
        <SelectTrigger id="sort" className="h-10 w-44 rounded-full"><SelectValue /></SelectTrigger>
        <SelectContent align="end">
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ClearFilters({ keys }: { keys: string[] }) {
  const t = useT()
  const { set } = useFilterNav()
  return (
    <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(keys.map((k) => [k, null])))}>
      <X />
      {t('filters.clear')}
    </Button>
  )
}
