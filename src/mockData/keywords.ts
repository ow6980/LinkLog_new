// 전체 프로그램에서 사용 가능한 키워드 목록 (최대 7개)
export const AVAILABLE_KEYWORDS = [
  "Technology",
  "Innovation",
  "Data",
  "Design",
  "Business",
  "Research",
  "Development"
] as const

export type Keyword = typeof AVAILABLE_KEYWORDS[number]
