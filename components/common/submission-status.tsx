'use client'

import { StatusPill } from './basics'
import { useT } from '@/components/i18n/provider'
import type { MessageKey } from '@/lib/i18n/translate'

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
  const t = useT()
  const s = status as keyof typeof tones
  return <StatusPill tone={tones[s] ?? 'neutral'}>{tones[s] ? t(`labels.submissionStatus.${s}` as MessageKey) : status}</StatusPill>
}
