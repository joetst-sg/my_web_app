import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireViewer } from '@/lib/auth'
import { productsByIds } from '@/lib/db/products'
import { createClient } from '@/lib/supabase/server'
import { CollectionEditor } from './collection-editor'

export const metadata: Metadata = { title: 'Edit collection', robots: { index: false } }

export default async function EditCollectionPage({ params }: PageProps<'/account/collections/[id]'>) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const viewer = await requireViewer(`/account/collections/${id}`)
  const supabase = await createClient()
  const { data: collection } = await supabase
    .from('collections')
    .select('id, slug, title, description, visibility, owner_id')
    .eq('id', id)
    .maybeSingle()
  if (!collection || collection.owner_id !== viewer.id) notFound()
  const { data: links } = await supabase.from('collection_products').select('product_id, position').eq('collection_id', id).order('position')
  const products = await productsByIds((links ?? []).map((l) => l.product_id))
  return (
    <CollectionEditor
      collection={{ id: collection.id, slug: collection.slug, title: collection.title, description: collection.description ?? '', visibility: collection.visibility }}
      products={products.map((p) => ({ id: p.id!, name: p.name!, slug: p.slug!, brand: p.brand_name, image: p.image_path }))}
    />
  )
}
