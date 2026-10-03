import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { getT, redirect } from '@/lib/i18n/server'
import { getViewer, safeNext } from '@/lib/auth'
import { LoginForm } from './login-form'
import { CodeLoginForm } from './code-login-form'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('auth.login.title'), robots: { index: false } }
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === 'string' ? sp.next : null, '/')
  if (await getViewer()) return redirect(next)
  const t = await getT()
  const method = sp.method === 'code' ? 'code' : 'password'
  const tabHref = (m: string) => `/login?${new URLSearchParams({ ...(m === 'code' && { method: 'code' }), ...(next !== '/' && { next }) })}`
  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t('auth.login.heading')}</h1>
      <p className="mb-6 mt-1 text-muted-foreground">{t('auth.login.intro')}</p>
      {sp.error === 'link' && (
        <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('auth.login.linkError')}
        </p>
      )}
      <nav aria-label={t('auth.code.tabsLabel')} className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm font-medium">
        {(['password', 'code'] as const).map((m) => (
          <Link
            key={m}
            href={tabHref(m)}
            aria-current={method === m ? 'page' : undefined}
            className={cn('rounded-full px-3 py-2 text-center transition-colors', method === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {m === 'password' ? t('auth.code.tabPassword') : t('auth.code.tabCode')}
          </Link>
        ))}
      </nav>
      {method === 'code' ? <CodeLoginForm next={next} /> : <LoginForm next={next} />}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.login.newHere')} <Link href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-foreground underline underline-offset-4">{t('auth.login.createAccount')}</Link>
      </p>
    </>
  )
}
