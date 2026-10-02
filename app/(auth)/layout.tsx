import Link from '@/components/i18n/link'
import { Logo } from '@/components/brand/logo'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { getT } from '@/lib/i18n/server'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT()
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="container-page flex h-16 items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md rounded-3xl border bg-background p-6 shadow-sm sm:p-8">{children}</div>
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground">{t('footer.terms')}</Link> · <Link href="/privacy" className="hover:text-foreground">{t('footer.privacy')}</Link>
      </footer>
    </div>
  )
}
