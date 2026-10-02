import type { GreenFundingConfig } from '../config'
import type { CampaignSource } from '../types'
import { HtmlCampaignSource } from './html'

// Picks the data source. An official GREEN FUNDING API or feed would be added
// here as another CampaignSource (e.g. GREEN_FUNDING_SOURCE=api) — nothing
// else in the import pipeline needs to change.
export function createCampaignSource(config: GreenFundingConfig): CampaignSource {
  switch (config.source) {
    case 'html':
      return new HtmlCampaignSource(config)
    default:
      throw new Error(`Unknown GREEN_FUNDING_SOURCE "${config.source}". Available: html.`)
  }
}
