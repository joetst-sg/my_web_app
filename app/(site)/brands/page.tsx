import type { Metadata } from 'next'
import { PageHeader } from '@/components/common/basics'
import { BrandCard } from '@/components/common/cards'
import { createClient } from '@/lib/supabase/server'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('nav.brands'), description: t('pages.brands.meta'), alternates: await alternatesFor('/brands') }
}

export default async function BrandsPage() {
  const supabase = await createClient()
  const t = await getT()
  const [{ data: brands }, { data: counts }] = await Promise.all([
    supabase.from('brands').select('id, slug, name, tagline, logo_url, is_verified, follower_count').eq('is_published', true).order('name'),
    supabase.from('products').select('brand_id').eq('status', 'published'),
  ])
  const countBy = new Map<string, number>()
  for (const c of counts ?? []) if (c.brand_id) countBy.set(c.brand_id, (countBy.get(c.brand_id) ?? 0) + 1)
  const groups = new Map<string, typeof brands>()
  for (const b of brands ?? []) {
    const letter = /[a-z]/i.test(b.name[0]) ? b.name[0].toUpperCase() : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), b])
  }
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('pages.brands.eyebrow')} title={t('nav.brands')} description={t('pages.brands.description', { count: brands?.length ?? 0 })} className="mb-10" />
      <nav aria-label={t('pages.brands.jump')} className="mb-8 flex flex-wrap gap-1">
        {[...groups.keys()].map((l) => (
          <a key={l} href={`#letter-${l}`} className="grid size-9 place-items-center rounded-lg text-sm font-semibold hover:bg-muted">{l}</a>
        ))}
      </nav>
      <div className="flex flex-col gap-10">
        {[...groups.entries()].map(([letter, list]) => (
          <section key={letter} id={`letter-${letter}`} aria-labelledby={`h-${letter}`} className="scroll-mt-24">
            <h2 id={`h-${letter}`} className="mb-4 font-display text-2xl font-bold">{letter}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list!.map((b) => <BrandCard key={b.id} brand={b} productCount={countBy.get(b.id) ?? 0} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
