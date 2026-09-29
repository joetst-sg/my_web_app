import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark } from '@/components/common/basics'
import { SearchBar } from '@/components/site/search-bar'
import { ProductListing } from '@/components/product/product-listing'
import { TrackOnMount } from '@/components/common/track'
import { parseFilters } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'
import { escapeLike } from '@/lib/validation'

export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const { q } = parseFilters(await searchParams)
  return { title: q ? `Search: ${q}` : 'Search', robots: { index: false, follow: true } }
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const filters = parseFilters(await searchParams)
  const q = filters.q?.trim() ?? ''
  let brands: { slug: string; name: string; logo_url: string | null }[] = []
  let categories: { slug: string; name: string }[] = []
  if (q.length >= 2) {
    const supabase = await createClient()
    const like = `%${escapeLike(q)}%`
    const [b, c] = await Promise.all([
      supabase.from('brands').select('slug, name, logo_url').eq('is_published', true).ilike('name', like).limit(6),
      supabase.from('categories').select('slug, name').ilike('name', like).limit(6),
    ])
    brands = b.data ?? []
    categories = c.data ?? []
  }

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{q ? `Results for “${q}”` : 'Search'}</h1>
      <SearchBar className="mt-6 max-w-xl lg:hidden" />
      {q && <TrackOnMount event={{ event: 'search', query: q }} />}
      {(brands.length > 0 || categories.length > 0) && (
        <div className="mt-8 flex flex-col gap-4">
          {brands.length > 0 && (
            <div>
              <h2 className="eyebrow mb-2">Brands</h2>
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
              <h2 className="eyebrow mb-2">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:border-foreground/30">
                    {c.name}
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
            emptyTitle={`No products found for “${q}”`}
            emptyDescription="Check the spelling, try a more general term, or browse categories instead."
          />
        ) : (
          <p className="text-muted-foreground">Type a product, brand, category or model number to search.</p>
        )}
      </div>
    </div>
  )
}
