import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export type Role = Database['public']['Enums']['app_role']

export type Viewer = {
  id: string
  email: string | null
  roles: Role[]
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  onboarded: boolean
  suspended: boolean
  isSeller: boolean
  isStaff: boolean
  isAdmin: boolean
}

// The signed-in user with roles and profile, or null. Cached per request.
// Uses getUser() (verified with Supabase Auth), never the unverified session.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: roles }, { data: profile }, { data: settings }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id),
    supabase.from('profiles').select('username, display_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('user_settings').select('onboarded_at, suspended_at').eq('user_id', user.id).maybeSingle(),
  ])

  const roleList = (roles ?? []).map((r) => r.role)
  return {
    id: user.id,
    email: user.email ?? null,
    roles: roleList,
    username: profile?.username ?? null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    onboarded: Boolean(settings?.onboarded_at),
    suspended: Boolean(settings?.suspended_at),
    isSeller: roleList.includes('seller'),
    isStaff: roleList.includes('editor') || roleList.includes('admin'),
    isAdmin: roleList.includes('admin'),
  }
})

export async function requireViewer(next?: string) {
  const viewer = await getViewer()
  if (!viewer) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  return viewer
}

export async function requireStaff() {
  const viewer = await requireViewer('/admin')
  if (!viewer.isStaff) redirect('/forbidden')
  return viewer
}

export async function requireAdmin() {
  const viewer = await requireViewer('/admin')
  if (!viewer.isAdmin) redirect('/forbidden')
  return viewer
}

// Only allow redirects to local paths (prevents open redirects).
export function safeNext(next: string | null | undefined, fallback = '/') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  return next
}
