import type { Metadata } from 'next'
import Link from '@/components/i18n/link'
import { requireViewer } from '@/lib/auth'
import { getT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t('seller.settings.title'), robots: { index: false } }
}

export default async function SellerSettingsPage() {
  const viewer = await requireViewer('/seller/settings')
  const t = await getT()
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('seller.nav.settings')}</h1>
      <p className="mb-8 mt-1 text-muted-foreground">{t('seller.settings.intro')}</p>
      <ul className="divide-y rounded-2xl border">
        {[
          ['/seller/profile', t('seller.nav.profile'), t('seller.settings.profileBody')],
          ['/account/preferences', t('account.nav.notifications'), t('seller.settings.notificationsBody')],
          ['/account/security', t('seller.settings.security'), t('account.security.signedInAs', { email: viewer.email ?? '' })],
          ['/account/profile', t('seller.settings.publicProfile'), t('seller.settings.publicProfileBody')],
        ].map(([href, title, body]) => (
          <li key={href}>
            <Link href={href} className="block p-5 hover:bg-surface">
              <span className="font-medium">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        {t('seller.settings.limit')}
      </p>
    </div>
  )
}
