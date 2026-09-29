import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, BellRing, Bookmark, FolderHeart, Heart, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requireViewer } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Your account', robots: { index: false } }

export default async function AccountPage() {
  const viewer = await requireViewer('/account')
  const supabase = await createClient()
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0)
  const [saved, collections, brands, cats, reminders, unread] = await Promise.all([
    count(supabase.from('product_saves').select('*', { count: 'exact', head: true }).eq('user_id', viewer.id)),
    count(supabase.from('collections').select('*', { count: 'exact', head: true }).eq('owner_id', viewer.id)),
    count(supabase.from('brand_followers').select('*', { count: 'exact', head: true }).eq('user_id', viewer.id)),
    count(supabase.from('category_followers').select('*', { count: 'exact', head: true }).eq('user_id', viewer.id)),
    count(supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('user_id', viewer.id).eq('status', 'pending')),
    count(supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', viewer.id).is('read_at', null)),
  ])
  const tiles = [
    ['/account/saved', 'Saved products', saved, Bookmark],
    ['/account/collections', 'Collections', collections, FolderHeart],
    ['/account/following', 'Following', brands + cats, Heart],
    ['/account/reminders', 'Active reminders', reminders, BellRing],
    ['/account/notifications', 'Unread notifications', unread, Bell],
  ] as const

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Hi {viewer.displayName ?? viewer.username}</h1>
        <p className="mt-1 text-muted-foreground">@{viewer.username} · {viewer.email}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map(([href, label, value, Icon]) => (
          <Link key={href} href={href} className="flex flex-col gap-3 rounded-2xl border p-4 hover:border-foreground/30">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
            <span className="font-display text-3xl font-bold tabular-nums">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
          </Link>
        ))}
      </div>
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Store className="mt-1 size-5" aria-hidden />
          <div>
            <h2 className="font-sans text-base font-semibold tracking-normal">{viewer.isSeller ? 'Your seller dashboard' : 'Make something great?'}</h2>
            <p className="text-sm text-muted-foreground">
              {viewer.isSeller ? 'Track submissions and see how your products perform.' : 'Submit your product for editorial review. It’s free.'}
            </p>
          </div>
        </div>
        <Button asChild size="lg"><Link href={viewer.isSeller ? '/seller/dashboard' : '/seller'}>{viewer.isSeller ? 'Open dashboard' : 'Become a seller'}</Link></Button>
      </section>
    </div>
  )
}
