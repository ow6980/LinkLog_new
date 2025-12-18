/**
 * 유사도 기반 키워드 추천 유틸리티
 * 입력한 아이디어와 유사한 기존 아이디어들의 키워드를 추천합니다.
 */

interface Idea {
  id: string
  title: string
  content: string | null
  keywords: string[]
  created_at?: string
}

/**
 * 텍스트 유사도 계산 함수 (0 ~ 1 사이의 값)
 */
const calculateSimilarity = (text1: string, text2: string): number => {
  // 한국어와 영어 모두 처리
  const koreanWordRegex = /[\uAC00-\uD7A3]+|[a-zA-Z0-9]+/g
  
  const words1 = new Set((text1.match(koreanWordRegex) || []).map(w => w.toLowerCase()))
  const words2 = new Set((text2.match(koreanWordRegex) || []).map(w => w.toLowerCase()))
  
  // 공통 단어 계산
  const commonWords = new Set([...words1].filter(word => words2.has(word)))
  
  // Jaccard 유사도: 교집합 / 합집합
  const union = new Set([...words1, ...words2])
  
  if (union.size === 0) {
    // 단어가 없으면 문자 단위로 비교 (한국어 처리)
    const chars1 = new Set(text1.replace(/\s/g, '').split(''))
    const chars2 = new Set(text2.replace(/\s/g, '').split(''))
    const commonChars = new Set([...chars1].filter(char => chars2.has(char)))
    const unionChars = new Set([...chars1, ...chars2])
    
    if (unionChars.size === 0) return 0
    return commonChars.size / unionChars.size
  }
  
  return commonWords.size / union.size
}

/**
 * 입력한 아이디어와 유사한 기존 아이디어들의 키워드를 추천합니다.
 * @param inputText 입력한 아이디어 텍스트
 * @param existingIdeas 기존 아이디어 배열
 * @param maxSuggestions 최대 추천 키워드 개수 (기본값: 7)
 * @param similarityThreshold 유사도 임계값 (기본값: 0.1)
 * @returns 추천 키워드 배열
 */
export function suggestSimilarKeywords(
  inputText: string,
  existingIdeas: Idea[],
  maxSuggestions: number = 7,
  similarityThreshold: number = 0.1
): string[] {
  if (!inputText.trim() || existingIdeas.length === 0) {
    return []
  }

  // 입력 텍스트와 각 아이디어의 유사도 계산
  const ideaSimilarities: Array<{ idea: Idea; similarity: number }> = []
  
  existingIdeas.forEach(idea => {
    const ideaText = `${idea.title} ${idea.content || ''}`.trim()
    if (!ideaText) return
    
    const similarity = calculateSimilarity(inputText, ideaText)
    if (similarity >= similarityThreshold) {
      ideaSimilarities.push({ idea, similarity })
    }
  })

  // 유사도 순으로 정렬
  ideaSimilarities.sort((a, b) => b.similarity - a.similarity)

  // 키워드 추출 및 점수 계산
  const keywordScores = new Map<string, number>()
  
  ideaSimilarities.forEach(({ idea, similarity }) => {
    if (idea.keywords && idea.keywords.length > 0) {
      idea.keywords.forEach(keyword => {
        if (keyword && keyword.trim()) {
          // 유사도가 높을수록 더 높은 점수 부여
          const currentScore = keywordScores.get(keyword) || 0
          keywordScores.set(keyword, currentScore + similarity)
        }
      })
    }
  })

  // 점수 순으로 정렬하고 상위 키워드 반환
  return Array.from(keywordScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSuggestions)
    .map(([keyword]) => keyword)
    .filter(k => k && k.trim().length > 0)
}

