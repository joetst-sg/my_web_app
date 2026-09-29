import type { Metadata } from 'next'
import { FolderHeart } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { CollectionCard } from '@/components/common/cards'
import { requireViewer } from '@/lib/auth'
import { withCollectionImages } from '@/lib/db/content'
import { createClient } from '@/lib/supabase/server'
import { NewCollectionButton } from './new-collection'

export const metadata: Metadata = { title: 'Your collections', robots: { index: false } }

export default async function MyCollectionsPage() {
  const viewer = await requireViewer('/account/collections')
  const supabase = await createClient()
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
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Your collections</h1>
          <p className="mt-1 text-muted-foreground">Group products into public or private collections and share them.</p>
        </div>
        <NewCollectionButton />
      </div>
      {collections.length === 0 ? (
        <EmptyState icon={FolderHeart} title="Create your first collection." description="Collections are lists of products — a dream desk, a gift list, a trip kit." action={<NewCollectionButton />} />
      ) : (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <CollectionCard collection={c} images={c.images} />
              <a href={`/account/collections/${c.id}`} className="text-sm font-medium underline underline-offset-4">Manage</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
