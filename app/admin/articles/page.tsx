import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/common/basics'
import { formatDate, labels } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Articles' }

const tone = { draft: 'neutral', review: 'info', scheduled: 'accent', published: 'success', archived: 'neutral' } as const

export default async function AdminArticlesPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('articles').select('id, slug, title, type, status, published_at, scheduled_for, updated_at, author_id').order('updated_at', { ascending: false })
  const authorIds = [...new Set((data ?? []).map((a) => a.author_id).filter(Boolean))] as string[]
  const { data: authors } = authorIds.length ? await supabase.from('profiles').select('id, display_name').in('id', authorIds) : { data: [] }
  const author = new Map((authors ?? []).map((a) => [a.id, a.display_name]))
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Articles</h1>
        <Button asChild><Link href="/admin/articles/new"><Plus />New article</Link></Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b"><th className="p-3 font-medium">Title</th><th className="p-3 font-medium">Type</th><th className="p-3 font-medium">Author</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Date</th></tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-surface">
                <td className="p-3"><Link href={`/admin/articles/${a.id}`} className="font-medium hover:underline">{a.title}</Link></td>
                <td className="p-3">{labels.articleType[a.type]}</td>
                <td className="p-3">{(a.author_id && author.get(a.author_id)) ?? '—'}</td>
                <td className="p-3"><StatusPill tone={tone[a.status]}>{a.status}</StatusPill></td>
                <td className="p-3 text-muted-foreground">{formatDate(a.status === 'scheduled' ? a.scheduled_for : a.published_at ?? a.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
