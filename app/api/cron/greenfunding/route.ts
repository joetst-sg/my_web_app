import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { backfillSummaries, runSync } from '@/lib/greenfunding/sync'
import { createServiceClient } from '@/lib/supabase/server'
import { processTranslationQueue } from '@/lib/translation/queue'

export const dynamic = 'force-dynamic'
// Each tick does a bounded amount of work (request budget + a few translations).
export const maxDuration = 300

// Called every few minutes by the database scheduler (pg_cron → pg_net) with
// `Authorization: Bearer $CRON_SECRET`. A sync only runs when the configured
// GREEN_FUNDING_SYNC_INTERVAL_MINUTES has passed; queued translations are
// processed on every tick.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const got = Buffer.from(header)
  return expected.length === got.length && timingSafeEqual(expected, got)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sync = await runSync('cron')
  const db = createServiceClient()
  const summaries = db ? await backfillSummaries(db) : null
  const translations = await processTranslationQueue()
  return NextResponse.json({ sync, summaries, translations }, { headers: { 'Cache-Control': 'no-store' } })
}
