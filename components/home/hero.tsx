import Image from 'next/image'
import Link from '@/components/i18n/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { productImageUrl } from '@/lib/images'
import { fromTranslations, localizeCard } from '@/lib/i18n/content'
import { getI18n } from '@/lib/i18n/server'
import type { ProductCardData } from '@/lib/db/products'
import { BuyButton } from '@/components/product/buy-button'
import { DiscountBadge, PriceDisplay, RatingBadge, raisedOf } from '@/components/product/price'
import { SaveButton } from '@/components/product/save-button'

export async function Hero({ product, isSaved }: { product: ProductCardData; isSaved: boolean }) {
  const { t, locale } = await getI18n()
  const p = localizeCard(product, locale)
  const img = productImageUrl(p.image_path)
  return (
    <section aria-labelledby="hero-title" className="container-page pt-6 sm:pt-10">
      <div className="grid overflow-hidden rounded-[2rem] bg-surface lg:grid-cols-[1.25fr_1fr]">
        <Link href={`/products/${p.slug}`} className="relative block" tabIndex={-1} aria-hidden>
          {img && (
            <Image
              src={img}
              alt={p.image_alt || p.name || ''}
              width={1200}
              height={900}
              priority
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="aspect-[4/3] size-full object-cover lg:aspect-auto lg:min-h-[520px]"
            />
          )}
        </Link>
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{t('home.featuredToday')}</span>
            {p.category_name && (
              <Link href={`/categories/${p.category_slug}`} className="rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium hover:border-foreground/30">
                {fromTranslations(p.category_translations, 'name', locale, p.category_name)}
              </Link>
            )}
          </div>
          <div>
            <Link href={`/brands/${p.brand_slug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              {p.brand_name}
            </Link>
            <h1 id="hero-title" className="mt-1 line-clamp-3 font-display text-2xl font-bold leading-tight sm:text-3xl xl:text-4xl">
              <Link href={`/products/${p.slug}`} className="hover:underline hover:decoration-2 hover:underline-offset-8">{p.name}</Link>
            </h1>
            {p.tagline && <p className="mt-4 max-w-md text-lg text-muted-foreground">{p.tagline}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PriceDisplay price={p.price} originalPrice={p.compare_at_price} currency={p.currency} raised={raisedOf(p)} size="lg" />
            {!p.source_name && <DiscountBadge percent={p.discount_percent} />}
            <RatingBadge score={p.score} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/products/${p.slug}`} className={cn(buttonVariants({ size: 'lg' }), 'h-11 rounded-full px-5 text-[0.95rem]')}>
              {t('home.discoverProduct')}
            </Link>
            <BuyButton productId={p.id!} className="bg-background text-foreground ring-1 ring-border hover:bg-muted" />
            <SaveButton productId={p.id!} productName={p.name ?? ''} initialSaved={isSaved} className="size-11" />
          </div>
        </div>
      </div>
    </section>
  )
}
