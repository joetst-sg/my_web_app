import type { Metadata } from 'next'
import { LegalPage } from '@/components/common/legal-page'

export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } }

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="30 September 2026"
      sections={[
        ['Using Loupe', 'You can browse without an account. To save products, build collections or submit products you need an account and must keep your login details secure.'],
        ['Product listings', 'Listings describe products sold by third parties. We review submissions but can’t guarantee availability, prices or product quality. Purchases happen on the seller’s website under their terms.'],
        ['Submitting products', 'You may only submit products you make or are authorised to represent, with images and text you have the right to use. Editors may edit, schedule, reject or remove listings. Submission doesn’t guarantee publication.'],
        ['Editorial independence', 'Editorial scores and reviews are written by our editors and can’t be purchased or edited by sellers.'],
        ['Acceptable use', 'Don’t submit spam, duplicates, misleading or offensive content, or try to manipulate rankings. We may suspend accounts that do.'],
        ['Changes', 'We may update these terms. Continued use after changes means you accept them.'],
      ]}
    />
  )
}
