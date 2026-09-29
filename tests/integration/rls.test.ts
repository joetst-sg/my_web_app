import { describe, expect, it } from 'vitest'
import { anonClient, clientFor, hasTestEnv } from './helpers'

// Row Level Security and permission boundaries, tested through the API.

describe.skipIf(!hasTestEnv)('row level security', () => {
  it('anonymous visitors only see published products', async () => {
    const { data } = await anonClient().from('products').select('status').neq('status', 'published').limit(5)
    expect(data).toEqual([])
  })

  it('anonymous visitors cannot read analytics, audit logs, emails or other users’ data', async () => {
    const anon = anonClient()
    for (const table of ['analytics_events', 'audit_logs', 'product_saves', 'reminders', 'notifications', 'user_settings', 'submissions'] as const) {
      const { data } = await anon.from(table).select('*').limit(1)
      expect(data ?? []).toEqual([])
    }
    const { error } = await anon.from('email_outbox' as 'audit_logs').select('*').limit(1)
    expect(error).not.toBeNull()
  })

  it('users see only their own saves and private collections', async () => {
    const user1 = await clientFor('user1')
    const user2 = await clientFor('user2')
    const { data: saves } = await user2.client.from('product_saves').select('user_id')
    expect(saves!.every((s) => s.user_id === user2.userId)).toBe(true)
    const { data: priv } = await user1.client.from('collections').select('id').eq('owner_id', user1.userId).eq('visibility', 'private')
    expect(priv!.length).toBeGreaterThan(0)
    const { data: seen } = await user2.client.from('collections').select('id').in('id', priv!.map((c) => c.id))
    expect(seen).toEqual([])
    const { data: edited } = await user2.client.from('collections').update({ title: 'hijacked' }).in('id', priv!.map((c) => c.id)).select('id')
    expect(edited ?? []).toEqual([])
  })

  it('users cannot fake counters, roles or editorial scores', async () => {
    const user = await clientFor('user1')
    const { error: roleError } = await user.client.from('user_roles').insert({ user_id: user.userId, role: 'admin' })
    expect(roleError).not.toBeNull()
    const { data: product } = await user.client.from('products').select('id, save_count').eq('status', 'published').limit(1).single()
    const { data: upd } = await user.client.from('products').update({ save_count: 99999 }).eq('id', product!.id).select('id')
    expect(upd ?? []).toEqual([])
    const { error: scoreError } = await user.client.from('product_scores').upsert({ product_id: product!.id, overall: 10 })
    expect(scoreError).not.toBeNull()
    const { error: rpcError } = await user.client.rpc('set_user_role', { target_user: user.userId, role: 'admin', enabled: true })
    expect(rpcError?.message).toContain('LOUPE:FORBIDDEN')
  })

  it('sellers cannot edit other sellers’ products or approve submissions', async () => {
    const seller1 = await clientFor('seller1')
    const { data: other } = await (await clientFor('editor')).client
      .from('products').select('id').neq('seller_id', seller1.userId).in('status', ['draft', 'changes_requested']).limit(1).single()
    const { data } = await seller1.client.from('products').update({ name: 'nope' }).eq('id', other!.id).select('id')
    expect(data ?? []).toEqual([])
    const { data: sub } = await seller1.client.from('submissions').select('id').eq('seller_id', seller1.userId).eq('status', 'submitted').limit(1).maybeSingle()
    if (sub) {
      const { error } = await seller1.client.rpc('transition_submission', { submission_id: sub.id, action: 'approve' })
      expect(error?.message).toContain('LOUPE:FORBIDDEN')
    }
  })

  it('only admins can list users and change roles', async () => {
    const editor = await clientFor('editor')
    const { error } = await editor.client.rpc('admin_list_users', {})
    expect(error?.message).toContain('LOUPE:FORBIDDEN')
    const admin = await clientFor('admin')
    const { data, error: adminError } = await admin.client.rpc('admin_list_users', { page_limit: 5 })
    expect(adminError).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('outbound clicks never return non-https or unpublished URLs', async () => {
    const editor = await clientFor('editor')
    const { data: draft } = await editor.client.from('products').select('id').eq('status', 'draft').limit(1).single()
    const { data } = await anonClient().rpc('record_outbound_click', { product_id: draft!.id })
    expect(data).toBeNull()
  })
})
