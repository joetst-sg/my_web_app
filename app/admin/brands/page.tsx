import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark, StatusPill } from '@/components/common/basics'
import { ActionButton } from '@/components/admin/action-button'
import { setBrandFlags } from '@/lib/actions/admin'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Brands' }

export default async function AdminBrandsPage() {
  const supabase = await createClient()
  const [{ data: brands }, { data: products }] = await Promise.all([
    supabase.from('brands').select('id, slug, name, logo_url, is_published, is_verified, follower_count, owner_id, created_at').order('created_at', { ascending: false }),
    supabase.from('products').select('brand_id, status'),
  ])
  const ownerIds = [...new Set((brands ?? []).map((b) => b.owner_id).filter(Boolean))] as string[]
  const { data: sellers } = ownerIds.length ? await supabase.from('seller_profiles').select('user_id, company_name').in('user_id', ownerIds) : { data: [] }
  const owner = new Map((sellers ?? []).map((s) => [s.user_id, s.company_name]))
  const count = (id: string, published?: boolean) => (products ?? []).filter((p) => p.brand_id === id && (!published || p.status === 'published')).length
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Brands</h1>
        <p className="mt-1 text-muted-foreground">Brands become public automatically when one of their products is published. Verified brands get a badge.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-background">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b"><th className="p-3 font-medium">Brand</th><th className="p-3 font-medium">Owner</th><th className="p-3 text-right font-medium">Products</th><th className="p-3 text-right font-medium">Followers</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Actions</th></tr>
          </thead>
          <tbody className="divide-y">
            {(brands ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-surface">
                <td className="p-3">
                  <Link href={`/brands/${b.slug}`} className="flex items-center gap-3 font-medium hover:underline"><BrandMark name={b.name} logoUrl={b.logo_url} size={32} />{b.name}</Link>
                </td>
                <td className="p-3">{(b.owner_id && owner.get(b.owner_id)) ?? <span className="text-muted-foreground">Editorial</span>}</td>
                <td className="p-3 text-right tabular-nums">{count(b.id, true)} / {count(b.id)}</td>
                <td className="p-3 text-right tabular-nums">{b.follower_count}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <StatusPill tone={b.is_published ? 'success' : 'neutral'}>{b.is_published ? 'Public' : 'Hidden'}</StatusPill>
                    {b.is_verified && <StatusPill tone="info">Verified</StatusPill>}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <ActionButton size="sm" variant="ghost" action={setBrandFlags.bind(null, b.id, { is_verified: !b.is_verified })}>{b.is_verified ? 'Unverify' : 'Verify'}</ActionButton>
                    <ActionButton size="sm" variant="ghost" action={setBrandFlags.bind(null, b.id, { is_published: !b.is_published })}>{b.is_published ? 'Hide' : 'Make public'}</ActionButton>
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
