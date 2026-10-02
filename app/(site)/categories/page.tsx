import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { PageHeader } from '@/components/common/basics'
import { CategoryCard } from '@/components/common/cards'
import { allCategories } from '@/lib/db/content'
import { localized } from '@/lib/i18n/content'
import { alternatesFor, getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t('nav.categories'), description: t('pages.categories.meta'), alternates: await alternatesFor('/categories') }
}

export default async function CategoriesPage() {
  const [cats, { t, locale }] = await Promise.all([allCategories(), getI18n()])
  const parents = cats.filter((c) => !c.parent_id)
  return (
    <div className="container-page py-10">
      <PageHeader eyebrow={t('footer.browse')} title={t('nav.categories')} description={t('pages.categories.description')} className="mb-10" />
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
                      {localized(s, 'name', locale)}
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
