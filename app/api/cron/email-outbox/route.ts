import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getEmailProvider } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/templates'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Sends queued emails from public.email_outbox. Called by Vercel Cron (or
// any scheduler) with `Authorization: Bearer $CRON_SECRET`.
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

  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' }, { status: 503 })
  const provider = getEmailProvider()
  if (!provider) return NextResponse.json({ sent: 0, note: 'No email provider configured; emails stay queued.' })

  const { data: batch, error } = await supabase
    .from('email_outbox')
    .select('id, to_email, template, payload, attempts')
    .eq('status', 'pending')
    .order('created_at')
    .limit(50)
  if (error) return NextResponse.json({ error: 'Could not read the outbox' }, { status: 500 })

  let sent = 0
  let failed = 0
  for (const row of batch ?? []) {
    // Claim the row so concurrent runs don't send it twice.
    const { data: claimed } = await supabase.from('email_outbox').update({ status: 'sending' }).eq('id', row.id).eq('status', 'pending').select('id')
    if (!claimed?.length) continue
    // Demo and reserved addresses never receive mail.
    if (/@(.+\.)?(example|test|invalid|localhost)$|@loupe\.example$/i.test(row.to_email)) {
      await supabase.from('email_outbox').update({ status: 'skipped', last_error: 'reserved address' }).eq('id', row.id)
      continue
    }
    const email = renderEmail(row.template, row.payload as Record<string, unknown>)
    if (!email) {
      await supabase.from('email_outbox').update({ status: 'skipped', last_error: `unknown template ${row.template}` }).eq('id', row.id)
      continue
    }
    try {
      await provider.send(row.to_email, email)
      await supabase.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null }).eq('id', row.id)
      sent++
    } catch (e) {
      const attempts = row.attempts + 1
      await supabase
        .from('email_outbox')
        .update({ status: attempts >= 5 ? 'failed' : 'pending', attempts, last_error: String(e instanceof Error ? e.message : e).slice(0, 500) })
        .eq('id', row.id)
      failed++
    }
  }
  return NextResponse.json({ provider: provider.name, sent, failed, checked: batch?.length ?? 0 })
}
