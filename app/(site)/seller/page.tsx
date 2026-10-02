import type { Metadata } from 'next'
import { getT, redirect } from '@/lib/i18n/server'
import { requireViewer } from '@/lib/auth'
import { BecomeSellerForm } from './become-seller-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.landing.title'), robots: { index: false } }
}

export default async function SellerLandingPage() {
  const viewer = await requireViewer('/seller')
  if (viewer.isSeller) return redirect('/seller/dashboard')
  const t = await getT()
  return (
    <div className="container-page max-w-2xl py-12">
      <p className="eyebrow">{t('seller.landing.eyebrow')}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t('seller.landing.heading')}</h1>
      <p className="mb-8 mt-2 text-lg text-muted-foreground">{t('seller.landing.intro')}</p>
      <BecomeSellerForm defaultEmail={viewer.email ?? ''} />
    </div>
  )
}
