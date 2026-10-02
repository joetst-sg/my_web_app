import type { Metadata } from 'next'
import { requireViewer } from '@/lib/auth'
import { EmailForm, PasswordForm } from './forms'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('account.nav.security'), robots: { index: false } }
}

export default async function SecurityPage() {
  const viewer = await requireViewer('/account/security')
  const t = await getT()
  return (
    <div className="flex max-w-xl flex-col gap-12">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('account.nav.security')}</h1>
        <p className="mt-1 text-muted-foreground">{t('account.security.signedInAs', { email: viewer.email ?? '' })}</p>
      </div>
      <section aria-labelledby="pw-h">
        <h2 id="pw-h" className="mb-4 font-sans text-lg font-semibold tracking-normal">{t('account.security.changePassword')}</h2>
        <PasswordForm />
      </section>
      <section aria-labelledby="email-h">
        <h2 id="email-h" className="mb-4 font-sans text-lg font-semibold tracking-normal">{t('account.security.changeEmail')}</h2>
        <EmailForm current={viewer.email ?? ''} />
      </section>
    </div>
  )
}
