import type { Metadata } from 'next'
import { ShieldAlert } from 'lucide-react'
import Link from '@/components/i18n/link'
import { EmptyState } from '@/components/common/basics'
import { Button } from '@/components/ui/button'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('pages.forbidden.metaTitle'), robots: { index: false } }
}

export default async function ForbiddenPage() {
  const t = await getT()
  return (
    <div className="container-page py-20">
      <EmptyState icon={ShieldAlert} title={t('pages.forbidden.title')} description={t('pages.forbidden.description')} action={<Button asChild><Link href="/">{t('pages.forbidden.home')}</Link></Button>} />
    </div>
  )
}
