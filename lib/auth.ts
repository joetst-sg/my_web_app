import 'server-only'
import { cache } from 'react'
import { redirect } from '@/lib/i18n/server'
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

// The signed-in user's id and email from the verified session token, or
// null. getClaims() checks the JWT signature (locally, with the project's
// signing keys) — unlike getSession(), it can't be spoofed with a forged
// cookie. Server actions that change data use getUser() instead.
export const getAuthUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  if (error || !sub) return null
  return { id: sub, email: (data.claims.email as string | undefined) ?? null }
})

// The signed-in user with roles and profile, or null. Cached per request.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()

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
  if (!viewer) return redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  return viewer
}

export async function requireStaff() {
  const viewer = await requireViewer('/admin')
  if (!viewer.isStaff) return redirect('/forbidden')
  return viewer
}

export async function requireAdmin() {
  const viewer = await requireViewer('/admin')
  if (!viewer.isAdmin) return redirect('/forbidden')
  return viewer
}

export { safeNext } from '@/lib/validation'
