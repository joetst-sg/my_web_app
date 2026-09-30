import type { Metadata } from 'next'
import { LegalPage } from '@/components/common/legal-page'

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } }

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="30 September 2026"
      sections={[
        ['What we collect', 'Your email address, the profile details you choose to add, and what you do on the site that you ask us to remember: saved products, collections, follows and reminders. Sellers also give us company and contact details.'],
        ['Analytics', 'We record page and product views, searches, shares and clicks to seller websites to rank trending products and show sellers aggregate statistics. We do not store IP addresses or browser fingerprints. Anonymous visitors get a random identifier in a first-party cookie so a single visit isn’t counted many times.'],
        ['How we use it', 'To run your account, build your personal feed, send reminders and notifications you asked for, review product submissions and keep the platform safe from spam and abuse.'],
        ['Who we share it with', 'Our infrastructure providers (database, hosting and email delivery) process data on our behalf. When you click “Buy now” you go to the seller’s website, which has its own privacy policy. We do not sell personal data.'],
        ['Your choices', 'You can edit or hide your profile, delete collections, turn off emails and notifications in Preferences, and ask us to delete your account.'],
        ['Retention', 'Short-lived records such as rate-limit counters and view de-duplication records are deleted automatically. Account data is kept until you delete your account.'],
      ]}
    />
  )
}
