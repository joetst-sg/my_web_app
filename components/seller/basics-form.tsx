'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
        toast.info('Restored your unsaved product details.')
      }
    } catch {
      // storage unavailable
    }
  }, [productId])
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
        const message = res.error === 'LOGIN_REQUIRED' ? 'Your session expired. Please log in again.' : res.error
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
      toast.success('Draft saved')
      router.push(andContinue ? `/seller/products/${id}/edit?step=2` : `/seller/products/${id}/edit?step=1`)
      router.refresh()
    })
  }

  const e = errors
  return (
    <form onSubmit={(ev) => { ev.preventDefault(); save(true) }} className="flex max-w-3xl flex-col gap-6" noValidate>
      {formError && (
        <div id="basics-error" role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Your draft wasn’t saved yet.</p>
          <p>{formError}{Object.values(errors).some((x) => x?.length) && ' The fields that need attention are marked below.'}</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" value={v.name} onChange={(ev) => set('name')(ev.target.value)} maxLength={120} className="h-11" aria-invalid={Boolean(e.name)} aria-describedby="name-help" />
        <FieldHelp id="name-help" error={e.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand">Brand</Label>
          <Select value={v.brand_id} onValueChange={set('brand_id')}>
            <SelectTrigger id="brand" className="h-11 w-full" aria-describedby="brand-help"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              <SelectItem value="new">+ New brand</SelectItem>
            </SelectContent>
          </Select>
          <FieldHelp id="brand-help" error={e.brand_id} hint="Brands you create are reviewed with your first product." />
        </div>
        {v.brand_id === 'new' && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="new_brand">New brand name</Label>
            <Input id="new_brand" value={v.new_brand} onChange={(ev) => set('new_brand')(ev.target.value)} maxLength={80} className="h-11" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="external_url">Product URL</Label>
        <Input id="external_url" type="url" inputMode="url" placeholder="https://yourstore.com/products/…" value={v.external_url} onChange={(ev) => set('external_url')(ev.target.value)} className="h-11" aria-invalid={Boolean(e.external_url)} aria-describedby="url-help" />
        <FieldHelp id="url-help" error={e.external_url} hint="Where people buy the product. Must start with https://" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tagline">Short description</Label>
        <Input id="tagline" value={v.tagline} onChange={(ev) => set('tagline')(ev.target.value)} maxLength={200} className="h-11" aria-invalid={Boolean(e.tagline)} aria-describedby="tagline-help" />
        <FieldHelp id="tagline-help" error={e.tagline} hint={`One sentence shown on product cards. ${v.tagline.length}/200`} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Full description</Label>
        <Textarea id="description" value={v.description} onChange={(ev) => set('description')(ev.target.value)} rows={8} maxLength={20000} aria-invalid={Boolean(e.description)} aria-describedby="desc-help" />
        <FieldHelp id="desc-help" error={e.description} hint={`What it is, who it's for and what makes it different. Leave a blank line between paragraphs. ${v.description.length} characters (80 minimum).`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Category</Label>
          <Select value={v.category_id} onValueChange={set('category_id')}>
            <SelectTrigger id="category" className="h-11 w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
            <SelectContent>{parents.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <FieldHelp id="category-help" error={e.category_id} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="subcategory">Subcategory (optional)</Label>
          <Select value={v.subcategory_id || 'none'} onValueChange={(x) => set('subcategory_id')(x === 'none' ? '' : x)} disabled={subs.length === 0}>
            <SelectTrigger id="subcategory" className="h-11 w-full"><SelectValue placeholder={subs.length ? 'Choose a subcategory' : 'None available'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {subs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" placeholder="wireless, noise-cancelling" value={v.tags} onChange={(ev) => set('tags')(ev.target.value)} className="h-11" aria-describedby="tags-help" />
          <FieldHelp id="tags-help" hint="Comma-separated, up to 12." />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">SKU / model (optional)</Label>
          <Input id="sku" value={v.sku} onChange={(ev) => set('sku')(ev.target.value)} maxLength={80} className="h-11" />
        </div>
      </div>

      <StepActions pending={pending} onSave={() => save(false)} onContinue={() => save(true)} />
    </form>
  )
}
