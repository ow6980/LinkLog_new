import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './BookmarkPage.css'

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  createdAt: string
  bookmarked?: boolean
}

const BookmarkPage = () => {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [filteredIdeas, setFilteredIdeas] = useState<Idea[]>([])
  const [filter, setFilter] = useState<string>('all')
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem('ideas')
    if (stored) {
      const allIdeas = JSON.parse(stored) as Idea[]
      const bookmarked = allIdeas.filter((idea) => idea.bookmarked)
      setIdeas(bookmarked)
      setFilteredIdeas(bookmarked)
    }
  }, [])

  useEffect(() => {
    if (filter === 'all') {
      setFilteredIdeas(ideas)
    } else {
      setFilteredIdeas(
        ideas.filter((idea) => idea.keywords.includes(filter))
      )
    }
  }, [filter, ideas])

  const handleCardClick = (id: string) => {
    navigate(`/idea/${id}`)
  }

  return (
    <div className="bookmark-page">
      <div className="bookmark-container">
        <h1 className="page-title">북마크</h1>
        
        <div className="filter-section">
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              전체
            </button>
            {/* 키워드 필터는 동적으로 생성 */}
          </div>
        </div>

        <div className="ideas-grid">
          {filteredIdeas.length > 0 ? (
            filteredIdeas.map((idea) => (
              <div
                key={idea.id}
                className="idea-card"
                onClick={() => handleCardClick(idea.id)}
              >
                <h3 className="idea-title">{idea.title}</h3>
                <p className="idea-content">
                  {idea.content.substring(0, 150)}
                  {idea.content.length > 150 ? '...' : ''}
                </p>
                {idea.keywords.length > 0 && (
                  <div className="idea-keywords">
                    {idea.keywords.map((keyword, idx) => (
                      <span key={idx} className="keyword-tag small">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
                <div className="idea-date">
                  {new Date(idea.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <p>북마크된 아이디어가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarkPage
