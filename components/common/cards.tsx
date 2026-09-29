import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, labels } from '@/lib/format'
import { productImageUrl } from '@/lib/images'
import { BrandMark } from './basics'
import { CategoryIcon } from './category-icon'

export function CategoryCard({
  category,
  className,
}: {
  category: { slug: string; name: string; color: string | null; icon: string | null; description?: string | null }
  className?: string
}) {
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
        <span className="block font-semibold">{category.name}</span>
        {category.description && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{category.description}</span>}
      </span>
    </Link>
  )
}

export function BrandCard({
  brand,
  productCount,
  className,
}: {
  brand: { slug: string; name: string; tagline: string | null; logo_url: string | null; is_verified: boolean; follower_count: number }
  productCount?: number
  className?: string
}) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className={cn('group flex items-center gap-4 rounded-2xl border p-4 transition-colors hover:border-foreground/30 hover:bg-surface', className)}
    >
      <BrandMark name={brand.name} logoUrl={brand.logo_url} size={52} />
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold">
          <span className="truncate">{brand.name}</span>
          {brand.is_verified && <BadgeCheck className="size-4 shrink-0 text-[oklch(0.55_0.15_250)]" aria-label="Verified brand" />}
        </span>
        {brand.tagline && <span className="line-clamp-1 block text-sm text-muted-foreground">{brand.tagline}</span>}
        <span className="mt-1 block text-xs text-muted-foreground">
          {productCount !== undefined && `${productCount} product${productCount === 1 ? '' : 's'} · `}
          {brand.follower_count} follower{brand.follower_count === 1 ? '' : 's'}
        </span>
      </span>
    </Link>
  )
}

export function CollectionCard({
  collection,
  images,
  ownerName,
  className,
}: {
  collection: { slug: string; title: string; description: string | null; product_count: number; is_editorial: boolean; visibility: string }
  images: (string | null)[]
  ownerName?: string | null
  className?: string
}) {
  const tiles = [...images.filter(Boolean), null, null, null, null].slice(0, 4)
  return (
    <Link href={`/collections/${collection.slug}`} className={cn('group flex flex-col gap-3', className)}>
      <div className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-2xl bg-muted">
        {tiles.map((path, i) =>
          path ? (
            <Image
              key={i}
              src={productImageUrl(path)!}
              alt=""
              width={600}
              height={450}
              sizes="(min-width: 1024px) 15vw, 40vw"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div key={i} className="bg-muted" />
          ),
        )}
      </div>
      <div>
        <p className="eyebrow flex items-center gap-1.5">
          {collection.is_editorial ? 'Editorial collection' : ownerName ? `By ${ownerName}` : 'Collection'}
          {collection.visibility === 'private' && <Lock className="size-3" aria-label="Private" />}
        </p>
        <h3 className="mt-1 font-sans text-lg font-semibold tracking-normal group-hover:underline group-hover:underline-offset-4">{collection.title}</h3>
        <p className="text-sm text-muted-foreground">{collection.product_count} product{collection.product_count === 1 ? '' : 's'}</p>
      </div>
    </Link>
  )
}

export function ArticleCard({
  article,
  authorName,
  className,
  layout = 'vertical',
}: {
  article: { slug: string; title: string; excerpt: string | null; featured_image_url: string | null; type: string; published_at: string | null; reading_minutes: number }
  authorName?: string | null
  className?: string
  layout?: 'vertical' | 'horizontal'
}) {
  return (
    <Link
      href={`/magazine/${article.slug}`}
      className={cn('group flex gap-4', layout === 'vertical' ? 'flex-col' : 'flex-row items-start', className)}
    >
      {article.featured_image_url && (
        <Image
          src={article.featured_image_url}
          alt=""
          width={1200}
          height={900}
          sizes={layout === 'vertical' ? '(min-width: 1024px) 33vw, 100vw' : '160px'}
          className={cn(
            'rounded-2xl bg-muted object-cover',
            layout === 'vertical' ? 'aspect-[16/10] w-full' : 'aspect-square w-28 shrink-0 sm:w-40',
          )}
        />
      )}
      <div>
        <p className="eyebrow">{labels.articleType[article.type as keyof typeof labels.articleType] ?? article.type}</p>
        <h3 className="mt-1 font-display text-xl font-bold leading-snug group-hover:underline group-hover:underline-offset-4">{article.title}</h3>
        {article.excerpt && layout === 'vertical' && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{article.excerpt}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {authorName && <>{authorName} · </>}
          {formatDate(article.published_at)} · {article.reading_minutes} min read
        </p>
      </div>
    </Link>
  )
}
