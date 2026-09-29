import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, Check, Globe } from 'lucide-react'
import { BrandMark, StatusPill } from '@/components/common/basics'
import { FollowButton } from '@/components/common/follow-button'
import { Button } from '@/components/ui/button'
import { formatDate, labels } from '@/lib/format'
import { videoEmbedUrl } from '@/lib/validation'
import { AddToCollectionButton } from './add-to-collection'
import { BuyButton } from './buy-button'
import { DiscountBadge, PriceDisplay, RatingBadge } from './price'
import { ProductGallery } from './product-gallery'
import { ReminderButton } from './reminder-button'
import { ReportButton } from './report-button'
import { SaveButton } from './save-button'
import { ShareButton } from './share-button'

export type ProductView = {
  id: string
  slug: string
  name: string
  tagline: string | null
  description: string | null
  key_features: string[]
  benefits: string[]
  currency: string
  price: number | null
  compareAt: number | null
  discount: number
  availability: string
  status: string
  published_at: string | null
  external_url: string | null
  dealEndsAt?: string | null
  brand: {
    id: string
    slug: string
    name: string
    tagline: string | null
    description: string | null
    logo_url: string | null
    website_url: string | null
    social_links: Record<string, string>
    is_verified: boolean
    follower_count: number
  } | null
  images: { id: string; src: string; alt: string; width: number; height: number }[]
  videos: { id: string; url: string; title: string | null }[]
  specs: { label: string; value: string }[]
  category: { slug: string; name: string } | null
  tags: { slug: string; name: string }[]
  score: { overall: number; design: number | null; innovation: number | null; usability: number | null; value: number | null; features: number | null; verdict: string | null } | null
}

export function ProductDetailView({
  product: p,
  preview = false,
  shareUrl,
  viewer,
}: {
  product: ProductView
  preview?: boolean
  shareUrl?: string
  viewer?: { saved: boolean; reminded: boolean; followsBrand: boolean }
}) {
  const unavailable = p.availability === 'sold_out' || p.availability === 'discontinued'
  const breakdown = p.score
    ? ([['Design', p.score.design], ['Innovation', p.score.innovation], ['Usability', p.score.usability], ['Value', p.score.value], ['Features', p.score.features]] as const).filter(([, v]) => v !== null)
    : []

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <ProductGallery images={p.images} name={p.name} />
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {p.brand && (
                <Link href={`/brands/${p.brand.slug}`} className="font-medium hover:underline">{p.brand.name}</Link>
              )}
              {p.category && (
                <>
                  <span aria-hidden className="text-muted-foreground">·</span>
                  <Link href={`/categories/${p.category.slug}`} className="text-muted-foreground hover:text-foreground">{p.category.name}</Link>
                </>
              )}
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">{p.name}</h1>
            {p.tagline && <p className="mt-3 text-lg text-muted-foreground">{p.tagline}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PriceDisplay price={p.price} originalPrice={p.compareAt} currency={p.currency} size="lg" />
            <DiscountBadge percent={p.discount} />
            <RatingBadge score={p.score?.overall} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusPill tone={unavailable ? 'danger' : p.availability === 'available' ? 'success' : 'warning'}>
              {labels.availability[p.availability as keyof typeof labels.availability] ?? p.availability}
            </StatusPill>
            {p.published_at && <span>Published {formatDate(p.published_at)}</span>}
            {p.dealEndsAt && <span>· Deal ends {formatDate(p.dealEndsAt)}</span>}
          </div>

          {preview ? (
            <div className="flex flex-wrap gap-2" aria-label="Buttons are disabled in preview">
              <Button size="lg" className="h-11 rounded-full px-5" disabled>Buy now <ArrowUpRight /></Button>
              <Button size="lg" variant="outline" disabled>Save</Button>
              <Button size="lg" variant="outline" disabled>Add to collection</Button>
              <Button size="lg" variant="outline" disabled>Remind me</Button>
              <Button size="lg" variant="outline" disabled>Share</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.external_url && !unavailable && <BuyButton productId={p.id} />}
              <SaveButton productId={p.id} productName={p.name} initialSaved={viewer?.saved} variant="full" />
              <AddToCollectionButton productId={p.id} productName={p.name} />
              <ReminderButton productId={p.id} productName={p.name} availability={p.availability} initialSet={viewer?.reminded} variant="full" />
              {shareUrl && <ShareButton url={shareUrl} title={p.name} productId={p.id} />}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Buy now opens the maker&apos;s website. Loupe doesn&apos;t sell products or take payments.
          </p>

          {p.key_features.length > 0 && (
            <section aria-labelledby="features" className="rounded-2xl bg-surface p-5">
              <h2 id="features" className="font-sans text-base font-semibold tracking-normal">Key features</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {p.key_features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-12">
          {p.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="font-display text-2xl font-bold">About the {p.name}</h2>
              <div className="mt-4 flex max-w-[68ch] flex-col gap-4 leading-relaxed text-foreground/90">
                {p.description.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
              {p.benefits.length > 0 && (
                <ul className="mt-4 list-disc pl-5 text-foreground/90">
                  {p.benefits.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </section>
          )}

          {p.videos.length > 0 && (
            <section aria-labelledby="videos">
              <h2 id="videos" className="font-display text-2xl font-bold">Video</h2>
              <div className="mt-4 flex flex-col gap-4">
                {p.videos.map((v) => {
                  const embed = videoEmbedUrl(v.url)
                  return embed ? (
                    <iframe
                      key={v.id}
                      src={embed}
                      title={v.title ?? `${p.name} video`}
                      className="aspect-video w-full rounded-2xl"
                      loading="lazy"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <a key={v.id} href={v.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-medium underline">
                      Watch video: {v.title ?? v.url}
                    </a>
                  )
                })}
              </div>
            </section>
          )}

          {p.specs.length > 0 && (
            <section aria-labelledby="specs">
              <h2 id="specs" className="font-display text-2xl font-bold">Specifications</h2>
              <dl className="mt-4 divide-y rounded-2xl border">
                {p.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[minmax(8rem,1fr)_2fr] gap-4 px-4 py-3 text-sm">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.tags.map((t) => (
                <Link key={t.slug} href={`/search?q=${encodeURIComponent(t.name)}`} className="rounded-full bg-muted px-3 py-1 text-xs font-medium hover:bg-accent">#{t.name}</Link>
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {p.score && (
            <section aria-labelledby="score" className="rounded-2xl border p-5">
              <div className="flex items-center justify-between">
                <h2 id="score" className="font-sans text-base font-semibold tracking-normal">Loupe editorial score</h2>
                <span className="font-display text-3xl font-bold tabular-nums">
                  {Number(p.score.overall).toFixed(1)}<span className="text-base text-muted-foreground">/10</span>
                </span>
              </div>
              {breakdown.length > 0 && (
                <dl className="mt-4 flex flex-col gap-2.5">
                  {breakdown.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 text-sm">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="h-2 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-highlight" style={{ width: `${Number(value) * 10}%` }} />
                      </dd>
                      <dd className="text-right font-mono tabular-nums">{Number(value).toFixed(1)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {p.score.verdict && <p className="mt-4 text-sm text-muted-foreground">{p.score.verdict}</p>}
            </section>
          )}

          {p.brand && (
            <section aria-labelledby="maker" className="rounded-2xl border p-5">
              <h2 id="maker" className="eyebrow">About the maker</h2>
              <div className="mt-3 flex items-center gap-3">
                <BrandMark name={p.brand.name} logoUrl={p.brand.logo_url} size={48} />
                <div className="min-w-0">
                  <Link href={`/brands/${p.brand.slug}`} className="flex items-center gap-1 font-semibold hover:underline">
                    {p.brand.name}
                    {p.brand.is_verified && <BadgeCheck className="size-4 text-[oklch(0.55_0.15_250)]" aria-label="Verified brand" />}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.brand.follower_count} followers</p>
                </div>
              </div>
              {(p.brand.tagline || p.brand.description) && (
                <p className="mt-3 line-clamp-4 text-sm text-muted-foreground">{p.brand.description || p.brand.tagline}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!preview && (
                  <FollowButton kind="brand" id={p.brand.id} name={p.brand.name} initialFollowing={Boolean(viewer?.followsBrand)} size="default" />
                )}
                {p.brand.website_url && (
                  <Button asChild variant="outline">
                    <a href={p.brand.website_url} target="_blank" rel="noopener noreferrer nofollow"><Globe />Website</a>
                  </Button>
                )}
                {Object.entries(p.brand.social_links ?? {}).map(([network, url]) =>
                  typeof url === 'string' && url.startsWith('https://') ? (
                    <Button key={network} asChild variant="ghost">
                      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="capitalize">{network === 'x' ? 'X' : network}</a>
                    </Button>
                  ) : null,
                )}
              </div>
            </section>
          )}

          {!preview && <ReportButton productId={p.id} productName={p.name} />}
        </aside>
      </div>
    </div>
  )
}
