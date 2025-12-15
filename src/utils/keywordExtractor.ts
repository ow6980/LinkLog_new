/**
 * 텍스트에서 의미있는 키워드를 추출하는 유틸리티
 * 한국어와 영어를 모두 지원하며, 단순 단어가 아닌 의미있는 키워드를 추출합니다.
 */

// 불용어 목록 (제거할 단어들)
const STOP_WORDS_KO = new Set([
  '이', '가', '을', '를', '에', '의', '와', '과', '으로', '로', '에서', '에게', '께서',
  '은', '는', '도', '만', '부터', '까지', '보다', '처럼', '같이', '또한', '또는', '그리고',
  '그', '이것', '저것', '그것', '이런', '저런', '그런', '이렇게', '저렇게', '그렇게',
  '있다', '없다', '되다', '하다', '이다', '아니다', '있다가', '없다가',
  '것', '수', '때', '곳', '등', '및', '또', '또한'
])

const STOP_WORDS_EN = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'done',
  'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'and', 'or', 'but', 'not', 'no', 'yes', 'if', 'then', 'else',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as',
  'about', 'into', 'through', 'during', 'including', 'against', 'among',
  'i', 'you', 'he', 'she', 'we', 'our', 'my', 'your', 'his', 'her'
])

// 기술 용어 및 중요 단어 패턴
const TECH_PATTERNS = [
  // AI/ML 관련
  /(?:AI|ML|NLP|GPT|BERT|CNN|RNN|LSTM|GAN|DQN|PPO|강화학습|머신러닝|딥러닝|인공지능|자연어처리|컴퓨터비전)/gi,
  // 기술 스택
  /(?:React|Vue|Angular|Node\.?js|Python|Java|TypeScript|JavaScript|Rust|Go|C\+\+|Kotlin|Swift)/gi,
  // 아키텍처/시스템
  /(?:API|REST|GraphQL|WebSocket|마이크로서비스|서버리스|클라우드|엣지컴퓨팅|분산시스템|데이터베이스|그래프데이터베이스)/gi,
  // 개발 도구/프레임워크
  /(?:Docker|Kubernetes|AWS|Lambda|Azure|GCP|CI\/CD|DevOps|테스트|자동화)/gi,
  // 데이터 관련
  /(?:빅데이터|데이터분석|데이터시각화|데이터레이크|데이터처리|데이터마이닝)/gi,
  // 기타 기술 용어
  /(?:블록체인|암호화|보안|인증|인가|웹소켓|실시간|비동기|이벤트처리|모니터링|성능최적화)/gi
]

/**
 * 텍스트에서 의미있는 키워드를 추출
 * @param text 입력 텍스트
 * @param maxKeywords 최대 추출할 키워드 개수 (기본값: 7)
 * @returns 추출된 키워드 배열
 */
export function extractMeaningfulKeywords(text: string, maxKeywords: number = 7): string[] {
  if (!text || !text.trim()) return []

  const keywords: Map<string, number> = new Map()

  // 1. 기술 용어 패턴 추출 (높은 우선순위)
  TECH_PATTERNS.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(match => {
        const normalized = normalizeKeyword(match)
        if (normalized && !isStopWord(normalized)) {
          keywords.set(normalized, (keywords.get(normalized) || 0) + 20) // 기술 용어는 높은 점수
        }
      })
    }
  })

  // 2. 한국어 명사 추출 (한글 + 숫자 조합, 2글자 이상)
  const koreanNouns = extractKoreanNouns(text)
  koreanNouns.forEach(noun => {
    if (!isStopWord(noun) && noun.length >= 2) {
      const score = calculateKeywordScore(noun, text)
      keywords.set(noun, (keywords.get(noun) || 0) + score)
    }
  })

  // 3. 영어 명사/기술 용어 추출
  const englishKeywords = extractEnglishKeywords(text)
  englishKeywords.forEach(keyword => {
    if (!isStopWord(keyword)) {
      const score = calculateKeywordScore(keyword, text)
      keywords.set(keyword, (keywords.get(keyword) || 0) + score)
    }
  })

  // 4. 복합명사 추출 (예: "AI 기반", "머신러닝 알고리즘")
  const compoundNouns = extractCompoundNouns(text)
  compoundNouns.forEach(compound => {
    if (!isStopWord(compound) && compound.length >= 3) {
      const score = calculateKeywordScore(compound, text) * 1.5 // 복합명사는 더 높은 점수
      keywords.set(compound, (keywords.get(compound) || 0) + score)
    }
  })

  // 점수 순으로 정렬하고 상위 키워드 반환
  return Array.from(keywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([keyword]) => keyword)
    .filter(k => k && k.length >= 2)
}

/**
 * 한국어 명사 추출 (조사 제거)
 */
function extractKoreanNouns(text: string): string[] {
  const nouns: string[] = []
  
  // 한글 단어 추출 (2글자 이상)
  const koreanWords = text.match(/[가-힣]{2,}/g) || []
  
  // 조사 패턴 (뒤에 붙는 조사 제거)
  const particles = ['을', '를', '이', '가', '에', '의', '와', '과', '으로', '로', '에서', '에게', '께서', '은', '는', '도', '만', '부터', '까지', '보다', '처럼', '같이']
  
  koreanWords.forEach(word => {
    // 조사 제거
    let cleanedWord = word
    for (const particle of particles) {
      if (cleanedWord.endsWith(particle) && cleanedWord.length > particle.length) {
        cleanedWord = cleanedWord.slice(0, -particle.length)
        break
      }
    }
    
    // 불용어가 아니고 의미있는 단어인지 확인 (최소 2글자)
    if (cleanedWord.length >= 2 && !isStopWord(cleanedWord)) {
      nouns.push(cleanedWord)
    }
  })
  
  return nouns
}

/**
 * 영어 키워드 추출
 */
function extractEnglishKeywords(text: string): string[] {
  const keywords: string[] = []
  
  // 대문자로 시작하는 단어 (고유명사, 기술 용어)
  const capitalizedWords = text.match(/\b[A-Z][a-zA-Z0-9]+\b/g) || []
  capitalizedWords.forEach(word => {
    if (word.length >= 2 && !isStopWord(word.toLowerCase())) {
      keywords.push(word)
    }
  })
  
  // 소문자지만 기술 용어일 수 있는 단어들 (길이가 4 이상인 단어)
  const words = text.match(/\b[a-z]{4,}\b/g) || []
  words.forEach(word => {
    if (!isStopWord(word) && isLikelyTechTerm(word)) {
      keywords.push(word)
    }
  })
  
  return keywords
}

/**
 * 복합명사 추출 (예: "AI 기반", "머신러닝 알고리즘", "데이터 분석", "AI기반")
 */
function extractCompoundNouns(text: string): string[] {
  const compounds: string[] = []
  
  // 패턴 1: 영어 + 공백 + 한글 (예: "AI 기반", "React 개발")
  const pattern1 = text.match(/\b[A-Z][a-zA-Z0-9]+\s+[가-힣]{2,}/g)
  if (pattern1) {
    pattern1.forEach(match => {
      compounds.push(match.trim())
    })
  }
  
  // 패턴 1-2: 영어 + 한글 (공백 없이 붙어있는 경우, 예: "AI기반", "React개발")
  const pattern1b = text.match(/\b[A-Z][a-zA-Z0-9]+[가-힣]{2,}/g)
  if (pattern1b) {
    pattern1b.forEach(match => {
      // 영어 부분과 한글 부분 분리
      const matchResult = match.match(/^([A-Z][a-zA-Z0-9]+)([가-힣]{2,})$/);
      if (matchResult) {
        const [, engPart, korPart] = matchResult
        // 둘 다 의미있는 경우만 추가
        if (engPart.length >= 2 && korPart.length >= 2) {
          compounds.push(match.trim())
        }
      }
    })
  }
  
  // 패턴 2: 한글 + 공백 + 한글 (예: "머신러닝 알고리즘", "데이터 분석")
  const pattern2 = text.match(/[가-힣]{2,}\s+[가-힣]{2,}/g)
  if (pattern2) {
    pattern2.forEach(match => {
      const words = match.trim().split(/\s+/)
      if (words.length === 2 && words.every(w => w.length >= 2)) {
        compounds.push(match.trim())
      }
    })
  }
  
  // 패턴 3: 한글 + 공백 + 영어 (예: "개인화 추천", "실시간 모니터링")
  const pattern3 = text.match(/[가-힣]{2,}\s+[A-Z][a-zA-Z0-9]+/g)
  if (pattern3) {
    pattern3.forEach(match => {
      compounds.push(match.trim())
    })
  }
  
  // 패턴 3-2: 한글 + 영어 (공백 없이 붙어있는 경우, 예: "개인화추천", "실시간모니터링")
  const pattern3b = text.match(/[가-힣]{2,}[A-Z][a-zA-Z0-9]+/g)
  if (pattern3b) {
    pattern3b.forEach(match => {
      // 한글 부분과 영어 부분 분리
      const matchResult = match.match(/^([가-힣]{2,})([A-Z][a-zA-Z0-9]+)$/);
      if (matchResult) {
        const [, korPart, engPart] = matchResult
        // 둘 다 의미있는 경우만 추가
        if (korPart.length >= 2 && engPart.length >= 2) {
          compounds.push(match.trim())
        }
      }
    })
  }
  
  return compounds
}

/**
 * 키워드 점수 계산 (빈도, 위치, 길이 등을 고려)
 */
function calculateKeywordScore(keyword: string, text: string): number {
  let score = 0
  
  // 한글 키워드인지 영어 키워드인지 확인
  const hasKorean = /[가-힣]/.test(keyword)
  const hasEnglish = /[a-zA-Z]/.test(keyword)
  
  // 1. 빈도수 계산 (한글과 영어를 다르게 처리)
  let frequency = 0
  if (hasKorean && hasEnglish) {
    // 한글-영어 혼용 키워드: 정확한 매칭
    const regex = new RegExp(escapeRegex(keyword), 'gi')
    frequency = (text.match(regex) || []).length
  } else if (hasKorean) {
    // 한글 키워드: word boundary 대신 직접 매칭 (한글은 word boundary가 제대로 작동 안함)
    const regex = new RegExp(escapeRegex(keyword), 'g')
    frequency = (text.match(regex) || []).length
  } else {
    // 영어 키워드: word boundary 사용
    const keywordLower = keyword.toLowerCase()
    const textLower = text.toLowerCase()
    const regex = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'gi')
    frequency = (textLower.match(regex) || []).length
  }
  score += frequency * 5
  
  // 2. 문장 앞부분에 나타나는 경우 (더 중요)
  const firstSentence = text.split(/[.!?。！？\n]/)[0] || ''
  if (hasKorean) {
    if (firstSentence.includes(keyword)) {
      score += 10
    }
  } else {
    if (firstSentence.toLowerCase().includes(keyword.toLowerCase())) {
      score += 10
    }
  }
  
  // 3. 제목/첫 부분에 나타나는 경우
  const first100Chars = text.substring(0, 100)
  if (hasKorean) {
    if (first100Chars.includes(keyword)) {
      score += 5
    }
  } else {
    if (first100Chars.toLowerCase().includes(keyword.toLowerCase())) {
      score += 5
    }
  }
  
  // 4. 키워드 길이 (너무 짧거나 길면 감점)
  if (keyword.length >= 3 && keyword.length <= 20) {
    score += 3
  }
  
  return score
}

/**
 * 기술 용어일 가능성이 있는지 확인
 */
function isLikelyTechTerm(word: string): boolean {
  const techSuffixes = ['ing', 'tion', 'ment', 'ness', 'ity', 'er', 'or', 'al', 'ic', 'ive']
  const techPrefixes = ['auto', 'micro', 'multi', 'hyper', 'super', 'meta', 'neo', 'proto']
  
  return techSuffixes.some(suffix => word.endsWith(suffix)) ||
         techPrefixes.some(prefix => word.startsWith(prefix)) ||
         word.length >= 6 // 긴 단어는 기술 용어일 가능성이 높음
}

/**
 * 키워드 정규화
 */
function normalizeKeyword(keyword: string): string {
  return keyword.trim()
    .replace(/\s+/g, ' ') // 여러 공백을 하나로
    .replace(/[.,;:!?()[\]{}'"]/g, '') // 구두점 제거
}

/**
 * 불용어 확인
 */
function isStopWord(word: string): boolean {
  const normalized = word.toLowerCase().trim()
  return STOP_WORDS_KO.has(normalized) || STOP_WORDS_EN.has(normalized)
}

/**
 * 정규식 이스케이프
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

