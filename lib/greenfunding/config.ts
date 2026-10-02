// GREEN FUNDING import settings, read from environment variables on the
// server. Every value has a safe default; invalid values fall back to it.

const int = (name: string, fallback: number, min: number, max: number) => {
  const n = Number(process.env[name])
  return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback
}
const list = (name: string, fallback: string[]) =>
  (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .concat((process.env[name] ?? '').trim() ? [] : fallback)

export type ImportMode = 'test' | 'production'

export function greenFundingConfig() {
  return {
    // "test" imports and translates but can never publish. Default: test.
    mode: (process.env.GREEN_FUNDING_IMPORT_MODE === 'production' ? 'production' : 'test') as ImportMode,
    // Which data source implementation to use (see lib/greenfunding/sources).
    source: (process.env.GREEN_FUNDING_SOURCE ?? 'html').trim(),
    baseUrl: (process.env.GREEN_FUNDING_BASE_URL ?? 'https://greenfunding.jp').replace(/\/$/, ''),
    apiKey: process.env.GREEN_FUNDING_API_KEY || null,
    syncIntervalMinutes: int('GREEN_FUNDING_SYNC_INTERVAL_MINUTES', 30, 5, 10080),
    allowedDomains: list('GREEN_FUNDING_ALLOWED_DOMAINS', ['greenfunding.jp', 'www.greenfunding.jp']),
    imageDomains: list('GREEN_FUNDING_IMAGE_DOMAINS', ['images.greenfunding.jp']),
    maxRequestsPerRun: int('GREEN_FUNDING_MAX_REQUESTS_PER_RUN', 50, 1, 500),
    requestDelayMs: int('GREEN_FUNDING_REQUEST_DELAY_MS', 500, 0, 60000),
    timeoutMs: int('GREEN_FUNDING_TIMEOUT_MS', 30000, 1000, 120000),
    // Newest-campaign listing pages read per sync (12 campaigns per page).
    discoveryPages: int('GREEN_FUNDING_DISCOVERY_PAGES', 1, 1, 20),
    // Existing campaigns re-checked for updates per sync.
    updateChecksPerRun: int('GREEN_FUNDING_UPDATE_CHECKS_PER_RUN', 10, 0, 200),
    maxImagesPerProduct: int('GREEN_FUNDING_MAX_IMAGES', 10, 1, 30),
    // GREEN FUNDING category names that are never imported (e.g. アイドル).
    excludedCategories: (process.env.GREEN_FUNDING_EXCLUDED_CATEGORIES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    userAgent: process.env.GREEN_FUNDING_USER_AGENT || 'JoetangtstBot/1.0 (+https://www.joetangtst.com; authorized GREEN FUNDING partner import)',
  }
}

export type GreenFundingConfig = ReturnType<typeof greenFundingConfig>
