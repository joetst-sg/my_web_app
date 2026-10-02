import { htmlToText } from '@/lib/greenfunding/parse'
import { LIMITS } from './prompt'
import { TranslationError, type TargetLanguage, type TranslationInput, type TranslationOutput } from './types'

// Shared logic for machine-translation services (Google Cloud Translation,
// Azure AI Translator). They translate faithfully but don't rewrite or write
// SEO copy, so:
//  - descriptions are sent as simple HTML so headings, bold and bullets survive;
//  - brand and model names are wrapped as "do not translate";
//  - SEO title/description and image alt text are derived from the result.

export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

// Our light markdown → simple HTML (one element per block).
export function textToHtml(text: string) {
  return textToHtmlBlocks(text).join('\n')
}

export function textToHtmlBlocks(text: string): string[] {
  const inline = (s: string) => escape(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim()
      if (!b) return ''
      const heading = b.match(/^#{1,6}\s+(.+)$/)
      if (heading && !b.includes('\n')) return `<h3>${inline(heading[1])}</h3>`
      const lines = b.split('\n')
      if (lines.every((l) => /^\s*[•・\-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[•・\-*]\s+/, ''))}</li>`).join('')}</ul>`
      return `<p>${lines.map(inline).join('<br>')}</p>`
    })
    .filter(Boolean)
}

// Latin-script product names and model numbers in a Japanese title
// (e.g. "Crusher 1080 ANC", "X100").
export function latinTerms(title: string) {
  return [...new Set(title.match(/[A-Za-z][A-Za-z0-9+.\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9+.\-]*)*/g) ?? [])].filter((t) => t.length >= 2)
}

// Wraps exact terms as untranslatable. Placeholders first (longest term
// first), so overlapping names or words inside the markup are never wrapped twice.
export function protect(html: string, terms: string[]) {
  const sorted = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length)
  let out = html
  sorted.forEach((term, i) => {
    const safe = escape(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(?<![\\w-])${safe}(?![\\w-])`, 'g'), `\u0000${i}\u0000`)
  })
  // class="notranslate" is honoured by Azure and Google; translate="no" by Google.
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<span class="notranslate" translate="no">${escape(sorted[Number(i)])}</span>`)
}

// Groups HTML blocks into chunks no longer than `max` characters (a single
// oversized block is kept whole rather than cut mid-sentence).
export function chunk(blocks: string[], max: number) {
  const out: string[] = []
  let cur = ''
  for (const b of blocks) {
    if (cur && cur.length + b.length + 1 > max) {
      out.push(cur)
      cur = ''
    }
    cur = cur ? `${cur}\n${b}` : b
  }
  if (cur) out.push(cur)
  return out
}

// Translates a product with a service that takes a list of HTML strings and
// returns them translated, in order.
export async function translateWithMachine(
  input: TranslationInput,
  target: TargetLanguage,
  translateHtml: (html: string[], target: TargetLanguage) => Promise<string[]>,
  maxChunk = 4500,
): Promise<TranslationOutput> {
  const keep = [...(input.brand ? [input.brand] : []), ...latinTerms(input.title)]
  const descriptionChunks = chunk(textToHtmlBlocks((input.description ?? '').slice(0, LIMITS.description)), maxChunk).map((c) => protect(c, keep))
  const parts = [protect(escape(input.title), keep), protect(escape(input.shortDescription ?? ''), keep), ...descriptionChunks]
  const out = await translateHtml(parts, target)
  if (out.length !== parts.length) throw new TranslationError('The translation service returned an unexpected response.')
  const plain = (html: string) => htmlToText(html).text ?? ''
  const title = plain(out[0]).replace(/\s*\n\s*/g, ' ')
  if (!title) throw new TranslationError('Translation is missing a title.')
  const short = plain(out[1]).replace(/\s*\n\s*/g, ' ') || null
  const description = descriptionChunks.length ? plain(out.slice(2).join('\n')) || null : null
  const firstParagraph = description?.split(/\n{2,}/).find((p) => !p.startsWith('###') && p.length > 20)?.replace(/\*\*/g, '') ?? null
  return {
    title: clip(title, LIMITS.title),
    shortDescription: short ? clip(short, LIMITS.shortDescription) : null,
    description: description ? clip(description, LIMITS.description) : null,
    seoTitle: clip(title, LIMITS.seoTitle),
    seoDescription: clip(short ?? firstParagraph ?? title, LIMITS.seoDescription),
    imageAlt: clip(title, LIMITS.imageAlt),
  }
}
