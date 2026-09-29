import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anonClient, clientFor, hasTestEnv, sleep, TINY_WEBP } from './helpers'

// End-to-end submission workflow through the same RLS-protected API the app
// uses: seller drafts → uploads → submits → editor requests changes → seller
// resubmits → editor approves → schedules → cron publishes → visitor clicks
// Buy Now and the click is recorded.

describe.skipIf(!hasTestEnv)('product submission workflow', () => {
  const stamp = Date.now()
  let seller: Awaited<ReturnType<typeof clientFor>>
  let editor: Awaited<ReturnType<typeof clientFor>>
  let admin: Awaited<ReturnType<typeof clientFor>>
  let productId = ''
  let submissionId = ''
  let slug = ''

  beforeAll(async () => {
    ;[seller, editor, admin] = await Promise.all([clientFor('seller1'), clientFor('editor'), clientFor('admin')])
  })

  afterAll(async () => {
    if (productId) {
      const { data: imgs } = await admin.client.from('product_images').select('storage_path').eq('product_id', productId)
      if (imgs?.length) await admin.client.storage.from('product-images').remove(imgs.map((i) => i.storage_path))
      await admin.client.from('products').delete().eq('id', productId)
    }
  })

  it('seller creates a draft; a submission is created automatically', async () => {
    const { data: brand } = await seller.client.from('brands').select('id').eq('owner_id', seller.userId).limit(1).single()
    slug = `integration-test-${stamp}`
    const { data, error } = await seller.client
      .from('products')
      .insert({ name: `Integration Test ${stamp}`, slug, brand_id: brand!.id, external_url: 'https://example.com/product', tagline: 'A product created by the test suite.', description: 'x'.repeat(100), price: 99 })
      .select('id, status, seller_id')
      .single()
    expect(error).toBeNull()
    expect(data!.status).toBe('draft')
    expect(data!.seller_id).toBe(seller.userId)
    productId = data!.id
    const { data: sub } = await seller.client.from('submissions').select('id, status').eq('product_id', productId).single()
    expect(sub!.status).toBe('draft')
    submissionId = sub!.id
  })

  it('seller cannot publish directly or change status', async () => {
    const { error } = await seller.client.from('products').update({ status: 'published' }).eq('id', productId)
    expect(error?.message).toContain('LOUPE:FORBIDDEN')
    const { error: rpcError } = await seller.client.rpc('transition_submission', { submission_id: submissionId, action: 'publish' })
    expect(rpcError?.message).toContain('LOUPE:FORBIDDEN')
  })

  it('submitting an incomplete product lists what is missing', async () => {
    const { error } = await seller.client.rpc('transition_submission', { submission_id: submissionId, action: 'submit' })
    expect(error?.message).toContain('LOUPE:INCOMPLETE')
    expect(error?.details).toMatch(/category/)
    expect(error?.details).toMatch(/image/)
  })

  it('anonymous visitors and other sellers cannot see the draft', async () => {
    const { data } = await anonClient().from('products').select('id').eq('id', productId)
    expect(data).toEqual([])
    const other = await clientFor('seller2')
    const { data: d2 } = await other.client.from('products').select('id').eq('id', productId)
    expect(d2).toEqual([])
    const { error } = await other.client.storage.from('product-images').upload(`products/${productId}/${crypto.randomUUID()}.webp`, TINY_WEBP, { contentType: 'image/webp' })
    expect(error).not.toBeNull()
  })

  it('seller uploads an image and adds a category, then submits', async () => {
    const path = `products/${productId}/${crypto.randomUUID()}.webp`
    const { error: upErr } = await seller.client.storage.from('product-images').upload(path, TINY_WEBP, { contentType: 'image/webp' })
    expect(upErr).toBeNull()
    const { error: badType } = await seller.client.storage.from('product-images').upload(`products/${productId}/x.html`, Buffer.from('<script>'), { contentType: 'text/html' })
    expect(badType).not.toBeNull()
    await seller.client.from('product_images').insert({ product_id: productId, storage_path: path, width: 1, height: 1, position: 0 })
    const { data: cat } = await seller.client.from('categories').select('id').eq('slug', 'audio').single()
    await seller.client.from('product_categories').insert({ product_id: productId, category_id: cat!.id, is_primary: true })
    const { data, error } = await seller.client.rpc('transition_submission', { submission_id: submissionId, action: 'submit' })
    expect(error).toBeNull()
    expect(data!.status).toBe('submitted')
  })

  it('seller cannot edit while the product is in review', async () => {
    const { data } = await seller.client.from('products').update({ name: 'Sneaky edit' }).eq('id', productId).select('id')
    expect(data).toEqual([])
  })

  it('editor requests changes (message required); seller is notified', async () => {
    const { error: noMsg } = await editor.client.rpc('transition_submission', { submission_id: submissionId, action: 'request_changes' })
    expect(noMsg?.message).toContain('LOUPE:INVALID_INPUT')
    await editor.client.rpc('transition_submission', { submission_id: submissionId, action: 'start_review' })
    const { data, error } = await editor.client.rpc('transition_submission', {
      submission_id: submissionId,
      action: 'request_changes',
      message: 'Please upload higher-quality lifestyle images.',
    })
    expect(error).toBeNull()
    expect(data!.status).toBe('changes_requested')
    const { data: notes } = await seller.client.from('notifications').select('type, link').eq('user_id', seller.userId).eq('type', 'changes_requested').order('created_at', { ascending: false }).limit(1)
    expect(notes?.[0]?.link).toBe(`/seller/submissions/${submissionId}`)
    const { data: msgs } = await seller.client.from('submission_messages').select('body').eq('submission_id', submissionId)
    expect(msgs?.some((m) => m.body.includes('lifestyle images'))).toBe(true)
  })

  it('seller updates and resubmits', async () => {
    const { data } = await seller.client.from('products').update({ tagline: 'Updated after editor feedback.' }).eq('id', productId).select('id')
    expect(data).toHaveLength(1)
    await seller.client.from('submission_messages').insert({ submission_id: submissionId, author_id: seller.userId, body: 'Updated, thanks!' })
    const { data: sub, error } = await seller.client.rpc('transition_submission', { submission_id: submissionId, action: 'submit' })
    expect(error).toBeNull()
    expect(sub!.status).toBe('submitted')
  })

  it('editor approves and schedules; the cron job publishes it', async () => {
    const { error: approveError } = await editor.client.rpc('transition_submission', { submission_id: submissionId, action: 'approve' })
    expect(approveError).toBeNull()
    const { error: pastError } = await editor.client.rpc('transition_submission', { submission_id: submissionId, action: 'schedule', scheduled_for: new Date(Date.now() - 60_000).toISOString() })
    expect(pastError?.message).toContain('LOUPE:INVALID_INPUT')
    const { data, error } = await editor.client.rpc('transition_submission', { submission_id: submissionId, action: 'schedule', scheduled_for: new Date(Date.now() + 3_000).toISOString() })
    expect(error).toBeNull()
    expect(data!.status).toBe('scheduled')

    // pg_cron runs publish_due() every minute.
    let status = 'scheduled'
    for (let i = 0; i < 30 && status !== 'published'; i++) {
      await sleep(5_000)
      const { data: p } = await editor.client.from('products').select('status').eq('id', productId).single()
      status = p!.status
    }
    expect(status).toBe('published')
  }, 180_000)

  it('the published product is public and Buy Now records the click', async () => {
    const anon = anonClient()
    const { data } = await anon.from('product_cards').select('id, name').eq('slug', slug)
    expect(data).toHaveLength(1)
    const { data: before } = await editor.client.from('products').select('click_count').eq('id', productId).single()
    const { data: url } = await anon.rpc('record_outbound_click', { product_id: productId, anon_id: `test-${stamp}` })
    expect(url).toBe('https://example.com/product')
    const { data: after } = await editor.client.from('products').select('click_count').eq('id', productId).single()
    expect(after!.click_count).toBe(before!.click_count + 1)
  })

  it('the full history is recorded', async () => {
    const { data } = await seller.client.from('submission_reviews').select('action').eq('submission_id', submissionId).order('id')
    expect(data!.map((r) => r.action)).toEqual(['submit', 'start_review', 'request_changes', 'submit', 'approve', 'schedule', 'publish'])
    const { data: audit } = await editor.client.from('audit_logs').select('action').eq('entity_id', submissionId)
    expect(audit!.length).toBeGreaterThanOrEqual(7)
  })
})
