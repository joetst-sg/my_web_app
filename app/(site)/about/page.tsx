import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { PageHeader } from '@/components/common/basics'
import { alternatesFor, getT } from '@/lib/i18n/server'
import { site } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('footer.about'), description: t('pages.about.meta', { name: site.name }), alternates: await alternatesFor('/about') }
}

export default async function AboutPage() {
  const t = await getT()
  const points = [
    ['pages.about.p1Title', 'pages.about.p1Body'],
    ['pages.about.p2Title', 'pages.about.p2Body'],
    ['pages.about.p3Title', 'pages.about.p3Body'],
    ['pages.about.p4Title', 'pages.about.p4Body'],
  ] as const
  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader eyebrow={t('footer.about')} title={t('pages.about.title', { name: site.name })} description={t('pages.about.description')} />
      <div className="mt-10 flex flex-col gap-6 text-lg leading-relaxed">
        <p>{t('pages.about.intro', { name: site.name })}</p>
        <h2 className="font-display text-2xl font-bold">{t('pages.about.howItWorks')}</h2>
        <ul className="list-disc space-y-2 pl-6">
          {points.map(([title, body]) => (
            <li key={title}><strong>{t(title)}</strong> {t(body)}</li>
          ))}
        </ul>
        <p>
          {t('pages.about.makersPrefix')} <Link href="/submit" className="underline">{t('pages.about.makersLink')}</Link>{t('pages.about.makersSuffix')}
        </p>
        <p className="text-base text-muted-foreground">{t('pages.about.demo')}</p>
      </div>
    </div>
  )
}
