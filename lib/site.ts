// Brand and site-wide constants. Rename the product here.
export const site = {
  name: 'Loupe',
  tagline: 'Discover products worth a closer look.',
  description:
    'Loupe is an editor-curated discovery platform for new gadgets, smart home tech, audio, travel gear and more — reviewed, scored and linked straight to the maker.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
}

export const mainNav = [
  { href: '/discover', label: 'Discover' },
  { href: '/categories', label: 'Categories' },
  { href: '/brands', label: 'Brands' },
  { href: '/trending', label: 'Trending' },
  { href: '/collections', label: 'Collections' },
  { href: '/magazine', label: 'Magazine' },
] as const

export const interestCategories = [
  'ai-gadgets', 'gaming', 'smart-home', 'fitness', 'travel', 'audio', 'photography',
  'automotive', 'productivity', 'kitchen', 'outdoor', 'wearables', 'office', 'health-wellness', 'eco-tech',
]
