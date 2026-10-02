import type { Metadata } from 'next'
import { LegalPage } from '@/components/common/legal-page'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('legal.cookies.title'), alternates: await alternatesFor('/cookies') }
}

export default function CookiesPage() {
  return <LegalPage page="cookies" sections={4} />
}
