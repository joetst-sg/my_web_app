import type { Metadata } from 'next'
import { LegalPage } from '@/components/common/legal-page'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('legal.terms.title'), alternates: await alternatesFor('/terms') }
}

export default function TermsPage() {
  return <LegalPage page="terms" sections={6} />
}
