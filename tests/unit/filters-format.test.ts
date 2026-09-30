import { describe, expect, it } from 'vitest'
import { filtersToSearchParams, parseFilters } from '@/lib/filters'
import { formatPrice, slugify } from '@/lib/format'
import { friendlyError, genericError } from '@/lib/errors'
import { renderEmail } from '@/lib/email/templates'

describe('parseFilters', () => {
  it('parses shareable URL filters', () => {
    const f = parseFilters({ category: 'gaming', sort: 'trending', price_max: '500', deal: '1', page: '2' })
    expect(f).toMatchObject({ category: 'gaming', sort: 'trending', price_max: 500, deal: true, page: 2 })
  })
  it('ignores invalid values instead of failing', () => {
    const f = parseFilters({ category: 'DROP TABLE', sort: 'nonsense', price_min: '-5', rating: 'abc', page: '0' })
    expect(f.category).toBeUndefined()
    expect(f.sort).toBeUndefined()
    expect(f.price_min).toBeUndefined()
    expect(f.rating).toBeUndefined()
  })
  it('round-trips to query params', () => {
    const sp = filtersToSearchParams({ category: 'audio', deal: true, discount: false, page: 1 })
    expect(sp.toString()).toBe('category=audio&deal=1')
  })
})

describe('format helpers', () => {
  it('slugifies', () => {
    expect(slugify('Lumen & Oak Solstice Lamp!')).toBe('lumen-and-oak-solstice-lamp')
    expect(slugify('  Café  Crème ')).toBe('cafe-creme')
  })
  it('formats prices', () => {
    expect(formatPrice(149, 'USD')).toBe('$149')
    expect(formatPrice(19.5, 'USD')).toBe('$19.50')
    expect(formatPrice(null)).toBeNull()
  })
})

describe('friendlyError', () => {
  it('shows our own database messages', () => {
    expect(friendlyError({ message: 'LOUPE:FORBIDDEN', details: 'You cannot do that.' })).toBe('You cannot do that.')
  })
  it('never exposes raw database errors', () => {
    expect(friendlyError({ message: 'relation "secret_table" does not exist', code: '42P01' })).toBe(genericError)
    expect(friendlyError({ message: 'new row violates row-level security policy', code: '42501' })).toBe("You don't have permission to perform this action.")
  })
})

describe('email templates', () => {
  it('escapes user-controlled values', () => {
    const email = renderEmail('changes_requested', { product_name: '<script>x</script>', message: '"quoted" & <b>', link: '/seller/submissions/1' })!
    expect(email.html).not.toContain('<script>x</script>')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;')
  })
  it('only links to our own site', () => {
    const email = renderEmail('product_published', { product_name: 'X', link: 'https://evil.example/phish' })!
    expect(email.html).not.toContain('evil.example')
  })
  it('returns null for unknown templates', () => expect(renderEmail('nope', {})).toBeNull())
})
