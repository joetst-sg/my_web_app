import type { Metadata } from 'next'
import { requireViewer } from '@/lib/auth'
import { interestCategories } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'
import { InterestsForm, PrefsForm } from './forms'

export const metadata: Metadata = { title: 'Preferences', robots: { index: false } }

export default async function PreferencesPage() {
  const viewer = await requireViewer('/account/preferences')
  const supabase = await createClient()
  const [{ data: settings }, { data: cats }, { data: follows }] = await Promise.all([
    supabase.from('user_settings').select('notification_prefs').eq('user_id', viewer.id).single(),
    supabase.from('categories').select('id, slug, name').in('slug', interestCategories),
    supabase.from('category_followers').select('category_id').eq('user_id', viewer.id),
  ])
  const prefs = (settings?.notification_prefs ?? {}) as Record<string, boolean>
  return (
    <div className="flex max-w-2xl flex-col gap-12">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Preferences</h1>
        <p className="mt-1 text-muted-foreground">Choose how we contact you and what your feed shows.</p>
      </div>
      <section aria-labelledby="notif-h">
        <h2 id="notif-h" className="mb-4 font-sans text-lg font-semibold tracking-normal">Notifications</h2>
        <PrefsForm prefs={{ email: prefs.email ?? true, in_app: prefs.in_app ?? true, product_updates: prefs.product_updates ?? true, deals: prefs.deals ?? true }} />
      </section>
      <section aria-labelledby="interests-h">
        <h2 id="interests-h" className="mb-4 font-sans text-lg font-semibold tracking-normal">Interests</h2>
        <InterestsForm
          categories={interestCategories.map((s) => cats?.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => Boolean(c))}
          selected={(follows ?? []).map((f) => f.category_id)}
        />
      </section>
    </div>
  )
}
