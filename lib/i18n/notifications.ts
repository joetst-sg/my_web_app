import type { Locale } from './config'
import type { MessageKey, Translate } from './translate'

// Notifications are written in English by database triggers (see the
// create_notification calls in supabase/migrations). Their wording is fixed,
// so we recognise each pattern here and show it in the reader's language.
// Anything unrecognised is shown as stored.
// [pattern, key, names of the captured values]
const PATTERNS: [RegExp, MessageKey, string[]][] = [
  // titles
  [/^New in "(.+)"$/, 'notif.collectionNewTitle', ['name']],
  [/^New follower$/, 'notif.newFollowerTitle', []],
  [/^New product submission$/, 'notif.submissionTitle', []],
  [/^Changes requested$/, 'notif.changesTitle', []],
  [/^Submission not accepted$/, 'notif.rejectedTitle', []],
  [/^Product approved$/, 'notif.approvedTitle', []],
  [/^Publication scheduled$/, 'notif.scheduledTitle', []],
  [/^Your product is live$/, 'notif.publishedTitle', []],
  [/^"(.+)" is available now$/, 'notif.launchTitle', ['name']],
  [/^"(.+)" is on sale$/, 'notif.saleTitle', ['name']],
  [/^Reminder: (.+)$/, 'notif.reminderTitle', ['name']],
  [/^Price drop: (.+)$/, 'notif.priceDropTitle', ['name']],
  [/^New message from seller$/, 'notif.sellerMessageTitle', []],
  [/^New message from the editors$/, 'notif.editorMessageTitle', []],
  // bodies
  [/^A product was added to a collection you follow\.$/, 'notif.collectionNewBody', []],
  [/^Someone started following (.+)\.$/, 'notif.brandFollowerBody', ['name']],
  [/^Someone saved your collection "(.+)"\.$/, 'notif.collectionFollowerBody', ['name']],
  [/^"(.+)" is waiting for review\.$/, 'notif.submissionBody', ['name']],
  [/^An editor asked for changes to "(.+)"\.$/, 'notif.changesBody', ['name']],
  [/^"(.+)" was not accepted\.$/, 'notif.rejectedBody', ['name']],
  [/^"(.+)" was approved and will be published soon\.$/, 'notif.approvedBody', ['name']],
  [/^"(.+)" will go live on (.+) UTC\.$/, 'notif.scheduledBody', ['name', 'date']],
  [/^"(.+)" is now published\.$/, 'notif.publishedBody', ['name']],
  [/^The product you were waiting for has launched\.$/, 'notif.launchBody', []],
  [/^A product you set a sale reminder for has a lower price\.$/, 'notif.saleBody', []],
  [/^You asked us to remind you about this product\.$/, 'notif.reminderBody', []],
  [/^Now ([A-Z]{3}) ([\d.]+) \(was ([\d.]+)\)\.$/, 'notif.priceDropBody', ['currency', 'price', 'old']],
  [/^The seller replied about "(.+)"\.$/, 'notif.sellerMessageBody', ['name']],
  [/^An editor sent a message about "(.+)"\.$/, 'notif.editorMessageBody', ['name']],
]

export function translateNotificationText(text: string | null, t: Translate, locale: Locale): string | null {
  if (!text || locale === 'en') return text
  for (const [re, key, names] of PATTERNS) {
    const m = re.exec(text)
    if (m) return t(key, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])))
  }
  return text
}
