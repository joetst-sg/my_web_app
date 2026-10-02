import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { BrandMark } from '@/components/common/basics'
import { SearchBar } from '@/components/site/search-bar'
import { ProductListing } from '@/components/product/product-listing'
import { TrackOnMount } from '@/components/common/track'
import { parseFilters } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'
import { escapeLike } from '@/lib/validation'
import { localized } from '@/lib/i18n/content'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const [{ q }, { t }] = await Promise.all([searchParams.then(parseFilters), getI18n()])
  return { title: q ? t('pages.search.metaTitleQuery', { q }) : t('search.label'), robots: { index: false, follow: true } }
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const [filters, { t, locale }] = await Promise.all([searchParams.then(parseFilters), getI18n()])
  const q = filters.q?.trim() ?? ''
  let brands: { slug: string; name: string; logo_url: string | null }[] = []
  let categories: { slug: string; name: string; translations: unknown }[] = []
  if (q.length >= 2) {
    const supabase = await createClient()
    const like = `%${escapeLike(q)}%`
    const [b, c] = await Promise.all([
      supabase.from('brands').select('slug, name, logo_url').eq('is_published', true).ilike('name', like).limit(6),
      // Values are double-quoted so commas or parentheses in the query can't break the filter.
      supabase.from('categories').select('slug, name, translations').or(`name.ilike.${JSON.stringify(like)},translations->"zh-HK"->>name.ilike.${JSON.stringify(like)}`).limit(6),
    ])
    brands = b.data ?? []
    categories = c.data ?? []
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{q ? t('pages.search.resultsFor', { q }) : t('search.label')}</h1>
      <SearchBar className="mt-6 max-w-xl lg:hidden" />
      {q && <TrackOnMount event={{ event: 'search', query: q }} />}
      {(brands.length > 0 || categories.length > 0) && (
        <div className="mt-8 flex flex-col gap-4">
          {brands.length > 0 && (
            <div>
              <h2 className="eyebrow mb-2">{t('nav.brands')}</h2>
              <div className="flex flex-wrap gap-2">
                {brands.map((b) => (
                  <Link key={b.slug} href={`/brands/${b.slug}`} className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium hover:border-foreground/30">
                    <BrandMark name={b.name} logoUrl={b.logo_url} size={26} className="rounded-full" />
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {categories.length > 0 && (
            <div>
              <h2 className="eyebrow mb-2">{t('nav.categories')}</h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-foreground/30">
                    {localized(c, 'name', locale)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-10">
        {q ? (
          <ProductListing
            filters={filters}
            basePath="/search"
            defaultSort="relevance"
            emptyTitle={t('pages.search.emptyTitle', { q })}
            emptyDescription={t('pages.search.emptyDescription')}
          />
        ) : (
          <p className="text-muted-foreground">{t('pages.search.prompt')}</p>
        )}
      </div>
    </div>
  )
}
