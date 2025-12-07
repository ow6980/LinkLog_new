import { useState, useEffect, useRef } from 'react'
import './MainPage.css'
import { AVAILABLE_KEYWORDS } from '../mockData/keywords'

const MainPage = () => {
  const [ideaInput, setIdeaInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 주제/키워드 자동 추출 (7개 고정 키워드 중에서만 추출)
  const extractKeywords = (text: string): string[] => {
    if (!text.trim()) return []

    const textLower = text.toLowerCase()
    const keywordScores: Array<{ keyword: string; score: number }> = []

    // 각 키워드에 대해 텍스트에서 매칭되는 빈도와 위치 기반 점수 계산
    AVAILABLE_KEYWORDS.forEach(keyword => {
      if (selectedKeywords.includes(keyword)) return

      const keywordLower = keyword.toLowerCase()
      let score = 0

      // 1. 정확한 키워드 매칭 (높은 점수)
      const exactMatches = (textLower.match(new RegExp(`\\b${keywordLower}\\b`, 'gi')) || []).length
      score += exactMatches * 10

      // 2. 키워드와 관련된 단어 패턴 매칭
      const relatedWords: Record<string, string[]> = {
        'technology': ['tech', 'technical', 'technological', 'software', 'hardware', 'system', 'platform', 'application', 'algorithm', 'computing', 'digital', 'electronic', 'ai', 'ml', 'iot', 'cloud'],
        'innovation': ['innovative', 'innovate', 'novel', 'new', 'breakthrough', 'revolutionary', 'disruptive', 'creative', 'original', 'pioneering'],
        'data': ['dataset', 'database', 'analytics', 'analysis', 'information', 'dataset', 'processing', 'mining', 'collection', 'storage'],
        'design': ['designing', 'designed', 'architecture', 'structure', 'layout', 'interface', 'ui', 'ux', 'user experience', 'visual'],
        'business': ['business', 'commercial', 'enterprise', 'company', 'organization', 'market', 'customer', 'client', 'revenue', 'profit'],
        'research': ['research', 'study', 'investigation', 'experiment', 'academic', 'scientific', 'analysis', 'findings', 'discovery'],
        'development': ['develop', 'developing', 'building', 'creating', 'construction', 'implementation', 'programming', 'coding', 'engineering']
      }

      if (relatedWords[keywordLower]) {
        relatedWords[keywordLower].forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi')
          const matches = textLower.match(regex)
          if (matches) {
            score += matches.length * 3
          }
        })
      }

      // 3. 문장 앞부분에 나타나는 경우 추가 점수
      const firstSentence = text.split(/[.!?。！？\n]/)[0]?.toLowerCase() || ''
      if (firstSentence.includes(keywordLower)) {
        score += 5
      }

      if (score > 0) {
        keywordScores.push({ keyword, score })
      }
    })

    // 점수 순으로 정렬하고 상위 7개 선택 (이미 7개 제한이므로 모두 반환)
    return keywordScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map(item => item.keyword)
      .filter(k => k && !selectedKeywords.includes(k))
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
              <div className="selected-keywords">
                {selectedKeywords.length > 0 ? (
                  selectedKeywords.map((keyword, index) => (
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
                  ))
                ) : (
                  <div className="keyword-placeholder"></div>
                )}
              </div>
              <div className="text-area-wrapper">
                <div className="input-container">
                  <textarea
                    ref={textareaRef}
                    className="idea-textarea"
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter a new idea, thought, or concept..."
                    rows={1}
                  />
                  <button
                    type="submit"
                    className="enter-button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }}
                    disabled={!ideaInput.trim()}
                  >
                    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="42" height="42" fill="#1E1E1E"/>
                      <path d="M9 21H32M32 21L22.1429 11M32 21L22.1429 31" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
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