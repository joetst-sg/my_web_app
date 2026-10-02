import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/i18n/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import Markdown from 'react-markdown'
import { SectionHeader } from '@/components/common/basics'
import { TrackOnMount } from '@/components/common/track'
import { ProductGrid } from '@/components/product/product-grid'
import { ShareButton } from '@/components/product/share-button'
import { productsByIds } from '@/lib/db/products'
import { localizePath } from '@/lib/i18n/config'
import { alternatesFor, getI18n } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/translate'
import { site } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

const getArticle = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, content, featured_image_url, author_id, type, status, seo_title, seo_description, reading_minutes, published_at, updated_at')
    .eq('slug', slug)
    .maybeSingle()
  return data
})

export async function generateMetadata({ params }: PageProps<'/magazine/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [a, { t }] = await Promise.all([getArticle(slug), getI18n()])
  if (!a || a.status !== 'published') return { title: t('pages.article.notFound'), robots: { index: false } }
  return {
    title: a.seo_title || a.title,
    description: a.seo_description || a.excerpt || undefined,
    alternates: await alternatesFor(`/magazine/${a.slug}`),
    openGraph: {
      type: 'article',
      title: a.title,
      description: a.excerpt ?? undefined,
      publishedTime: a.published_at ?? undefined,
      modifiedTime: a.updated_at,
      images: a.featured_image_url ? [{ url: a.featured_image_url, width: 1200, height: 900 }] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: PageProps<'/magazine/[slug]'>) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()
  const supabase = await createClient()
  const { t, f, locale } = await getI18n()
  const [{ data: author }, { data: links }] = await Promise.all([
    article.author_id ? supabase.from('profiles').select('display_name').eq('id', article.author_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('article_products').select('product_id, position').eq('article_id', article.id).order('position'),
  ])
  const products = await productsByIds((links ?? []).map((l) => l.product_id))
  const url = `${site.url}${localizePath(`/magazine/${article.slug}`, locale)}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: article.featured_image_url ? [article.featured_image_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: { '@type': 'Person', name: author?.display_name ?? t('pages.collection.editors', { site: site.name }) },
    inLanguage: 'en',
    publisher: { '@type': 'Organization', name: site.name },
    mainEntityOfPage: url,
  }

  return (
    <article className="pb-10">
      {article.status === 'published' ? (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
          <TrackOnMount event={{ event: 'page_view', articleId: article.id }} />
        </>
      ) : (
        <div role="status" className="container-page mt-6 rounded-xl border bg-muted px-4 py-3 text-sm">
          {t('pages.article.notPublic', { status: article.status })}
        </div>
      )}
      <header className="container-page max-w-4xl pt-10 text-center">
        <Link href={`/magazine?type=${article.type}`} className="eyebrow hover:text-foreground">
          {t(`labels.articleType.${article.type}` as MessageKey)}
        </Link>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">{article.title}</h1>
        {article.excerpt && <p className="mx-auto mt-5 max-w-2xl text-xl text-muted-foreground">{article.excerpt}</p>}
        <p className="mt-5 text-sm text-muted-foreground">
          {t('pages.article.byline', { author: author?.display_name ?? t('pages.collection.editors', { site: site.name }), date: f.date(article.published_at ?? article.updated_at) })} · {t('magazine.minRead', { count: article.reading_minutes })}
        </p>
      </header>
      {article.featured_image_url && (
        <div className="container-page mt-10 max-w-5xl">
          <Image src={article.featured_image_url} alt="" width={1200} height={900} priority sizes="(min-width: 1024px) 1024px, 100vw" className="aspect-[16/9] w-full rounded-3xl object-cover" />
        </div>
      )}
      <div className="container-page mt-12 max-w-[72ch]">
        <div className="flex flex-col gap-5 text-lg leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_em]:text-muted-foreground">
          {/* Markdown is rendered without raw HTML, so content can't inject scripts. */}
          <Markdown
            components={{
              a: ({ href, children }) =>
                href?.startsWith('/') ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
              img: () => null,
            }}
          >
            {article.content}
          </Markdown>
        </div>
        <div className="mt-10 flex items-center justify-between border-t pt-6">
          <span className="text-sm text-muted-foreground">{t('pages.article.share')}</span>
          <ShareButton url={url} title={article.title} />
        </div>
      </div>
      {products.length > 0 && (
        <section className="container-page mt-16">
          <SectionHeader title={t('pages.article.products')} />
          <ProductGrid products={products} />
        </section>
      )}
    </article>
  )
}
