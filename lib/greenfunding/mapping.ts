// Category and tag mapping (source label → our taxonomy).

export type CategoryMapping = { source_category: string; category_id: string | null; priority: number }

// The best mapped category for a campaign, or null when none of its
// categories is mapped (the product then needs category review).
export function resolveCategory(sourceCategories: string[], mappings: CategoryMapping[], maxPriority = Infinity): string | null {
  const candidates = mappings
    .filter((m) => m.category_id && sourceCategories.includes(m.source_category) && m.priority < maxPriority)
    .sort((a, b) => a.priority - b.priority)
  return candidates[0]?.category_id ?? null
}

// Keyword rules (Japanese and English) for campaigns whose GREEN FUNDING
// categories don't map to anything specific. First match wins; the title is
// checked before the summary.
export const KEYWORD_RULES: [RegExp, string][] = [
  [/ヘッドホン|ヘッドフォン|イヤホン|イヤフォン|スピーカー|集音|オーディオ|サウンド|headphone|earbud|speaker|audio/i, 'audio'],
  [/カメラ|レンズ|三脚|ジンバル|ドローン|撮影|camera|lens|tripod|gimbal|drone/i, 'photography'],
  [/キーボード|keyboard/i, 'keyboards'],
  [/スマートウォッチ|ウォッチ|指輪|リング型|ウェアラブル|smart ?watch|wearable|smart ?ring/i, 'wearables'],
  [/ゲーミング|ゲーム機|コントローラー|gaming|game controller/i, 'gaming'],
  [/ドラレコ|ドライブレコーダー|カー用品|車載|バイク|dash ?cam/i, 'automotive'],
  [/キャンプ|テント|登山|アウトドア|釣り|camping|tent|hiking|outdoor/i, 'outdoor'],
  [/スーツケース|旅行|トラベル|機内|suitcase|travel|luggage/i, 'travel'],
  [/フィットネス|トレーニング|筋トレ|ランニング|ヨガ|fitness|workout|running|yoga/i, 'fitness'],
  [/睡眠|マッサージ|美容|ヘルスケア|sleep|massage|wellness/i, 'health-wellness'],
  [/キッチン|調理|料理|フライパン|コーヒー|炊飯|kitchen|cooking|coffee/i, 'kitchen'],
  [/照明|ライト|掃除機|空気清浄|加湿|除湿|スマートホーム|家電|smart home|vacuum|purifier|lighting/i, 'smart-home'],
  [/ソーラー|太陽光|リサイクル|サステナブル|solar|recycl|sustainab/i, 'eco-tech'],
  [/PC|パソコン|ノートPC|モニター|デスク|SSD|USB|ハブ|ドック|充電器|monitor|desk|laptop|dock|charger/i, 'office'],
  [/写真集|雑誌|書籍|出版|本を|photobook|magazine|book/i, 'books'],
  [/模型|プラモデル|フィギュア|かるた|カードゲーム|ボードゲーム|パズル|おもちゃ|model kit|figure|board game|puzzle|toy/i, 'hobbies'],
  [/\bAI\b|AI搭載|人工知能/i, 'ai-gadgets'],
]

export function categoryFromKeywords(title: string | null, summary: string | null): string | null {
  for (const text of [title ?? '', summary ?? '']) {
    for (const [re, slug] of KEYWORD_RULES) if (re.test(text)) return slug
  }
  return null
}

// Picks a category: a specific mapping first (priority < 80), then keywords
// in the title/summary, then a broad mapping (雑貨, ライフスタイル…).
export const BROAD_MAPPING_PRIORITY = 80

export function chooseCategory(
  input: { sourceCategories: string[]; title: string | null; summary: string | null },
  mappings: CategoryMapping[],
  slugToId: Map<string, string>,
): string | null {
  const specific = resolveCategory(input.sourceCategories, mappings, BROAD_MAPPING_PRIORITY)
  if (specific) return specific
  const keyword = categoryFromKeywords(input.title, input.summary)
  if (keyword && slugToId.has(keyword)) return slugToId.get(keyword)!
  return resolveCategory(input.sourceCategories, mappings)
}

// Normalised form used to find an existing tag: NFKC (full-width → half-width),
// lower case, single spaces. Different words are never merged automatically.
export function normalizeTag(label: string) {
  return label.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function tagSlug(label: string) {
  return normalizeTag(label)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
