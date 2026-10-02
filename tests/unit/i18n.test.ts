import { describe, expect, it } from 'vitest'
import { isLocalizablePath, localeFromAcceptLanguage, localizePath, splitLocale } from '@/lib/i18n/config'
import { fromTranslations, localized } from '@/lib/i18n/content'
import { dictionaries } from '@/lib/i18n/dictionaries'
import { en } from '@/lib/i18n/dictionaries/en'
import { translateNotificationText } from '@/lib/i18n/notifications'
import { createTranslator } from '@/lib/i18n/translate'

const zh = createTranslator('zh-HK', dictionaries['zh-HK'], en)
const enT = createTranslator('en', en, en)

describe('locale paths', () => {
  it('adds and strips the /zh prefix', () => {
    expect(localizePath('/products', 'zh-HK')).toBe('/zh/products')
    expect(localizePath('/', 'zh-HK')).toBe('/zh')
    expect(localizePath('/?q=1', 'zh-HK')).toBe('/zh?q=1')
    expect(localizePath('/zh/products', 'en')).toBe('/products')
    expect(localizePath('/zh/products', 'zh-HK')).toBe('/zh/products')
    expect(splitLocale('/zh/brands/x')).toMatchObject({ locale: 'zh-HK', path: '/brands/x' })
    expect(splitLocale('/zhongguo')).toMatchObject({ locale: 'en', path: '/zhongguo' })
  })
  it('leaves admin, API and external links alone', () => {
    expect(localizePath('/admin/products', 'zh-HK')).toBe('/admin/products')
    expect(localizePath('/api/track', 'zh-HK')).toBe('/api/track')
    expect(localizePath('https://example.com', 'zh-HK')).toBe('https://example.com')
    expect(localizePath('//example.com', 'zh-HK')).toBe('//example.com')
    expect(isLocalizablePath('/sitemap.xml')).toBe(false)
  })
})

describe('browser language detection', () => {
  it.each([
    ['zh-HK,zh;q=0.9,en;q=0.8', 'zh-HK'],
    ['zh-TW', 'zh-HK'],
    ['zh-Hant-HK', 'zh-HK'],
    ['en-GB,en;q=0.9', 'en'],
    ['zh-CN,zh;q=0.9', null],
    ['', null],
  ])('%s → %s', (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected)
  })
})

describe('translator', () => {
  it('interpolates variables', () => {
    expect(enT('account.overview.hi', { name: 'Ada' })).toBe('Hi Ada')
    expect(zh('account.overview.hi', { name: 'Ada' })).toBe('你好，Ada')
  })
  it('falls back to English for missing keys', () => {
    const partial = createTranslator('zh-HK', { common: {} }, en)
    expect(partial('common.save')).toBe('Save')
  })
})

describe('dictionaries', () => {
  const keys = (o: object, prefix = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
  it('zh-HK has exactly the English keys, all non-empty', () => {
    const zhDict = dictionaries['zh-HK']
    expect(keys(zhDict).sort()).toEqual(keys(en).sort())
    for (const k of keys(zhDict)) {
      const value = k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], zhDict)
      expect(value, k).not.toBe('')
    }
  })
  it('uses Traditional characters and Hong Kong terms', () => {
    const all = JSON.stringify(dictionaries['zh-HK'])
    // A few common Simplified-only characters that must never appear.
    for (const ch of ['们', '这', '个', '发', '时', '设', '图', '账', '邮', '录']) expect(all).not.toContain(ch)
    expect(all).toContain('電郵')
    expect(all).toContain('登入')
    expect(all).not.toContain('郵箱')
    expect(all).not.toContain('登錄')
  })
})

describe('database content', () => {
  it('reads translations with English fallback', () => {
    const row = { name: 'Audio', translations: { 'zh-HK': { name: '音響' } } }
    expect(localized(row, 'name', 'zh-HK')).toBe('音響')
    expect(localized(row, 'name', 'en')).toBe('Audio')
    expect(localized({ name: 'Audio', translations: {} }, 'name', 'zh-HK')).toBe('Audio')
    expect(fromTranslations({ 'zh-HK': { name: ' ' } }, 'name', 'zh-HK', 'Audio')).toBe('Audio')
  })
})

describe('notifications', () => {
  it('translates known database messages', () => {
    expect(translateNotificationText('"Aero Lamp" is on sale', zh, 'zh-HK')).toBe('「Aero Lamp」正在減價')
    expect(translateNotificationText('Now USD 99 (was 129).', zh, 'zh-HK')).toBe('現價 USD 99（原價 129）。')
  })
  it('keeps English and unknown text as stored', () => {
    expect(translateNotificationText('"Aero Lamp" is on sale', enT, 'en')).toBe('"Aero Lamp" is on sale')
    expect(translateNotificationText('Something custom', zh, 'zh-HK')).toBe('Something custom')
    expect(translateNotificationText(null, zh, 'zh-HK')).toBeNull()
  })
})
