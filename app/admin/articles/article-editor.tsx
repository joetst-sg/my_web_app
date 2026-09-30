'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import Markdown from 'react-markdown'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUnsavedChanges } from '@/components/seller/wizard-shared'
import { deleteArticle, saveArticle } from '@/lib/actions/admin'
import { labels } from '@/lib/format'
import { prepareImage, uploadWithProgress, UploadError } from '@/lib/upload'

type Article = {
  id?: string; title: string; slug: string; excerpt: string; content: string; type: string; status: string
  featured_image_url: string; seo_title: string; seo_description: string; scheduled_for: string
  category_ids: string[]; product_ids: string[]
}

export function ArticleEditor({
  article,
  categories,
  products,
  canDelete,
}: {
  article: Article
  categories: { id: string; name: string }[]
  products: { id: string; name: string }[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [v, setV] = useState(article)
  const [dirty, setDirty] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [pending, start] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)
  useUnsavedChanges(dirty)
  const set = <K extends keyof Article>(k: K, value: Article[K]) => {
    setV((c) => ({ ...c, [k]: value }))
    setDirty(true)
  }

  async function upload(file: File) {
    try {
      setProgress(0)
      const img = await prepareImage(file, { minWidth: 1200, minHeight: 600 })
      const url = await uploadWithProgress('article-images', `articles/${crypto.randomUUID()}.${img.ext}`, img.blob, setProgress)
      set('featured_image_url', url)
    } catch (e) {
      toast.error(e instanceof UploadError ? e.message : 'Upload failed. Please try again.')
    } finally {
      setProgress(null)
    }
  }

  function save() {
    start(async () => {
      const res = await saveArticle({ ...v, type: v.type as never, status: v.status as never })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setDirty(false)
      toast.success('Article saved')
      if (!v.id) router.push(`/admin/articles/${res.data.id}`)
      else router.refresh()
    })
  }

  const matches = productQuery.length >= 2 ? products.filter((p) => p.name.toLowerCase().includes(productQuery.toLowerCase()) && !v.product_ids.includes(p.id)).slice(0, 6) : []

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-4 rounded-2xl border bg-background p-5">
        <div className="flex flex-col gap-1.5"><Label htmlFor="a-title">Title</Label><Input id="a-title" value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={160} className="h-11 text-lg" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="a-excerpt">Excerpt</Label><Textarea id="a-excerpt" rows={2} value={v.excerpt} onChange={(e) => set('excerpt', e.target.value)} maxLength={400} /></div>
        <Tabs defaultValue="write">
          <TabsList><TabsTrigger value="write">Write</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
          <TabsContent value="write">
            <Label htmlFor="a-content" className="sr-only">Content (Markdown)</Label>
            <Textarea id="a-content" rows={22} value={v.content} onChange={(e) => set('content', e.target.value)} className="font-mono text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Markdown: ## headings, - lists, **bold**, _italic_, [links](https://…). Raw HTML is not rendered.</p>
          </TabsContent>
          <TabsContent value="preview">
            <div className="flex min-h-80 flex-col gap-4 rounded-lg border p-4 leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
              <Markdown components={{ img: () => null }}>{v.content || '_Nothing to preview yet._'}</Markdown>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-2xl border bg-background p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-type">Type</Label>
              <Select value={v.type} onValueChange={(x) => set('type', x)}>
                <SelectTrigger id="a-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(labels.articleType).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-status">Status</Label>
              <Select value={v.status} onValueChange={(x) => set('status', x)}>
                <SelectTrigger id="a-status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{['draft', 'review', 'scheduled', 'published', 'archived'].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {v.status === 'scheduled' && (
            <div className="flex flex-col gap-1.5"><Label htmlFor="a-when">Publish at</Label><Input id="a-when" type="datetime-local" value={v.scheduled_for} onChange={(e) => set('scheduled_for', e.target.value)} /></div>
          )}
          <div className="flex flex-col gap-1.5"><Label htmlFor="a-slug">URL slug (auto if empty)</Label><Input id="a-slug" value={v.slug} onChange={(e) => set('slug', e.target.value)} /></div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={pending || v.title.trim().length < 3}>{pending && <Loader2 className="animate-spin" />}Save</Button>
            {v.id && canDelete && (
              <Button variant="destructive" size="icon" aria-label="Delete article" disabled={pending} onClick={() => start(async () => {
                const res = await deleteArticle(v.id!)
                if (!res.ok) toast.error(res.error)
                else router.push('/admin/articles')
              })}><Trash2 /></Button>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border bg-background p-5">
          <h2 className="font-sans text-sm font-semibold tracking-normal">Featured image</h2>
          {v.featured_image_url && <Image src={v.featured_image_url} alt="" width={600} height={340} className="aspect-video w-full rounded-lg object-cover" />}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={progress !== null}><Upload />{v.featured_image_url ? 'Replace image' : 'Upload image'}</Button>
          {progress !== null && <Progress value={progress * 100} aria-label="Upload progress" />}
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border bg-background p-5">
          <h2 className="font-sans text-sm font-semibold tracking-normal">Categories</h2>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Checkbox id={`ac-${c.id}`} checked={v.category_ids.includes(c.id)} onCheckedChange={(on) => set('category_ids', on ? [...v.category_ids, c.id] : v.category_ids.filter((x) => x !== c.id))} />
                <Label htmlFor={`ac-${c.id}`} className="font-normal">{c.name}</Label>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border bg-background p-5">
          <h2 className="font-sans text-sm font-semibold tracking-normal">Products in this article</h2>
          <ol className="flex flex-col gap-1">
            {v.product_ids.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm">
                {products.find((p) => p.id === id)?.name ?? id}
                <button type="button" aria-label="Remove product" className="text-muted-foreground hover:text-foreground" onClick={() => set('product_ids', v.product_ids.filter((x) => x !== id))}>×</button>
              </li>
            ))}
          </ol>
          <Label htmlFor="a-product-search" className="sr-only">Add product</Label>
          <Input id="a-product-search" placeholder="Search products to add…" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
          {matches.map((p) => (
            <button key={p.id} type="button" className="rounded-lg px-3 py-1.5 text-left text-sm hover:bg-muted" onClick={() => { set('product_ids', [...v.product_ids, p.id]); setProductQuery('') }}>+ {p.name}</button>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border bg-background p-5">
          <h2 className="font-sans text-sm font-semibold tracking-normal">SEO</h2>
          <div className="flex flex-col gap-1.5"><Label htmlFor="a-seot">SEO title ({v.seo_title.length}/70)</Label><Input id="a-seot" maxLength={70} value={v.seo_title} onChange={(e) => set('seo_title', e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="a-seod">SEO description ({v.seo_description.length}/170)</Label><Textarea id="a-seod" rows={2} maxLength={170} value={v.seo_description} onChange={(e) => set('seo_description', e.target.value)} /></div>
        </section>
      </div>
    </div>
  )
}
