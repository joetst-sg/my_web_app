import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { TimelineEntry } from '@/components/common/submission-timeline'

export async function getSubmission(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, status, seller_id, reviewer_id, submitted_at, scheduled_for, last_action_at, created_at, product_id')
    .eq('id', id)
    .maybeSingle()
  if (!submission) return null

  const [{ data: reviews }, { data: messages }] = await Promise.all([
    supabase.from('submission_reviews').select('id, actor_id, action, to_status, message, created_at').eq('submission_id', id).order('created_at'),
    supabase.from('submission_messages').select('id, author_id, body, created_at').eq('submission_id', id).order('created_at'),
  ])
  const people = [...new Set([...(reviews ?? []).map((r) => r.actor_id), ...(messages ?? []).map((m) => m.author_id)].filter(Boolean))] as string[]
  const { data: profiles } = people.length ? await supabase.from('profiles').select('id, display_name, username').in('id', people) : { data: [] }
  const name = (uid: string | null) => {
    if (!uid) return null
    const p = profiles?.find((x) => x.id === uid)
    return p?.display_name || p?.username || 'Editor'
  }

  const timeline: TimelineEntry[] = [
    ...(reviews ?? []).map((r) => ({ kind: 'review' as const, id: String(r.id), at: r.created_at, action: r.action, to: r.to_status, message: r.message, actor: name(r.actor_id) })),
    ...(messages ?? []).map((m) => ({ kind: 'message' as const, id: String(m.id), at: m.created_at, body: m.body, actor: name(m.author_id), fromSeller: m.author_id === submission.seller_id })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  const latestRequest = [...(reviews ?? [])].reverse().find((r) => r.action === 'request_changes' || r.action === 'reject')
  return { submission, timeline, latestRequest }
}
