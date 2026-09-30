import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SectionList } from './section-editor'

export const metadata: Metadata = { title: 'Homepage' }

export default async function HomepageCmsPage() {
  const supabase = await createClient()
  const [{ data: sections }, { data: products }] = await Promise.all([
    supabase.from('homepage_sections').select('id, type, title, subtitle, config, is_enabled, position').order('position'),
    supabase.from('products').select('id, name').eq('status', 'published').order('name'),
  ])
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Homepage</h1>
        <p className="mt-1 text-muted-foreground">
          The homepage is built from these sections, top to bottom. Changes go live immediately. <Link href="/" className="underline" target="_blank">Open homepage</Link>
        </p>
      </div>
      <SectionList sections={(sections ?? []).map((s) => ({ ...s, config: (s.config ?? {}) as { limit?: number; product_ids?: string[] } }))} products={products ?? []} />
    </div>
  )
}
