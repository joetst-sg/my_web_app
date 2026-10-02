'use client'

import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveFeatures } from '@/lib/actions/seller'
import { StepActions, useUnsavedChanges } from './wizard-shared'

// Suggested spec rows, in the seller's language.
const SUGGESTED_SPECS = ['dimensions', 'weight', 'materials', 'battery', 'connectivity', 'compatibility', 'warranty'] as const

function ListEditor({ id, label, hint, items, onChange, max = 10, placeholder }: { id: string; label: string; hint: string; items: string[]; onChange: (v: string[]) => void; max?: number; placeholder: string }) {
  const t = useT()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Label htmlFor={`${id}-${i}`} className="sr-only">{label} {i + 1}</Label>
          <Input id={`${id}-${i}`} value={item} placeholder={placeholder} maxLength={160} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className="h-11" />
          <Button type="button" variant="ghost" size="icon-lg" aria-label={t('seller.features.removeItem', { label, n: i + 1 })} onClick={() => onChange(items.filter((_, j) => j !== i))}><X /></Button>
        </div>
      ))}
      {items.length < max && <Button type="button" variant="ghost" className="self-start" onClick={() => onChange([...items, ''])}><Plus />{t('seller.features.add')}</Button>}
    </fieldset>
  )
}

export function FeaturesForm({ productId, initial }: { productId: string; initial: { key_features: string[]; benefits: string[]; specs: { label: string; value: string }[] } }) {
  const router = useLocalizedRouter()
  const t = useT()
  const [features, setFeatures] = useState(initial.key_features.length ? initial.key_features : ['', '', ''])
  const [benefits, setBenefits] = useState(initial.benefits)
  const [specs, setSpecs] = useState(
    initial.specs.length ? initial.specs : SUGGESTED_SPECS.map((k) => ({ label: t(`seller.features.specs.${k}`), value: '' })),
  )
  const [dirty, setDirty] = useState(false)
  const [pending, start] = useTransition()
  useUnsavedChanges(dirty)
  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true) }

  function save(andContinue: boolean) {
    start(async () => {
      const res = await saveFeatures(productId, { key_features: features, benefits, specs })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setDirty(false)
      toast.success(t('seller.features.saved'))
      if (andContinue) router.push(`/seller/products/${productId}/edit?step=5`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(true) }} className="flex max-w-3xl flex-col gap-10">
      <ListEditor id="feature" label={t('seller.features.key')} hint={t('seller.features.keyHint')} items={features} onChange={touch(setFeatures)} placeholder={t('seller.features.keyPlaceholder')} />
      <ListEditor id="benefit" label={`${t('seller.features.benefits')} ${t('common.optional')}`} hint={t('seller.features.benefitsHint')} items={benefits} onChange={touch(setBenefits)} placeholder={t('seller.features.benefitsPlaceholder')} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('seller.features.specsTitle')}</legend>
        <p className="text-xs text-muted-foreground">{t('seller.features.specsHint')}</p>
        {specs.map((s, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2">
            <Label htmlFor={`spec-l-${i}`} className="sr-only">{t('seller.features.specName', { n: i + 1 })}</Label>
            <Input id={`spec-l-${i}`} value={s.label} maxLength={60} onChange={(e) => touch(setSpecs)(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="h-11" placeholder={t('seller.features.name')} />
            <Label htmlFor={`spec-v-${i}`} className="sr-only">{t('seller.features.specValue', { label: s.label || t('seller.features.specN', { n: i + 1 }) })}</Label>
            <Input id={`spec-v-${i}`} value={s.value} maxLength={300} onChange={(e) => touch(setSpecs)(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className="h-11" placeholder={t('seller.features.value')} />
            <Button type="button" variant="ghost" size="icon-lg" aria-label={t('seller.features.removeSpec', { label: s.label || t('seller.features.specification') })} onClick={() => touch(setSpecs)(specs.filter((_, j) => j !== i))}><X /></Button>
          </div>
        ))}
        {specs.length < 30 && <Button type="button" variant="ghost" className="self-start" onClick={() => setSpecs([...specs, { label: '', value: '' }])}><Plus />{t('seller.features.addSpec')}</Button>}
      </fieldset>
      <StepActions pending={pending} onSave={() => save(false)} onContinue={() => save(true)} backHref={`/seller/products/${productId}/edit?step=3`} />
    </form>
  )
}
