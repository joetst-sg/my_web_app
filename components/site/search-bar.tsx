'use client'

import Image from 'next/image'
import { useLocalizedRouter, useT } from '@/components/i18n/provider'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Clock, Loader2, Search, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { productImageUrl } from '@/lib/images'
import type { Locale } from '@/lib/i18n/config'
import { useLocale } from '@/components/i18n/provider'
import { fromTranslations } from '@/lib/i18n/content'

type Suggest = {
  products: { slug: string; name: string; brand_name: string | null; image_path: string | null }[]
  brands: { slug: string; name: string }[]
  categories: { slug: string; name: string; translations?: unknown }[]
  popular?: string[]
}

type Option = { key: string; href: string; label: string; sub?: string; kind: 'query' | 'recent' | 'popular' | 'product' | 'brand' | 'category'; image?: string | null }

const RECENT_KEY = 'loupe:recent-searches'

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 6)
  } catch {
    return []
  }
}

function pushRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable: recent searches are a convenience only
  }
}

export function SearchBar({ className, autoFocus = false, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useLocalizedRouter()
  const t = useT()
  const locale: Locale = useLocale()
  const listId = useId()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Suggest | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const [active, setActive] = useState(-1)
  const cache = useRef(new Map<string, Suggest>())
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => setRecent(readRecent()), [])

  // Debounced fetch with cancellation and an in-memory cache, so typing does
  // not fire a request per keystroke.
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    const key = term.length < 2 ? '' : term.toLowerCase()
    if (cache.current.has(key)) {
      setData(cache.current.get(key)!)
      return
    }
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(key)}`, { signal: controller.signal })
        const json = (await res.json()) as Suggest
        cache.current.set(key, json)
        setData(json)
      } catch {
        // aborted or offline: keep previous suggestions
      } finally {
        setLoading(false)
      }
    }, key ? 200 : 0)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [q, open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const options: Option[] = useMemo(() => {
    const term = q.trim()
    const out: Option[] = []
    if (term.length >= 2) {
      out.push({ key: 'q', kind: 'query', href: `/search?q=${encodeURIComponent(term)}`, label: t('search.searchFor', { term }) })
      data?.products?.forEach((p) => out.push({ key: `p-${p.slug}`, kind: 'product', href: `/products/${p.slug}`, label: p.name, sub: p.brand_name ?? undefined, image: p.image_path }))
      data?.brands?.forEach((b) => out.push({ key: `b-${b.slug}`, kind: 'brand', href: `/brands/${b.slug}`, label: b.name, sub: t('search.brand') }))
      data?.categories?.forEach((c) => out.push({ key: `c-${c.slug}`, kind: 'category', href: `/categories/${c.slug}`, label: fromTranslations(c.translations, 'name', locale, c.name), sub: t('search.category') }))
    } else {
      recent.forEach((r) => out.push({ key: `r-${r}`, kind: 'recent', href: `/search?q=${encodeURIComponent(r)}`, label: r }))
      data?.popular?.filter((p) => !recent.includes(p)).forEach((p) => out.push({ key: `s-${p}`, kind: 'popular', href: `/search?q=${encodeURIComponent(p)}`, label: p }))
    }
    return out
  }, [q, data, recent, t, locale])

  function go(option: Option | null) {
    const term = q.trim()
    const href = option?.href ?? (term ? `/search?q=${encodeURIComponent(term)}` : null)
    if (!href) return
    if (option?.kind === 'query' || option?.kind === 'recent' || option?.kind === 'popular' || !option) {
      pushRecent(option && option.kind !== 'query' ? option.label : term)
      setRecent(readRecent())
    }
    setOpen(false)
    setActive(-1)
    onNavigate?.()
    router.push(href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(active >= 0 ? options[active] : null)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && options.length > 0
  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          go(null)
        }}
      >
        <label htmlFor={`${listId}-input`} className="sr-only">{t('search.description')}</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={t('search.placeholder')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          maxLength={100}
          className="h-10 w-full rounded-full border bg-muted/60 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30 focus:bg-background [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label={t('search.loading')} />
        ) : q ? (
          <button type="button" aria-label={t('search.clear')} onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-50 max-h-[70vh] overflow-auto rounded-2xl border bg-popover p-2 shadow-lg">
          {q.trim().length < 2 && recent.length > 0 && <li className="eyebrow px-3 pb-1 pt-2" role="presentation">{t('search.recent')}</li>}
          {options.map((o, i) => (
            <li key={o.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              {o.kind === 'popular' && (i === 0 || options[i - 1].kind !== 'popular') && (
                <span className="eyebrow block px-3 pb-1 pt-2">{t('search.suggested')}</span>
              )}
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(o)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm', i === active && 'bg-muted')}
              >
                {o.kind === 'product' && o.image ? (
                  <Image src={productImageUrl(o.image)!} alt="" width={40} height={30} className="h-8 w-10 rounded-md object-cover" />
                ) : o.kind === 'recent' ? (
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                ) : o.kind === 'popular' ? (
                  <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <Search className="size-4 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.sub && <span className="shrink-0 text-xs text-muted-foreground">{o.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
