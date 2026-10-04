import type { GreenFundingConfig } from '../config'
import type { CampaignSource } from '../types'
import { HtmlCampaignSource } from './html'

export { sourceDefinition, sourceDefinitions, type SourceDefinition, type SourceKey, type SourceConfig } from './registry'

// GREEN FUNDING data source. An official GREEN FUNDING API or feed would be
// added as another CampaignSource (e.g. GREEN_FUNDING_SOURCE=api).
export function createCampaignSource(config: GreenFundingConfig): CampaignSource {
  switch (config.source) {
    case 'html':
      return new HtmlCampaignSource(config)
    default:
      throw new Error(`Unknown GREEN_FUNDING_SOURCE "${config.source}". Available: html.`)
  }
}
