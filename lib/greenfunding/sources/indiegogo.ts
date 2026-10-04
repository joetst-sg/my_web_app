import { RequestBudgetExceeded, SourceError, type CampaignRef, type CampaignSource, type SourceCampaign } from '../types'
import { CAMPAIGN_PATHS, hostAllowed, validateSourceUrl } from '../url'
import type { SourceConfig } from './registry'

// Indiegogo's official public API (documented at
// help.indiegogo.com/article/616-indiegogo-public-api). No key is needed.
// Only the two documented project endpoints are used:
//   GET /api/public/projects/getActiveCrowdfundingProjects
//   GET /api/public/projects/getCrowdfundingProject?urlName=…
// The website itself is never fetched.

export type IndiegogoProject = {
  backerCount?: number
  campaignEndDate?: string
  campaignGoal?: number
  campaignStartDate?: string
  commentCount?: number
  creatorName?: string
  creatorUrlName?: string
  currencyShortName?: string
  fundsGathered?: number
  projectHomeUrl?: string
  projectImageUrl?: string
  projectName?: string
  projectType?: number
  projectUrlName?: string
  rewardCount?: number
  shortDescription?: string
  updateCount?: number
}

// Amount in US dollars (approximate), or null when the currency is unknown.
export function raisedInUsd(amount: number | null, currency: string | null, rates: Record<string, number>) {
  if (amount === null || !currency || !rates[currency]) return null
  return amount * rates[currency]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)

// Converts an API project into the shared campaign shape. Unknown → null.
export function normalizeIndiegogoProject(p: IndiegogoProject, config: Pick<SourceConfig, 'allowedDomains' | 'imageDomains'>, now = new Date()): SourceCampaign | null {
  const id = typeof p.projectUrlName === 'string' && /^[a-z0-9_-]{1,200}$/i.test(p.projectUrlName) ? p.projectUrlName : null
  const check = validateSourceUrl(p.projectHomeUrl, config.allowedDomains, CAMPAIGN_PATHS.indiegogo)
  if (!id || !check.ok) return null
  const end = p.campaignEndDate && !Number.isNaN(Date.parse(p.campaignEndDate)) ? new Date(p.campaignEndDate) : null
  const start = p.campaignStartDate && !Number.isNaN(Date.parse(p.campaignStartDate)) ? new Date(p.campaignStartDate) : null
  const goal = num(p.campaignGoal)
  const raised = num(p.fundsGathered)
  const ended = end !== null && end.getTime() <= now.getTime()
  const image = (() => {
    try {
      const u = new URL(p.projectImageUrl ?? '')
      return u.protocol === 'https:' && hostAllowed(u.hostname, config.imageDomains) ? u.toString() : null
    } catch {
      return null
    }
  })()
  const text = (s: unknown) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() || null : null)
  return {
    campaignId: id,
    url: check.url,
    title: text(p.projectName),
    shortDescription: text(p.shortDescription),
    description: text(p.shortDescription),
    ownerName: text(p.creatorName),
    categories: [],
    tags: [],
    status: ended ? 'ended' : start && start.getTime() > now.getTime() ? 'upcoming' : goal && raised !== null && raised >= goal ? 'succeeded' : 'active',
    currency: typeof p.currencyShortName === 'string' && /^[A-Z]{3}$/.test(p.currencyShortName) ? p.currencyShortName : null,
    price: null,
    goalAmount: goal,
    raisedAmount: raised,
    backerCount: num(p.backerCount),
    daysRemaining: end && !ended ? Math.ceil((end.getTime() - now.getTime()) / 86_400_000) : end ? 0 : null,
    startsAt: start?.toISOString() ?? null,
    endsAt: end?.toISOString() ?? null,
    endsAtEstimated: false,
    imageUrls: image ? [image] : [],
    raw: {
      projectType: p.projectType ?? null,
      creatorUrlName: p.creatorUrlName ?? null,
      rewardCount: p.rewardCount ?? null,
      updateCount: p.updateCount ?? null,
      commentCount: p.commentCount ?? null,
    },
  }
}

export class IndiegogoApiSource implements CampaignSource {
  readonly name = 'indiegogo-public-api'
  private requests = 0
  private lastRequestAt = 0
  private blocked = false
  private cache = new Map<string, IndiegogoProject>()

  constructor(
    private readonly config: SourceConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get requestCount() {
    return this.requests
  }

  private async getJson(path: string): Promise<unknown> {
    if (this.blocked) throw new SourceError('Indiegogo asked us to slow down; stopping this run.', true)
    if (this.requests >= this.config.maxRequestsPerRun) throw new RequestBudgetExceeded()
    const wait = this.lastRequestAt + this.config.requestDelayMs - Date.now()
    if (wait > 0) await sleep(wait)
    this.requests++
    this.lastRequestAt = Date.now()
    let res: Response
    try {
      res = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        headers: { 'User-Agent': this.config.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: 'no-store',
      })
    } catch (e) {
      throw new SourceError(`Indiegogo API request failed: ${e instanceof Error ? e.message : String(e)}`, true)
    }
    if (res.status === 429 || res.status === 403 || res.status === 503) {
      this.blocked = true
      throw new SourceError(`Indiegogo API returned ${res.status}; stopping this run.`, true)
    }
    if (res.status === 400 || res.status === 404) throw new SourceError(`Indiegogo project not found (${res.status}).`, false)
    if (!res.ok) throw new SourceError(`Indiegogo API returned ${res.status}.`, true)
    const length = Number(res.headers.get('content-length'))
    if (length > 20 * 1024 * 1024) throw new SourceError('Indiegogo API response is unexpectedly large.', true)
    try {
      return await res.json()
    } catch {
      throw new SourceError('Indiegogo API returned invalid JSON.', true)
    }
  }

  // Active projects, newest first, limited to recently started ones that
  // have already raised the minimum amount (and have the minimum backers).
  async listNewCampaigns(): Promise<CampaignRef[]> {
    const data = await this.getJson('/api/public/projects/getActiveCrowdfundingProjects')
    if (!Array.isArray(data)) throw new SourceError('Unexpected Indiegogo API response (expected a list).', true)
    const since = Date.now() - this.config.lookbackDays * 86_400_000
    const refs: (CampaignRef & { start: number })[] = []
    for (const p of data as IndiegogoProject[]) {
      const c = normalizeIndiegogoProject(p, this.config)
      if (!c) continue
      const start = c.startsAt ? Date.parse(c.startsAt) : 0
      if (start < since || (c.backerCount ?? 0) < this.config.minBackers) continue
      if (this.config.minRaisedUsd > 0 && (raisedInUsd(c.raisedAmount, c.currency, this.config.usdRates) ?? 0) < this.config.minRaisedUsd) continue
      this.cache.set(c.campaignId, p)
      refs.push({ campaignId: c.campaignId, url: c.url, start })
    }
    return refs.sort((a, b) => b.start - a.start).map(({ campaignId, url }) => ({ campaignId, url }))
  }

  async fetchCampaign(ref: CampaignRef): Promise<SourceCampaign> {
    const cached = this.cache.get(ref.campaignId)
    const project = cached ?? ((await this.getJson(`/api/public/projects/getCrowdfundingProject?urlName=${encodeURIComponent(ref.campaignId)}`)) as IndiegogoProject)
    const c = normalizeIndiegogoProject(project, this.config)
    if (!c) throw new SourceError('Indiegogo returned incomplete or invalid project data.', false)
    return c
  }
}
