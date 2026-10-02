'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createDeal, deleteDeal, setFeatured, setProductScore, updateProductAdmin } from '@/lib/actions/admin'
import { formatDate, formatPrice } from '@/lib/format'

type Product = {
  id: string; name: string; slug: string; tagline: string | null; description: string | null; external_url: string | null
  price: number | null; original_price: number | null; currency: string; availability: string; seo_title: string | null; seo_description: string | null; translations?: unknown
  category_id: string | null
}
type Score = { overall: number; design: number | null; innovation: number | null; usability: number | null; value: number | null; features: number | null; verdict: string | null } | null
type Deal = { id: string; title: string | null; deal_price: number; starts_at: string; ends_at: string | null; coupon_code: string | null }

const PLACEMENTS = [
  ['hero', 'Homepage hero'],
  ['featured_today', 'Featured today'],
  ['featured_this_week', 'Featured this week'],
  ['editors_pick', "Editor's pick"],
  ['trending', 'Trending (manual)'],
  ['new', 'New'],
  ['coming_soon', 'Coming soon'],
  ['deal', 'Deal'],
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-background p-5">
      <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  )
}

export function ProductEditor({
  product,
  categories,
  score,
  placements,
  deals,
}: {
  product: Product
  categories: { id: string; name: string; parent_id: string | null }[]
  score: Score
  placements: string[]
  deals: Deal[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const zh = (f: string) => (product.translations as Record<string, Record<string, string>> | undefined)?.['zh-HK']?.[f] ?? ''
  const [v, setV] = useState({
    name: product.name,
    slug: product.slug,
    tagline: product.tagline ?? '',
    description: product.description ?? '',
    external_url: product.external_url ?? '',
    price: product.price?.toString() ?? '',
    original_price: product.original_price?.toString() ?? '',
    currency: product.currency,
    availability: product.availability,
    seo_title: product.seo_title ?? '',
    seo_description: product.seo_description ?? '',
    category_id: product.category_id ?? '',
    zh_name: zh('name'),
    zh_tagline: zh('tagline'),
    zh_description: zh('description'),
    zh_seo_title: zh('seo_title'),
    zh_seo_description: zh('seo_description'),
  })
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const [s, setS] = useState({
    overall: score?.overall?.toString() ?? '',
    design: score?.design?.toString() ?? '',
    innovation: score?.innovation?.toString() ?? '',
    usability: score?.usability?.toString() ?? '',
    value: score?.value?.toString() ?? '',
    features: score?.features?.toString() ?? '',
    verdict: score?.verdict ?? '',
  })
  const [deal, setDeal] = useState({ title: '', deal_price: '', coupon_code: '', starts_at: new Date().toISOString().slice(0, 16), ends_at: '' })

  const done = (res: { ok: boolean; error?: string; message?: string }) => {
    if (!res.ok) toast.error(res.error)
    else {
      toast.success(res.message ?? 'Saved')
      router.refresh()
    }
  }
  const field = (k: keyof typeof v, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`p-${k}`}>{label}</Label>
      <Input id={`p-${k}`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} aria-invalid={Boolean(errors[k])} {...props} />
      {errors[k] && <p role="alert" className="text-xs text-destructive">{errors[k]![0]}</p>}
    </div>
  )

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Section title="Content & metadata">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setErrors({})
            start(async () => {
              const res = await updateProductAdmin(product.id, v as never)
              if (!res.ok) setErrors(res.fieldErrors ?? {})
              done(res)
            })
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'Name')}
            {field('slug', 'URL slug')}
          </div>
          {field('tagline', 'Short description')}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-description">Full description</Label>
            <Textarea id="p-description" rows={8} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </div>
          {field('external_url', 'Product URL (https)', { type: 'url' })}
          <div className="grid gap-4 sm:grid-cols-3">
            {field('price', 'Price', { inputMode: 'decimal' })}
            {field('original_price', 'Original price', { inputMode: 'decimal' })}
            {field('currency', 'Currency', { maxLength: 3 })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-availability">Availability</Label>
              <Select value={v.availability} onValueChange={(x) => setV({ ...v, availability: x })}>
                <SelectTrigger id="p-availability" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['available', 'coming_soon', 'preorder', 'crowdfunding', 'sold_out', 'discontinued'].map((a) => <SelectItem key={a} value={a}>{a.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-category">Primary category</Label>
              <Select value={v.category_id} onValueChange={(x) => setV({ ...v, category_id: x })}>
                <SelectTrigger id="p-category" className="w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.parent_id ? `— ${c.name}` : c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {field('seo_title', `SEO title (${v.seo_title.length}/70)`, { maxLength: 70 })}
          {field('seo_description', `SEO description (${v.seo_description.length}/170)`, { maxLength: 170 })}
          <fieldset className="flex flex-col gap-4 rounded-xl border p-4" lang="zh-HK">
            <legend className="px-1 text-sm font-semibold">繁體中文 (Traditional Chinese)</legend>
            <p className="text-xs text-muted-foreground">Shown on /zh pages. Leave a field empty to show the English text instead.</p>
            {field('zh_name', 'Name (中文)', { maxLength: 120 })}
            {field('zh_tagline', 'Short description (中文)', { maxLength: 200 })}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-zh_description">Full description (中文)</Label>
              <Textarea id="p-zh_description" rows={8} value={v.zh_description} onChange={(e) => setV({ ...v, zh_description: e.target.value })} />
            </div>
            {field('zh_seo_title', `SEO title (中文) (${v.zh_seo_title.length}/70)`, { maxLength: 70 })}
            {field('zh_seo_description', `SEO description (中文) (${v.zh_seo_description.length}/170)`, { maxLength: 170 })}
          </fieldset>
          <Button type="submit" className="self-start" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save product</Button>
        </form>
      </Section>

      <div className="flex flex-col gap-6">
        <Section title="Editorial score">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              const num = (x: string) => (x === '' ? null : Number(x))
              start(async () => done(await setProductScore(product.id, { overall: Number(s.overall), design: num(s.design), innovation: num(s.innovation), usability: num(s.usability), value: num(s.value), features: num(s.features), verdict: s.verdict })))
            }}
          >
            <div className="grid grid-cols-3 gap-3">
              {(['overall', 'design', 'innovation', 'usability', 'value', 'features'] as const).map((k) => (
                <div key={k} className="flex flex-col gap-1.5">
                  <Label htmlFor={`s-${k}`} className="capitalize">{k}</Label>
                  <Input id={`s-${k}`} inputMode="decimal" value={s[k]} placeholder="0–10" onChange={(e) => setS({ ...s, [k]: e.target.value.replace(/[^0-9.]/g, '') })} required={k === 'overall'} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-verdict">Verdict</Label>
              <Textarea id="s-verdict" rows={3} maxLength={600} value={s.verdict} onChange={(e) => setS({ ...s, verdict: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || s.overall === ''}>Save score</Button>
              {score && <Button type="button" variant="ghost" disabled={pending} onClick={() => start(async () => done(await setProductScore(product.id, null)))}>Remove score</Button>}
            </div>
          </form>
        </Section>

        <Section title="Featured placements">
          <div className="grid grid-cols-2 gap-3">
            {PLACEMENTS.map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`f-${key}`}
                  checked={placements.includes(key)}
                  disabled={pending}
                  onCheckedChange={(on) => start(async () => done(await setFeatured(product.id, key, Boolean(on), null)))}
                />
                <Label htmlFor={`f-${key}`} className="font-normal">{label}</Label>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Deals">
          {deals.length > 0 && (
            <ul className="mb-4 divide-y rounded-xl border text-sm">
              {deals.map((d) => (
                <li key={d.id} className="flex items-center gap-3 p-3">
                  <span className="flex-1">
                    <span className="font-medium">{formatPrice(d.deal_price, product.currency)}</span> {d.title && `· ${d.title}`}
                    <span className="block text-xs text-muted-foreground">{formatDate(d.starts_at)} – {d.ends_at ? formatDate(d.ends_at) : 'no end'}{d.coupon_code && ` · code ${d.coupon_code}`}</span>
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete deal" disabled={pending} onClick={() => start(async () => done(await deleteDeal(d.id)))}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              start(async () => {
                const res = await createDeal({ productId: product.id, ...deal, deal_price: deal.deal_price as never, original_price: product.price?.toString() as never })
                done(res)
                if (res.ok) setDeal({ ...deal, title: '', deal_price: '', coupon_code: '' })
              })
            }}
          >
            <div className="flex flex-col gap-1.5"><Label htmlFor="d-price">Deal price</Label><Input id="d-price" inputMode="decimal" required value={deal.deal_price} onChange={(e) => setDeal({ ...deal, deal_price: e.target.value.replace(/[^0-9.]/g, '') })} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="d-title">Title</Label><Input id="d-title" value={deal.title} onChange={(e) => setDeal({ ...deal, title: e.target.value })} placeholder="Launch week price" /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="d-start">Starts</Label><Input id="d-start" type="datetime-local" required value={deal.starts_at} onChange={(e) => setDeal({ ...deal, starts_at: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="d-end">Ends (optional)</Label><Input id="d-end" type="datetime-local" value={deal.ends_at} onChange={(e) => setDeal({ ...deal, ends_at: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="d-code">Coupon code</Label><Input id="d-code" value={deal.coupon_code} onChange={(e) => setDeal({ ...deal, coupon_code: e.target.value })} /></div>
            <div className="flex items-end"><Button type="submit" disabled={pending || !deal.deal_price}>Add deal</Button></div>
          </form>
        </Section>
      </div>
    </div>
  )
}
