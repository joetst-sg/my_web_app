import type { MessageKey } from '@/lib/i18n/translate'

// Brand and site-wide constants. Rename the product here.
// The tagline and description shown to visitors are translated (site.* keys).
export const site = {
  name: 'Loupe',
  tagline: 'Discover products worth a closer look.',
  description:
    'Loupe is an editor-curated discovery platform for new gadgets, smart home tech, audio, travel gear and more — reviewed, scored and linked straight to the maker.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
}

export const mainNav: readonly { href: string; label: MessageKey }[] = [
  { href: '/discover', label: 'nav.discover' },
  { href: '/categories', label: 'nav.categories' },
  { href: '/brands', label: 'nav.brands' },
  { href: '/trending', label: 'nav.trending' },
  { href: '/collections', label: 'nav.collections' },
  { href: '/magazine', label: 'nav.magazine' },
]

export const interestCategories = [
  'ai-gadgets', 'gaming', 'smart-home', 'fitness', 'travel', 'audio', 'photography',
  'automotive', 'productivity', 'kitchen', 'outdoor', 'wearables', 'office', 'health-wellness', 'eco-tech',
]
