import { formatDateTime } from '@/lib/format'
import { SubmissionStatusBadge } from './submission-status'

const actionLabel = {
  submit: 'Submitted for review',
  withdraw: 'Withdrawn by seller',
  start_review: 'Review started',
  request_changes: 'Changes requested',
  approve: 'Approved',
  reject: 'Rejected',
  schedule: 'Scheduled',
  publish: 'Published',
  archive: 'Archived',
} as const

export type TimelineEntry =
  | { kind: 'review'; id: string; at: string; action: string; to: string; message: string | null; actor: string | null }
  | { kind: 'message'; id: string; at: string; body: string; actor: string | null; fromSeller: boolean }

// Review history and messages interleaved by time.
export function SubmissionTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((e) =>
        e.kind === 'review' ? (
          <li key={`r-${e.id}`} className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-foreground/40" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{actionLabel[e.action as keyof typeof actionLabel] ?? e.action}</span>
                <SubmissionStatusBadge status={e.to} />
              </p>
              <p className="text-xs text-muted-foreground">{e.actor ?? 'System'} · {formatDateTime(e.at)}</p>
            </div>
          </li>
        ) : (
          <li key={`m-${e.id}`} className={`rounded-2xl p-4 ${e.fromSeller ? 'ml-6 bg-surface' : 'mr-6 border'}`}>
            <p className="text-xs text-muted-foreground">{e.actor ?? 'Unknown'} {e.fromSeller ? '(seller)' : '(editor)'} · {formatDateTime(e.at)}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{e.body}</p>
          </li>
        ),
      )}
    </ol>
  )
}

