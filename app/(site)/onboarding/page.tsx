import type { Metadata } from 'next'
import { getI18n, getT, redirect } from '@/lib/i18n/server'
import { localized } from '@/lib/i18n/content'
import { requireViewer } from '@/lib/auth'
import { interestCategories } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './onboarding-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('onboarding.title'), robots: { index: false } }
}

export default async function OnboardingPage() {
  const viewer = await requireViewer('/onboarding')
  if (viewer.onboarded) return redirect('/account/feed')
  const supabase = await createClient()
  const { data: cats } = await supabase.from('categories').select('id, slug, name, icon, color, translations').in('slug', interestCategories)
  const { t, locale } = await getI18n()
  const ordered = interestCategories
    .map((s) => cats?.find((c) => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(({ translations, ...c }) => ({ ...c, name: localized({ translations, name: c.name }, 'name', locale) }))
  const suggested = (viewer.username ?? viewer.displayName ?? viewer.email?.split('@')[0] ?? '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30)

  return (
    <div className="container-page max-w-3xl py-12">
      <p className="eyebrow">{t('onboarding.step')}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t('onboarding.heading')}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{t('onboarding.intro')}</p>
      <OnboardingForm categories={ordered} suggestedUsername={suggested.length >= 3 ? suggested : ''} />
    </div>
  )
}
