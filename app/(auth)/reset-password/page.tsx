import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { getViewer } from '@/lib/auth'
import { ResetForm } from './reset-form'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('auth.reset.heading'), robots: { index: false } }
}

// Reached from the reset email via /auth/confirm, which signs the user in
// with a short-lived recovery session.
export default async function ResetPasswordPage() {
  const viewer = await getViewer()
  const t = await getT()
  if (!viewer) {
    return (
      <>
        <h1 className="font-display text-3xl font-bold">{t('auth.reset.expiredHeading')}</h1>
        <p className="mt-2 text-muted-foreground">{t('auth.reset.expiredBody')}</p>
        <Link href="/forgot-password" className="mt-6 inline-block font-medium underline underline-offset-4">{t('auth.reset.requestNew')}</Link>
      </>
    )
  }
  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('auth.reset.heading')}</h1>
      <p className="mb-6 mt-1 text-muted-foreground">{t('auth.reset.for', { email: viewer.email ?? '' })}</p>
      <ResetForm />
    </>
  )
}
