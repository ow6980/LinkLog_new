import { useState, useEffect, useRef } from 'react'
import './MainPage.css'

const MainPage = () => {
  const [ideaInput, setIdeaInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 주제/키워드 자동 추출 (의미 기반 주제 추출)
  const extractKeywords = (text: string): string[] => {
    if (!text.trim()) return []

    // 불용어 제거 (영어/한국어 공통)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      '이', '가', '을', '를', '에', '의', '와', '과', '도', '로', '으로', '에서',
      '그', '이', '저', '것', '수', '것', '때', '곳', '등', '및', '또한', '그리고',
      '하는', '하는데', '한다', '하다', '된다', '되다', '있다', '없다', '같다', '이다'
    ])

    const candidates: Array<{ text: string; score: number }> = []

    // 1. 명사구/복합어 추출 (2-3단어 조합)
    // 영어: 대문자로 시작하는 연속 단어 (고유명사, 전문용어)
    const properNounPhrases = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) || []
    properNounPhrases.forEach(phrase => {
      const cleaned = phrase.trim()
      if (cleaned.length > 3 && !selectedKeywords.includes(cleaned)) {
        candidates.push({ text: cleaned, score: 10 }) // 명사구는 높은 점수
      }
    })

    // 영어: 일반 명사구 패턴 (형용사/명사 + 명사)
    const commonPhrases = text.match(/\b([a-z]+(?:\s+[a-z]+){1,2})\b/gi) || []
    commonPhrases.forEach(phrase => {
      const cleaned = phrase.trim().toLowerCase()
      const words = cleaned.split(/\s+/)
      // 불용어가 포함되지 않은 경우만
      if (words.length > 1 && words.every(w => !stopWords.has(w) && w.length > 2)) {
        const original = phrase.trim()
        if (!candidates.some(c => c.text.toLowerCase() === cleaned) && 
            !selectedKeywords.includes(original)) {
          candidates.push({ text: original, score: 5 })
        }
      }
    })

    // 한국어: 명사구 패턴
    const koreanPhrases = text.match(/([가-힣]+(?:\s+[가-힣]+){1,2})/g) || []
    koreanPhrases.forEach(phrase => {
      const cleaned = phrase.trim()
      if (cleaned.length > 2 && !selectedKeywords.includes(cleaned)) {
        // 이미 단일 단어로 추출될 예정이면 제외
        if (cleaned.split(/\s+/).length > 1) {
          candidates.push({ text: cleaned, score: 5 })
        }
      }
    })

    // 2. 핵심 단어 추출 (문장 구조 기반)
    const sentences = text.split(/[.!?。！？\n]/).filter(s => s.trim().length > 0)
    
    sentences.forEach((sentence) => {
      const words = sentence
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2)

      words.forEach((word, wordIndex) => {
        const lowerWord = word.toLowerCase()
        if (!stopWords.has(lowerWord)) {
          // 대문자로 시작하는 단어는 더 중요 (고유명사, 전문용어)
          const isProperNoun = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()
          // 문장 앞부분에 위치한 단어는 더 중요 (주제는 보통 앞에)
          const positionScore = Math.max(1, words.length - wordIndex)
          const score = isProperNoun ? positionScore * 3 : positionScore
          
          // 이미 명사구에 포함된 단어는 제외
          const isInPhrase = candidates.some(c => 
            c.text.toLowerCase().includes(lowerWord) && c.text !== word
          )
          
          if (!isInPhrase && !selectedKeywords.includes(word)) {
            const existing = candidates.find(c => c.text.toLowerCase() === lowerWord)
            if (existing) {
              existing.score += score
            } else {
              candidates.push({ text: word, score })
            }
          }
        }
      })
    })

    // 3. 빈도 기반 추가 점수
    candidates.forEach(candidate => {
      const regex = new RegExp(`\\b${candidate.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        candidate.score += matches.length
      }
    })

    // 4. 점수 순으로 정렬하고 상위 6개 선택
    const sorted = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(c => c.text)
      .filter(k => k && !selectedKeywords.includes(k))

    return sorted
  }

  useEffect(() => {
    if (ideaInput) {
      const extracted = extractKeywords(ideaInput)
      setSuggestedKeywords(extracted)
    } else {
      setSuggestedKeywords([])
    }
  }, [ideaInput, selectedKeywords])

  // textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [ideaInput])


  const handleKeywordSelect = (keyword: string) => {
    if (!selectedKeywords.includes(keyword)) {
      setSelectedKeywords([...selectedKeywords, keyword])
      setSuggestedKeywords(suggestedKeywords.filter((k: string) => k !== keyword))
    }
  }

  const handleKeywordRemove = (keyword: string) => {
    setSelectedKeywords(selectedKeywords.filter((k: string) => k !== keyword))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!ideaInput.trim()) {
      return
    }

    const newIdea = {
      id: Date.now().toString(),
      title: ideaInput.split('\n')[0].substring(0, 50),
      content: ideaInput,
      keywords: selectedKeywords,
      createdAt: new Date().toISOString(),
    }

    const existingIdeas = JSON.parse(
      localStorage.getItem('ideas') || '[]'
    )
    const updatedIdeas = [newIdea, ...existingIdeas]
    localStorage.setItem('ideas', JSON.stringify(updatedIdeas))

    setIdeaInput('')
    setSelectedKeywords([])
    setSuggestedKeywords([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.closest('form')
      if (form) {
        handleSubmit(e as any)
      }
    }
  }

  return (
    <div className="p1-main-page">
      <div className="main-container">
        <div className="main-input-section">
          <div className="title-section">
            <h1 className="main-title">Create Idea</h1>
            <p className="subtitle">Visualize your thoughts</p>
          </div>

          <form onSubmit={handleSubmit} className="input-area">
            <div className="idea-input-wrapper">
              {selectedKeywords.length > 0 && (
                <div className="selected-keywords">
                  {selectedKeywords.map((keyword, index) => (
                    <div key={index} className="keyword-tag-selected">
                      <span>{keyword}</span>
                      <button
                        type="button"
                        className="keyword-remove"
                        onClick={() => handleKeywordRemove(keyword)}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="text-area-wrapper">
                <textarea
                  ref={textareaRef}
                  className="idea-textarea"
                  value={ideaInput}
                  onChange={(e) => setIdeaInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter a new idea, thought, or concept..."
                  rows={1}
                />
              </div>
            </div>

            {suggestedKeywords.length > 0 && (
              <div className="suggested-keywords-section">
                <p className="suggested-label">Suggested Keywords</p>
                <div className="suggested-keywords">
                  {suggestedKeywords.map((keyword, index) => (
                    <button
                      key={index}
                      type="button"
                      className="keyword-button"
                      onClick={() => handleKeywordSelect(keyword)}
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default MainPage