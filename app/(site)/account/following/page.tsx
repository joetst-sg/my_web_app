import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { Heart } from 'lucide-react'
import { BrandMark, EmptyState } from '@/components/common/basics'
import { FollowButton } from '@/components/common/follow-button'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getI18n, getT } from '@/lib/i18n/server'
import { localized } from '@/lib/i18n/content'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('account.nav.following'), robots: { index: false } }
}

export default async function FollowingPage() {
  const viewer = await requireViewer('/account/following')
  const supabase = await createClient()
  const { t, locale } = await getI18n()
  const [{ data: brands }, { data: cats }, { data: cols }] = await Promise.all([
    supabase.from('brand_followers').select('brand:brands ( id, slug, name, logo_url, tagline )').eq('user_id', viewer.id),
    supabase.from('category_followers').select('category:categories ( id, slug, name, translations )').eq('user_id', viewer.id),
    supabase.from('collection_followers').select('collection:collections ( id, slug, title, product_count )').eq('user_id', viewer.id),
  ])
  const empty = !brands?.length && !cats?.length && !cols?.length

  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('account.nav.following')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('account.following.intro')}</p>
      {empty ? (
        <EmptyState icon={Heart} title={t('account.following.emptyTitle')} description={t('account.following.emptyBody')} />
      ) : (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="mb-3 font-sans text-lg font-semibold tracking-normal">{t('account.following.brands', { count: brands?.length ?? 0 })}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(brands ?? []).map(({ brand: b }) => b && (
                <li key={b.id} className="flex items-center gap-3 rounded-2xl border p-3">
                  <BrandMark name={b.name} logoUrl={b.logo_url} size={40} />
                  <Link href={`/brands/${b.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{b.name}</Link>
                  <FollowButton kind="brand" id={b.id} name={b.name} initialFollowing size="sm" />
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 font-sans text-lg font-semibold tracking-normal">{t('account.following.categories', { count: cats?.length ?? 0 })}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(cats ?? []).map(({ category: c }) => c && (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border p-3">
                  <Link href={`/categories/${c.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{localized(c, 'name', locale)}</Link>
                  <FollowButton kind="category" id={c.id} name={localized(c, 'name', locale)} initialFollowing size="sm" />
                </li>
              ))}
            </ul>
          </section>
          {(cols ?? []).length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-lg font-semibold tracking-normal">{t('account.following.collections', { count: cols!.length })}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {cols!.map(({ collection: c }) => c && (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border p-3">
                    <Link href={`/collections/${c.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{c.title}</Link>
                    <FollowButton kind="collection" id={c.id} name={c.title} initialFollowing size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
