import { StatusPill } from './basics'
import { labels } from '@/lib/format'

const tones = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  scheduled: 'accent',
  published: 'success',
  rejected: 'danger',
  archived: 'neutral',
} as const

export function SubmissionStatusBadge({ status }: { status: string }) {
  const s = status as keyof typeof tones
  return <StatusPill tone={tones[s] ?? 'neutral'}>{labels.submissionStatus[s] ?? status}</StatusPill>
}
