'use client'

import Link from '@/components/i18n/link'
import { usePathname } from '@/components/i18n/use-pathname'
import { BarChart3, Building2, FileClock, Images, LayoutDashboard, Package, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n/provider'

const items = [
  ['/seller/dashboard', 'seller.nav.dashboard', LayoutDashboard],
  ['/seller/products', 'seller.nav.products', Package],
  ['/seller/submissions', 'seller.nav.submissions', FileClock],
  ['/seller/media', 'seller.nav.media', Images],
  ['/seller/analytics', 'seller.nav.analytics', BarChart3],
  ['/seller/profile', 'seller.nav.profile', Building2],
  ['/seller/settings', 'seller.nav.settings', Settings],
] as const

export function SellerNav() {
  const pathname = usePathname()
  const t = useT()
  return (
    <nav aria-label={t('seller.nav.label')} className="lg:w-56 lg:shrink-0">
      <div className="lg:sticky lg:top-24">
        <p className="eyebrow mb-3 hidden lg:block">{t('seller.nav.label')}</p>
        <Button asChild className="mb-3 hidden w-full lg:inline-flex" size="lg">
          <Link href="/seller/products/new"><Plus />{t('seller.newProduct')}</Link>
        </Button>
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:px-0">
          {items.map(([href, label, Icon]) => {
            const active = pathname.startsWith(href)
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(label)}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
