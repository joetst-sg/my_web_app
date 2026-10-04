'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { deleteHomepageSection, reorderHomepageSections, saveHomepageSection } from '@/lib/actions/admin'

type Section = { id: string; type: string; title: string | null; subtitle: string | null; translations?: unknown; config: { limit?: number; product_ids?: string[] }; is_enabled: boolean }

export const SECTION_TYPES = {
  hero: 'Hero (featured product)',
  featured_categories: 'Featured categories',
  trending_products: 'Trending products',
  editors_picks: "Editor's picks",
  new_products: 'New products',
  deals: 'Deals',
  product_list: 'Hand-picked products',
} as const

function Row({ section, index, total, ids, products }: { section: Section; index: number; total: number; ids: string[]; products: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [v, setV] = useState({
    title: section.title ?? '',
    subtitle: section.subtitle ?? '',
    zh_title: ((section.translations as Record<string, Record<string, string>> | undefined)?.['zh-HK']?.title ?? ''),
    zh_subtitle: ((section.translations as Record<string, Record<string, string>> | undefined)?.['zh-HK']?.subtitle ?? ''),
    limit: String(section.config?.limit ?? 8),
    product_ids: section.config?.product_ids ?? [],
    is_enabled: section.is_enabled,
  })
  const [pick, setPick] = useState('')
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn()
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(res.message ?? 'Saved')
        router.refresh()
      }
    })
  const move = (dir: -1 | 1) => {
    const next = [...ids]
    ;[next[index], next[index + dir]] = [next[index + dir], next[index]]
    run(() => reorderHomepageSections(next))
  }

  return (
    <li className="rounded-2xl border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
        <span className="flex-1 font-medium">{SECTION_TYPES[section.type as keyof typeof SECTION_TYPES] ?? section.type}</span>
        <div className="flex items-center gap-2">
          <Switch id={`en-${section.id}`} checked={v.is_enabled} onCheckedChange={(on) => { setV({ ...v, is_enabled: on }); run(() => saveHomepageSection({ id: section.id, type: section.type as never, ...v, is_enabled: on, limit: v.limit as never })) }} />
          <Label htmlFor={`en-${section.id}`} className="font-normal">Visible</Label>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={pending || index === 0} onClick={() => move(-1)}><ArrowUp /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={pending || index === total - 1} onClick={() => move(1)}><ArrowDown /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Remove section" disabled={pending} onClick={() => run(() => deleteHomepageSection(section.id))}><Trash2 /></Button>
      </div>
      {section.type !== 'hero' && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_1.4fr_6rem_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => saveHomepageSection({ id: section.id, type: section.type as never, ...v, limit: v.limit as never }))
          }}
        >
          <div className="flex flex-col gap-1.5"><Label htmlFor={`t-${section.id}`}>Title</Label><Input id={`t-${section.id}`} value={v.title} maxLength={80} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor={`s-${section.id}`}>Subtitle</Label><Input id={`s-${section.id}`} value={v.subtitle} maxLength={200} onChange={(e) => setV({ ...v, subtitle: e.target.value })} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor={`zt-${section.id}`}>Title (繁體中文)</Label><Input id={`zt-${section.id}`} lang="zh-HK" value={v.zh_title} maxLength={80} onChange={(e) => setV({ ...v, zh_title: e.target.value })} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor={`zs-${section.id}`}>Subtitle (繁體中文)</Label><Input id={`zs-${section.id}`} lang="zh-HK" value={v.zh_subtitle} maxLength={200} onChange={(e) => setV({ ...v, zh_subtitle: e.target.value })} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor={`l-${section.id}`}>Items</Label><Input id={`l-${section.id}`} inputMode="numeric" value={v.limit} onChange={(e) => setV({ ...v, limit: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="flex items-end"><Button type="submit" variant="outline" disabled={pending}>Save</Button></div>
          {section.type === 'product_list' && (
            <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-6">
              <p className="text-sm font-medium">Products</p>
              <ol className="flex flex-wrap gap-1.5">
                {v.product_ids.map((id) => (
                  <li key={id} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                    {products.find((p) => p.id === id)?.name ?? 'Unknown'}
                    <button type="button" aria-label="Remove" onClick={() => setV({ ...v, product_ids: v.product_ids.filter((x) => x !== id) })}>×</button>
                  </li>
                ))}
              </ol>
              <Select value={pick} onValueChange={(id) => { setV({ ...v, product_ids: [...v.product_ids, id] }); setPick('') }}>
                <SelectTrigger className="w-72" aria-label="Add a product"><SelectValue placeholder="Add a product…" /></SelectTrigger>
                <SelectContent>{products.filter((p) => !v.product_ids.includes(p.id)).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </form>
      )}
      {section.type === 'hero' && <p className="mt-2 text-sm text-muted-foreground">Shows the first product in the “Homepage hero” placement (Featured page), or the top trending product if none is set.</p>}
    </li>
  )
}

export function SectionList({ sections, products }: { sections: Section[]; products: { id: string; name: string }[] }) {
  const router = useRouter()
  const [type, setType] = useState<string>('product_list')
  const [pending, start] = useTransition()
  const ids = sections.map((s) => s.id)
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {sections.map((s, i) => <Row key={s.id} section={s} index={i} total={sections.length} ids={ids} products={products} />)}
      </ol>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed bg-background p-4">
        <Label htmlFor="new-type">Add section</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="new-type" className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(SECTION_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveHomepageSection({ type: type as never, title: SECTION_TYPES[type as keyof typeof SECTION_TYPES], limit: 8 as never, is_enabled: true })
              if (!res.ok) toast.error(res.error)
              else router.refresh()
            })
          }
        >
          <Plus />Add
        </Button>
      </div>
    </div>
  )
}
