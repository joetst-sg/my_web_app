import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { greenFundingConfig } from '@/lib/greenfunding/config'
import { changedFields, eligibility, needsTranslationReview, sourceContentHash } from '@/lib/greenfunding/content'
import { actionForListedCampaign, applyTranslationAutomatically, nextAttempt, pipelineAfterTranslation, shouldCheckForUpdates, syncIsDue } from '@/lib/greenfunding/decide'
import { imagePath, imageSize, importImages } from '@/lib/greenfunding/images'
import { normalizeTag, resolveCategory } from '@/lib/greenfunding/mapping'
import { htmlToText, parseCampaignList, parseCampaignPage } from '@/lib/greenfunding/parse'
import { HtmlCampaignSource } from '@/lib/greenfunding/sources/html'
import { RequestBudgetExceeded, SourceError } from '@/lib/greenfunding/types'
import { campaignIdFromUrl, validateCampaignUrl } from '@/lib/greenfunding/url'
import { AnthropicTranslator } from '@/lib/translation/anthropic'
import { AzureTranslator, latinTerms, textToHtml } from '@/lib/translation/azure'
import { GoogleTranslator } from '@/lib/translation/google'
import { TranslationError } from '@/lib/translation/types'
import { campaignHtml, listingHtml } from '../fixtures/greenfunding'

const BASE = 'https://greenfunding.jp'
const DOMAINS = ['greenfunding.jp', 'www.greenfunding.jp']
const ref = { campaignId: '1001', url: 'https://greenfunding.jp/lab/projects/1001' }
const NOW = new Date('2026-10-04T00:00:00Z')

// 1. New campaign detection
describe('campaign detection', () => {
  it('finds campaign links on the new-campaigns listing, de-duplicated and on GREEN FUNDING only', () => {
    expect(parseCampaignList(listingHtml, BASE)).toEqual([
      { campaignId: '1001', url: 'https://greenfunding.jp/lab/projects/1001' },
      { campaignId: '1002', url: 'https://greenfunding.jp/partner_x/projects/1002' },
      { campaignId: '1004', url: 'https://greenfunding.jp/lab/projects/1004' },
    ])
  })
  it('imports campaigns that are not in the registry yet', () => {
    expect(actionForListedCampaign(null)).toBe('import')
  })
})

// 2. Duplicate detection
describe('duplicate prevention', () => {
  it('skips campaigns that were already imported, rejected, not eligible or deleted', () => {
    expect(actionForListedCampaign({ product_id: 'p1', pipeline_status: 'pending_review', source_status: 'active' })).toBe('skip')
    expect(actionForListedCampaign({ product_id: 'p1', pipeline_status: 'rejected', source_status: 'active' })).toBe('skip')
    expect(actionForListedCampaign({ product_id: null, pipeline_status: 'not_eligible', source_status: 'ended' })).toBe('skip')
    expect(actionForListedCampaign({ product_id: null, pipeline_status: 'published', source_status: 'active' })).toBe('skip')
  })
  it('retries a campaign whose previous import failed before a product existed', () => {
    expect(actionForListedCampaign({ product_id: null, pipeline_status: 'sync_error', source_status: 'active' })).toBe('import')
  })
  it('uses the numeric project id as the stable campaign id', () => {
    expect(campaignIdFromUrl('https://greenfunding.jp/lab/projects/1001')).toBe('1001')
    expect(campaignIdFromUrl('https://greenfunding.jp/other/projects/1001/')).toBe('1001')
  })
})

// 3. Campaign URL validation
describe('campaign URL validation', () => {
  it.each([
    ['https://greenfunding.jp/lab/projects/1001', true],
    ['https://www.greenfunding.jp/lab/projects/1001', true],
    ['http://greenfunding.jp/lab/projects/1001', false],
    ['https://greenfunding.jp.evil.com/lab/projects/1001', false],
    ['https://evilgreenfunding.jp/lab/projects/1001', false],
    ['https://user:pw@greenfunding.jp/lab/projects/1001', false],
    ['https://greenfunding.jp:8443/lab/projects/1001', false],
    ['https://greenfunding.jp/', false],
    ['https://greenfunding.jp/lab/projects/1001/activities/2', false],
    ['javascript:alert(1)', false],
    ['', false],
  ])('%s → %s', (url, ok) => {
    expect(validateCampaignUrl(url, DOMAINS).ok).toBe(ok)
  })
  it('reads allowed domains from the environment', () => {
    vi.stubEnv('GREEN_FUNDING_ALLOWED_DOMAINS', 'greenfunding.jp, shop.greenfunding.jp')
    expect(greenFundingConfig().allowedDomains).toEqual(['greenfunding.jp', 'shop.greenfunding.jp'])
    vi.unstubAllEnvs()
    expect(greenFundingConfig().allowedDomains).toEqual(DOMAINS)
  })
  it('defaults to test mode and a configurable interval', () => {
    vi.stubEnv('GREEN_FUNDING_SYNC_INTERVAL_MINUTES', '45')
    expect(greenFundingConfig()).toMatchObject({ mode: 'test', syncIntervalMinutes: 45 })
    vi.stubEnv('GREEN_FUNDING_IMPORT_MODE', 'production')
    vi.stubEnv('GREEN_FUNDING_SYNC_INTERVAL_MINUTES', 'abc')
    expect(greenFundingConfig()).toMatchObject({ mode: 'production', syncIntervalMinutes: 30 })
    vi.unstubAllEnvs()
  })
})

// 4. Image import
describe('image import', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x04, 0xb0, 0, 0, 0x03, 0x84, 8, 6, 0, 0, 0])
  const deps = () => {
    const uploads: string[] = []
    return {
      uploads,
      deps: {
        fetch: vi.fn(async (url: string | URL | Request) =>
          String(url).includes('bad') ? new Response('<html>', { headers: { 'content-type': 'text/html' } }) : new Response(png, { headers: { 'content-type': 'image/png' } }),
        ) as unknown as typeof fetch,
        upload: vi.fn(async (path: string) => void uploads.push(path)),
        publicUrl: (p: string) => `https://cdn.test/${p}`,
        existing: new Set(['https://images.greenfunding.jp/store/already']),
        delayMs: 0,
        timeoutMs: 1000,
        userAgent: 'test',
      },
    }
  }
  it('stores images under campaign-<id>/ with hero first and skips ones already imported', async () => {
    const { deps: d, uploads } = deps()
    const res = await importImages('1001', ['https://images.greenfunding.jp/store/hero', 'https://images.greenfunding.jp/store/already', 'https://images.greenfunding.jp/store/two'], d)
    expect(res.skipped).toBe(1)
    expect(uploads[0]).toBe('campaign-1001/hero.png')
    expect(uploads[1]).toMatch(/^campaign-1001\/image-[0-9a-f]{12}\.png$/)
    expect(res.imported.map((i) => i.position)).toEqual([0, 1])
    expect(res.imported[0]).toMatchObject({ width: 1200, height: 900, publicUrl: 'https://cdn.test/campaign-1001/hero.png' })
  })
  it('rejects non-image responses without failing the others', async () => {
    const { deps: d } = deps()
    const res = await importImages('1001', ['https://images.greenfunding.jp/store/bad', 'https://images.greenfunding.jp/store/ok'], d)
    expect(res.imported).toHaveLength(1)
    expect(res.errors[0]).toMatch(/Not a supported image type/)
  })
  it('identifies images by their bytes when the server sends no content type', async () => {
    const { deps: d } = deps()
    d.fetch = (async (url: string | URL | Request) =>
      String(url).includes('fake') ? new Response('<html>not an image', { headers: { 'content-type': 'image/png' } }) : new Response(png)) as unknown as typeof fetch
    const res = await importImages('1001', ['https://images.greenfunding.jp/store/nohdr', 'https://images.greenfunding.jp/store/fake'], d)
    expect(res.imported).toHaveLength(1)
    expect(res.errors[0]).toMatch(/fake: Not a supported image type/)
  })
  it('uses stable file names and reads image dimensions', () => {
    expect(imagePath('1', 'https://x/a', 3, 'jpg')).toBe(imagePath('1', 'https://x/a', 3, 'jpg'))
    expect(imageSize(png)).toEqual({ width: 1200, height: 900 })
  })
})

// 5 + 6. English and Traditional Chinese translation
describe('AI translation (Anthropic)', () => {
  const toolResponse = (input: Record<string, unknown>) =>
    new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'save_translation', input }], stop_reason: 'tool_use' }), { status: 200 })
  const source = { title: 'テスト ヘッドホン X100', shortDescription: '最大40時間再生', description: '### 特徴\n\n• 重量：250g', brand: 'Test Audio Inc.' }

  it('requests English with the structured tool and returns normalised fields', async () => {
    const fetchMock = vi.fn(async () => toolResponse({ title: 'Test Audio X100 Wireless Headphones', short_description: 'Up to 40 hours of playback.', description: '### Features\n\n• Weight: 250 g', seo_title: 'Test Audio X100 Wireless Headphones', seo_description: 'Up to 40 hours of playback.', image_alt: 'Test Audio X100 headphones' }))
    const t = new AnthropicTranslator('key', 'claude-test', 1000, fetchMock as unknown as typeof fetch)
    const out = await t.translate(source, 'en')
    expect(out).toMatchObject({ title: 'Test Audio X100 Wireless Headphones', description: '### Features\n\n• Weight: 250 g' })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ model: 'claude-test', tool_choice: { type: 'tool', name: 'save_translation' } })
    expect(body.system).toMatch(/do NOT add, remove or strengthen any claim/)
    expect(body.messages[0].content).toContain('テスト ヘッドホン X100')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('key')
  })

  it('asks for Traditional Chinese (never Simplified) and keeps the English name consistent', async () => {
    const fetchMock = vi.fn(async () => toolResponse({ title: 'Test Audio X100 無線耳機', short_description: '最長 40 小時播放。', description: '### 特點\n\n• 重量：250g', seo_title: 'Test Audio X100 無線耳機', seo_description: '最長 40 小時播放。', image_alt: 'Test Audio X100 耳機' }))
    const t = new AnthropicTranslator('key', 'claude-test', 1000, fetchMock as unknown as typeof fetch)
    const out = await t.translate({ ...source, englishTitle: 'Test Audio X100 Wireless Headphones' }, 'zh-HK')
    expect(out.title).toBe('Test Audio X100 無線耳機')
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.system).toMatch(/Traditional Chinese/)
    expect(body.system).toMatch(/Never use Simplified Chinese/)
    expect(body.messages[0].content).toContain('Test Audio X100 Wireless Headphones')
  })

  it('enforces SEO length limits', async () => {
    const long = 'x'.repeat(300)
    const t = new AnthropicTranslator('k', 'm', 1000, (async () => toolResponse({ title: 'T', short_description: long, description: 'd', seo_title: long, seo_description: long, image_alt: long })) as unknown as typeof fetch)
    const out = await t.translate(source, 'en')
    expect(out.seoTitle.length).toBeLessThanOrEqual(70)
    expect(out.seoDescription.length).toBeLessThanOrEqual(170)
    expect(out.shortDescription!.length).toBeLessThanOrEqual(200)
  })
})

// 7. Category mapping
describe('category mapping', () => {
  const mappings = [
    { source_category: 'ガジェット', category_id: null, priority: 90 },
    { source_category: 'オーディオ', category_id: 'audio-id', priority: 10 },
    { source_category: 'アウトドア', category_id: 'outdoor-id', priority: 20 },
  ]
  it('picks the highest-priority mapped category', () => {
    expect(resolveCategory(['ガジェット', 'アウトドア', 'オーディオ'], mappings)).toBe('audio-id')
  })
  it('leaves the product uncategorized when nothing is mapped', () => {
    expect(resolveCategory(['ガジェット', '雑貨'], mappings)).toBeNull()
  })
  it('normalises tags without merging different words', () => {
    expect(normalizeTag('ＡＩ  搭載')).toBe('ai 搭載')
    expect(normalizeTag('AI')).not.toBe(normalizeTag('AI Technology'))
  })
})

// 8. Product creation (parsing + eligibility)
describe('campaign parsing', () => {
  const c = parseCampaignPage(campaignHtml(), ref, BASE, NOW)
  it('reads the structured fields and never invents missing ones', () => {
    expect(c).toMatchObject({
      title: 'テスト ワイヤレス ヘッドホン X100',
      shortDescription: 'ノイズキャンセリング搭載。最大40時間再生。',
      ownerName: 'Test Audio Inc.',
      categories: ['ガジェット', 'オーディオ'],
      currency: 'JPY',
      price: 15800,
      goalAmount: 300000,
      raisedAmount: 1234567,
      backerCount: 321,
      daysRemaining: 12,
      status: 'active',
      startsAt: null,
      endsAtEstimated: true,
    })
    expect(c.endsAt).toBe('2026-10-16T00:00:00.000Z')
    expect(c.imageUrls).toEqual(['https://images.greenfunding.jp/store/hero123', 'https://images.greenfunding.jp/store/img2'])
    expect(c.raw.videos).toEqual(['https://www.youtube.com/watch?v=abcDEF12345'])
  })
  it('keeps headings, bold text and bullets, and drops scripts', () => {
    expect(c.description).toContain('### ■特徴')
    expect(c.description).toContain('**最大40時間**の連続再生。\nBluetooth 5.3対応。')
    expect(c.description).toContain('• 重量：250g\n• 型番：X100')
    expect(c.description).not.toContain('alert')
  })
  it('recognises funded, ended and cancelled campaigns', () => {
    expect(parseCampaignPage(campaignHtml({ ribbon: 'SUCCESS !' }), ref, BASE).status).toBe('succeeded')
    expect(parseCampaignPage(campaignHtml({ extra: '', ribbon: 'このプロジェクトは終了しました' }), ref, BASE).status).toBe('ended')
    expect(parseCampaignPage(campaignHtml({ ribbon: 'プロジェクト中止' }), ref, BASE).status).toBe('cancelled')
  })
  it('only imports eligible campaigns', () => {
    expect(eligibility(c, []).eligible).toBe(true)
    expect(eligibility({ ...c, status: 'cancelled' }, []).eligible).toBe(false)
    expect(eligibility({ ...c, status: 'ended' }, []).eligible).toBe(false)
    expect(eligibility({ ...c, title: null }, []).eligible).toBe(false)
    expect(eligibility(c, ['オーディオ']).eligible).toBe(false)
  })
  it('converts arbitrary HTML safely', () => {
    expect(htmlToText('<p>A &amp; B<img src="https://images.greenfunding.jp/x"></p><p>&nbsp;</p>')).toEqual({ text: 'A & B', images: ['https://images.greenfunding.jp/x'], videos: [] })
  })
})

// 9. Product update detection
describe('update detection', () => {
  const fresh = parseCampaignPage(campaignHtml(), ref, BASE, NOW)
  const stored = {
    ja_title: fresh.title,
    ja_short_description: fresh.shortDescription,
    ja_description: fresh.description,
    source_status: 'active',
    campaign_ends_at: fresh.endsAt,
    source_categories: ['オーディオ', 'ガジェット'],
    image_urls: fresh.imageUrls,
  }
  it('reports nothing when the campaign is unchanged (end date estimates may drift a little)', () => {
    expect(changedFields({ ...stored, campaign_ends_at: new Date(Date.parse(fresh.endsAt!) + 3_600_000).toISOString() }, fresh)).toEqual([])
  })
  it('detects description, status, end date, category and image changes', () => {
    const later = parseCampaignPage(campaignHtml({ daysLeft: '30', ribbon: 'SUCCESS !', extra: '<p>新色追加</p><p><img src="https://images.greenfunding.jp/store/new"></p>' }), ref, BASE, NOW)
    expect(changedFields(stored, later)).toEqual(['description', 'status', 'end_date', 'images'])
  })
  it('re-checks only live imported campaigns', () => {
    expect(shouldCheckForUpdates({ product_id: 'p', pipeline_status: 'published', source_status: 'active' })).toBe(true)
    expect(shouldCheckForUpdates({ product_id: 'p', pipeline_status: 'published', source_status: 'ended' })).toBe(false)
    expect(shouldCheckForUpdates({ product_id: 'p', pipeline_status: 'rejected', source_status: 'active' })).toBe(false)
    expect(shouldCheckForUpdates({ product_id: null, pipeline_status: 'not_eligible', source_status: 'active' })).toBe(false)
  })
})

// 10. Translation update detection and cost control
describe('translation updates', () => {
  const base = { title: 'a', shortDescription: 'b', description: 'c' }
  it('only re-translates when the source text changes', () => {
    expect(sourceContentHash(base)).toBe(sourceContentHash({ ...base }))
    expect(sourceContentHash(base)).not.toBe(sourceContentHash({ ...base, description: 'c2' }))
    expect(needsTranslationReview(['status', 'images', 'end_date'])).toBe(false)
    expect(needsTranslationReview(['description'])).toBe(true)
  })
  it('never overwrites published or admin-edited text automatically', () => {
    expect(applyTranslationAutomatically('draft', false)).toBe(true)
    expect(applyTranslationAutomatically('pending_review', false)).toBe(true)
    expect(applyTranslationAutomatically('published', false)).toBe(false)
    expect(applyTranslationAutomatically('pending_review', true)).toBe(false)
  })
  it('moves new imports to pending review once translated', () => {
    expect(pipelineAfterTranslation('translating')).toBe('pending_review')
    expect(pipelineAfterTranslation('published')).toBe('published')
  })
})

// 11. Buy Now redirect
describe('Buy Now redirect', () => {
  beforeEach(() => vi.resetModules())
  it('redirects to exactly the URL stored for the product', async () => {
    const stored = 'https://greenfunding.jp/lab/projects/1001'
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: async () => ({ data: stored, error: null }) }) }))
    const { GET } = await import('@/app/go/product/[id]/route')
    const res = await GET(new NextRequest('https://www.joetangtst.com/go/product/5280fd62-b6d2-4a9b-b15d-01225627c472'), { params: Promise.resolve({ id: '5280fd62-b6d2-4a9b-b15d-01225627c472' }) } as never)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(stored)
  })
  it('falls back to the catalogue when the database refuses the URL', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) }))
    const { GET } = await import('@/app/go/product/[id]/route')
    const res = await GET(new NextRequest('https://www.joetangtst.com/go/product/5280fd62-b6d2-4a9b-b15d-01225627c472'), { params: Promise.resolve({ id: '5280fd62-b6d2-4a9b-b15d-01225627c472' }) } as never)
    expect(res.headers.get('location')).toBe('https://www.joetangtst.com/products')
  })
})

// 12. Unauthorized admin access
describe('admin authorization', () => {
  beforeEach(() => vi.resetModules())
  it('refuses every GREEN FUNDING action for non-admins', async () => {
    vi.doMock('@/lib/auth', () => ({ getViewer: async () => ({ id: 'u1', isAdmin: false, isStaff: true }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: () => {} }))
    const actions = await import('@/lib/actions/greenfunding')
    const id = '5280fd62-b6d2-4a9b-b15d-01225627c472'
    for (const res of await Promise.all([
      actions.syncNow(),
      actions.translateNow(),
      actions.approveAndPublish(id),
      actions.rejectImport(id),
      actions.saveTranslations(id, { en: { title: 'x' }, zh: { title: 'x' } }),
      actions.updateCampaignUrl(id, 'https://greenfunding.jp/lab/projects/1'),
      actions.saveCategoryMapping('ガジェット', null),
    ])) {
      expect(res).toEqual({ ok: false, error: 'Only administrators can do this.' })
    }
  })
  it('refuses the cron endpoint without the secret', async () => {
    vi.stubEnv('CRON_SECRET', 'right-secret')
    const { GET } = await import('@/app/api/cron/greenfunding/route')
    const res = await GET(new NextRequest('https://x/api/cron/greenfunding', { headers: { authorization: 'Bearer wrong' } }))
    expect(res.status).toBe(401)
    vi.unstubAllEnvs()
  })
})

// 13. Sync failure handling (source)
describe('source failures and rate limiting', () => {
  const config = { ...greenFundingConfig(), requestDelayMs: 0, maxRequestsPerRun: 2 }
  it('stops the run when GREEN FUNDING rate-limits or blocks us', async () => {
    const src = new HtmlCampaignSource(config, (async () => new Response('', { status: 429 })) as unknown as typeof fetch)
    await expect(src.fetchCampaign(ref)).rejects.toThrow(/stopping this run/)
    await expect(src.fetchCampaign(ref)).rejects.toThrow(/slow down/)
    expect(src.requestCount).toBe(1)
  })
  it('treats a missing page as a permanent (non-retryable) error', async () => {
    const src = new HtmlCampaignSource(config, (async () => new Response('', { status: 404 })) as unknown as typeof fetch)
    const err = await src.fetchCampaign(ref).catch((e) => e)
    expect(err).toBeInstanceOf(SourceError)
    expect(err.retryable).toBe(false)
  })
  it('enforces the per-run request budget', async () => {
    const src = new HtmlCampaignSource(config, (async () => new Response(campaignHtml(), { status: 200 })) as unknown as typeof fetch)
    await src.fetchCampaign(ref)
    await src.fetchCampaign(ref)
    await expect(src.fetchCampaign(ref)).rejects.toBeInstanceOf(RequestBudgetExceeded)
  })
  it('only runs a scheduled sync when the interval has passed', () => {
    const now = Date.parse('2026-10-04T10:30:00Z')
    expect(syncIsDue(null, 30, now)).toBe(true)
    expect(syncIsDue('2026-10-04T10:10:00Z', 30, now)).toBe(false)
    expect(syncIsDue('2026-10-04T10:00:00Z', 30, now)).toBe(true)
  })
})

// 14. Translation failure
describe('translation failures', () => {
  it('marks bad credentials as permanent and server errors as retryable', async () => {
    const make = (status: number) => new AnthropicTranslator('k', 'm', 1000, (async () => new Response('{"error":{}}', { status })) as unknown as typeof fetch)
    const auth = await make(401).translate({ title: 'x', shortDescription: null, description: null, brand: null }, 'en').catch((e) => e)
    expect(auth).toBeInstanceOf(TranslationError)
    expect(auth.retryable).toBe(false)
    const overloaded = await make(529).translate({ title: 'x', shortDescription: null, description: null, brand: null }, 'en').catch((e) => e)
    expect(overloaded.retryable).toBe(true)
  })
  it('rejects output without a title', async () => {
    const t = new AnthropicTranslator('k', 'm', 1000, (async () => new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'save_translation', input: { title: '' } }] }))) as unknown as typeof fetch)
    await expect(t.translate({ title: 'x', shortDescription: null, description: null, brand: null }, 'en')).rejects.toThrow(/missing a title/)
  })
})

// 15. Retry logic
describe('translation retries', () => {
  const now = Date.parse('2026-10-04T00:00:00Z')
  it('backs off exponentially until the retry limit', () => {
    expect(nextAttempt(1, 3, true, now)).toEqual({ status: 'queued', runAfter: '2026-10-04T00:02:00.000Z' })
    expect(nextAttempt(2, 3, true, now)).toEqual({ status: 'queued', runAfter: '2026-10-04T00:04:00.000Z' })
    expect(nextAttempt(3, 3, true, now)).toEqual({ status: 'failed', runAfter: null })
  })
  it('does not retry permanent errors', () => {
    expect(nextAttempt(1, 3, false, now).status).toBe('failed')
  })
})

// Azure Translator (free-tier alternative)
describe('AI translation (Azure Translator)', () => {
  const source = {
    title: 'Skullcandy Crusher 1080 ANC ヘッドホン',
    shortDescription: '最大40時間再生。',
    description: '### 特徴\n\n**Skullcandy**の最新モデル。\n\n• 重量：250g\n• 型番：X100',
    brand: 'Skullcandy Japan',
  }
  // Echo the request, standing in for the translation, so we can inspect what was sent.
  const echo = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const items = JSON.parse(String(init!.body)) as { Text: string }[]
    return new Response(JSON.stringify(items.map((i) => ({ translations: [{ text: i.Text.replace('ヘッドホン', 'Headphones').replace('特徴', 'Features').replace('最大40時間再生。', 'Up to 40 hours of playback.'), to: 'en' }] }))), { status: 200 })
  })

  it('calls Translator v3 with the right languages, key, region and HTML mode', async () => {
    const t = new AzureTranslator('az-key', 'eastasia', 'https://api.cognitive.microsofttranslator.com', 1000, echo as unknown as typeof fetch)
    await t.translate(source, 'zh-HK')
    const [url, init] = echo.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=ja&to=zh-Hant&textType=html')
    expect(init.headers).toMatchObject({ 'Ocp-Apim-Subscription-Key': 'az-key', 'Ocp-Apim-Subscription-Region': 'eastasia' })
  })

  it('protects brand and model names and keeps headings, bold and bullets', async () => {
    echo.mockClear()
    const t = new AzureTranslator('k', null, undefined, 1000, echo as unknown as typeof fetch)
    const out = await t.translate(source, 'en')
    const sent = JSON.parse(String((echo.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as { Text: string }[]
    expect(sent[0].Text).toContain('<span class="notranslate" translate="no">Skullcandy Crusher 1080 ANC</span>')
    expect(sent[2].Text).toContain('<h3>特徴</h3>')
    expect(sent[2].Text).toContain('<li>重量：250g</li>')
    expect(out.title).toBe('Skullcandy Crusher 1080 ANC Headphones')
    expect(out.description).toBe('### Features\n\n**Skullcandy**の最新モデル。\n\n• 重量：250g\n• 型番：X100')
    expect(out.seoTitle.length).toBeLessThanOrEqual(70)
    expect(out.seoDescription).toBe('Up to 40 hours of playback.')
  })

  it('treats a used-up free quota as "try later" and a bad key as permanent', async () => {
    const make = (status: number, code: number) =>
      new AzureTranslator('k', null, undefined, 1000, (async () => new Response(JSON.stringify({ error: { code, message: 'x' } }), { status })) as unknown as typeof fetch)
    const quota = await make(403, 403001).translate(source, 'en').catch((e) => e)
    expect(quota.retryable).toBe(true)
    const badKey = await make(401, 401000).translate(source, 'en').catch((e) => e)
    expect(badKey.retryable).toBe(false)
  })

  it('round-trips the description format', () => {
    expect(textToHtml('### A\n\n**b** c\n\n• x\n• y')).toBe('<h3>A</h3>\n<p><strong>b</strong> c</p>\n<ul><li>x</li><li>y</li></ul>')
    expect(latinTerms('テスト Crusher 1080 ANC と X100')).toEqual(['Crusher 1080 ANC', 'X100'])
  })

  it('is selected with TRANSLATION_PROVIDER=azure', async () => {
    vi.stubEnv('TRANSLATION_PROVIDER', 'azure')
    vi.stubEnv('TRANSLATION_API_KEY', 'k')
    vi.stubEnv('AZURE_TRANSLATOR_REGION', 'eastasia')
    const { createTranslator, translationConfig } = await import('@/lib/translation')
    expect(createTranslator()?.name).toBe('azure')
    expect(translationConfig().model).toBe('translator-v3')
    vi.unstubAllEnvs()
  })
})

// Google Cloud Translation (Basic v2)
describe('translation (Google Cloud Translation)', () => {
  const source = {
    title: 'Skullcandy Crusher 1080 ANC ヘッドホン',
    shortDescription: '最大40時間再生。',
    description: '### 特徴\n\n**Skullcandy**の最新モデル。\n\n• 重量：250g\n• 型番：X100',
    brand: 'Skullcandy Japan',
  }
  const echo = () =>
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body)) as { q: string[] }
      return new Response(JSON.stringify({ data: { translations: body.q.map((t) => ({ translatedText: t.replace('ヘッドホン', '耳機').replace('特徴', '特點').replace('最大40時間再生。', '最長 40 小時播放。') })) } }), { status: 200 })
    })

  it('sends Japanese → Traditional Chinese (zh-TW) as HTML with the key in a header', async () => {
    const f = echo()
    const out = await new GoogleTranslator('g-key', undefined, 1000, f as unknown as typeof fetch).translate(source, 'zh-HK')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://translation.googleapis.com/language/translate/v2')
    expect(url).not.toContain('g-key')
    expect(init.headers).toMatchObject({ 'X-Goog-Api-Key': 'g-key' })
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({ source: 'ja', target: 'zh-TW', format: 'html' })
    expect(body.q[0]).toContain('<span class="notranslate" translate="no">Skullcandy Crusher 1080 ANC</span>')
    expect(out.title).toBe('Skullcandy Crusher 1080 ANC 耳機')
    expect(out.description).toBe('### 特點\n\n**Skullcandy**の最新モデル。\n\n• 重量：250g\n• 型番：X100')
    expect(out.seoDescription).toBe('最長 40 小時播放。')
  })

  it('splits long descriptions into requests of at most ~5,000 characters, keeping order', async () => {
    const f = echo()
    const long = Array.from({ length: 12 }, (_, i) => `段落${i}：${'あ'.repeat(900)}`).join('\n\n')
    const out = await new GoogleTranslator('k', undefined, 1000, f as unknown as typeof fetch).translate({ ...source, description: long }, 'en')
    expect(f.mock.calls.length).toBeGreaterThan(2)
    for (const [, init] of f.mock.calls as unknown as [string, RequestInit][]) {
      const q = (JSON.parse(String(init.body)) as { q: string[] }).q
      expect(q.join('').length).toBeLessThanOrEqual(5000)
    }
    expect(out.description!.indexOf('段落0')).toBeLessThan(out.description!.indexOf('段落11'))
  })

  it('retries rate limits but not a bad key or disabled API', async () => {
    const make = (status: number, reason: string) =>
      new GoogleTranslator('k', undefined, 1000, (async () => new Response(JSON.stringify({ error: { code: status, message: 'x', errors: [{ reason }] } }), { status })) as unknown as typeof fetch)
    expect((await make(403, 'userRateLimitExceeded').translate(source, 'en').catch((e) => e)).retryable).toBe(true)
    expect((await make(429, 'rateLimitExceeded').translate(source, 'en').catch((e) => e)).retryable).toBe(true)
    expect((await make(400, 'badRequest').translate(source, 'en').catch((e) => e)).retryable).toBe(false)
    expect((await make(403, 'accessNotConfigured').translate(source, 'en').catch((e) => e)).retryable).toBe(false)
  })

  it('is selected with TRANSLATION_PROVIDER=google', async () => {
    vi.stubEnv('TRANSLATION_PROVIDER', 'google')
    vi.stubEnv('TRANSLATION_API_KEY', 'k')
    const { createTranslator, translationConfig } = await import('@/lib/translation')
    expect(createTranslator()?.name).toBe('google')
    expect(translationConfig().model).toBe('translate-v2')
    vi.unstubAllEnvs()
  })
})
