import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireViewer } from '@/lib/auth'
import { BecomeSellerForm } from './become-seller-form'

export const metadata: Metadata = { title: 'Sell on Loupe', robots: { index: false } }

export default async function SellerLandingPage() {
  const viewer = await requireViewer('/seller')
  if (viewer.isSeller) redirect('/seller/dashboard')
  return (
    <div className="container-page max-w-2xl py-12">
      <p className="eyebrow">Seller program</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Create your seller profile</h1>
      <p className="mb-8 mt-2 text-lg text-muted-foreground">Tell us who makes the products. Editors see this when they review your submissions; it isn’t shown publicly.</p>
      <BecomeSellerForm defaultEmail={viewer.email ?? ''} />
    </div>
  )
}
