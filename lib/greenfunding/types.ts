// The data the rest of the system needs about a campaign, independent of
// where it came from (HTML pages today, an official API/feed later).
// Unknown values are null — never guessed.

export type SourceStatus = 'active' | 'succeeded' | 'ended' | 'cancelled' | 'upcoming' | 'unknown'

export type CampaignRef = {
  campaignId: string
  url: string
}

export type SourceCampaign = CampaignRef & {
  title: string | null
  shortDescription: string | null
  // Plain text with light markdown: "### " headings, "**bold**", "• " bullets.
  description: string | null
  ownerName: string | null
  categories: string[]
  tags: string[]
  status: SourceStatus
  currency: string | null
  // Lowest reward/plan price shown, if any.
  price: number | null
  goalAmount: number | null
  raisedAmount: number | null
  backerCount: number | null
  daysRemaining: number | null
  startsAt: string | null
  endsAt: string | null
  endsAtEstimated: boolean
  // Hero first, then images from the description, de-duplicated.
  imageUrls: string[]
  // Anything else worth keeping for audit (reward plans, raw labels…).
  raw: Record<string, unknown>
}

// A data source. To switch to an official GREEN FUNDING API or feed,
// implement this interface and select it with GREEN_FUNDING_SOURCE.
export interface CampaignSource {
  readonly name: string
  // Newest campaigns first.
  listNewCampaigns(): Promise<CampaignRef[]>
  fetchCampaign(ref: CampaignRef): Promise<SourceCampaign>
  // Requests made so far in this run (for rate limiting and logs).
  readonly requestCount: number
}

export class SourceError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message)
  }
}

export class RequestBudgetExceeded extends SourceError {
  constructor() {
    super('Request budget for this run is used up.', true)
  }
}
