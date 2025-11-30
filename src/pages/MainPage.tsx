import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './MainPage.css'

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  createdAt: string
}

const MainPage = () => {
  const [ideaInput, setIdeaInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const [recentIdeas, setRecentIdeas] = useState<Idea[]>([])
  const navigate = useNavigate()

  // 키워드 자동 추출
  const extractKeywords = (text: string): string[] => {
    if (!text.trim()) return []

    const words = text
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)

    const wordCount: Record<string, number> = {}
    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word]) => word)
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

  useEffect(() => {
    const stored = localStorage.getItem('ideas')
    if (stored) {
      const ideas = JSON.parse(stored) as Idea[]
      setRecentIdeas(ideas.slice(0, 10))
    }
  }, [])

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

    const newIdea: Idea = {
      id: Date.now().toString(),
      title: ideaInput.split('\n')[0].substring(0, 50),
      content: ideaInput,
      keywords: selectedKeywords,
      createdAt: new Date().toISOString(),
    }

    const existingIdeas = JSON.parse(
      localStorage.getItem('ideas') || '[]'
    ) as Idea[]
    const updatedIdeas = [newIdea, ...existingIdeas]
    localStorage.setItem('ideas', JSON.stringify(updatedIdeas))
    setRecentIdeas(updatedIdeas.slice(0, 10))

    setIdeaInput('')
    setSelectedKeywords([])
    setSuggestedKeywords([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
                  className="idea-textarea"
                  value={ideaInput}
                  onChange={(e) => setIdeaInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter a new idea, thought, or concept..."
                  rows={3}
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
            <button type="submit" className="submit-button">
              SAVE
            </button>
          </form>
        </div>

        <div className="recent-ideas-section">
          <h2 className="section-title">Recent Ideas</h2>
          <div className="ideas-grid">
            {recentIdeas.length > 0 ? (
              recentIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="idea-card"
                  onClick={() => navigate(`/idea/${idea.id}`)}
                >
                  <h3 className="idea-card-title">{idea.title}</h3>
                  <p className="idea-card-content">
                    {idea.content.substring(0, 100)}
                    {idea.content.length > 100 ? '...' : ''}
                  </p>
                  {idea.keywords.length > 0 && (
                    <div className="idea-card-keywords">
                      {idea.keywords.slice(0, 3).map((keyword, idx) => (
                        <span key={idx} className="keyword-tag-small">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="idea-card-date">
                    {new Date(idea.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <p>아직 저장된 아이디어가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainPage