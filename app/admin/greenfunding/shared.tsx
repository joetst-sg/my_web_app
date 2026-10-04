import { StatusPill } from '@/components/common/basics'

export const pipelineTone: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'> = {
  imported: 'info',
  translating: 'info',
  draft: 'neutral',
  pending_review: 'warning',
  approved: 'accent',
  published: 'success',
  rejected: 'neutral',
  archived: 'neutral',
  sync_error: 'danger',
  failed: 'danger',
  duplicate: 'warning',
  not_eligible: 'neutral',
}

export const pipelineLabel: Record<string, string> = {
  imported: 'Imported',
  translating: 'Translating',
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
  sync_error: 'Sync error',
  failed: 'Failed',
  duplicate: 'Possible duplicate',
  not_eligible: 'Not eligible',
}

export const campaignLabel: Record<string, string> = {
  active: 'Active',
  succeeded: 'Funded · active',
  ended: 'Ended',
  cancelled: 'Cancelled',
  upcoming: 'Upcoming',
  unknown: 'Unknown',
}

export function PipelinePill({ status }: { status: string }) {
  return <StatusPill tone={pipelineTone[status] ?? 'neutral'}>{pipelineLabel[status] ?? status}</StatusPill>
}

export function CampaignPill({ status }: { status: string }) {
  return <StatusPill tone={status === 'ended' || status === 'cancelled' ? 'danger' : status === 'unknown' ? 'neutral' : 'success'}>{campaignLabel[status] ?? status}</StatusPill>
}

export function translationState(job: { status: string; attempts: number; max_attempts: number } | undefined, translated: boolean) {
  if (job?.status === 'running') return { label: 'Translating…', tone: 'info' as const }
  if (job?.status === 'queued') return { label: job.attempts ? `Retrying (${job.attempts}/${job.max_attempts})` : 'Queued', tone: 'info' as const }
  if (job?.status === 'failed' && !translated) return { label: 'Failed', tone: 'danger' as const }
  if (translated) return { label: 'Translated', tone: 'success' as const }
  return { label: 'Not translated', tone: 'neutral' as const }
}

export const fmtDate = (d: string | null | undefined) =>
  d ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Hong_Kong' }).format(new Date(d)) + ' HKT' : '—'

export const yen = (n: number | null | undefined, currency = 'JPY') =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)
