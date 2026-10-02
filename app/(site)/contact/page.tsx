import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { PageHeader } from '@/components/common/basics'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('footer.contact'), alternates: await alternatesFor('/contact') }
}

export default async function ContactPage() {
  const t = await getT()
  const rows = [
    ['pages.contact.r1Title', 'pages.contact.r1Body', null],
    ['pages.contact.r2Title', 'pages.contact.r2Body', '/submit'],
    ['pages.contact.r3Title', 'pages.contact.r3Body', '/account/preferences'],
  ] as const
  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader eyebrow={t('footer.contact')} title={t('pages.contact.title')} description={t('pages.contact.description')} />
      <ul className="mt-10 divide-y rounded-2xl border">
        {rows.map(([title, body, href]) => (
          <li key={title} className="p-6">
            <h2 className="font-sans text-lg font-semibold tracking-normal">{t(title)}</h2>
            <p className="mt-1 text-muted-foreground">{t(body)}</p>
            {href && <Link href={href} className="mt-2 inline-block text-sm font-medium underline underline-offset-4">{t('pages.contact.go')}</Link>}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">{t('pages.contact.note')}</p>
    </div>
  )
}
