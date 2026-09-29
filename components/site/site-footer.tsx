import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { site } from '@/lib/site'

const columns = [
  { title: 'Discover', links: [['/discover', 'Discover'], ['/trending', 'Trending'], ['/new', 'New products'], ['/deals', 'Deals'], ['/collections', 'Collections']] },
  { title: 'Browse', links: [['/categories', 'Categories'], ['/brands', 'Brands'], ['/magazine', 'Magazine'], ['/search', 'Search']] },
  { title: 'For makers', links: [['/submit', 'Submit a product'], ['/seller', 'Seller program'], ['/seller/dashboard', 'Seller dashboard']] },
  { title: 'Company', links: [['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/cookies', 'Cookies']] },
] as const

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{site.tagline} Every product is reviewed by an editor before it goes live.</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Buy links go to the maker&apos;s own website. Loupe does not sell products or handle payments.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-sans text-sm font-semibold tracking-normal">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-muted-foreground hover:text-foreground">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. All product listings shown in this build are fictional demo data.</p>
          <p><Link href="/feed.xml" className="hover:text-foreground">RSS</Link> · <Link href="/sitemap.xml" className="hover:text-foreground">Sitemap</Link></p>
        </div>
      </div>
    </footer>
  )
}
