import { greenFundingConfig, type GreenFundingConfig } from '../config'
import type { CampaignSource } from '../types'
import { CAMPAIGN_PATHS } from '../url'
import { HtmlCampaignSource } from './html'
import { IndiegogoApiSource } from './indiegogo'

// Crowdfunding sources. Each source supplies campaigns in the shared
// SourceCampaign shape; everything after that (registry, duplicate checks,
// AI content, images, publishing, Buy Now) is shared. To add a platform,
// implement CampaignSource and add an entry here.

export type SourceKey = 'greenfunding' | 'indiegogo'

export type SourceConfig = GreenFundingConfig & {
  enabled: boolean
  // Most new campaigns imported per run (each needs AI processing).
  maxNewPerRun: number
  // Indiegogo: only campaigns started within this many days, with this many backers.
  lookbackDays: number
  minBackers: number
  // Indiegogo: only campaigns that have already raised at least this much
  // (converted to US dollars with approximate rates; 0 = no minimum).
  minRaisedUsd: number
  usdRates: Record<string, number>
}

// Approximate US-dollar value of one unit of each currency. Only used for
// the minimum-raised threshold, so rough rates are fine. Override or add
// with INDIEGOGO_USD_RATES="HKD=0.128,EUR=1.10".
const DEFAULT_USD_RATES: Record<string, number> = {
  USD: 1, EUR: 1.1, GBP: 1.3, CAD: 0.73, AUD: 0.66, NZD: 0.6, HKD: 0.128, SGD: 0.77, JPY: 0.0068,
  CHF: 1.15, SEK: 0.095, DKK: 0.147, NOK: 0.094, MXN: 0.055, KRW: 0.00073, TWD: 0.032, CNY: 0.14,
}
const rates = (name: string) => {
  const out = { ...DEFAULT_USD_RATES }
  for (const pair of (process.env[name] ?? '').split(',')) {
    const [code, value] = pair.split('=').map((s) => s.trim())
    if (/^[A-Z]{3}$/.test(code ?? '') && Number(value) > 0) out[code] = Number(value)
  }
  return out
}

export type SourceDefinition = {
  key: SourceKey
  displayName: string
  // Language of the source text.
  language: 'ja' | 'en'
  campaignPath: RegExp
  // Copy images only after AI content passed validation (skips work for
  // campaigns that turn out not to be eligible).
  deferImages: boolean
  // The AI must confirm the campaign is a Tech & Innovation product.
  requireTechProduct: boolean
  config: SourceConfig
  create(): CampaignSource
}

const int = (name: string, fallback: number, min: number, max: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback
}
const list = (name: string, fallback: string[]) => {
  const v = (process.env[name] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return v.length ? v : fallback
}

export function sourceDefinitions(): SourceDefinition[] {
  const base = greenFundingConfig()
  const gf: SourceConfig = {
    ...base,
    enabled: process.env.GREEN_FUNDING_ENABLED !== 'false',
    maxNewPerRun: int('GREEN_FUNDING_MAX_NEW_PER_RUN', 12, 1, 100),
    lookbackDays: 3650,
    minBackers: 0,
    minRaisedUsd: 0,
    usdRates: DEFAULT_USD_RATES,
  }
  const igg: SourceConfig = {
    ...base,
    enabled: process.env.INDIEGOGO_ENABLED === 'true',
    baseUrl: (process.env.INDIEGOGO_API_BASE_URL ?? 'https://www.indiegogo.com').replace(/\/$/, ''),
    syncIntervalMinutes: int('INDIEGOGO_SYNC_INTERVAL_MINUTES', 1440, 5, 10080),
    allowedDomains: list('INDIEGOGO_ALLOWED_DOMAINS', ['www.indiegogo.com', 'indiegogo.com']),
    imageDomains: list('INDIEGOGO_IMAGE_DOMAINS', ['cdn.images.indiegogo.com']),
    maxRequestsPerRun: int('INDIEGOGO_MAX_REQUESTS_PER_RUN', 20, 1, 200),
    requestDelayMs: int('INDIEGOGO_REQUEST_DELAY_MS', 1000, 0, 60000),
    updateChecksPerRun: int('INDIEGOGO_UPDATE_CHECKS_PER_RUN', 10, 0, 200),
    maxImagesPerProduct: 1,
    excludedCategories: [],
    maxNewPerRun: int('INDIEGOGO_MAX_NEW_PER_RUN', 8, 1, 100),
    lookbackDays: int('INDIEGOGO_LOOKBACK_DAYS', 90, 1, 365),
    minBackers: int('INDIEGOGO_MIN_BACKERS', 0, 0, 100000),
    minRaisedUsd: int('INDIEGOGO_MIN_RAISED_USD', 50000, 0, 1_000_000_000),
    usdRates: rates('INDIEGOGO_USD_RATES'),
  }
  return [
    { key: 'greenfunding', displayName: 'GREEN FUNDING', language: 'ja', campaignPath: CAMPAIGN_PATHS.greenfunding, deferImages: false, requireTechProduct: false, config: gf, create: () => new HtmlCampaignSource(gf) },
    { key: 'indiegogo', displayName: 'Indiegogo', language: 'en', campaignPath: CAMPAIGN_PATHS.indiegogo, deferImages: true, requireTechProduct: true, config: igg, create: () => new IndiegogoApiSource(igg) },
  ]
}

export function sourceDefinition(key: string): SourceDefinition | null {
  return sourceDefinitions().find((d) => d.key === key) ?? null
}
