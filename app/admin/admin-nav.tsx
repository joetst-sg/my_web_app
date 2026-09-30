'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3, BookOpen, Building2, FileCheck2, Flag, FolderHeart, LayoutDashboard, LayoutTemplate, Package, Settings, Sparkles, Tags, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const groups = [
  ['Editorial', [
    ['/admin/dashboard', 'Dashboard', LayoutDashboard, false],
    ['/admin/submissions', 'Submissions', FileCheck2, false],
    ['/admin/products', 'Products', Package, false],
    ['/admin/featured', 'Featured', Sparkles, false],
    ['/admin/articles', 'Articles', BookOpen, false],
    ['/admin/content', 'Homepage', LayoutTemplate, false],
  ]],
  ['Catalogue', [
    ['/admin/brands', 'Brands', Building2, false],
    ['/admin/categories', 'Categories', Tags, false],
    ['/admin/collections', 'Collections', FolderHeart, false],
  ]],
  ['Operations', [
    ['/admin/reports', 'Reports', Flag, false],
    ['/admin/analytics', 'Analytics', BarChart3, false],
    ['/admin/users', 'Users', Users, true],
    ['/admin/settings', 'Settings', Settings, true],
  ]],
] as const

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="border-b bg-background lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex gap-4 overflow-x-auto px-4 py-3 lg:sticky lg:top-16 lg:flex-col lg:gap-6 lg:py-6">
        {groups.map(([title, items]) => (
          <div key={title} className="flex shrink-0 gap-1 lg:flex-col">
            <p className="eyebrow hidden px-3 pb-1 lg:block">{title}</p>
            {items.filter(([, , , adminOnly]) => isAdmin || !adminOnly).map(([href, label, Icon]) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
