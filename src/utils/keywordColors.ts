import variablesData from '../variables.json'

// variables.json에서 색상 추출 (RGB를 HEX로 변환)
const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const extractTagColors = () => {
  const tagColors: Record<string, string> = {}
  variablesData.variables.forEach((variable: any) => {
    if (variable.name.startsWith('color/tag/')) {
      const colorName = variable.name.replace('color/tag/', '')
      const rgb = variable.resolvedValuesByMode['12:0'].resolvedValue
      tagColors[colorName] = rgbToHex(rgb.r, rgb.g, rgb.b)
    }
  })
  return tagColors
}

const TAG_COLORS = extractTagColors()

// 사용 가능한 색상 목록 (키워드가 많을 경우 순환 사용)
export const AVAILABLE_COLORS = [
  TAG_COLORS.red || '#ff4848',
  TAG_COLORS.orange || '#ffae2b',
  TAG_COLORS.yellow || '#ffff06',
  TAG_COLORS.skyblue || '#0de7ff',
  TAG_COLORS.violet || '#8a38f5',
  TAG_COLORS.green || '#77ff00',
  TAG_COLORS.blue || '#0d52ff',
]

const extractGrayColors = () => {
  const grayColors: Record<string, string> = {}
  variablesData.variables.forEach((variable: any) => {
    if (variable.name.startsWith('color/gray/')) {
      const grayLevel = variable.name.replace('color/gray/', '')
      const rgb = variable.resolvedValuesByMode['12:0'].resolvedValue
      grayColors[grayLevel] = rgbToHex(rgb.r, rgb.g, rgb.b)
    }
  })
  return grayColors
}

export const GRAY_COLORS = extractGrayColors()

// 키워드 이름을 해시하여 일관된 색상 할당
const hashKeyword = (keyword: string): number => {
  let hash = 0
  for (let i = 0; i < keyword.length; i++) {
    const char = keyword.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * 키워드 이름을 기반으로 일관된 색상을 반환합니다.
 * 같은 키워드는 항상 같은 색상을 가집니다.
 * @param keyword 키워드 이름
 * @returns 키워드에 할당된 색상 (HEX)
 */
export const getKeywordColor = (keyword: string): string => {
  if (!keyword || keyword === 'ungrouped') {
    return GRAY_COLORS['500'] || '#666666'
  }
  
  // 키워드 이름을 해시하여 색상 인덱스 결정
  const hash = hashKeyword(keyword)
  const colorIndex = hash % AVAILABLE_COLORS.length
  
  return AVAILABLE_COLORS[colorIndex]
}

/**
 * 여러 키워드에 대한 색상 맵을 생성합니다.
 * @param keywords 키워드 배열
 * @returns 키워드 -> 색상 맵
 */
export const createKeywordColorMap = (keywords: string[]): Map<string, string> => {
  const colorMap = new Map<string, string>()
  
  keywords.forEach(keyword => {
    if (keyword && keyword !== 'ungrouped' && !colorMap.has(keyword)) {
      colorMap.set(keyword, getKeywordColor(keyword))
    }
  })
  
  return colorMap
}

