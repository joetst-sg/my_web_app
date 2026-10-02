import type { Metadata } from 'next'
import { CheckCircle2, Clock, Eye, Send } from 'lucide-react'
import Link from '@/components/i18n/link'
import { Button } from '@/components/ui/button'
import { getViewer } from '@/lib/auth'
import { alternatesFor, getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('nav.submitProductLong'), description: t('pages.submit.meta'), alternates: await alternatesFor('/submit') }
}

export default async function SubmitPage() {
  const [viewer, t] = await Promise.all([getViewer(), getT()])
  const href = !viewer ? '/signup?next=/seller' : viewer.isSeller ? '/seller/products/new' : '/seller'
  const steps = [
    [Send, 'pages.submit.s1Title', 'pages.submit.s1Body'],
    [Eye, 'pages.submit.s2Title', 'pages.submit.s2Body'],
    [Clock, 'pages.submit.s3Title', 'pages.submit.s3Body'],
    [CheckCircle2, 'pages.submit.s4Title', 'pages.submit.s4Body'],
  ] as const
  return (
    <div className="container-page py-16">
      <div className="max-w-3xl">
        <p className="eyebrow">{t('pages.submit.eyebrow')}</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-6xl">{t('pages.submit.title')}</h1>
        <p className="mt-5 text-xl text-muted-foreground">{t('pages.submit.description')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-full px-6 text-base"><Link href={href}>{viewer?.isSeller ? t('nav.submitProductLong') : t('pages.submit.getStarted')}</Link></Button>
          {viewer?.isSeller && <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6 text-base"><Link href="/seller/dashboard">{t('nav.sellerDashboard')}</Link></Button>}
        </div>
      </div>
      <ol className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([Icon, title, body], i) => (
          <li key={title} className="rounded-2xl border p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-highlight text-highlight-foreground"><Icon className="size-4" aria-hidden /></span>
              <span className="text-sm text-muted-foreground">{t('pages.submit.step', { n: i + 1 })}</span>
            </div>
            <h2 className="mt-4 font-sans text-lg font-semibold tracking-normal">{t(title)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(body)}</p>
          </li>
        ))}
      </ol>
      <section className="mt-16 max-w-3xl">
        <h2 className="font-display text-2xl font-bold">{t('pages.submit.lookFor')}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>{t('pages.submit.l1')}</li>
          <li>{t('pages.submit.l2')}</li>
          <li>{t('pages.submit.l3')}</li>
          <li>{t('pages.submit.l4')}</li>
        </ul>
      </section>
    </div>
  )
}
