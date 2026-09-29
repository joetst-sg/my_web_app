import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/common/basics'
import { CategoryCard } from '@/components/common/cards'
import { allCategories } from '@/lib/db/content'

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse products by category: AI gadgets, smart home, audio, travel, photography and more.',
  alternates: { canonical: '/categories' },
}

export default async function CategoriesPage() {
  const cats = await allCategories()
  const parents = cats.filter((c) => !c.parent_id)
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Browse" title="Categories" description="Every product sits in at least one category. Follow the ones you care about to shape your feed." className="mb-10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {parents.map((c) => {
          const children = cats.filter((x) => x.parent_id === c.id)
          return (
            <div key={c.id} className="flex flex-col gap-2">
              <CategoryCard category={c} className="min-h-36" />
              {children.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  {children.map((s) => (
                    <Link key={s.id} href={`/categories/${s.slug}`} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium hover:bg-accent">
                      {s.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
