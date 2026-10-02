import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { PageHeader } from './basics'

// Legal pages are stored as numbered sections in the dictionaries:
// legal.<page>.title, legal.<page>.s1Title / s1Body, s2Title / s2Body, …
export async function LegalPage({ page, sections }: { page: 'privacy' | 'terms' | 'cookies'; sections: number }) {
  const t = await getT()
  const k = (suffix: string) => `legal.${page}.${suffix}` as MessageKey
  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader eyebrow={t('legal.eyebrow')} title={t(k('title'))} description={t('legal.updated', { date: t('legal.date') })} />
      <p className="mt-8 rounded-xl bg-surface p-4 text-sm text-muted-foreground">{t('legal.templateNote')}</p>
      <div className="mt-8 flex flex-col gap-8">
        {Array.from({ length: sections }, (_, i) => i + 1).map((n) => (
          <section key={n}>
            <h2 className="font-display text-xl font-bold">{t(k(`s${n}Title`))}</h2>
            <p className="mt-2 leading-relaxed text-foreground/90">{t(k(`s${n}Body`))}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
