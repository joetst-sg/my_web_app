import { PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { Pagination } from '@/components/common/pagination'
import { createClient } from '@/lib/supabase/server'
import { filtersToSearchParams, listProducts, sortOptions, type ProductFilters } from '@/lib/db/products'
import { ClearFilters, FilterSidebar, MobileFilterDrawer, SortSelect } from './filter-panel'
import { ProductGrid } from './product-grid'

const FILTER_KEYS = ['category', 'brand', 'price_min', 'price_max', 'rating', 'availability', 'discount', 'new', 'trending', 'featured', 'crowdfunding', 'deal'] as const

async function filterOptions() {
  const supabase = await createClient()
  const [{ data: cats }, { data: brands }] = await Promise.all([
    supabase.from('categories').select('id, slug, name, parent_id, sort_order').order('sort_order'),
    supabase.from('brands').select('slug, name').eq('is_published', true).order('name'),
  ])
  const parents = (cats ?? []).filter((c) => !c.parent_id)
  const ordered = parents.flatMap((p) => [
    { slug: p.slug, name: p.name, parent: null },
    ...(cats ?? []).filter((c) => c.parent_id === p.id).map((c) => ({ slug: c.slug, name: c.name, parent: p.slug })),
  ])
  return { categories: ordered, brands: brands ?? [] }
}

// Shared listing used by /products, /discover, /search, /trending, /new,
// category and brand pages. Fixed filters (e.g. the category of a category
// page) are merged with the URL filters.
export async function ProductListing({
  filters,
  fixed = {},
  basePath,
  defaultSort = 'trending',
  emptyTitle = 'No products match these filters',
  emptyDescription = 'Try removing a filter or searching for something else.',
}: {
  filters: ProductFilters
  fixed?: Partial<ProductFilters>
  basePath: string
  defaultSort?: string
  emptyTitle?: string
  emptyDescription?: string
}) {
  const merged = { ...filters, ...fixed, sort: filters.sort ?? (filters.q ? 'relevance' : defaultSort) }
  const [result, options] = await Promise.all([listProducts(merged), filterOptions()])
  const activeCount = FILTER_KEYS.filter((k) => filters[k] !== undefined && filters[k] !== false && !(k in fixed)).length
  const sorts = merged.q ? sortOptions : sortOptions.filter((s) => s.value !== 'relevance')
  const lock = { lockCategory: 'category' in fixed, lockBrand: 'brand' in fixed }

  return (
    <div className="flex gap-10">
      <FilterSidebar categories={options.categories} brands={options.brands} {...lock} />
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {result.total} product{result.total === 1 ? '' : 's'}
            {merged.q && <> for “<span className="text-foreground">{merged.q}</span>”</>}
          </p>
          <div className="flex items-center gap-2">
            {activeCount > 0 && <ClearFilters keys={[...FILTER_KEYS]} />}
            <MobileFilterDrawer categories={options.categories} brands={options.brands} {...lock} activeCount={activeCount} total={result.total} />
            <SortSelect options={sorts} value={merged.sort!} />
          </div>
        </div>
        {result.items.length === 0 ? (
          <EmptyState icon={PackageSearch} title={emptyTitle} description={emptyDescription} />
        ) : (
          <>
            <ProductGrid products={result.items} priorityCount={4} />
            <Pagination
              className="mt-12"
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={(page) => {
                const sp = filtersToSearchParams({ ...filters, page })
                return `${basePath}${sp.size ? `?${sp}` : ''}`
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
