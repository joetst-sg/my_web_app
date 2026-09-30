import { z } from 'zod'

// Product listing filters. They live in the URL so filtered views are shareable,
// e.g. /products?category=gaming&sort=trending&price_max=500

export const sortOptions = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'most_saved', label: 'Most saved' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'discount', label: 'Biggest discount' },
] as const

const boolParam = z
  .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
  .optional()
  .transform((v) => v === '1' || v === 'true')

const numParam = z.coerce.number().min(0).max(1_000_000).optional().catch(undefined)

export const filterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().regex(/^[a-z0-9-]+$/).max(60).optional().catch(undefined),
  brand: z.string().regex(/^[a-z0-9-]+$/).max(60).optional().catch(undefined),
  price_min: numParam,
  price_max: numParam,
  rating: z.coerce.number().min(0).max(10).optional().catch(undefined),
  availability: z.enum(['available', 'coming_soon', 'preorder', 'crowdfunding', 'sold_out', 'discontinued']).optional().catch(undefined),
  discount: boolParam.catch(false),
  new: boolParam.catch(false),
  trending: boolParam.catch(false),
  featured: boolParam.catch(false),
  crowdfunding: boolParam.catch(false),
  deal: boolParam.catch(false),
  sort: z.enum(sortOptions.map((s) => s.value) as [string, ...string[]]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(1),
})

export type ProductFilters = z.infer<typeof filterSchema>

export function parseFilters(params: Record<string, string | string[] | undefined>): ProductFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  return filterSchema.parse(flat)
}

export function filtersToSearchParams(filters: Partial<ProductFilters>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === false || v === '') continue
    if (k === 'page' && v === 1) continue
    sp.set(k, v === true ? '1' : String(v))
  }
  return sp
}

