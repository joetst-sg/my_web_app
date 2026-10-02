// Builds a short Japanese summary of a campaign (introduction + key
// features) from its description. Only this summary, the title and the
// short description are sent for translation, which keeps machine
// translation usage small.
//
// Never included: support plans / rewards, prices, crowdfunding figures,
// shipping and payment details, and filler such as review-video intros.
// It only selects and trims the campaign's own sentences — nothing is
// rewritten or invented.

import { decodeEntities } from './parse'

// Sections whose heading matches are skipped entirely.
const SKIP_SECTION = /リターン|支援|プラン|価格|料金|特典|スケジュール|配送|発送|お届け|注意|警告|保証|よくある|質問|Q\s*&\s*A|FAQ|会社概要|運営|製造|販売元|プロフィール|経歴|起案者|メディア掲載|実績|レビュー|動画|リスク|最後に|おわりに|ごあいさつ|ご挨拶|お問い合わせ|ストレッチ|達成|イベント|体験会|展示|店舗/i

// Sentences matching any of these are dropped.
const PRICE = /[¥￥]\s*[\d,]|[\d,]+\s*円|税込|税抜|送料|早割|割引|%\s*OFF|％\s*OFF|\bOFF\b|月々|分割|価格|定価|ポイント還元/i
const CROWDFUNDING = /支援|リターン|クラウドファンディング|クラファン|応援購入|目標金額|ストレッチ|募集|GREEN\s*FUNDING|グリーンファンディング/i
const LOGISTICS = /発送|お届け|配送|出荷|納期|お支払|決済|キャンセル|返品|特定商取引|お問い合わせ/
const FILLER = /YouTube|ユーチューブ|動画|レビュー|Instagram|インスタ|Twitter|ツイッター|SNS|フォロー|こちら|詳しくは|下記|上記|URL|https?:\/\/|イメージです|画像は/i
const META_HEADING = /(の特徴|について|とは|概要|はじめに|ポイント|紹介)$|^特徴$|^主な特徴$/
// Headings that are questions, dates, schedules, events, audience notes or notices.
const NOISE_HEADING = /^Q\s*\d|[?？]$|\d{1,2}\s*月\s*(末|上旬|中旬|下旬|\d)|\d{1,2}\s*\/\s*\d{1,2}|（[月火水木金土日]）|開始|終了|開催|体験|オススメ|おすすめ|こんな(かた|方|人)|製造|販売元|警告|注意|保証|商品情報|企画|デザイン|監修|^仕様$/

// English-only headings on Japanese pages duplicate the Japanese ones.
const ENGLISH_ONLY = /^[\x20-\x7E]+$/

const isHeading = (block: string) => /^###\s/.test(block) || (/^\*\*[^*]+\*\*$/.test(block) && block.length <= 80)

function cleanHeading(block: string) {
  return block
    .replace(/^###\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^[\s■◼️◼◆◇●○▼▶▷★☆◎・\-–—―#]+/u, '')
    .replace(/^NEW!?\s*[｜|:：]\s*/i, '')
    .replace(/[【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Sentences of a block; lines without closing punctuation get a "。" so
// joined sentences don't run together.
function sentences(block: string) {
  return block
    .replace(/\*\*/g, '')
    .split(/(?<=[。！？!?])\s*|\n+/)
    .map((s) => s.replace(/^[\s•・\-*]+/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((s) => (/[。！？!?」』）)”]$/.test(s) ? s : `${s}。`))
}

const allowedSentence = (s: string) =>
  s.length >= 8 && !s.startsWith('※') && !/^A\s*[.．:：]/.test(s) && !/[*＊]\s*\d|&sup\d;|[¹²³⁴⁵]/.test(s.slice(0, 3)) && !PRICE.test(s) && !CROWDFUNDING.test(s) && !LOGISTICS.test(s) && !FILLER.test(s)

// Removes footnote markers like "*¹" or "*&sup2;" left inside sentences.
const stripFootnotes = (s: string) => s.replace(/[*＊](?:&sup\d;|[¹²³⁴⁵⁶⁷⁸⁹]|\d)/g, '').replace(/&sup\d;/g, '')

function clipSentence(s: string, max: number) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const end = Math.max(cut.lastIndexOf('、'), cut.lastIndexOf('，'), cut.lastIndexOf(' '))
  return `${cut.slice(0, end > max * 0.5 ? end : max - 1)}…`
}

// Short description without prices or crowdfunding talk (max 200 characters).
export function cleanShortDescription(short: string | null): string | null {
  if (!short) return null
  const kept = sentences(decodeEntities(short)).filter((s) => !PRICE.test(s) && !CROWDFUNDING.test(s) && !LOGISTICS.test(s)).map(stripFootnotes).join('')
  if (!kept) return null
  return kept.length > 200 ? clipSentence(kept, 200) : kept
}

export function buildJapaneseSummary(description: string | null, maxChars = 400): string | null {
  if (!description) return null
  // Headings sometimes appear in the middle of a line ("…しました。 ### 特徴").
  const normalized = decodeEntities(description).replace(/[ \t]*\n?[ \t]*(?=###\s)/g, '\n\n')
  const blocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)

  const intro: string[] = []
  const features: string[] = []
  let skipping = false
  let introDone = false
  for (const block of blocks) {
    if (isHeading(block)) {
      const heading = cleanHeading(block)
      // Question headings (Q1., …？) start FAQ sections, which are skipped too.
      skipping = SKIP_SECTION.test(heading) || /^Q\s*\d|[?？]$/.test(heading)
      if (intro.length) introDone = true
      if (!skipping && heading.length >= 2 && heading.length <= 60 && !ENGLISH_ONLY.test(heading) && !META_HEADING.test(heading) && !NOISE_HEADING.test(heading) && !PRICE.test(heading) && !CROWDFUNDING.test(heading) && !FILLER.test(heading)) {
        features.push(heading)
      }
      continue
    }
    if (skipping) continue
    const kept = sentences(block).filter(allowedSentence).map(stripFootnotes)
    // Short "label：value" lines are features/specs, not introduction.
    for (const s of kept) {
      if (/^[^。]{2,40}[：:]\s*\S/.test(s) && s.length <= 70) features.push(s.replace(/。$/, ''))
      else if (!introDone) intro.push(s)
    }
  }

  const uniqueFeatures = [...new Set(features)]
  const introBudget = uniqueFeatures.length ? Math.round(maxChars * 0.55) : maxChars
  let introText = ''
  for (const s of intro) {
    if (introText.length + s.length > introBudget) {
      if (!introText) introText = clipSentence(s, introBudget)
      break
    }
    introText += s
  }

  const lines: string[] = []
  let used = introText.length
  for (const f of uniqueFeatures.slice(0, 10)) {
    const line = `• ${clipSentence(f, 60)}`
    if (used + line.length + 1 > maxChars) break
    lines.push(line)
    used += line.length + 1
  }
  // No usable introduction: fall back to the first feature-free sentences.
  if (!introText && !lines.length) return null
  return [introText, lines.length ? `### 主な特徴\n\n${lines.join('\n')}` : ''].filter(Boolean).join('\n\n')
}
