import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { getT, redirect } from '@/lib/i18n/server'
import { getViewer, safeNext } from '@/lib/auth'
import { SignupForm } from './signup-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('auth.signup.title'), robots: { index: false } }
}

export default async function SignupPage({ searchParams }: PageProps<'/signup'>) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null, '/onboarding')
  if (await getViewer()) return redirect('/')
  const t = await getT()
  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('auth.signup.heading')}</h1>
      <p className="mb-6 mt-1 text-muted-foreground">{t('auth.signup.intro')}</p>
      <SignupForm next={next} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('auth.code.signupAlt')} <Link href="/login?method=code" className="font-medium text-foreground underline underline-offset-4">{t('auth.code.signupAltLink')}</Link>
      </p>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.signup.haveAccount')} <Link href="/login" className="font-medium text-foreground underline underline-offset-4">{t('auth.login.submit')}</Link>
      </p>
    </>
  )
}
