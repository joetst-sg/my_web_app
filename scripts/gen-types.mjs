#!/usr/bin/env node
// Regenerates lib/supabase/database.types.ts from the live schema using the
// Supabase Management API (same token as the seed script).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const env = fs.existsSync(path.join(root, '.env.local')) ? fs.readFileSync(path.join(root, '.env.local'), 'utf8') : ''
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]
const tokenFile = path.join(os.homedir(), '.supabase/access-token')
const token = process.env.SUPABASE_ACCESS_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : null)
if (!url || !token) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ACCESS_TOKEN (or ~/.supabase/access-token).')
  process.exit(1)
}
const ref = new URL(url).hostname.split('.')[0]
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`, {
  headers: { Authorization: `Bearer ${token}` },
})
if (!res.ok) {
  console.error(`Failed: ${res.status} ${await res.text()}`)
  process.exit(1)
}
const { types } = await res.json()
fs.writeFileSync(path.join(root, 'lib/supabase/database.types.ts'), types)
console.log('Wrote lib/supabase/database.types.ts')
