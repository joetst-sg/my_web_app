import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'
import { htmlLang, locales, localizePath } from '@/lib/i18n/config'
import { createPublicClient } from '@/lib/supabase/server'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()
  const [{ data: products }, { data: categories }, { data: brands }, { data: collections }, { data: articles }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('status', 'published').limit(10000),
    supabase.from('categories').select('slug, updated_at'),
    supabase.from('brands').select('slug, updated_at').eq('is_published', true),
    supabase.from('collections').select('slug, updated_at').eq('visibility', 'public').gt('product_count', 0),
    supabase.from('articles').select('slug, updated_at').eq('status', 'published'),
  ])
  const staticPages = ['', '/discover', '/products', '/trending', '/new', '/deals', '/categories', '/brands', '/collections', '/magazine', '/submit', '/about', '/contact', '/privacy', '/terms', '/cookies']
  type Entry = Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'> & { path: string }
  const entries: Entry[] = [
    ...staticPages.map((p) => ({ path: p || '/', changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.6 })),
    ...(products ?? []).map((p) => ({ path: `/products/${p.slug}`, lastModified: p.updated_at, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...(categories ?? []).map((c) => ({ path: `/categories/${c.slug}`, lastModified: c.updated_at, priority: 0.7 })),
    ...(brands ?? []).map((b) => ({ path: `/brands/${b.slug}`, lastModified: b.updated_at, priority: 0.5 })),
    ...(collections ?? []).map((c) => ({ path: `/collections/${c.slug}`, lastModified: c.updated_at, priority: 0.5 })),
    ...(articles ?? []).map((a) => ({ path: `/magazine/${a.slug}`, lastModified: a.updated_at, priority: 0.6 })),
  ]
  // One URL per language, each listing every language version (hreflang).
  const abs = (path: string) => `${site.url}${path === '/' ? '' : path}`
  return entries.flatMap(({ path, ...rest }) => {
    const languages: Record<string, string> = { 'x-default': abs(path) }
    for (const l of locales) languages[htmlLang[l]] = abs(localizePath(path, l))
    return locales.map((l) => ({ ...rest, url: abs(localizePath(path, l)), alternates: { languages } }))
  })
}
