'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveCategoryMapping, setImportCategory } from '@/lib/actions/greenfunding'

type Cat = { id: string; name: string; parent_id: string | null }

function CategorySelect({ value, categories, onChange, label, allowNone }: { value: string | null; categories: Cat[]; onChange: (v: string | null) => void; label: string; allowNone?: boolean }) {
  return (
    <Select value={value ?? 'none'} onValueChange={(v) => onChange(v === 'none' ? null : v)}>
      <SelectTrigger className="h-9 w-56" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">Not mapped (needs review)</SelectItem>}
        {!allowNone && value === null && <SelectItem value="none" disabled>Uncategorized — choose…</SelectItem>}
        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.parent_id ? `— ${c.name}` : c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function MappingRow({ label, categoryId, categories }: { label: string; categoryId: string | null; categories: Cat[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2" aria-busy={pending}>
      <span className="font-medium" lang="ja">{label}</span>
      <CategorySelect
        value={categoryId}
        categories={categories}
        allowNone
        label={`Map ${label}`}
        onChange={(v) => start(async () => {
          const res = await saveCategoryMapping(label, v)
          if (res.ok) { toast.success(res.message); router.refresh() } else toast.error(res.error)
        })}
      />
    </div>
  )
}

export function ProductCategoryPicker({ productId, categoryId, categories }: { productId: string; categoryId: string | null; categories: Cat[] }) {
  const router = useRouter()
  const [, start] = useTransition()
  return (
    <CategorySelect
      value={categoryId}
      categories={categories}
      label="Product category"
      onChange={(v) => v && start(async () => {
        const res = await setImportCategory(productId, v)
        if (res.ok) { toast.success(res.message); router.refresh() } else toast.error(res.error)
      })}
    />
  )
}
