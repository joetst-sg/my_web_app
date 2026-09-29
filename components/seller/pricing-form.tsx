'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { savePricing } from '@/lib/actions/seller'
import { FieldHelp, StepActions, useUnsavedChanges } from './wizard-shared'

type Values = { price: string; original_price: string; currency: string; availability: string; sale_starts_at: string; sale_ends_at: string }

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '')

export function PricingForm({ productId, initial }: { productId: string; initial: { price: number | null; original_price: number | null; currency: string; availability: string; sale_starts_at: string | null; sale_ends_at: string | null } }) {
  const router = useRouter()
  const [v, setV] = useState<Values>({
    price: initial.price?.toString() ?? '',
    original_price: initial.original_price?.toString() ?? '',
    currency: initial.currency,
    availability: initial.availability === 'discontinued' ? 'available' : initial.availability,
    sale_starts_at: toLocal(initial.sale_starts_at),
    sale_ends_at: toLocal(initial.sale_ends_at),
  })
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [pending, start] = useTransition()
  useUnsavedChanges(dirty)
  const set = (k: keyof Values) => (value: string) => {
    setV((c) => ({ ...c, [k]: value }))
    setDirty(true)
  }
  const price = Number(v.price)
  const orig = Number(v.original_price)
  const discount = v.price && v.original_price && orig > price ? Math.round((1 - price / orig) * 100) : 0

  function save(andContinue: boolean) {
    setErrors({})
    start(async () => {
      const res = await savePricing(productId, {
        price: v.price as unknown as number,
        original_price: v.original_price === '' ? null : (v.original_price as unknown as number),
        currency: v.currency as 'USD',
        availability: v.availability as 'available',
        sale_starts_at: v.sale_starts_at || undefined,
        sale_ends_at: v.sale_ends_at || undefined,
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        toast.error(res.error)
        return
      }
      setDirty(false)
      toast.success('Pricing saved')
      if (andContinue) router.push(`/seller/products/${productId}/edit?step=3`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(true) }} className="flex max-w-3xl flex-col gap-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Current price</Label>
          <Input id="price" inputMode="decimal" value={v.price} onChange={(e) => set('price')(e.target.value.replace(/[^0-9.]/g, ''))} className="h-11 font-mono" aria-invalid={Boolean(errors.price)} aria-describedby="price-help" />
          <FieldHelp id="price-help" error={errors.price} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="original_price">Original price (optional)</Label>
          <Input id="original_price" inputMode="decimal" value={v.original_price} onChange={(e) => set('original_price')(e.target.value.replace(/[^0-9.]/g, ''))} className="h-11 font-mono" aria-invalid={Boolean(errors.original_price)} aria-describedby="orig-help" />
          <FieldHelp id="orig-help" error={errors.original_price} hint={discount ? `Shows as ${discount}% off` : 'Only if the product is discounted.'} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={v.currency} onValueChange={set('currency')}>
            <SelectTrigger id="currency" className="h-11 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{['USD', 'EUR', 'GBP', 'HKD', 'JPY', 'CAD', 'AUD', 'SGD'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label htmlFor="availability">Availability</Label>
        <Select value={v.availability} onValueChange={set('availability')}>
          <SelectTrigger id="availability" className="h-11 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available now</SelectItem>
            <SelectItem value="preorder">Pre-order</SelectItem>
            <SelectItem value="crowdfunding">Crowdfunding</SelectItem>
            <SelectItem value="coming_soon">Coming soon</SelectItem>
            <SelectItem value="sold_out">Sold out</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Sale dates (optional)</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sale_starts_at" className="font-normal">Sale starts</Label>
          <Input id="sale_starts_at" type="datetime-local" value={v.sale_starts_at} onChange={(e) => set('sale_starts_at')(e.target.value)} className="h-11" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sale_ends_at" className="font-normal">Sale ends</Label>
          <Input id="sale_ends_at" type="datetime-local" value={v.sale_ends_at} onChange={(e) => set('sale_ends_at')(e.target.value)} className="h-11" aria-invalid={Boolean(errors.sale_ends_at)} aria-describedby="end-help" />
          <FieldHelp id="end-help" error={errors.sale_ends_at} />
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">Featured deals on the Deals page are set up by our editors after review.</p>
      <StepActions pending={pending} onSave={() => save(false)} onContinue={() => save(true)} backHref={`/seller/products/${productId}/edit?step=1`} />
    </form>
  )
}
