import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusPill } from '@/components/common/basics'
import { ActionButton } from '@/components/admin/action-button'
import { deleteCollectionAdmin, setCollectionFlags } from '@/lib/actions/admin'
import { getViewer } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { NewEditorialCollection } from './new-collection'

export const metadata: Metadata = { title: 'Collections' }

export default async function AdminCollectionsPage() {
  const viewer = await getViewer()
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('id, slug, title, visibility, is_editorial, is_featured, product_count, follower_count, owner_id, updated_at')
    .order('is_editorial', { ascending: false })
    .order('updated_at', { ascending: false })
  const ownerIds = [...new Set((data ?? []).map((c) => c.owner_id).filter(Boolean))] as string[]
  const { data: owners } = ownerIds.length ? await supabase.from('profiles').select('id, display_name').in('id', ownerIds) : { data: [] }
  const owner = new Map((owners ?? []).map((o) => [o.id, o.display_name]))
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Collections</h1>
          <p className="mt-1 text-muted-foreground">Editorial collections are yours to curate; you can feature any public collection. Private collections are shown for moderation only.</p>
        </div>
        <NewEditorialCollection />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b"><th className="p-3 font-medium">Collection</th><th className="p-3 font-medium">Owner</th><th className="p-3 text-right font-medium">Products</th><th className="p-3 text-right font-medium">Followers</th><th className="p-3 font-medium">Flags</th><th className="p-3 font-medium">Updated</th><th className="p-3 font-medium">Actions</th></tr>
          </thead>
          <tbody className="divide-y">
            {(data ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-surface">
                <td className="p-3"><Link href={`/collections/${c.slug}`} className="font-medium hover:underline">{c.title}</Link></td>
                <td className="p-3">{c.is_editorial ? 'Editors' : (c.owner_id && owner.get(c.owner_id)) ?? '—'}</td>
                <td className="p-3 text-right tabular-nums">{c.product_count}</td>
                <td className="p-3 text-right tabular-nums">{c.follower_count}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <StatusPill tone={c.visibility === 'public' ? 'success' : 'neutral'}>{c.visibility}</StatusPill>
                    {c.is_editorial && <StatusPill tone="info">Editorial</StatusPill>}
                    {c.is_featured && <StatusPill tone="accent">Featured</StatusPill>}
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">{formatDate(c.updated_at)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {c.visibility === 'public' && <ActionButton size="sm" variant="ghost" action={setCollectionFlags.bind(null, c.id, { is_featured: !c.is_featured })}>{c.is_featured ? 'Unfeature' : 'Feature'}</ActionButton>}
                    {c.is_editorial && <Link href={`/account/collections/${c.id}`} className="inline-flex h-7 items-center px-2 text-sm underline underline-offset-4">Edit</Link>}
                    {!c.is_editorial && c.visibility === 'public' && (
                      <ActionButton size="sm" variant="ghost" action={setCollectionFlags.bind(null, c.id, { visibility: 'private' })} confirm={{ title: 'Hide this collection?', description: 'It becomes private to its owner. Use this for moderation.' }}>Hide</ActionButton>
                    )}
                    {viewer?.isAdmin && (
                      <ActionButton size="sm" variant="ghost" className="text-destructive" action={deleteCollectionAdmin.bind(null, c.id)} confirm={{ title: `Delete “${c.title}”?`, confirmLabel: 'Delete' }}>Delete</ActionButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
