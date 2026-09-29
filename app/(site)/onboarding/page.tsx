import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireViewer } from '@/lib/auth'
import { interestCategories } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = { title: 'Welcome', robots: { index: false } }

export default async function OnboardingPage() {
  const viewer = await requireViewer('/onboarding')
  if (viewer.onboarded) redirect('/account/feed')
  const supabase = await createClient()
  const { data: cats } = await supabase.from('categories').select('id, slug, name, icon, color').in('slug', interestCategories)
  const ordered = interestCategories.map((s) => cats?.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => Boolean(c))
  const suggested = (viewer.username ?? viewer.displayName ?? viewer.email?.split('@')[0] ?? '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30)

  return (
    <div className="container-page max-w-3xl py-12">
      <p className="eyebrow">Step 1 of 1</p>
      <h1 className="mt-2 font-display text-4xl font-bold">What are you interested in?</h1>
      <p className="mt-2 text-lg text-muted-foreground">We&apos;ll use this to build your personal feed. You can change it any time.</p>
      <OnboardingForm categories={ordered} suggestedUsername={suggested.length >= 3 ? suggested : ''} />
    </div>
  )
}
