import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './IdeaDetailPage.css'

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  sourceUrl?: string
  bookmarked?: boolean
  createdAt: string
}

const IdeaDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [idea, setIdea] = useState<Idea | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [isBookmarked, setIsBookmarked] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const stored = localStorage.getItem('ideas')
    if (stored && id) {
      const ideas = JSON.parse(stored) as Idea[]
      const found = ideas.find((idea) => idea.id === id)
      if (found) {
        setIdea(found)
        setTitle(found.title)
        setContent(found.content)
        setKeywords(found.keywords || [])
        setSourceUrl(found.sourceUrl || '')
        setIsBookmarked(found.bookmarked || false)
      }
    }
  }, [id, isAuthenticated, navigate])

  const handleSave = () => {
    if (!id) return

    const stored = localStorage.getItem('ideas')
    if (stored) {
      const ideas = JSON.parse(stored) as Idea[]
      const updated = ideas.map((idea) => {
        if (idea.id === id) {
          return {
            ...idea,
            title,
            content,
            keywords,
            sourceUrl,
            bookmarked: isBookmarked,
          }
        }
        return idea
      })
      localStorage.setItem('ideas', JSON.stringify(updated))
      alert('저장되었습니다!')
    }
  }

  const handleDelete = () => {
    if (!id) return

    if (confirm('정말 삭제하시겠습니까?')) {
      const stored = localStorage.getItem('ideas')
      if (stored) {
        const ideas = JSON.parse(stored) as Idea[]
        const filtered = ideas.filter((idea) => idea.id !== id)
        localStorage.setItem('ideas', JSON.stringify(filtered))
        navigate('/')
      }
    }
  }

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()])
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword))
  }

  if (!idea) {
    return (
      <div className="idea-detail-page">
        <div className="loading">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="idea-detail-page">
      <div className="detail-container">
        <div className="detail-header">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← 뒤로
          </button>
          <div className="header-actions">
            <button
              className={`bookmark-btn ${isBookmarked ? 'active' : ''}`}
              onClick={() => setIsBookmarked(!isBookmarked)}
            >
              {isBookmarked ? '★' : '☆'} 북마크
            </button>
            <button className="delete-btn" onClick={handleDelete}>
              삭제
            </button>
          </div>
        </div>

        <div className="detail-content">
          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="title-input"
            />
          </div>

          <div className="form-group">
            <label>내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="content-input"
              rows={12}
            />
          </div>

          <div className="form-group">
            <label>키워드</label>
            <div className="keywords-input-section">
              <div className="keywords-list">
                {keywords.map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">
                    {keyword}
                    <button
                      className="remove-keyword"
                      onClick={() => handleRemoveKeyword(keyword)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="add-keyword">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddKeyword()
                    }
                  }}
                  placeholder="키워드 추가"
                  className="keyword-input"
                />
                <button onClick={handleAddKeyword} className="add-btn">
                  추가
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>출처 URL</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="url-input"
              placeholder="https://..."
            />
          </div>

          <div className="form-actions">
            <button className="save-button" onClick={handleSave}>
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IdeaDetailPage
