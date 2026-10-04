import Image from 'next/image'
import Link from '@/components/i18n/link'
import { BadgeCheck, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { localized } from '@/lib/i18n/content'
import { getI18n } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { productImageUrl } from '@/lib/images'
import { BrandMark } from './basics'
import { CategoryIcon } from './category-icon'

export async function CategoryCard({
  category,
  className,
}: {
  category: { slug: string; name: string; color: string | null; icon: string | null; description?: string | null; translations?: unknown }
  className?: string
}) {
  const { locale } = await getI18n()
  const color = category.color ?? '#475467'
  return (
    <Link
      href={`/categories/${category.slug}`}
      className={cn(
        'group flex flex-col justify-between gap-6 rounded-2xl border p-5 transition-colors hover:border-foreground/30 hover:bg-surface',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl text-white" style={{ background: color }}>
        <CategoryIcon name={category.icon} className="size-5" />
      </span>
      <span>
        <span className="block font-semibold">{localized(category, 'name', locale)}</span>
        {category.description && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{localized(category, 'description', locale)}</span>}
      </span>
    </Link>
  )
}

export async function BrandCard({
  brand,
  productCount,
  className,
}: {
  brand: { slug: string; name: string; tagline: string | null; logo_url: string | null; is_verified: boolean; follower_count: number }
  productCount?: number
  className?: string
}) {
  const { t } = await getI18n()
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className={cn('group flex items-center gap-4 rounded-2xl border p-4 transition-colors hover:border-foreground/30 hover:bg-surface', className)}
    >
      <BrandMark name={brand.name} logoUrl={brand.logo_url} size={52} />
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold">
          <span className="truncate">{brand.name}</span>
          {brand.is_verified && <BadgeCheck className="size-4 shrink-0 text-[oklch(0.55_0.15_250)]" aria-label={t('common.verifiedBrand')} />}
        </span>
        {brand.tagline && <span className="line-clamp-1 block text-sm text-muted-foreground">{brand.tagline}</span>}
        <span className="mt-1 block text-xs text-muted-foreground">
          {productCount !== undefined && `${t(productCount === 1 ? 'common.productsOne' : 'common.productsMany', { count: productCount })} · `}
          {t(brand.follower_count === 1 ? 'common.followersOne' : 'common.followersMany', { count: brand.follower_count })}
        </span>
      </span>
    </Link>
  )
}
