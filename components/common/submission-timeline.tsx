'use client'

import { useFormatters, useT } from '@/components/i18n/provider'
import type { MessageKey } from '@/lib/i18n/translate'
import { SubmissionStatusBadge } from './submission-status'

const actions = ['submit', 'withdraw', 'start_review', 'request_changes', 'approve', 'reject', 'schedule', 'publish', 'archive'] as const

export type TimelineEntry =
  | { kind: 'review'; id: string; at: string; action: string; to: string; message: string | null; actor: string | null }
  | { kind: 'message'; id: string; at: string; body: string; actor: string | null; fromSeller: boolean }

// Review history and messages interleaved by time.
export function SubmissionTimeline({ entries }: { entries: TimelineEntry[] }) {
  const t = useT()
  const f = useFormatters()
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t('timeline.empty')}</p>
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((e) =>
        e.kind === 'review' ? (
          <li key={`r-${e.id}`} className="flex gap-3">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-foreground/40" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">
                  {(actions as readonly string[]).includes(e.action) ? t(`timeline.actions.${e.action}` as MessageKey) : e.action}
                </span>
                <SubmissionStatusBadge status={e.to} />
              </p>
              <p className="text-xs text-muted-foreground">{e.actor ?? t('timeline.system')} · {f.dateTime(e.at)}</p>
            </div>
          </li>
        ) : (
          <li key={`m-${e.id}`} className={`rounded-2xl p-4 ${e.fromSeller ? 'ml-6 bg-surface' : 'mr-6 border'}`}>
            <p className="text-xs text-muted-foreground">
              {e.actor ?? t('timeline.unknown')} {e.fromSeller ? t('timeline.seller') : t('timeline.editor')} · {f.dateTime(e.at)}
            </p>
            <p className="mt-1 whitespace-pre-line text-sm">{e.body}</p>
          </li>
        ),
      )}
    </ol>
  )
}
