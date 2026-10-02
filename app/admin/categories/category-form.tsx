'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveCategory } from '@/lib/actions/admin'

type Cat = { id?: string; name: string; slug: string; description: string | null; parent_id: string | null; color: string | null; icon: string | null; seo_title: string | null; seo_description: string | null; is_featured: boolean; sort_order: number; translations?: unknown }

const zh = (row: { translations?: unknown } | undefined, field: string) =>
  ((row?.translations as Record<string, Record<string, string>> | undefined)?.['zh-HK']?.[field] ?? '')

export function CategoryForm({ category, parents, onDone }: { category?: Cat; parents: { id: string; name: string }[]; onDone?: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [v, setV] = useState({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    parent_id: category?.parent_id ?? '',
    color: category?.color ?? '#475467',
    icon: category?.icon ?? '',
    seo_title: category?.seo_title ?? '',
    seo_description: category?.seo_description ?? '',
    is_featured: category?.is_featured ?? false,
    sort_order: String(category?.sort_order ?? 0),
    zh_name: zh(category, 'name'),
    zh_description: zh(category, 'description'),
  })
  const id = category?.id ?? 'new'
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await saveCategory({ ...v, id: category?.id, sort_order: v.sort_order as never })
          if (!res.ok) toast.error(res.error)
          else {
            toast.success(res.message)
            router.refresh()
            onDone?.()
            if (!category) setV({ ...v, name: '', slug: '', description: '', zh_name: '', zh_description: '' })
          }
        })
      }}
    >
      <div className="flex flex-col gap-1.5"><Label htmlFor={`c-name-${id}`}>Name</Label><Input id={`c-name-${id}`} required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`c-slug-${id}`}>Slug (auto if empty)</Label><Input id={`c-slug-${id}`} value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5 sm:col-span-2"><Label htmlFor={`c-desc-${id}`}>Description</Label><Input id={`c-desc-${id}`} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`c-zhname-${id}`}>Name (繁體中文)</Label><Input id={`c-zhname-${id}`} lang="zh-HK" maxLength={60} value={v.zh_name} placeholder="Optional — English is shown if empty" onChange={(e) => setV({ ...v, zh_name: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`c-zhdesc-${id}`}>Description (繁體中文)</Label><Input id={`c-zhdesc-${id}`} lang="zh-HK" maxLength={600} value={v.zh_description} onChange={(e) => setV({ ...v, zh_description: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`c-parent-${id}`}>Parent category</Label>
        <Select value={v.parent_id || 'none'} onValueChange={(x) => setV({ ...v, parent_id: x === 'none' ? '' : x })}>
          <SelectTrigger id={`c-parent-${id}`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (top level)</SelectItem>
            {parents.filter((p) => p.id !== category?.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor={`c-color-${id}`}>Colour</Label><Input id={`c-color-${id}`} type="color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} className="h-9 p-1" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`c-icon-${id}`}>Icon</Label><Input id={`c-icon-${id}`} value={v.icon} placeholder="headphones" onChange={(e) => setV({ ...v, icon: e.target.value })} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor={`c-order-${id}`}>Order</Label><Input id={`c-order-${id}`} inputMode="numeric" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`c-seot-${id}`}>SEO title</Label><Input id={`c-seot-${id}`} maxLength={70} value={v.seo_title} onChange={(e) => setV({ ...v, seo_title: e.target.value })} /></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor={`c-seod-${id}`}>SEO description</Label><Input id={`c-seod-${id}`} maxLength={170} value={v.seo_description} onChange={(e) => setV({ ...v, seo_description: e.target.value })} /></div>
      <div className="flex items-center gap-2"><Checkbox id={`c-feat-${id}`} checked={v.is_featured} onCheckedChange={(x) => setV({ ...v, is_featured: Boolean(x) })} /><Label htmlFor={`c-feat-${id}`} className="font-normal">Featured on homepage</Label></div>
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{category ? 'Save' : 'Create category'}</Button></div>
    </form>
  )
}
