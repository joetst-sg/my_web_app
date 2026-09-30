import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ArticleEditor } from '../article-editor'

export const metadata: Metadata = { title: 'Edit article' }

export default async function EditArticlePage({ params }: PageProps<'/admin/articles/[id]'>) {
  const { id } = await params
  const isNew = id === 'new'
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const viewer = await getViewer()
  const supabase = await createClient()
  const [{ data: categories }, { data: products }, article] = await Promise.all([
    supabase.from('categories').select('id, name').is('parent_id', null).order('sort_order'),
    supabase.from('products').select('id, name').eq('status', 'published').order('name'),
    isNew
      ? Promise.resolve(null)
      : supabase
          .from('articles')
          .select('id, slug, title, excerpt, content, type, status, featured_image_url, seo_title, seo_description, scheduled_for, article_categories ( category_id ), article_products ( product_id, position )')
          .eq('id', id)
          .maybeSingle()
          .then((r) => r.data),
  ])
  if (!isNew && !article) notFound()
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow"><Link href="/admin/articles" className="hover:text-foreground">Articles</Link></p>
        <h1 className="mt-1 font-display text-3xl font-bold">{isNew ? 'New article' : article!.title}</h1>
        {article?.status === 'published' && <Link href={`/magazine/${article.slug}`} className="text-sm underline underline-offset-4">View live</Link>}
      </div>
      <ArticleEditor
        canDelete={Boolean(viewer?.isAdmin)}
        categories={categories ?? []}
        products={products ?? []}
        article={{
          id: article?.id,
          title: article?.title ?? '',
          slug: article?.slug ?? '',
          excerpt: article?.excerpt ?? '',
          content: article?.content ?? '',
          type: article?.type ?? 'news',
          status: article?.status ?? 'draft',
          featured_image_url: article?.featured_image_url ?? '',
          seo_title: article?.seo_title ?? '',
          seo_description: article?.seo_description ?? '',
          scheduled_for: article?.scheduled_for ? new Date(article.scheduled_for).toISOString().slice(0, 16) : '',
          category_ids: (article?.article_categories ?? []).map((c) => c.category_id),
          product_ids: [...(article?.article_products ?? [])].sort((a, b) => a.position - b.position).map((p) => p.product_id),
        }}
      />
    </div>
  )
}
