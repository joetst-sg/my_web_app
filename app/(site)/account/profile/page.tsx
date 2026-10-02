import type { Metadata } from 'next'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AvatarUploader } from './avatar-uploader'
import { ProfileForm } from './profile-form'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('account.nav.profile'), robots: { index: false } }
}

export default async function ProfilePage() {
  const viewer = await requireViewer('/account/profile')
  const supabase = await createClient()
  const t = await getT()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, website, social_links, is_public, avatar_url, created_at')
    .eq('id', viewer.id)
    .single()
  const socials = (profile?.social_links ?? {}) as Record<string, string>
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('account.nav.profile')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('account.profile.intro')}</p>
      <AvatarUploader userId={viewer.id} name={profile?.display_name ?? viewer.email ?? ''} current={profile?.avatar_url ?? null} />
      <ProfileForm
        defaults={{
          username: profile?.username ?? '',
          display_name: profile?.display_name ?? '',
          bio: profile?.bio ?? '',
          website: profile?.website ?? '',
          instagram: socials.instagram ?? '',
          x: socials.x ?? '',
          is_public: profile?.is_public ?? true,
        }}
        memberSince={profile?.created_at ?? null}
      />
    </div>
  )
}
