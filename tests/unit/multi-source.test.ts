import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeminiProvider } from '@/lib/ai/gemini'
import { chineseFromEnglish, englishWithinRange, factsFromRegistry } from '@/lib/ai/pipeline'
import { cleanTags, countWords, hasSimplified, pickCategory, summarySystemPrompt, wordRange } from '@/lib/ai/prompts'
import { AIError, type AIProvider, type ChineseContent, type EnglishContent, type ProductFacts } from '@/lib/ai/types'
import { IndiegogoApiSource, normalizeIndiegogoProject, raisedInUsd, type IndiegogoProject } from '@/lib/greenfunding/sources/indiegogo'
import { sourceDefinition, sourceDefinitions } from '@/lib/greenfunding/sources/registry'
import { RequestBudgetExceeded, SourceError } from '@/lib/greenfunding/types'
import { CAMPAIGN_PATHS, normalizeCampaignUrl, validateSourceUrl } from '@/lib/greenfunding/url'

const NOW = new Date('2026-10-04T00:00:00Z')
const IGG = { allowedDomains: ['www.indiegogo.com', 'indiegogo.com'], imageDomains: ['cdn.images.indiegogo.com'] }
const project = (over: Partial<IndiegogoProject> = {}): IndiegogoProject => ({
  projectUrlName: 'smart-lamp',
  projectHomeUrl: 'https://www.indiegogo.com/projects/smart-lamp?utm_source=x#top',
  projectName: 'Smart Lamp <b>Pro</b>',
  shortDescription: 'A lamp that follows the sun.',
  creatorName: 'Lumen Labs',
  projectImageUrl: 'https://cdn.images.indiegogo.com/abc.jpg',
  campaignStartDate: '2026-10-01T00:00:00Z',
  campaignEndDate: '2026-11-01T00:00:00Z',
  campaignGoal: 10000,
  fundsGathered: 2500,
  backerCount: 40,
  currencyShortName: 'USD',
  ...over,
})
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

// Source architecture
describe('source registry', () => {
  beforeEach(() => vi.unstubAllEnvs())
  it('defines GREEN FUNDING (on by default) and Indiegogo (off until enabled)', () => {
    expect(sourceDefinition('greenfunding')?.config.enabled).toBe(true)
    expect(sourceDefinition('indiegogo')?.config.enabled).toBe(false)
    vi.stubEnv('INDIEGOGO_ENABLED', 'true')
    vi.stubEnv('GREEN_FUNDING_ENABLED', 'false')
    expect(sourceDefinition('indiegogo')?.config.enabled).toBe(true)
    expect(sourceDefinition('greenfunding')?.config.enabled).toBe(false)
    expect(sourceDefinition('kickstarter')).toBeNull()
  })
  it('only Indiegogo is limited to tech products, with English source text', () => {
    const igg = sourceDefinitions().find((d) => d.key === 'indiegogo')!
    expect(igg).toMatchObject({ language: 'en', requireTechProduct: true, displayName: 'Indiegogo' })
    expect(igg.config.syncIntervalMinutes).toBe(1440)
  })
})

// URL normalization and validation (SSRF / open redirect protection)
describe('campaign URL normalization', () => {
  it('strips tracking parameters, fragments and trailing slashes and lower-cases the host', () => {
    expect(normalizeCampaignUrl('https://WWW.Indiegogo.com/projects/smart-lamp/?utm_source=x&ref=y#story')).toBe('https://www.indiegogo.com/projects/smart-lamp')
  })
  it('rejects http, credentials and junk', () => {
    expect(normalizeCampaignUrl('http://www.indiegogo.com/projects/a')).toBeNull()
    expect(normalizeCampaignUrl('https://user:pw@www.indiegogo.com/projects/a')).toBeNull()
    expect(normalizeCampaignUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeCampaignUrl('')).toBeNull()
  })
  it('accepts only campaign pages on allowed domains', () => {
    const v = (u: string) => validateSourceUrl(u, IGG.allowedDomains, CAMPAIGN_PATHS.indiegogo)
    expect(v('https://www.indiegogo.com/projects/smart-lamp')).toEqual({ ok: true, url: 'https://www.indiegogo.com/projects/smart-lamp' })
    expect(v('https://www.indiegogo.com/projects/smart-lamp/pica')).toMatchObject({ ok: true })
    expect(v('https://indiegogo.com.evil.example/projects/a')).toMatchObject({ ok: false })
    expect(v('https://www.indiegogo.com:8443/projects/a')).toMatchObject({ ok: false })
    expect(v('https://www.indiegogo.com/explore/tech')).toMatchObject({ ok: false })
    expect(v('https://169.254.169.254/projects/a')).toMatchObject({ ok: false })
  })
})

// Indiegogo normalization
describe('Indiegogo project normalization', () => {
  it('maps the documented public API fields', () => {
    const c = normalizeIndiegogoProject(project(), IGG, NOW)!
    expect(c).toMatchObject({
      campaignId: 'smart-lamp',
      url: 'https://www.indiegogo.com/projects/smart-lamp',
      title: 'Smart Lamp Pro',
      ownerName: 'Lumen Labs',
      status: 'active',
      currency: 'USD',
      goalAmount: 10000,
      raisedAmount: 2500,
      backerCount: 40,
      daysRemaining: 28,
      imageUrls: ['https://cdn.images.indiegogo.com/abc.jpg'],
      price: null,
    })
  })
  it('computes ended, upcoming and funded states from the dates and amounts', () => {
    expect(normalizeIndiegogoProject(project({ campaignEndDate: '2026-10-01T00:00:00Z' }), IGG, NOW)?.status).toBe('ended')
    expect(normalizeIndiegogoProject(project({ campaignStartDate: '2026-10-10T00:00:00Z' }), IGG, NOW)?.status).toBe('upcoming')
    expect(normalizeIndiegogoProject(project({ fundsGathered: 12000 }), IGG, NOW)?.status).toBe('succeeded')
  })
  it('drops images from other hosts and rejects projects with a bad URL or id', () => {
    expect(normalizeIndiegogoProject(project({ projectImageUrl: 'https://evil.example/x.jpg' }), IGG, NOW)?.imageUrls).toEqual([])
    expect(normalizeIndiegogoProject(project({ projectHomeUrl: 'https://evil.example/projects/smart-lamp' }), IGG, NOW)).toBeNull()
    expect(normalizeIndiegogoProject(project({ projectUrlName: '../etc' }), IGG, NOW)).toBeNull()
  })
  it('ignores invalid numbers and currencies', () => {
    const c = normalizeIndiegogoProject(project({ backerCount: -1, campaignGoal: Number.NaN, currencyShortName: 'usd' }), IGG, NOW)!
    expect([c.backerCount, c.goalAmount, c.currency]).toEqual([null, null, null])
  })
})

describe('Indiegogo API source', () => {
  const config = { ...sourceDefinition('indiegogo')!.config, requestDelayMs: 0, maxRequestsPerRun: 2, lookbackDays: 14, minBackers: 5, minRaisedUsd: 0 }
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch
  it('lists recent active projects newest first, filtered by backers, and reuses the list data', async () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const newer = new Date(Date.now() - 86_400_000).toISOString()
    const old = new Date(Date.now() - 60 * 86_400_000).toISOString()
    const fetchMock = vi.fn(ok([
      project({ projectUrlName: 'a', projectHomeUrl: 'https://www.indiegogo.com/projects/a', campaignStartDate: recent, campaignEndDate: '2099-01-01T00:00:00Z' }),
      project({ projectUrlName: 'b', projectHomeUrl: 'https://www.indiegogo.com/projects/b', campaignStartDate: newer, campaignEndDate: '2099-01-01T00:00:00Z' }),
      project({ projectUrlName: 'old', projectHomeUrl: 'https://www.indiegogo.com/projects/old', campaignStartDate: old }),
      project({ projectUrlName: 'few', projectHomeUrl: 'https://www.indiegogo.com/projects/few', campaignStartDate: recent, backerCount: 1 }),
      { projectName: 'broken' },
    ]))
    const src = new IndiegogoApiSource(config, fetchMock)
    const refs = await src.listNewCampaigns()
    expect(refs.map((r) => r.campaignId)).toEqual(['b', 'a'])
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://www.indiegogo.com/api/public/projects/getActiveCrowdfundingProjects')
    await src.fetchCampaign(refs[0])
    expect(src.requestCount).toBe(1)
  })
  it('fetches a single project by URL name through the documented endpoint', async () => {
    const fetchMock = vi.fn(ok(project()))
    const c = await new IndiegogoApiSource(config, fetchMock).fetchCampaign({ campaignId: 'smart-lamp', url: 'https://www.indiegogo.com/projects/smart-lamp' })
    expect(c.campaignId).toBe('smart-lamp')
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://www.indiegogo.com/api/public/projects/getCrowdfundingProject?urlName=smart-lamp')
  })
  it('stops on rate limits, treats 404 as permanent and enforces the request budget', async () => {
    const limited = new IndiegogoApiSource(config, (async () => new Response('', { status: 429 })) as unknown as typeof fetch)
    await expect(limited.listNewCampaigns()).rejects.toThrow(/stopping this run/)
    await expect(limited.listNewCampaigns()).rejects.toThrow(/slow down/)
    const missing = await new IndiegogoApiSource(config, (async () => new Response('', { status: 404 })) as unknown as typeof fetch).fetchCampaign({ campaignId: 'x', url: '' }).catch((e) => e)
    expect(missing).toBeInstanceOf(SourceError)
    expect(missing.retryable).toBe(false)
    const src = new IndiegogoApiSource(config, ok(project()))
    await src.fetchCampaign({ campaignId: 'a', url: '' })
    await src.fetchCampaign({ campaignId: 'b', url: '' })
    await expect(src.fetchCampaign({ campaignId: 'c', url: '' })).rejects.toBeInstanceOf(RequestBudgetExceeded)
  })
  it('only lists campaigns that raised the minimum (converted to US dollars)', async () => {
    const recent = new Date(Date.now() - 86_400_000).toISOString()
    const p = (id: string, raised: number, currency: string) => project({ projectUrlName: id, projectHomeUrl: `https://www.indiegogo.com/projects/${id}`, campaignStartDate: recent, campaignEndDate: '2099-01-01T00:00:00Z', fundsGathered: raised, currencyShortName: currency })
    const src = new IndiegogoApiSource({ ...config, minRaisedUsd: 100_000 }, ok([p('usd-big', 150_000, 'USD'), p('usd-small', 99_000, 'USD'), p('hkd-big', 1_000_000, 'HKD'), p('hkd-small', 500_000, 'HKD'), p('odd', 9_999_999, 'XYZ')]))
    expect((await src.listNewCampaigns()).map((r) => r.campaignId).sort()).toEqual(['hkd-big', 'usd-big'])
    expect(raisedInUsd(1_000_000, 'HKD', { HKD: 0.128 })).toBeCloseTo(128_000)
    expect(raisedInUsd(5, 'XYZ', {})).toBeNull()
  })
  it('requires US$50,000 raised by default', () => {
    expect(sourceDefinition('indiegogo')!.config.minRaisedUsd).toBe(50_000)
  })
  it('rejects a response that is not a list', async () => {
    await expect(new IndiegogoApiSource(config, ok({ error: 'x' })).listNewCampaigns()).rejects.toThrow(/expected a list/)
  })
})

// Word counts and summary length
describe('summary length rules', () => {
  it('counts words without headings or bullet markers', () => {
    expect(countWords('## Features\n• Long battery life\n- USB-C charging')).toBe(6)
  })
  it('uses 200–300 words for rich sources and 60–150 for short ones', () => {
    expect(wordRange({ language: 'en', description: words(120), shortDescription: null })).toEqual({ min: 200, max: 300 })
    expect(wordRange({ language: 'en', description: words(36), shortDescription: null })).toEqual({ min: 60, max: 150 })
    expect(wordRange({ language: 'ja', description: 'あ'.repeat(600), shortDescription: null })).toEqual({ min: 200, max: 300 })
    expect(wordRange({ language: 'ja', description: 'あ'.repeat(100), shortDescription: null })).toEqual({ min: 60, max: 150 })
  })
  it('tells the AI the word range, the allowed categories and the tech-only rule', () => {
    const p = summarySystemPrompt({ minWords: 200, maxWords: 300, requireTechProduct: true, categories: [{ slug: 'audio', name: 'Audio' }] })
    expect(p).toMatch(/200/)
    expect(p).toMatch(/300/)
    expect(p).toMatch(/audio/)
  })
})

const en = (n: number, over: Partial<EnglishContent> = {}): EnglishContent => ({
  isTechProduct: true, eligibilityReason: '', title: 'Smart Lamp', shortDescription: 'A lamp.', description: words(n),
  seoTitle: 'Smart Lamp', seoDescription: 'A lamp.', category: null, tags: ['lamp', 'smart home', 'lighting'], imageAlt: 'Smart Lamp', ...over,
})
const zh = (over: Partial<ChineseContent> = {}): ChineseContent => ({ title: '智慧檯燈', shortDescription: '一盞檯燈。', description: '這是一盞智慧檯燈。', seoTitle: '智慧檯燈', seoDescription: '一盞檯燈。', imageAlt: '智慧檯燈', ...over })
const fakeAi = (summaries: EnglishContent[], translations: ChineseContent[] = []): AIProvider & { calls: unknown[] } => {
  const calls: unknown[] = []
  return {
    name: 'fake', model: 'fake-1', calls,
    generateProductSummary: async (_f, o) => { calls.push(o); return summaries.shift()! },
    translateToTraditionalChinese: async (_e, feedback) => { calls.push(feedback); return translations.shift()! },
    generateSEO: async () => ({ seoTitle: '', seoDescription: '' }),
    generateTags: async () => [],
  }
}
const facts: ProductFacts = { sourceName: 'Indiegogo', language: 'en', title: 'Smart Lamp', shortDescription: null, description: words(150), brand: null }
const opts = { requireTechProduct: true, categories: [] }

describe('English summary validation', () => {
  it('accepts exactly 200 and 300 words', async () => {
    expect((await englishWithinRange(fakeAi([en(200)]), facts, opts)).words).toBe(200)
    expect((await englishWithinRange(fakeAi([en(300)]), facts, opts)).words).toBe(300)
  })
  it('asks again with feedback when outside the range, then gives up', async () => {
    const ai = fakeAi([en(199), en(250)])
    expect((await englishWithinRange(ai, facts, opts)).words).toBe(250)
    expect(ai.calls[1]).toMatchObject({ feedback: expect.stringMatching(/199 words/) })
    await expect(englishWithinRange(fakeAi([en(301), en(301), en(301)]), facts, opts)).rejects.toBeInstanceOf(AIError)
  })
  it('returns non-tech products straight away (they are not imported)', async () => {
    const res = await englishWithinRange(fakeAi([en(10, { isTechProduct: false })]), facts, opts)
    expect(res.en.isTechProduct).toBe(false)
  })
  it('passes English source text to the AI unchanged, Japanese text cleaned', () => {
    const f = factsFromRegistry({ source: 'indiegogo', source_name: 'Indiegogo', source_language: 'en', ja_title: 'Lamp', ja_short_description: 'Short', ja_description: 'Long text', owner_name: 'Lumen' })
    expect(f).toEqual({ sourceName: 'Indiegogo', language: 'en', title: 'Lamp', shortDescription: 'Short', description: 'Long text', brand: 'Lumen' })
  })
})

describe('Traditional Chinese only', () => {
  it('detects Simplified characters but not Traditional ones', () => {
    expect(hasSimplified('这个产品')).toBe(true)
    expect(hasSimplified('這個產品')).toBe(false)
  })
  it('retranslates once when Simplified characters appear, then fails', async () => {
    const ai = fakeAi([], [zh({ description: '这是一盏台灯' }), zh()])
    expect((await chineseFromEnglish(ai, en(200))).description).toBe('這是一盞智慧檯燈。')
    expect(ai.calls[1]).toMatch(/Traditional Chinese/)
    await expect(chineseFromEnglish(fakeAi([], [zh({ title: '们' }), zh({ title: '们' })]), en(200))).rejects.toBeInstanceOf(AIError)
  })
})

describe('tags and categories', () => {
  it('keeps at most 8 unique, cleaned tags', () => {
    expect(cleanTags(['Lamp', 'lamp', '<b>LED</b>', ...Array.from({ length: 10 }, (_, i) => `t${i}`)])).toHaveLength(8)
    expect(cleanTags(['#Smart  Home'])).toEqual(['Smart Home'])
  })
  it('only accepts a category from the controlled list', () => {
    const list = [{ slug: 'audio', name: 'Audio' }]
    expect(pickCategory('Audio', list)).toBe('audio')
    expect(pickCategory('weapons', list)).toBeNull()
  })
})

// Gemini provider (mocked HTTP — no real API call)
describe('Gemini provider', () => {
  const reply = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: 'STOP' }] }), { status: 200 })
  const summary = { is_tech_product: true, eligibility_reason: 'Hardware', title: 'Smart Lamp', short_description: 'A lamp.', description: words(220), seo_title: 'Smart Lamp', seo_description: 'A lamp.', category: 'lighting', tags: ['lamp', 'lamp', 'LED'], image_alt: 'Lamp' }
  const so = { minWords: 200, maxWords: 300, requireTechProduct: true, categories: [{ slug: 'lighting', name: 'Lighting' }] }
  it('calls generateContent with the key in a header and structured JSON output', async () => {
    const fetchMock = vi.fn(async () => reply(summary))
    const out = await new GeminiProvider('secret-key', 'gemini-test', 1000, fetchMock as unknown as typeof fetch).generateProductSummary(facts, so)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
    expect(url).not.toMatch(/secret-key/)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key')
    expect(JSON.parse(String(init.body)).generationConfig.responseMimeType).toBe('application/json')
    expect(out).toMatchObject({ title: 'Smart Lamp', category: 'lighting', tags: ['lamp', 'LED'], isTechProduct: true })
  })
  it('translates into Traditional Chinese fields', async () => {
    const out = await new GeminiProvider('k', 'm', 1000, (async () => reply({ title: '智慧檯燈', short_description: '檯燈', description: '內容', seo_title: '智慧檯燈', seo_description: '檯燈', image_alt: '檯燈' })) as unknown as typeof fetch).translateToTraditionalChinese(en(200))
    expect(out.title).toBe('智慧檯燈')
  })
  it('classifies quota, server, key and safety errors', async () => {
    const err = async (res: Response) => new GeminiProvider('k', 'm', 1000, (async () => res) as unknown as typeof fetch).generateTags({ title: 't', description: 'd' }).then(() => { throw new Error('expected an error') }, (e: AIError) => e)
    const quota = await err(new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } }), { status: 429 }))
    expect([quota.retryable, quota.quota]).toEqual([true, true])
    const busy = await err(new Response(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'high demand' } }), { status: 503 }))
    expect([busy.retryable, busy.quota, busy.busy]).toEqual([true, false, true])
    const server = await err(new Response('{}', { status: 500 }))
    expect([server.retryable, server.quota, server.busy]).toEqual([true, false, false])
    const badKey = await err(new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: 'API key not valid' } }), { status: 403 }))
    expect(badKey.retryable).toBe(false)
    const blocked = await err(new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }))
    expect(blocked.retryable).toBe(false)
    const invalid = await err(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 }))
    expect(invalid.message).toMatch(/invalid JSON/)
  })
  it('rejects a summary without a description', async () => {
    const res = await new GeminiProvider('k', 'm', 1000, (async () => reply({ ...summary, description: '' })) as unknown as typeof fetch).generateProductSummary(facts, so).catch((e) => e)
    expect(res).toBeInstanceOf(AIError)
  })
})

describe('AI configuration', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs() })
  it('has no provider until AI_PROVIDER and AI_API_KEY are set', async () => {
    vi.stubEnv('AI_PROVIDER', '')
    vi.stubEnv('AI_API_KEY', '')
    const { createAIProvider } = await import('@/lib/ai')
    expect(createAIProvider()).toBeNull()
  })
  it('creates a Gemini provider when configured', async () => {
    vi.stubEnv('AI_PROVIDER', 'gemini')
    vi.stubEnv('AI_API_KEY', 'k')
    vi.stubEnv('AI_MODEL', 'gemini-test')
    const { createAIProvider } = await import('@/lib/ai')
    expect(createAIProvider()).toMatchObject({ name: 'gemini', model: 'gemini-test' })
  })
})

// Duplicate hold before auto-publish
describe('automatic publishing and duplicates', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs() })
  it('holds a possible duplicate instead of publishing it', async () => {
    vi.stubEnv('GREEN_FUNDING_IMPORT_MODE', 'production')
    vi.stubEnv('GREEN_FUNDING_AUTO_PUBLISH', 'true')
    const updates: Record<string, unknown>[] = []
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      select: () => q, eq: () => q, insert: async () => ({ error: null }),
      update: (v: Record<string, unknown>) => { updates.push(v); return { eq: async () => ({ error: null }) } },
      maybeSingle: async () => ({ data: { id: 'm', source: 'indiegogo', source_campaign_id: 'a', source_url: 'https://www.indiegogo.com/projects/a' } }),
    })
    const db = { from: () => q, rpc: async () => ({ data: [{ name: 'Smart Lamp', reason: 'Very similar name' }] }) }
    const { autoPublishIfEnabled } = await import('@/lib/greenfunding/publish')
    const res = await autoPublishIfEnabled(db as never, 'p')
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/Possible duplicate/) })
    expect(updates[0]).toMatchObject({ pipeline_status: 'duplicate' })
    expect(updates.some((u) => u.status === 'published')).toBe(false)
  })
})

// Admin maintenance actions
describe('admin maintenance actions', () => {
  beforeEach(() => vi.resetModules())
  it('are refused for non-admins', async () => {
    vi.doMock('@/lib/auth', () => ({ getViewer: async () => ({ id: 'u1', isAdmin: false, isStaff: true }) }))
    vi.doMock('next/cache', () => ({ revalidatePath: () => {} }))
    const actions = await import('@/lib/actions/greenfunding')
    const id = '5280fd62-b6d2-4a9b-b15d-01225627c472'
    for (const res of await Promise.all([actions.resyncImport(id), actions.deleteImport(id), actions.republishImport(id), actions.retranslate(id), actions.archiveImport(id), actions.checkAi()])) {
      expect(res).toEqual({ ok: false, error: 'Only administrators can do this.' })
    }
  })
})

// Images are copied at import; rejected products leave no files behind.
describe('Indiegogo images', () => {
  it('are copied at import time', () => {
    expect(sourceDefinition('indiegogo')!.deferImages).toBe(false)
  })
  it('removes the stored files of a rejected product', async () => {
    const removed: string[][] = []
    const q: Record<string, unknown> = {}
    Object.assign(q, { select: () => q, eq: async () => ({ data: [
      { storage_path: 'https://x.supabase.co/storage/v1/object/public/greenfunding-products/campaign-versa/hero%20a.png' },
      { storage_path: 'https://elsewhere.example/image.png' },
    ] }) })
    const db = { from: () => q, storage: { from: () => ({ remove: async (paths: string[]) => { removed.push(paths); return { error: null } } }) } }
    const { removeProductImageFiles } = await import('@/lib/greenfunding/sync')
    expect(await removeProductImageFiles(db as never, 'p')).toBe(1)
    expect(removed).toEqual([['campaign-versa/hero a.png']])
  })
})

describe('amount raised instead of price', () => {
  it('formats short amounts in the campaign currency', async () => {
    const { formatters } = await import('@/lib/i18n/format')
    expect(formatters('en').moneyCompact(3_435_112, 'USD')).toBe('US$3.4M')
    expect(formatters('en').moneyCompact(7_757_127, 'HKD')).toBe('HK$7.8M')
    expect(formatters('zh-HK').moneyCompact(3_435_112, 'USD')).toBe('US$3.4M')
    expect(formatters('en').moneyCompact(null, 'USD')).toBeNull()
  })
  it('uses the raised amount only for crowdfunding products', async () => {
    const { raisedOf } = await import('@/components/product/price')
    expect(raisedOf({ source_name: 'Indiegogo', campaign_raised: 100, campaign_currency: 'USD' })).toEqual({ amount: 100, currency: 'USD' })
    expect(raisedOf({ source_name: null, campaign_raised: null, campaign_currency: null })).toBeNull()
  })
})
