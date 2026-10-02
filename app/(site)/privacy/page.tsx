import type { Metadata } from 'next'
import { LegalPage } from '@/components/common/legal-page'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('legal.privacy.title'), alternates: await alternatesFor('/privacy') }
}

export default function PrivacyPage() {
  return <LegalPage page="privacy" sections={6} />
}
