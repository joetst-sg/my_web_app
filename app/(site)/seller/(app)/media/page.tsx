import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/i18n/link'
import { Images } from 'lucide-react'
import { EmptyState } from '@/components/common/basics'
import { requireViewer } from '@/lib/auth'
import { productImageUrl } from '@/lib/images'
import { createClient } from '@/lib/supabase/server'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.nav.media'), robots: { index: false } }
}

export default async function SellerMediaPage() {
  const viewer = await requireViewer('/seller/media')
  const supabase = await createClient()
  const t = await getT()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, status, images:product_images ( id, storage_path, alt, width, height, position )')
    .eq('seller_id', viewer.id)
    .order('updated_at', { ascending: false })
  const withImages = (products ?? []).filter((p) => p.images?.length)
  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('seller.nav.media')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('seller.media.intro')}</p>
      {withImages.length === 0 ? (
        <EmptyState icon={Images} title={t('seller.media.emptyTitle')} description={t('seller.media.emptyBody')} />
      ) : (
        <div className="flex flex-col gap-10">
          {withImages.map((p) => {
            const editable = p.status === 'draft' || p.status === 'changes_requested'
            return (
              <section key={p.id}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h2 className="font-sans text-base font-semibold tracking-normal">{p.name}</h2>
                  {editable && <Link href={`/seller/products/${p.id}/edit?step=3`} className="text-sm underline underline-offset-4">{t('seller.media.manage')}</Link>}
                </div>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {[...p.images].sort((a, b) => a.position - b.position).map((img) => (
                    <li key={img.id}>
                      <Image src={productImageUrl(img.storage_path)!} alt={img.alt ?? ''} width={300} height={225} sizes="160px" className="aspect-[4/3] w-full rounded-lg object-cover" />
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">{img.width}×{img.height} WebP</p>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
