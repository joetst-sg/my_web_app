import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { getT, redirect } from '@/lib/i18n/server'
import { getViewer, safeNext } from '@/lib/auth'
import { LoginForm } from './login-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('auth.login.title'), robots: { index: false } }
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null, '/')
  if (await getViewer()) return redirect(next)
  const t = await getT()
  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('auth.login.heading')}</h1>
      <p className="mb-6 mt-1 text-muted-foreground">{t('auth.login.intro')}</p>
      {sp.error === 'link' && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('auth.login.linkError')}
        </p>
      )}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.login.newHere')} <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-foreground underline underline-offset-4">{t('auth.login.createAccount')}</Link>
      </p>
    </>
  )
}
