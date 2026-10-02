// Pure decision rules for the sync (no I/O, so they are easy to test).

export type RegistryRow = {
  product_id: string | null
  pipeline_status: string
  source_status: string
}

// What to do with a campaign found on the "new campaigns" listing.
export function actionForListedCampaign(existing: RegistryRow | null): 'import' | 'skip' {
  if (!existing) return 'import'
  // A previous attempt failed before a product existed: try again.
  if (!existing.product_id && existing.pipeline_status === 'sync_error') return 'import'
  // Already imported, deliberately not eligible, or deleted by an admin.
  return 'skip'
}

// Campaigns whose page is still worth re-checking for updates.
export function shouldCheckForUpdates(row: RegistryRow) {
  return Boolean(row.product_id) && !['rejected', 'archived', 'not_eligible'].includes(row.pipeline_status) && !['ended', 'cancelled'].includes(row.source_status)
}

// Pipeline status after a translation finishes.
export function pipelineAfterTranslation(current: string) {
  return ['imported', 'translating', 'draft', 'sync_error'].includes(current) ? 'pending_review' : current
}

// AI output replaces the live text only while nobody has edited it and the
// product isn't public yet. Otherwise it is stored as a new version and the
// admin sees "Update available".
export function applyTranslationAutomatically(productStatus: string, hasAdminEdits: boolean) {
  return !hasAdminEdits && !['published', 'scheduled', 'approved'].includes(productStatus)
}

// Retry schedule for failed translation jobs: 2, 4, 8… minutes, capped at 1 hour.
export function nextAttempt(attempts: number, maxAttempts: number, retryable: boolean, now = Date.now()) {
  if (!retryable || attempts >= maxAttempts) return { status: 'failed' as const, runAfter: null }
  const delay = Math.min(2 ** attempts, 60) * 60_000
  return { status: 'queued' as const, runAfter: new Date(now + delay).toISOString() }
}

// Whether a scheduled (cron) sync is due.
export function syncIsDue(lastStartedAt: string | null, intervalMinutes: number, now = Date.now()) {
  if (!lastStartedAt) return true
  // Small tolerance so a 30-minute interval isn't missed by a tick that fires a few seconds early.
  return now - Date.parse(lastStartedAt) >= intervalMinutes * 60_000 - 30_000
}
