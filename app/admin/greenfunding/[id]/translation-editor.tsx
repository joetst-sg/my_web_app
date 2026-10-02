'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { resetSummary, saveSummaryAndTranslate, saveTranslations, updateCampaignUrl } from '@/lib/actions/greenfunding'

export type Texts = { title: string; short_description: string; description: string; seo_title: string; seo_description: string }
type Source = { title: string | null; short_description: string | null; description: string | null; summary: string | null; summaryEdited: boolean }

const FIELDS: [keyof Texts, string, number, boolean][] = [
  ['title', 'Title', 120, false],
  ['short_description', 'Short description', 200, false],
  ['description', 'Full description', 20000, true],
  ['seo_title', 'SEO title', 70, false],
  ['seo_description', 'SEO description', 170, false],
]

function Column({ lang, label, value, onChange }: { lang: 'en' | 'zh-HK'; label: string; value: Texts; onChange: (v: Texts) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-3" lang={lang}>
      <h3 className="font-sans text-sm font-semibold tracking-normal">{label}</h3>
      {FIELDS.map(([k, name, max, long]) => (
        <div key={k} className="flex flex-col gap-1.5">
          <Label htmlFor={`${lang}-${k}`} className="text-xs text-muted-foreground">
            {name}{max <= 300 ? ` (${value[k].length}/${max})` : ''}
          </Label>
          {long ? (
            <Textarea id={`${lang}-${k}`} rows={18} value={value[k]} maxLength={max} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className="font-[inherit] text-sm" />
          ) : (
            <Input id={`${lang}-${k}`} value={value[k]} maxLength={max} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
          )}
        </div>
      ))}
    </div>
  )
}

export function TranslationEditor({ productId, source, en: initialEn, zh: initialZh }: { productId: string; source: Source; en: Texts; zh: Texts }) {
  const router = useRouter()
  const [en, setEn] = useState(initialEn)
  const [zh, setZh] = useState(initialZh)
  const [pending, start] = useTransition()
  const dirty = JSON.stringify([en, zh]) !== JSON.stringify([initialEn, initialZh])
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-3" lang="ja">
          <h3 className="font-sans text-sm font-semibold tracking-normal">Original Japanese <span className="font-normal text-muted-foreground">(read-only source)</span></h3>
          {([['Title', source.title], ['Short description', source.short_description]] as const).map(([name, text]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">{name}</p>
              <div className="whitespace-pre-wrap rounded-lg border bg-muted/40 px-3 py-2 text-sm">{text ?? '—'}</div>
            </div>
          ))}
          <SummaryEditor productId={productId} summary={source.summary} edited={source.summaryEdited} />
          <details className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">Full campaign description (reference only, not translated)</summary>
            <div className="mt-2 max-h-[30rem] overflow-y-auto whitespace-pre-wrap">{source.description ?? '—'}</div>
          </details>
        </div>
        <Column lang="en" label="English" value={en} onChange={setEn} />
        <Column lang="zh-HK" label="Traditional Chinese 繁體中文" value={zh} onChange={setZh} />
      </div>
      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-background/95 py-3 backdrop-blur">
        {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        <Button
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const res = await saveTranslations(productId, { en, zh })
              if (res.ok) {
                toast.success(res.message)
                router.refresh()
              } else toast.error(res.error)
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />}Save translations
        </Button>
      </div>
    </div>
  )
}

export function CampaignUrlEditor({ productId, url }: { productId: string; url: string }) {
  const router = useRouter()
  const [value, setValue] = useState(url)
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-sm underline">{url}</a>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Change</Button>
      </div>
    )
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const res = await updateCampaignUrl(productId, value)
          if (res.ok) {
            toast.success(res.message)
            setEditing(false)
            router.refresh()
          } else toast.error(res.error)
        })
      }}
    >
      <Label htmlFor="campaign-url" className="sr-only">Campaign URL</Label>
      <Input id="campaign-url" value={value} onChange={(e) => setValue(e.target.value)} className="min-w-72 flex-1 font-mono text-sm" />
      <Button size="sm" type="submit" disabled={pending}>Save</Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => { setValue(url); setEditing(false) }}>Cancel</Button>
    </form>
  )
}

// The Japanese summary is what gets translated. Editing it and clicking
// "Save & translate" replaces the English and Chinese text.
function SummaryEditor({ productId, summary, edited }: { productId: string; summary: string | null; edited: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(summary ?? '')
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn()
      if (res.ok) {
        toast.success(res.message)
        router.refresh()
      } else toast.error(res.error)
    })
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="ja-summary" className="text-xs text-muted-foreground">
        Summary — translated into English and Chinese ({value.length} characters{edited ? ', edited' : ', automatic'})
      </Label>
      <Textarea id="ja-summary" lang="ja" rows={12} maxLength={3000} value={value} onChange={(e) => setValue(e.target.value)} className="text-sm" />
      <p className="text-xs text-muted-foreground">Introduction and key features only — no support plans or prices. Shorter summaries use less of the translation quota.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || value.trim().length < 10} onClick={() => run(() => saveSummaryAndTranslate(productId, value))}>
          {pending && <Loader2 className="animate-spin" />}Save &amp; translate
        </Button>
        {edited && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resetSummary(productId))}>Restore automatic summary</Button>}
      </div>
    </div>
  )
}
