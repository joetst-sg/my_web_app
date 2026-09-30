import { describe, expect, it } from 'vitest'
import { escapeLike, httpsUrl, isSafeHttpsUrl, safeNext, videoEmbedUrl, videoProvider } from '@/lib/validation'

describe('isSafeHttpsUrl', () => {
  it.each([
    ['https://store.example.com/p/1', true],
    ['https://shop.co.uk', true],
    ['http://store.example.com', false],
    ['javascript:alert(1)', false],
    ['data:text/html,hi', false],
    ['https://user:pass@example.com', false],
    ['https://localhost/admin', false],
    ['https://192.168.1.10', false],
    ['https://10.0.0.1/x', false],
    ['ftp://example.com', false],
    ['not a url', false],
  ])('%s -> %s', (url, ok) => expect(isSafeHttpsUrl(url)).toBe(ok))

  it('gives a friendly message', () => {
    const r = httpsUrl.safeParse('http://example.com')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Please enter a valid HTTPS URL (it must start with https://).')
  })
})

describe('safeNext (open redirect protection)', () => {
  it.each([
    ['/account', '/account'],
    ['/products?x=1', '/products?x=1'],
    ['//evil.com', '/'],
    ['https://evil.com', '/'],
    ['/\\evil.com', '/'],
    [null, '/'],
    ['', '/'],
  ])('%s -> %s', (input, out) => expect(safeNext(input)).toBe(out))
})

describe('escapeLike', () => {
  it('escapes wildcards', () => expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\'))
})

describe('video helpers', () => {
  it('detects providers', () => {
    expect(videoProvider('https://www.youtube.com/watch?v=abc')).toBe('youtube')
    expect(videoProvider('https://vimeo.com/123')).toBe('vimeo')
    expect(videoProvider('https://example.com/v.mp4')).toBe('other')
  })
  it('builds privacy-friendly embed URLs', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123')
    expect(videoEmbedUrl('https://youtu.be/xyz')).toBe('https://www.youtube-nocookie.com/embed/xyz')
    expect(videoEmbedUrl('https://vimeo.com/42')).toBe('https://player.vimeo.com/video/42')
    expect(videoEmbedUrl('https://vimeo.com/not-a-number')).toBeNull()
    expect(videoEmbedUrl('https://example.com/v')).toBeNull()
  })
})
