import { site } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/server'

export const revalidate = 1800

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)

// RSS 2.0 feed of newly published products.
export async function GET() {
  const supabase = createPublicClient()
  const { data: products } = await supabase.from('products').select('slug, name, tagline, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(30)
  const items = (products ?? [])
    .map((p) => ({ title: `New: ${p.name}`, link: `${site.url}/products/${p.slug}`, description: p.tagline, date: p.published_at }))
    .filter((i) => i.date)
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .slice(0, 30)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(site.name)}</title>
<link>${site.url}</link>
<description>${esc(site.description)}</description>
<language>en</language>
<atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (i) => `<item><title>${esc(i.title)}</title><link>${i.link}</link><guid>${i.link}</guid><pubDate>${new Date(i.date!).toUTCString()}</pubDate><description>${esc(i.description)}</description></item>`,
  )
  .join('\n')}
</channel>
</rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=1800' } })
}
