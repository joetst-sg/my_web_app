import { parseCampaignList, parseCampaignPage } from '../parse'
import { RequestBudgetExceeded, SourceError, type CampaignRef, type CampaignSource, type SourceCampaign } from '../types'
import { hostAllowed, validateCampaignUrl } from '../url'
import type { GreenFundingConfig } from '../config'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Reads GREEN FUNDING's public pages, as authorized by GREEN FUNDING.
// Polite by design: one request at a time, a delay between requests, a hard
// per-run request budget and a timeout. It never logs in, never sends cookies
// and gives up on 403/429 instead of retrying, so it cannot be used to get
// around access controls or rate limits.
export class HtmlCampaignSource implements CampaignSource {
  readonly name = 'greenfunding-html'
  private requests = 0
  private lastRequestAt = 0
  private blocked = false

  constructor(
    private readonly config: GreenFundingConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get requestCount() {
    return this.requests
  }

  async fetchPage(url: string): Promise<string> {
    if (this.blocked) throw new SourceError('GREEN FUNDING asked us to slow down; stopping this run.', true)
    if (this.requests >= this.config.maxRequestsPerRun) throw new RequestBudgetExceeded()
    const wait = this.lastRequestAt + this.config.requestDelayMs - Date.now()
    if (wait > 0) await sleep(wait)
    this.requests++
    this.lastRequestAt = Date.now()
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        headers: { 'User-Agent': this.config.userAgent, Accept: 'text/html', 'Accept-Language': 'ja' },
        redirect: 'follow',
        signal: AbortSignal.timeout(this.config.timeoutMs),
        cache: 'no-store',
      })
    } catch (e) {
      throw new SourceError(`Request failed: ${e instanceof Error ? e.message : String(e)}`, true)
    }
    if (res.status === 429 || res.status === 403 || res.status === 503) {
      this.blocked = true
      throw new SourceError(`GREEN FUNDING returned ${res.status}; stopping this run.`, true)
    }
    if (res.status === 404 || res.status === 410) throw new SourceError(`Not found (${res.status}).`, false)
    if (!res.ok) throw new SourceError(`GREEN FUNDING returned ${res.status}.`, true)
    // The page must stay on an authorized domain after redirects.
    const finalHost = (() => {
      try {
        return new URL(res.url || url).hostname
      } catch {
        return ''
      }
    })()
    if (!hostAllowed(finalHost, this.config.allowedDomains)) throw new SourceError(`Unexpected redirect to ${res.url}.`, false)
    return res.text()
  }

  async listNewCampaigns(): Promise<CampaignRef[]> {
    const refs: CampaignRef[] = []
    for (let page = 1; page <= this.config.discoveryPages; page++) {
      const html = await this.fetchPage(`${this.config.baseUrl}/portals/search?condition=new${page > 1 ? `&page=${page}` : ''}`)
      refs.push(...parseCampaignList(html, this.config.baseUrl).filter((r) => validateCampaignUrl(r.url, this.config.allowedDomains).ok))
    }
    return [...new Map(refs.map((r) => [r.campaignId, r])).values()]
  }

  async fetchCampaign(ref: CampaignRef): Promise<SourceCampaign> {
    const html = await this.fetchPage(ref.url)
    return parseCampaignPage(html, ref, this.config.baseUrl)
  }
}
