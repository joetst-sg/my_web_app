import type { Metadata } from 'next'
import { FolderHeart } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { requireViewer } from '@/lib/auth'
import { withCollectionImages } from '@/lib/db/content'
import { createClient } from '@/lib/supabase/server'
import { NewCollectionButton } from './new-collection'
import Link from '@/components/i18n/link'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('account.collections.title'), robots: { index: false } }
}

export default async function MyCollectionsPage() {
  const viewer = await requireViewer('/account/collections')
  const supabase = await createClient()
  const t = await getT()
  const { data } = await supabase
    .from('collections')
    .select('id, slug, title, description, product_count, is_editorial, visibility, owner_id, follower_count, updated_at')
    .eq('owner_id', viewer.id)
    .order('updated_at', { ascending: false })
  const collections = await withCollectionImages(data ?? [])
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('account.collections.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('account.collections.intro')}</p>
        </div>
        <NewCollectionButton />
      </div>
      {collections.length === 0 ? (
        <EmptyState icon={FolderHeart} title={t('collections.createFirst')} description={t('account.collections.emptyBody')} action={<NewCollectionButton />} />
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <CollectionCard collection={c} images={c.images} />
              <Link href={`/account/collections/${c.id}`} className="text-sm font-medium underline underline-offset-4">{t('account.collections.manage')}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
