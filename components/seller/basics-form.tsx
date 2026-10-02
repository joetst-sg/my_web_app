'use client'

import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createProductDraft, saveBasics, type BasicsInput } from '@/lib/actions/seller'
import { FieldHelp, StepActions, useUnsavedChanges } from './wizard-shared'

type Options = { brands: { id: string; name: string }[]; categories: { id: string; name: string; parent_id: string | null }[] }
type Values = { name: string; brand_id: string; new_brand: string; external_url: string; tagline: string; description: string; category_id: string; subcategory_id: string; tags: string; sku: string }

const BACKUP_KEY = 'loupe:new-product-draft'

export function BasicsForm({ productId, initial, options }: { productId?: string; initial?: Partial<Values>; options: Options }) {
  const router = useLocalizedRouter()
  const t = useT()
  const empty: Values = { name: '', brand_id: options.brands[0]?.id ?? 'new', new_brand: '', external_url: '', tagline: '', description: '', category_id: '', subcategory_id: '', tags: '', sku: '' }
  const [v, setV] = useState<Values>({ ...empty, ...initial })
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  useUnsavedChanges(dirty)

  // Before the draft exists, keep a local backup so nothing typed is lost.
  useEffect(() => {
    if (productId) return
    try {
      const saved = localStorage.getItem(BACKUP_KEY)
      if (saved) {
        setV((cur) => ({ ...cur, ...JSON.parse(saved) }))
        toast.info(t('seller.basics.restored'))
      }
    } catch {
      // storage unavailable
    }
  }, [productId, t])
  useEffect(() => {
    if (productId || !dirty) return
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(v))
    } catch {
      // storage unavailable
    }
  }, [v, dirty, productId])

  const parents = options.categories.filter((c) => !c.parent_id)
  const subs = useMemo(() => options.categories.filter((c) => c.parent_id && c.parent_id === v.category_id), [options.categories, v.category_id])
  const set = (k: keyof Values) => (value: string) => {
    setV((cur) => ({ ...cur, [k]: value, ...(k === 'category_id' && { subcategory_id: '' }) }))
    setDirty(true)
  }

  // Field ids in the order they appear, so we can focus the first problem.
  const fieldOrder: [keyof Values, string][] = [
    ['name', 'name'], ['brand_id', 'brand'], ['new_brand', 'new_brand'], ['external_url', 'external_url'],
    ['tagline', 'tagline'], ['description', 'description'], ['category_id', 'category'], ['tags', 'tags'], ['sku', 'sku'],
  ]

  function save(andContinue: boolean) {
    setErrors({})
    setFormError(null)
    const input: BasicsInput = { ...v, brand_id: v.brand_id }
    start(async () => {
      const res = productId ? await saveBasics(productId, input) : await createProductDraft(input)
      if (!res.ok) {
        const fe = res.fieldErrors ?? {}
        const message = res.error === 'LOGIN_REQUIRED' ? t('upload.session') : res.error
        setErrors(fe)
        setFormError(message)
        toast.error(message)
        const first = fieldOrder.find(([k]) => fe[k]?.length)
        if (first) document.getElementById(first[1])?.focus()
        else document.getElementById('basics-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      setDirty(false)
      const id = productId ?? (res as { data: { id: string } }).data.id
      if (!productId) {
        try {
          localStorage.removeItem(BACKUP_KEY)
        } catch {
          // ignore
        }
      }
      toast.success(t('act.draftSaved'))
      router.push(andContinue ? `/seller/products/${id}/edit?step=2` : `/seller/products/${id}/edit?step=1`)
      router.refresh()
    })
  }

  const e = errors
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); save(true) }} className="flex max-w-3xl flex-col gap-6" noValidate>
      {formError && (
        <div id="basics-error" role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">{t('seller.basics.notSaved')}</p>
          <p>{formError}{Object.values(errors).some((x) => x?.length) && ` ${t('seller.basics.fieldsMarked')}`}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t('seller.basics.name')}</Label>
        <Input id="name" value={v.name} onChange={(ev) => set('name')(ev.target.value)} maxLength={120} className="h-11" aria-invalid={Boolean(e.name)} aria-describedby="name-help" />
        <FieldHelp id="name-help" error={e.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand">{t('seller.basics.brand')}</Label>
          <Select value={v.brand_id} onValueChange={set('brand_id')}>
            <SelectTrigger id="brand" className="h-11 w-full" aria-describedby="brand-help"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              <SelectItem value="new">{t('seller.basics.newBrandOption')}</SelectItem>
            </SelectContent>
          </Select>
          <FieldHelp id="brand-help" error={e.brand_id} hint={t('seller.basics.brandHint')} />
        </div>
        {v.brand_id === 'new' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_brand">{t('seller.basics.newBrand')}</Label>
            <Input id="new_brand" value={v.new_brand} onChange={(ev) => set('new_brand')(ev.target.value)} maxLength={80} className="h-11" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="external_url">{t('seller.basics.url')}</Label>
        <Input id="external_url" type="url" inputMode="url" placeholder="https://yourstore.com/products/…" value={v.external_url} onChange={(ev) => set('external_url')(ev.target.value)} className="h-11" aria-invalid={Boolean(e.external_url)} aria-describedby="url-help" />
        <FieldHelp id="url-help" error={e.external_url} hint={t('seller.basics.urlHint')} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tagline">{t('seller.basics.tagline')}</Label>
        <Input id="tagline" value={v.tagline} onChange={(ev) => set('tagline')(ev.target.value)} maxLength={200} className="h-11" aria-invalid={Boolean(e.tagline)} aria-describedby="tagline-help" />
        <FieldHelp id="tagline-help" error={e.tagline} hint={t('seller.basics.taglineHint', { count: v.tagline.length })} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t('seller.basics.description')}</Label>
        <Textarea id="description" value={v.description} onChange={(ev) => set('description')(ev.target.value)} rows={8} maxLength={20000} aria-invalid={Boolean(e.description)} aria-describedby="desc-help" />
        <FieldHelp id="desc-help" error={e.description} hint={t('seller.basics.descriptionHint', { count: v.description.length })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">{t('seller.basics.category')}</Label>
          <Select value={v.category_id} onValueChange={set('category_id')}>
            <SelectTrigger id="category" className="h-11 w-full"><SelectValue placeholder={t('seller.basics.chooseCategory')} /></SelectTrigger>
            <SelectContent>{parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <FieldHelp id="category-help" error={e.category_id} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="subcategory">{t('seller.basics.subcategory')} {t('common.optional')}</Label>
          <Select value={v.subcategory_id || 'none'} onValueChange={(x) => set('subcategory_id')(x === 'none' ? '' : x)} disabled={subs.length === 0}>
            <SelectTrigger id="subcategory" className="h-11 w-full"><SelectValue placeholder={subs.length ? t('seller.basics.chooseSubcategory') : t('seller.basics.noneAvailable')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('seller.basics.none')}</SelectItem>
              {subs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">{t('seller.basics.tags')}</Label>
          <Input id="tags" placeholder={t('seller.basics.tagsPlaceholder')} value={v.tags} onChange={(ev) => set('tags')(ev.target.value)} className="h-11" aria-describedby="tags-help" />
          <FieldHelp id="tags-help" hint={t('seller.basics.tagsHint')} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">{t('seller.basics.sku')} {t('common.optional')}</Label>
          <Input id="sku" value={v.sku} onChange={(ev) => set('sku')(ev.target.value)} maxLength={80} className="h-11" />
        </div>
      </div>

      <StepActions pending={pending} onSave={() => save(false)} onContinue={() => save(true)} />
    </form>
  )
}
