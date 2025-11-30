import { useState, useEffect, useRef } from 'react'
import './MainPage.css'

const MainPage = () => {
  const [ideaInput, setIdeaInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 키워드 자동 추출 (NLP 기반 기본 키워드 분석)
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
      '그', '이', '저', '것', '수', '것', '때', '곳', '등', '및', '또한', '그리고'
    ])

    // 원본 단어를 유지하기 위해 원본 텍스트에서 단어 추출
    const originalWords = text
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)

    // 소문자로 변환한 단어로 빈도 계산
    const wordCount: Record<string, { count: number; original: string }> = {}
    originalWords.forEach((originalWord) => {
      const lowerWord = originalWord.toLowerCase()
      if (!stopWords.has(lowerWord)) {
        if (!wordCount[lowerWord]) {
          wordCount[lowerWord] = { count: 0, original: originalWord }
        }
        wordCount[lowerWord].count += 1
        // 원본 단어의 첫 글자가 대문자면 원본 유지
        if (originalWord[0] === originalWord[0].toUpperCase() && originalWord[0] !== originalWord[0].toLowerCase()) {
          wordCount[lowerWord].original = originalWord
        }
      }
    })

    return Object.entries(wordCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([_, data]) => data.original)
      .filter((word) => !selectedKeywords.includes(word))
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