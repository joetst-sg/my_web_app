export function formatPrice(value: number | string | null | undefined, currency = 'USD') {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n)
}

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(value))
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })
}

export function timeAgo(value: string | Date | null | undefined) {
  if (!value) return ''
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(-seconds, 'second')
  if (abs < 3600) return rtf.format(-Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(-Math.round(seconds / 86400), 'day')
  return formatDate(value)
}

export function compactNumber(n: number | null | undefined) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0)
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function randomSuffix(length = 4) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

export const labels = {
  availability: {
    available: 'Available',
    coming_soon: 'Coming soon',
    preorder: 'Pre-order',
    crowdfunding: 'Crowdfunding',
    sold_out: 'Sold out',
    discontinued: 'Discontinued',
  },
  submissionStatus: {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under review',
    changes_requested: 'Changes requested',
    approved: 'Approved',
    scheduled: 'Scheduled',
    published: 'Published',
    rejected: 'Rejected',
    archived: 'Archived',
  },
  productStatus: {
    draft: 'Draft',
    pending_review: 'Pending review',
    changes_requested: 'Changes requested',
    approved: 'Approved',
    scheduled: 'Scheduled',
    published: 'Published',
    rejected: 'Rejected',
    archived: 'Archived',
  },
  articleType: {
    review: 'Review',
    hands_on: 'Hands-on',
    buying_guide: 'Buying guide',
    news: 'Tech news',
    roundup: 'Roundup',
    how_to: 'How-to',
    interview: 'Interview',
  },
  reportReason: {
    broken_link: 'Broken link',
    incorrect_information: 'Incorrect information',
    offensive_content: 'Offensive content',
    misleading_information: 'Misleading information',
    copyright_concern: 'Copyright concern',
    scam_suspicious: 'Scam or suspicious',
    other: 'Other',
  },
} as const
