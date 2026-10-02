import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { Lock, Pencil } from 'lucide-react'
import { EmptyState, StatusPill } from '@/components/common/basics'
import { FollowButton } from '@/components/common/follow-button'
import { TrackOnMount } from '@/components/common/track'
import { Button } from '@/components/ui/button'
import { ProductGrid } from '@/components/product/product-grid'
import { ShareButton } from '@/components/product/share-button'
import { getViewer } from '@/lib/auth'
import { productsByIds } from '@/lib/db/products'
import { localizePath } from '@/lib/i18n/config'
import { alternatesFor, getI18n } from '@/lib/i18n/server'
import { site } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

const getCollection = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('id, slug, title, description, visibility, is_editorial, owner_id, product_count, follower_count, created_at, updated_at')
    .eq('slug', slug)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: PageProps<'/collections/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [c, { t }] = await Promise.all([getCollection(slug), getI18n()])
  if (!c || c.visibility !== 'public') return { title: t('collections.collection'), robots: { index: false } }
  return {
    title: c.title,
    description: c.description ?? t('pages.collection.metaDescription', { count: c.product_count, site: site.name }),
    alternates: await alternatesFor(`/collections/${c.slug}`),
  }
}

export default async function CollectionPage({ params }: PageProps<'/collections/[slug]'>) {
  const { slug } = await params
  const collection = await getCollection(slug)
  if (!collection) notFound()
  const supabase = await createClient()
  const [viewer, { t, f, locale }] = await Promise.all([getViewer(), getI18n()])
  const isOwner = viewer?.id === collection.owner_id

  const [{ data: links }, { data: owner }, following] = await Promise.all([
    supabase.from('collection_products').select('product_id, position, note').eq('collection_id', collection.id).order('position'),
    collection.owner_id ? supabase.from('profiles').select('display_name, username').eq('id', collection.owner_id).maybeSingle() : Promise.resolve({ data: null }),
    viewer && !isOwner
      ? supabase.from('collection_followers').select('collection_id').eq('user_id', viewer.id).eq('collection_id', collection.id).maybeSingle().then((r) => Boolean(r.data))
      : Promise.resolve(false),
  ])
  const products = (await productsByIds((links ?? []).map((l) => l.product_id))).filter((p) => p.status === 'published')
  const url = `${site.url}${localizePath(`/collections/${collection.slug}`, locale)}`
  const by = collection.is_editorial ? t('pages.collection.editors', { site: site.name }) : owner?.display_name || owner?.username || t('pages.collection.member')

  return (
    <div className="container-page py-10">
      {collection.visibility === 'public' && <TrackOnMount event={{ event: 'page_view', collectionId: collection.id }} />}
      <header className="flex flex-col gap-6 border-b pb-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow flex items-center gap-2">
            {collection.is_editorial ? t('collections.editorial') : t('collections.community')}
            {collection.visibility === 'private' && <StatusPill className="h-5"><Lock className="size-3" />{t('common.private')}</StatusPill>}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl">{collection.title}</h1>
          {collection.description && <p className="mt-3 text-lg text-muted-foreground">{collection.description}</p>}
          <p className="mt-3 text-sm text-muted-foreground">
            {t('pages.collection.meta', { by, count: collection.product_count, date: f.date(collection.updated_at) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Button asChild variant="outline" size="lg"><Link href={`/account/collections/${collection.id}`}><Pencil />{t('pages.collection.edit')}</Link></Button>
          ) : (
            collection.visibility === 'public' && <FollowButton kind="collection" id={collection.id} name={collection.title} initialFollowing={following} />
          )}
          {collection.visibility === 'public' && <ShareButton url={url} title={collection.title} />}
        </div>
      </header>
      <div className="mt-10">
        {products.length === 0 ? (
          <EmptyState title={t('pages.collection.emptyTitle')} description={isOwner ? t('pages.collection.emptyOwner') : t('pages.collection.emptyOther')} />
        ) : (
          <ProductGrid products={products} priorityCount={4} />
        )}
      </div>
    </div>
  )
}
