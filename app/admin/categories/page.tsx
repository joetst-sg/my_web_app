import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusPill } from '@/components/common/basics'
import { CategoryIcon } from '@/components/common/category-icon'
import { ActionButton } from '@/components/admin/action-button'
import { deleteCategory } from '@/lib/actions/admin'
import { getViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CategoryForm } from './category-form'

export const metadata: Metadata = { title: 'Categories' }

export default async function AdminCategoriesPage() {
  const viewer = await getViewer()
  const supabase = await createClient()
  const [{ data: cats }, { data: links }] = await Promise.all([
    supabase.from('categories').select('id, slug, name, description, parent_id, color, icon, seo_title, seo_description, is_featured, sort_order, follower_count').order('sort_order'),
    supabase.from('product_categories').select('category_id'),
  ])
  const all = cats ?? []
  const parents = all.filter((c) => !c.parent_id)
  const count = (id: string) => (links ?? []).filter((l) => l.category_id === id).length
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold">Categories</h1>
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">New category</h2>
        <CategoryForm parents={parents} />
      </section>
      <div className="flex flex-col gap-3">
        {parents.flatMap((p) => [p, ...all.filter((c) => c.parent_id === p.id)]).map((c) => (
          <details key={c.id} className={`rounded-2xl border bg-background ${c.parent_id ? 'ml-8' : ''}`}>
            <summary className="flex cursor-pointer items-center gap-3 p-4">
              <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: c.color ?? '#475467' }}><CategoryIcon name={c.icon} className="size-4" /></span>
              <span className="flex-1 font-medium">{c.name} <span className="font-normal text-muted-foreground">/{c.slug}</span></span>
              {c.is_featured && <StatusPill tone="accent">Featured</StatusPill>}
              <span className="text-sm text-muted-foreground">{count(c.id)} products · {c.follower_count} followers</span>
            </summary>
            <div className="border-t p-4">
              <CategoryForm category={c} parents={parents} />
              <div className="mt-3 flex gap-2">
                <Link href={`/categories/${c.slug}`} className="text-sm underline underline-offset-4">View page</Link>
                {viewer?.isAdmin && (
                  <ActionButton size="sm" variant="ghost" className="text-destructive" action={deleteCategory.bind(null, c.id)} confirm={{ title: `Delete ${c.name}?`, description: 'Products stay, but lose this category. Subcategories become top-level.', confirmLabel: 'Delete' }}>
                    Delete category
                  </ActionButton>
                )}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
