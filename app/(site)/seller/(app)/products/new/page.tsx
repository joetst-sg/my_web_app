import type { Metadata } from 'next'
import { BasicsForm } from '@/components/seller/basics-form'
import { WizardProgress } from '@/components/seller/wizard-shared'
import { requireViewer } from '@/lib/auth'
import { wizardOptions } from '@/lib/db/seller'
import { getI18n, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.newProduct'), robots: { index: false } }
}

export default async function NewProductPage() {
  const viewer = await requireViewer('/seller/products/new')
  const { t, locale } = await getI18n()
  const options = await wizardOptions(viewer.id, locale)
  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('seller.newProduct')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('seller.newIntro')}</p>
      <WizardProgress current={1} reachable={1} />
      <BasicsForm options={options} />
    </div>
  )
}
