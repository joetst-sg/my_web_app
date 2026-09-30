import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, Pencil, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/common/basics'
import { Pagination } from '@/components/common/pagination'
import { ActionButton } from '@/components/admin/action-button'
import { deleteProduct, reviewSubmission, setFeatured } from '@/lib/actions/admin'
import { getViewer } from '@/lib/auth'
import { formatDate, labels } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import { escapeLike } from '@/lib/validation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Products' }

const PAGE = 30
const statuses = ['all', 'published', 'pending_review', 'changes_requested', 'approved', 'scheduled', 'draft', 'rejected', 'archived'] as const
const tone = { published: 'success', pending_review: 'info', changes_requested: 'warning', approved: 'success', scheduled: 'accent', draft: 'neutral', rejected: 'danger', archived: 'neutral' } as const

export default async function AdminProductsPage({ searchParams }: PageProps<'/admin/products'>) {
  const sp = await searchParams
  const status = statuses.find((s) => s === sp.status) ?? 'all'
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 100) : ''
  const page = Math.max(1, Number(sp.page) || 1)
  const viewer = await getViewer()
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select(
      'id, name, slug, status, view_count, save_count, published_at, seller_id, brand:brands ( name ), images:product_images ( storage_path, position ), categories:product_categories ( is_primary, category:categories ( name ) ), submission:submissions ( id, status ), featured:featured_products ( placement )',
      { count: 'exact' },
    )
  if (status !== 'all') query = query.eq('status', status)
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`)
  const { data, count } = await query.order('updated_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1)

  const sellerIds = [...new Set((data ?? []).map((p) => p.seller_id).filter(Boolean))] as string[]
  const { data: sellers } = sellerIds.length ? await supabase.from('seller_profiles').select('user_id, company_name').in('user_id', sellerIds) : { data: [] }
  const sellerName = new Map((sellers ?? []).map((s) => [s.user_id, s.company_name]))
  const href = (p: Record<string, string | number | undefined>) => {
    const params = { status: status === 'all' ? undefined : status, q: q || undefined, ...p }
    const entries = Object.entries(params).filter(([k, v]) => v !== undefined && v !== '' && !(k === 'page' && Number(v) === 1))
    return `/admin/products?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Products <span className="text-lg font-normal text-muted-foreground">({count ?? 0})</span></h1>
        <Button asChild><Link href="/seller/products/new"><Plus />Add product manually</Link></Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2" action="/admin/products">
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">Search products</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Search by name" className="h-9 w-56 bg-background" />
          <Button type="submit" variant="outline">Search</Button>
        </form>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
          {statuses.map((s) => (
            <Link key={s} href={href({ status: s === 'all' ? undefined : s, page: undefined })} aria-current={status === s ? 'page' : undefined} className={cn('rounded-full px-3 py-1.5 text-xs font-medium', status === s ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
              {s === 'all' ? 'All' : labels.productStatus[s]}
            </Link>
          ))}
        </nav>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              {['Image', 'Product', 'Brand', 'Category', 'Seller', 'Status', 'Views', 'Saves', 'Published', 'Actions'].map((h) => (
                <th key={h} className={cn('p-3 font-medium', (h === 'Views' || h === 'Saves') && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).map((p) => {
              const img = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0]
              const cat = p.categories?.find((c) => c.is_primary)?.category?.name ?? p.categories?.[0]?.category?.name
              const sub = Array.isArray(p.submission) ? p.submission[0] : p.submission
              const featuredToday = p.featured?.some((f) => f.placement === 'featured_today')
              return (
                <tr key={p.id} className="align-middle hover:bg-surface">
                  <td className="p-3">{img ? <Image src={productImageUrl(img.storage_path)!} alt="" width={80} height={60} className="h-10 w-14 rounded object-cover" /> : <span className="block h-10 w-14 rounded bg-muted" />}</td>
                  <td className="p-3"><Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">{p.name}</Link></td>
                  <td className="p-3">{p.brand?.name ?? '—'}</td>
                  <td className="p-3">{cat ?? '—'}</td>
                  <td className="p-3">{(p.seller_id && sellerName.get(p.seller_id)) ?? <span className="text-muted-foreground">Editorial</span>}</td>
                  <td className="p-3"><StatusPill tone={tone[p.status]}>{labels.productStatus[p.status]}</StatusPill></td>
                  <td className="p-3 text-right tabular-nums">{p.view_count}</td>
                  <td className="p-3 text-right tabular-nums">{p.save_count}</td>
                  <td className="p-3 text-muted-foreground">{p.published_at ? formatDate(p.published_at) : '—'}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.status === 'published' && <Button asChild variant="ghost" size="icon-sm" aria-label={`View ${p.name}`}><Link href={`/products/${p.slug}`}><Eye /></Link></Button>}
                      <Button asChild variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`}><Link href={`/admin/products/${p.id}`}><Pencil /></Link></Button>
                      {p.status === 'published' && (
                        <ActionButton size="sm" variant={featuredToday ? 'secondary' : 'ghost'} action={setFeatured.bind(null, p.id, 'featured_today', !featuredToday, null)}>
                          <Sparkles />{featuredToday ? 'Featured' : 'Feature'}
                        </ActionButton>
                      )}
                      {sub && ['approved', 'scheduled', 'submitted', 'under_review'].includes(sub.status) && (
                        <>
                          <Button asChild variant="ghost" size="sm"><Link href={`/admin/submissions/${sub.id}`}>Schedule</Link></Button>
                          <ActionButton size="sm" variant="ghost" action={reviewSubmission.bind(null, { submissionId: sub.id, action: 'publish' })}>Publish</ActionButton>
                        </>
                      )}
                      {sub && p.status === 'published' && (
                        <ActionButton size="sm" variant="ghost" action={reviewSubmission.bind(null, { submissionId: sub.id, action: 'archive' })} confirm={{ title: `Archive ${p.name}?`, description: 'It will disappear from the site but can be found here.' }}>Archive</ActionButton>
                      )}
                      {viewer?.isAdmin && (
                        <ActionButton size="sm" variant="ghost" className="text-destructive" action={deleteProduct.bind(null, p.id)} confirm={{ title: `Delete ${p.name}?`, description: 'This permanently deletes the product, its images and history.', confirmLabel: 'Delete' }}>Delete</ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={Math.ceil((count ?? 0) / PAGE)} hrefFor={(p) => href({ page: p })} />
    </div>
  )
}
