import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { MailCheck } from 'lucide-react'
import { ResendForm } from './resend-form'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('auth.verify.title'), robots: { index: false } }
}

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const sp = await searchParams
  const email = typeof sp.email === 'string' ? sp.email : ''
  const t = await getT()
  return (
    <>
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-highlight text-highlight-foreground">
        <MailCheck className="size-6" aria-hidden />
      </div>
      <h1 className="font-display text-3xl font-bold">{t('auth.verify.heading')}</h1>
      <p className="mt-2 text-muted-foreground">
        {email ? <>{t('auth.verify.sentTo')}<strong className="text-foreground">{email}</strong>{t('auth.verify.sentToAfter')}</> : t('auth.verify.sent')}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">{t('auth.verify.didntGet')}</p>
      <ResendForm email={email} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.verify.already')} <Link href="/login" className="font-medium text-foreground underline underline-offset-4">{t('auth.login.submit')}</Link>
      </p>
    </>
  )
}
