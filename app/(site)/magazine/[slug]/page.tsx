import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import Markdown from 'react-markdown'
import { SectionHeader } from '@/components/common/basics'
import { TrackOnMount } from '@/components/common/track'
import { ProductGrid } from '@/components/product/product-grid'
import { ShareButton } from '@/components/product/share-button'
import { productsByIds } from '@/lib/db/products'
import { formatDate, labels } from '@/lib/format'
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
  const a = await getArticle(slug)
  if (!a || a.status !== 'published') return { title: 'Article not found', robots: { index: false } }
  return {
    title: a.seo_title || a.title,
    description: a.seo_description || a.excerpt || undefined,
    alternates: { canonical: `/magazine/${a.slug}` },
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
  const [{ data: author }, { data: links }] = await Promise.all([
    article.author_id ? supabase.from('profiles').select('display_name').eq('id', article.author_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('article_products').select('product_id, position').eq('article_id', article.id).order('position'),
  ])
  const products = await productsByIds((links ?? []).map((l) => l.product_id))
  const url = `${site.url}/magazine/${article.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: article.featured_image_url ? [article.featured_image_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    author: { '@type': 'Person', name: author?.display_name ?? `${site.name} editors` },
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
          This article is <strong>{article.status}</strong> and only visible to editors.
        </div>
      )}
      <header className="container-page max-w-4xl pt-10 text-center">
        <Link href={`/magazine?type=${article.type}`} className="eyebrow hover:text-foreground">
          {labels.articleType[article.type as keyof typeof labels.articleType]}
        </Link>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-6xl">{article.title}</h1>
        {article.excerpt && <p className="mx-auto mt-5 max-w-2xl text-xl text-muted-foreground">{article.excerpt}</p>}
        <p className="mt-5 text-sm text-muted-foreground">
          By {author?.display_name ?? `${site.name} editors`} · {formatDate(article.published_at ?? article.updated_at)} · {article.reading_minutes} min read
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
          <span className="text-sm text-muted-foreground">Share this article</span>
          <ShareButton url={url} title={article.title} />
        </div>
      </div>
      {products.length > 0 && (
        <section className="container-page mt-16">
          <SectionHeader title="Products in this article" />
          <ProductGrid products={products} />
        </section>
      )}
    </article>
  )
}
