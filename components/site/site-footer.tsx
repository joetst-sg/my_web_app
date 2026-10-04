import Link from '@/components/i18n/link'
import { Logo } from '@/components/brand/logo'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { site } from '@/lib/site'

const columns: { title: MessageKey; links: [string, MessageKey][] }[] = [
  { title: 'footer.discover', links: [['/discover', 'nav.discover'], ['/trending', 'nav.trending'], ['/new', 'footer.newProducts'], ['/deals', 'nav.deals']] },
  { title: 'footer.browse', links: [['/categories', 'nav.categories'], ['/brands', 'nav.brands'], ['/search', 'footer.search']] },
  { title: 'footer.forMakers', links: [['/submit', 'nav.submitProductLong'], ['/seller', 'footer.sellerProgram'], ['/seller/dashboard', 'nav.sellerDashboard']] },
  { title: 'footer.company', links: [['/about', 'footer.about'], ['/contact', 'footer.contact'], ['/privacy', 'footer.privacy'], ['/terms', 'footer.terms'], ['/cookies', 'footer.cookies']] },
]

export async function SiteFooter() {
  const t = await getT()
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="sm:col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t('site.tagline')} {t('footer.reviewedByEditors')}</p>
          <p className="mt-4 text-xs text-muted-foreground">{t('footer.buyLinksNote')}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={t(col.title)}>
            <h2 className="font-sans text-sm font-semibold tracking-normal">{t(col.title)}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">{t(label)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. {t('footer.demoNote')}</p>
          <p><a href="/feed.xml" className="hover:text-foreground">RSS</a> · <a href="/sitemap.xml" className="hover:text-foreground">{t('footer.sitemap')}</a></p>
        </div>
      </div>
    </footer>
  )
}
