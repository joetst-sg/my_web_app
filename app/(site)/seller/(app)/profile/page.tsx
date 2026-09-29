import type { Metadata } from 'next'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { BecomeSellerForm } from '../../become-seller-form'

export const metadata: Metadata = { title: 'Seller profile', robots: { index: false } }

export default async function SellerProfilePage() {
  const viewer = await requireViewer('/seller/profile')
  const supabase = await createClient()
  const { data } = await supabase.from('seller_profiles').select('company_name, website, contact_email, bio, social_links').eq('user_id', viewer.id).maybeSingle()
  const socials = (data?.social_links ?? {}) as Record<string, string>
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Seller profile</h1>
      <p className="mb-8 mt-1 text-muted-foreground">Visible to editors reviewing your submissions. Public brand details are edited per brand in the product wizard.</p>
      <BecomeSellerForm
        mode="edit"
        defaultEmail={viewer.email ?? ''}
        defaults={{
          company_name: data?.company_name ?? '',
          website: data?.website ?? '',
          contact_email: data?.contact_email ?? viewer.email ?? '',
          bio: data?.bio ?? '',
          instagram: socials.instagram ?? '',
          x: socials.x ?? '',
          linkedin: socials.linkedin ?? '',
        }}
      />
    </div>
  )
}
