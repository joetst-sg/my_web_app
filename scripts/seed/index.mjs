#!/usr/bin/env node
// Seeds a Supabase project with fictional demo content and demo accounts.
//
//   npm run db:seed              # refuses to run if catalogue data exists
//   npm run db:seed -- --reset   # DELETES all catalogue content first (dev only)
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (from
// .env.local) and a Supabase personal access token in SUPABASE_ACCESS_TOKEN
// or ~/.supabase/access-token. Demo account passwords are generated randomly
// and written to DEMO_ACCOUNTS.local.md, which is git-ignored.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { articles, brands, categories, collections, deals, products, workflowProducts } from './data.mjs'
import { renderArticleImage, renderProductImage } from './images.mjs'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
loadEnvFile(path.join(root, '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ||
  (fs.existsSync(path.join(os.homedir(), '.supabase/access-token'))
    ? fs.readFileSync(path.join(os.homedir(), '.supabase/access-token'), 'utf8').trim()
    : null)

if (!SUPABASE_URL || !ANON_KEY || !TOKEN) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or a Supabase access token. See ENVIRONMENT.md.')
  process.exit(1)
}
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const RESET = process.argv.includes('--reset')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${text.slice(0, 2000)}`)
  return JSON.parse(text)
}

function lit(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return v.length ? `array[${v.map(lit).join(', ')}]` : `'{}'`
  if (typeof v === 'object') return `${lit(JSON.stringify(v))}::jsonb`
  return `'${String(v).replace(/'/g, "''")}'`
}

const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const password = () => crypto.randomBytes(12).toString('base64url') + 'a9!'

// Deterministic pseudo-random numbers so re-seeding gives similar data.
let seedState = 42
const rand = () => ((seedState = (seedState * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

async function signIn(email, pw) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(json)}`)
  return json.access_token
}

async function upload(jwt, bucket, objectPath, buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: buffer,
  })
  if (!res.ok) throw new Error(`Upload failed for ${bucket}/${objectPath}: ${res.status} ${await res.text()}`)
}

const log = (msg) => console.log(`• ${msg}`)

// ---------------------------------------------------------------------------
// Demo accounts
// ---------------------------------------------------------------------------

const accounts = {
  admin: { email: 'admin@loupe.example', name: 'Avery Admin', username: 'avery_admin', roles: ['admin'] },
  editor: { email: 'editor@loupe.example', name: 'Elin Park', username: 'elin_edits', roles: ['editor'], bio: 'Senior editor. Tests everything twice.' },
  seller1: { email: 'seller@loupe.example', name: 'Mara Lindqvist', username: 'mara_halden', seller: { company: 'Halden Group', website: 'https://halden-audio.example.com' } },
  seller2: { email: 'seller2@loupe.example', name: 'Theo Okafor', username: 'theo_veloce', seller: { company: 'Veloce Labs Ltd', website: 'https://velocelabs.example.com' } },
  seller3: { email: 'seller3@loupe.example', name: 'Rin Takahashi', username: 'rin_driftline', seller: { company: 'Driftline Supply Co.', website: 'https://driftline.example.com' } },
  user1: { email: 'user@loupe.example', name: 'Sam Rivera', username: 'sam_r', bio: 'Desk setups and travel gear.' },
  user2: { email: 'user2@loupe.example', name: 'Jules Moreau', username: 'jules_m', bio: 'Audio nerd.' },
}

async function createAccounts() {
  const credentials = {}
  for (const [key, a] of Object.entries(accounts)) {
    const pw = password()
    credentials[key] = pw
    const id = crypto.randomUUID()
    a.id = id
    await sql(`
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', ${lit(id)}, 'authenticated', 'authenticated', ${lit(a.email)},
        extensions.crypt(${lit(pw)}, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        ${lit({ display_name: a.name, username: a.username })}, now() - interval '60 days', now(), '', '', '', '', '', '', '', '');
      insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (${lit(id)}, ${lit(id)}, ${lit({ sub: id, email: a.email, email_verified: true })}, 'email', now(), now(), now());
      update public.profiles set bio = ${lit(a.bio ?? null)} where id = ${lit(id)};
      update public.user_settings set onboarded_at = now() where user_id = ${lit(id)};
      -- demo addresses cannot receive mail
      update public.email_outbox set status = 'skipped', last_error = 'demo account' where user_id = ${lit(id)};
      ${(a.roles || []).map((r) => `insert into public.user_roles (user_id, role) values (${lit(id)}, ${lit(r)}) on conflict do nothing;`).join('\n')}
      ${a.seller ? `insert into public.seller_profiles (user_id, company_name, website, contact_email, bio)
        values (${lit(id)}, ${lit(a.seller.company)}, ${lit(a.seller.website)}, ${lit(a.email)}, ${lit(`${a.seller.company} — demo seller account.`)});` : ''}
    `)
  }

  const lines = [
    '# Demo accounts (local development only)',
    '',
    'Generated by `npm run db:seed`. This file is git-ignored — never commit it.',
    'Re-running the seed with `--reset` creates new accounts with new passwords.',
    '',
    '| Role | Email | Password |',
    '|---|---|---|',
    ...Object.entries(accounts).map(([k, a]) => `| ${k} | ${a.email} | \`${credentials[k]}\` |`),
    '',
  ]
  fs.writeFileSync(path.join(root, 'DEMO_ACCOUNTS.local.md'), lines.join('\n'))
  return credentials
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

function describe(p, brand) {
  const f = p.features.map((x) => x.charAt(0).toLowerCase() + x.slice(1))
  return [
    p.blurb,
    `${brand.name} built the ${p.name} around ${f[0]}${f[1] ? ` and ${f[1]}` : ''}. ${f.length > 2 ? `It also brings ${f.slice(2).join(', ')}.` : ''}`.trim(),
    `${brand.tagline} This listing is fictional demo content created for development.`,
  ].join('\n\n')
}

async function seedCatalogue() {
  // Categories (parents first)
  const parents = categories.filter((c) => !c.parent)
  const children = categories.filter((c) => c.parent)
  await sql(`insert into public.categories (slug, name, description, color, icon, is_featured, sort_order, seo_title, seo_description) values
    ${parents.map((c, i) => `(${lit(c.slug)}, ${lit(c.name)}, ${lit(c.description)}, ${lit(c.color)}, ${lit(c.icon)}, ${lit(!!c.featured)}, ${i}, ${lit(`${c.name} — new and trending products`)}, ${lit(c.description)})`).join(',\n')};`)
  await sql(`insert into public.categories (slug, name, description, color, icon, parent_id, sort_order) values
    ${children.map((c, i) => `(${lit(c.slug)}, ${lit(c.name)}, ${lit(c.description)}, ${lit(c.color)}, ${lit(c.icon)}, (select id from public.categories where slug = ${lit(c.parent)}), ${i})`).join(',\n')};`)
  log(`${categories.length} categories`)

  // Brands
  await sql(`insert into public.brands (slug, name, tagline, description, website_url, owner_id, is_published, is_verified, social_links) values
    ${brands.map((b) => `(${lit(b.slug)}, ${lit(b.name)}, ${lit(b.tagline)}, ${lit(b.description)}, ${lit(b.website)},
      ${b.owner ? lit(accounts[b.owner].id) : 'null'}, true, ${lit(rand() > 0.3)},
      ${lit({ instagram: `https://instagram.com/${b.slug.replace(/-/g, '')}`, x: `https://x.com/${b.slug.replace(/-/g, '')}` })})`).join(',\n')};`)
  log(`${brands.length} brands`)

  // Tags
  const allTags = [...new Set([...products, ...workflowProducts].flatMap((p) => p.tags || []))]
  await sql(`insert into public.tags (slug, name) values ${allTags.map((t) => `(${lit(t)}, ${lit(t.replace(/-/g, ' '))})`).join(', ')};`)
  log(`${allTags.length} tags`)
}

async function insertProduct(p, { status, publishedDaysAgo, sellerKey }) {
  const brand = brands.find((b) => b.slug === p.brand)
  const slug = slugify(p.name)
  const seller = accounts[sellerKey || p.seller || 'editor']
  const [row] = await sql(`
    insert into public.products (slug, name, tagline, description, key_features, benefits, brand_id, seller_id, external_url, sku,
      currency, price, original_price, availability, seo_title, seo_description, created_at)
    values (${lit(slug)}, ${lit(p.name)}, ${lit(p.tagline)}, ${lit(describe(p, brand))}, ${lit(p.features)}, '{}',
      (select id from public.brands where slug = ${lit(p.brand)}), ${lit(seller.id)},
      ${lit(`${brand.website}/products/${slug}`)}, ${lit(p.sku ?? null)}, 'USD', ${p.price}, ${p.orig ?? 'null'},
      ${lit(p.availability || 'available')}, ${lit(p.name.slice(0, 70))}, ${lit(p.tagline.slice(0, 170))},
      now() - interval '${(publishedDaysAgo ?? 2) + 3} days')
    returning id;
  `)
  const id = row.id
  const specs = Object.entries(p.specs || {})
  await sql(`
    insert into public.product_categories (product_id, category_id, is_primary)
      select ${lit(id)}, c.id, c.slug = ${lit(p.cats[0])} from public.categories c where c.slug = any(${lit(p.cats)}::text[]);
    ${(p.tags || []).length ? `insert into public.product_tags (product_id, tag_id) select ${lit(id)}, id from public.tags where slug = any(${lit(p.tags)}::text[]);` : ''}
    ${specs.length ? `insert into public.product_specifications (product_id, label, value, position) values ${specs.map(([k, v], i) => `(${lit(id)}, ${lit(k)}, ${lit(v)}, ${i})`).join(', ')};` : ''}
    ${p.score ? `insert into public.product_scores (product_id, overall, design, innovation, usability, value, features, verdict, reviewed_by)
      values (${lit(id)}, ${p.score.join(', ')}, ${lit(`${p.tagline} A strong pick in its category.`)}, ${lit(accounts.editor.id)});` : ''}
  `)
  return { id, slug, name: p.name, product: p, status, publishedDaysAgo, seller }
}

async function setWorkflowState(entry, state, message) {
  const { id, seller } = entry
  const editor = accounts.editor.id
  const steps = {
    draft: [],
    submitted: [['submit', 'draft', 'submitted', seller.id]],
    under_review: [['submit', 'draft', 'submitted', seller.id], ['start_review', 'submitted', 'under_review', editor]],
    changes_requested: [['submit', 'draft', 'submitted', seller.id], ['start_review', 'submitted', 'under_review', editor], ['request_changes', 'under_review', 'changes_requested', editor]],
    rejected: [['submit', 'draft', 'submitted', seller.id], ['reject', 'submitted', 'rejected', editor]],
    approved: [['submit', 'draft', 'submitted', seller.id], ['start_review', 'submitted', 'under_review', editor], ['approve', 'under_review', 'approved', editor]],
    scheduled: [['submit', 'draft', 'submitted', seller.id], ['approve', 'submitted', 'approved', editor], ['schedule', 'approved', 'scheduled', editor]],
    published: [['submit', 'draft', 'submitted', seller.id], ['approve', 'submitted', 'approved', editor], ['publish', 'approved', 'published', editor]],
  }[state]
  const productStatus = { draft: 'draft', submitted: 'pending_review', under_review: 'pending_review', changes_requested: 'changes_requested', rejected: 'rejected', approved: 'approved', scheduled: 'scheduled', published: 'published' }[state]
  const days = entry.publishedDaysAgo ?? 1
  const scheduledFor = state === 'scheduled' ? `now() + interval '2 days'` : 'null'
  await sql(`
    update public.products set status = ${lit(productStatus)},
      published_at = ${state === 'published' ? `now() - interval '${days} days' - interval '${Math.floor(rand() * 20)} hours'` : 'null'},
      scheduled_for = ${scheduledFor}
    where id = ${lit(id)};
    update public.submissions set status = ${lit(state)},
      reviewer_id = ${steps.some((s) => s[3] === editor) ? lit(editor) : 'null'},
      submitted_at = ${steps.length ? `now() - interval '${days + 2} days'` : 'null'},
      scheduled_for = ${scheduledFor},
      last_action_at = now() - interval '${days} days'
    where product_id = ${lit(id)};
    ${steps.map(([action, from, to, actor], i) => `
      insert into public.submission_reviews (submission_id, actor_id, action, from_status, to_status, message, created_at)
      values ((select id from public.submissions where product_id = ${lit(id)}), ${lit(actor)}, ${lit(action)}, ${lit(from)}, ${lit(to)},
        ${['request_changes', 'reject'].includes(action) ? lit(message) : 'null'}, now() - interval '${days + 2 - i * 0.5} days');`).join('')}
    ${message ? `insert into public.submission_messages (submission_id, author_id, body, created_at)
      values ((select id from public.submissions where product_id = ${lit(id)}), ${lit(editor)}, ${lit(message)}, now() - interval '${days} days');` : ''}
  `)
}

async function uploadProductImages(jwt, entry) {
  const count = entry.product.availability === 'coming_soon' ? 2 : 3
  const values = []
  for (let v = 0; v < count; v++) {
    const buf = await renderProductImage({ shape: entry.product.shape, hue: entry.product.hue, variant: v })
    const objectPath = `products/${entry.id}/${crypto.randomUUID()}.webp`
    await upload(jwt, 'product-images', objectPath, buf)
    values.push(`(${lit(entry.id)}, ${lit(objectPath)}, ${lit(`${entry.name}${v ? ` — ${v === 1 ? 'detail' : 'angle'} view` : ''}`)}, 1200, 900, ${v})`)
  }
  await sql(`insert into public.product_images (product_id, storage_path, alt, width, height, position) values ${values.join(', ')};`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding project ${PROJECT_REF}…`)
  const [{ n }] = await sql(`select count(*)::int as n from public.products`)
  if (n > 0 && !RESET) {
    console.error(`The database already has ${n} products. Re-run with --reset to wipe catalogue content and demo accounts first (development only).`)
    process.exit(1)
  }
  if (RESET) {
    log('Resetting catalogue content and demo accounts')
    await sql(`
      delete from auth.users where email like '%@loupe.example';
      truncate public.analytics_events, public.product_views, public.notifications, public.homepage_sections,
        public.featured_products, public.deals, public.article_products, public.article_categories, public.article_tags,
        public.articles, public.collection_products, public.collection_followers, public.collections, public.reminders,
        public.reports, public.product_saves, public.submission_messages, public.submission_reviews, public.submissions,
        public.product_images, public.product_videos, public.product_specifications, public.product_scores,
        public.product_tags, public.product_categories, public.products, public.brand_followers, public.brands,
        public.category_followers, public.categories, public.tags, public.audit_logs, public.rate_limit_hits cascade;
      delete from storage.objects where bucket_id in ('product-images', 'article-images');
    `)
  }

  const credentials = await createAccounts()
  log(`${Object.keys(accounts).length} demo accounts (credentials in DEMO_ACCOUNTS.local.md)`)
  await seedCatalogue()

  const editorJwt = await signIn(accounts.editor.email, credentials.editor)

  // Published products, spread over the last ~45 days.
  const entries = []
  for (const [i, p] of products.entries()) {
    const days = Math.max(0, Math.floor((i / products.length) * 45 + rand() * 4) - 1)
    const entry = await insertProduct(p, { status: 'published', publishedDaysAgo: (products.length - i) % 46 === 0 ? 0 : days })
    entries.push(entry)
  }
  // Make the list order roughly "newest last" -> shuffle days so categories mix.
  for (const e of entries) e.publishedDaysAgo = Math.floor(rand() * 45)
  for (const e of entries) await setWorkflowState(e, 'published')
  log(`${entries.length} published products`)

  for (const e of entries) await uploadProductImages(editorJwt, e)
  log(`${entries.length * 3} product images uploaded`)

  // Products in the review workflow.
  for (const p of workflowProducts) {
    const e = await insertProduct(p, { status: p.state, publishedDaysAgo: 1, sellerKey: p.seller })
    await uploadProductImages(editorJwt, e)
    await setWorkflowState(e, p.state, p.message)
  }
  log(`${workflowProducts.length} products in the review workflow`)

  const pid = (name) => `(select id from public.products where name = ${lit(name)})`

  // Deals
  await sql(`insert into public.deals (product_id, title, deal_price, coupon_code, starts_at, ends_at, created_by) values
    ${deals.map((d) => `(${pid(d.product)}, ${lit(d.title)}, ${d.price}, ${lit(d.code ?? null)},
      now() + interval '${d.days[0] * 24} hours', now() + interval '${d.days[1] * 24} hours', ${lit(accounts.editor.id)})`).join(',\n')};`)
  log(`${deals.length} deals`)

  // Featured placements
  const featured = {
    hero: ['Tessellate Lingo One'],
    featured_today: ['Kestrel Swift Drone', 'Halden Arc Pro', 'Quillwork Slate Notebook', 'Lumen & Oak Solstice Lamp'],
    featured_this_week: ['Parsec Pip Desk Robot', 'Driftline Carry 35', 'Nimbus Keystone Lock', 'Grainfield F1 Compact'],
    editors_pick: ['Sable Loop Ring', 'Moonforge Tide Controller', 'Veloce Pace Watch', 'Cinder Ember Speaker', 'Tallow Precision Kettle', 'Voltra Duo Dash Cam'],
    coming_soon: ['Tessellate Glance Glasses', 'Petrichor Charge Garden', 'Parsec Rover Home Assistant', 'Veloce Rowline Compact Rower'],
  }
  await sql(`insert into public.featured_products (product_id, placement, position, created_by) values
    ${Object.entries(featured).flatMap(([placement, names]) => names.map((n, i) => `(${pid(n)}, ${lit(placement)}, ${i}, ${lit(accounts.editor.id)})`)).join(',\n')};`)
  log('featured placements')

  // Collections
  for (const c of collections) {
    const owner = accounts[c.owner || 'editor']
    const slug = `${slugify(c.title)}-${crypto.randomBytes(2).toString('hex')}`
    await sql(`
      with col as (
        insert into public.collections (slug, owner_id, title, description, visibility, is_editorial, is_featured, created_at)
        values (${lit(slug)}, ${lit(owner.id)}, ${lit(c.title)}, ${lit(c.description)}, ${lit(c.visibility || 'public')},
          ${lit(!!c.editorial)}, ${lit(!!c.featured)}, now() - interval '${Math.floor(rand() * 30)} days')
        returning id
      )
      insert into public.collection_products (collection_id, product_id, position)
      select col.id, p.id, x.ord from col, unnest(${lit(c.products)}::text[]) with ordinality as x(name, ord)
      join public.products p on p.name = x.name;
    `)
  }
  log(`${collections.length} collections`)

  // Articles with generated cover images
  for (const [i, a] of articles.entries()) {
    const slug = slugify(a.title)
    const first = products.find((p) => p.name === a.products[0])
    const cover = `articles/${crypto.randomUUID()}.webp`
    await upload(editorJwt, 'article-images', cover, await renderArticleImage({ hue: first?.hue ?? 220, shape: first?.shape ?? 'tablet' }))
    const coverUrl = `${SUPABASE_URL}/storage/v1/object/public/article-images/${cover}`
    const sections = a.products.map((name) => {
      const p = [...products, ...workflowProducts].find((x) => x.name === name)
      return `## ${name}\n\n${p.tagline} ${p.blurb}\n\n${p.features.map((f) => `- ${f}`).join('\n')}`
    })
    const content = [
      a.excerpt,
      'Our editors spent time with each product in everyday use: commuting, working and travelling. Here is what stood out.',
      ...sections,
      '## The verdict',
      `If you only pick one, start with the ${a.products[0]}. It is the most complete package here and the one we kept reaching for.`,
      '_This article is fictional demo content created for development._',
    ].join('\n\n')
    const words = content.split(/\s+/).length
    const status = a.status || 'published'
    await sql(`
      with art as (
        insert into public.articles (slug, title, excerpt, content, featured_image_url, author_id, type, status, seo_title, seo_description,
          reading_minutes, published_at, scheduled_for, created_at)
        values (${lit(slug)}, ${lit(a.title)}, ${lit(a.excerpt)}, ${lit(content)}, ${lit(coverUrl)}, ${lit(accounts.editor.id)},
          ${lit(a.type)}, ${lit(status)}, ${lit(a.title.slice(0, 70))}, ${lit(a.excerpt.slice(0, 170))}, ${Math.max(1, Math.round(words / 220))},
          ${status === 'published' ? `now() + interval '${a.days} days'` : 'null'},
          ${status === 'scheduled' ? `now() + interval '${a.days} days'` : 'null'}, now() - interval '${i + 3} days')
        returning id
      ), cats as (
        insert into public.article_categories (article_id, category_id)
        select art.id, c.id from art, public.categories c where c.slug = any(${lit(a.cats)}::text[])
      )
      insert into public.article_products (article_id, product_id, position)
      select art.id, p.id, x.ord from art, unnest(${lit(a.products)}::text[]) with ordinality as x(name, ord)
      join public.products p on p.name = x.name;
    `)
  }
  log(`${articles.length} articles`)

  // Homepage sections (CMS-managed)
  await sql(`insert into public.homepage_sections (type, title, subtitle, config, position) values
    ('hero', null, null, '{}'::jsonb, 0),
    ('featured_categories', 'Browse by category', 'Twelve places to start exploring.', '{"limit": 12}'::jsonb, 1),
    ('trending_products', 'Trending this week', 'Ranked by saves, clicks and views over the last few days.', '{"limit": 8}'::jsonb, 2),
    ('editors_picks', 'Editor''s picks', 'Products our team tested and loved.', '{"limit": 6}'::jsonb, 3),
    ('new_products', 'Just published', 'Fresh from the review desk.', '{"limit": 8}'::jsonb, 4),
    ('featured_collections', 'Curated collections', 'Hand-picked sets for specific needs.', '{"limit": 4}'::jsonb, 5),
    ('deals', 'Deals worth knowing about', 'Verified price drops on products we cover.', '{"limit": 4}'::jsonb, 6),
    ('magazine', 'From the magazine', 'Reviews, guides and interviews.', '{"limit": 3}'::jsonb, 7);`)
  log('homepage sections')

  // Demo user activity: follows, saves, reminders
  const u1 = accounts.user1.id
  const u2 = accounts.user2.id
  await sql(`
    insert into public.category_followers (user_id, category_id) select ${lit(u1)}, id from public.categories where slug in ('office', 'travel', 'ai-gadgets');
    insert into public.category_followers (user_id, category_id) select ${lit(u2)}, id from public.categories where slug in ('audio', 'photography');
    insert into public.brand_followers (user_id, brand_id) select ${lit(u1)}, id from public.brands where slug in ('quillwork', 'driftline', 'orbital-desk');
    insert into public.brand_followers (user_id, brand_id) select ${lit(u2)}, id from public.brands where slug in ('halden-audio', 'cinder-audio');
    insert into public.product_saves (user_id, product_id) select ${lit(u1)}, id from public.products where name in ('Quillwork Slate Notebook', 'Driftline Carry 35', 'Tessellate Lingo One', 'Orbital Float Monitor Arm');
    insert into public.product_saves (user_id, product_id) select ${lit(u2)}, id from public.products where name in ('Halden Arc Pro', 'Cinder Ember Speaker', 'Kestrel Swift Drone');
    insert into public.reminders (user_id, product_id, type) select ${lit(u1)}, id, 'launch' from public.products where name = 'Tessellate Glance Glasses';
    insert into public.reminders (user_id, product_id, type, remind_at) select ${lit(u2)}, id, 'custom', now() + interval '5 days' from public.products where name = 'Grainfield F1 Compact';
  `)
  log('demo user activity')

  // Synthetic analytics so trending and dashboards have data. Marked with
  // metadata.seed = true so they can be told apart from real traffic.
  await sql(`
    with weights as (
      select id, (10 + random() * 140)::int as views from public.products where status = 'published'
    ), views as (
      insert into public.analytics_events (event_type, anon_id, product_id, metadata, created_at)
      select 'product_view', 'seed-' || substr(md5(random()::text), 1, 12), w.id, '{"seed": true}'::jsonb,
        now() - (random() ^ 2) * interval '14 days'
      from weights w cross join lateral generate_series(1, w.views)
      returning product_id
    ), clicks as (
      insert into public.analytics_events (event_type, anon_id, product_id, metadata, created_at)
      select 'buy_click', 'seed-' || substr(md5(random()::text), 1, 12), w.id, '{"seed": true}'::jsonb,
        now() - (random() ^ 2) * interval '14 days'
      from weights w cross join lateral generate_series(1, greatest(1, (w.views * (0.04 + random() * 0.1))::int))
      returning product_id
    ), shares as (
      insert into public.analytics_events (event_type, anon_id, product_id, metadata, created_at)
      select 'product_share', 'seed-' || substr(md5(random()::text), 1, 12), w.id, jsonb_build_object('seed', true, 'channel', 'copy_link'),
        now() - random() * interval '14 days'
      from weights w cross join lateral generate_series(1, (w.views * random() * 0.05)::int)
      returning product_id
    )
    select 1;
  `)
  await sql(`
    update public.products p set
      view_count = coalesce((select count(*) from public.analytics_events e where e.product_id = p.id and e.event_type = 'product_view'), 0),
      click_count = coalesce((select count(*) from public.analytics_events e where e.product_id = p.id and e.event_type = 'buy_click'), 0),
      share_count = coalesce((select count(*) from public.analytics_events e where e.product_id = p.id and e.event_type = 'product_share'), 0);
    insert into public.analytics_events (event_type, anon_id, query, metadata, created_at)
    select 'search', 'seed-' || substr(md5(random()::text), 1, 12), q, '{"seed": true}'::jsonb, now() - random() * interval '10 days'
    from unnest(array['translator', 'headphones', 'drone', 'smart lock', 'desk lamp', 'ring', 'backpack', 'controller', 'solar', 'kettle']) q
    cross join lateral generate_series(1, (3 + random() * 20)::int);
    select public.refresh_popularity_scores();
  `)
  log('synthetic analytics and trending scores')

  // Site settings
  await sql(`insert into public.site_settings (key, value) values
    ('site.name', '"Loupe"'), ('site.tagline', '"Discover products worth a closer look."'),
    ('submissions.open', 'true'), ('submissions.daily_limit', '10')
    on conflict (key) do nothing;`)

  // Skip any queued emails to demo addresses.
  await sql(`update public.email_outbox set status = 'skipped', last_error = 'demo account' where to_email like '%@loupe.example' and status = 'pending';`)

  const [counts] = await sql(`select
    (select count(*) from public.brands) brands, (select count(*) from public.products) products,
    (select count(*) from public.products where status = 'published') published,
    (select count(*) from public.categories) categories, (select count(*) from public.collections) collections,
    (select count(*) from public.articles) articles, (select count(*) from public.deals) deals,
    (select count(*) from public.submissions) submissions, (select count(*) from public.product_images) images`)
  console.log('\nDone:', counts)
  console.log('Demo account credentials: DEMO_ACCOUNTS.local.md (git-ignored)')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
