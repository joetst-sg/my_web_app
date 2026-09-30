import type { Metadata } from 'next'
import { LegalPage } from '@/components/common/legal-page'

export const metadata: Metadata = { title: 'Cookie policy', alternates: { canonical: '/cookies' } }

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie policy"
      updated="30 September 2026"
      sections={[
        ['Essential cookies', 'sb-*-auth-token keeps you logged in. It is set only when you log in and is required for your account to work.'],
        ['Analytics cookie', 'loupe_aid is a random, first-party identifier (no personal data) used to avoid counting the same product view many times. It lasts one year.'],
        ['Local storage', 'Your browser stores recent searches and unsaved product-form drafts locally. They never leave your device.'],
        ['Third parties', 'We don’t use advertising or cross-site tracking cookies. Embedded YouTube videos use the privacy-enhanced youtube-nocookie.com domain.'],
      ]}
    />
  )
}
