import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import variablesData from '../variables.json'
import './BookmarkPage.css'

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

// 키워드 색상 매핑 (variables.json의 tag 색상 사용)
const KEYWORD_COLORS: Record<string, string> = {
  Technology: TAG_COLORS.red || '#ff4848',
  Innovation: TAG_COLORS.orange || '#ffae2b',
  Data: TAG_COLORS.yellow || '#ffff06',
  Design: TAG_COLORS.skyblue || '#0de7ff',
  Business: TAG_COLORS.violet || '#8a38f5',
  Research: TAG_COLORS.green || '#77ff00',
  Development: TAG_COLORS.blue || '#0d52ff',
}

// Gray 색상 추출
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

const GRAY_COLORS = extractGrayColors()

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  createdAt: string
  bookmarked?: boolean
}

const BookmarkPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [filteredIdeas, setFilteredIdeas] = useState<Idea[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

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

  // 연결된 아이디어 수 계산 (공통 키워드를 가진 아이디어들)
  const getConnectedIdeasCount = (idea: Idea): number => {
    const stored = localStorage.getItem('ideas')
    if (!stored) return 0
    
    try {
      const allIdeas = JSON.parse(stored) as Idea[]
      const connected = allIdeas.filter(otherIdea => {
        if (otherIdea.id === idea.id) return false
        // 공통 키워드가 있으면 연결됨
        return idea.keywords.some(keyword => otherIdea.keywords.includes(keyword))
      })
      return connected.length
    } catch {
      return 0
    }
  }

  const handleCardClick = (id: string) => {
    navigate(`/idea/${id}`)
  }

  const handleBookmarkToggle = (e: React.MouseEvent, idea: Idea) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    
    const stored = localStorage.getItem('ideas')
    if (stored) {
      try {
        const allIdeas = JSON.parse(stored) as Idea[]
        const updatedIdeas = allIdeas.map(i => 
          i.id === idea.id ? { ...i, bookmarked: !i.bookmarked } : i
        )
        localStorage.setItem('ideas', JSON.stringify(updatedIdeas))
        
        // 현재 상태 업데이트
        const bookmarked = updatedIdeas.filter((idea) => idea.bookmarked)
        setIdeas(bookmarked)
        if (filter === 'all') {
          setFilteredIdeas(bookmarked)
        } else {
          setFilteredIdeas(bookmarked.filter((idea) => idea.keywords.includes(filter)))
        }
      } catch {
        // 에러 처리
      }
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${year}.${month}.${day} | ${displayHours}:${minutes} ${ampm}`
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
            filteredIdeas.map((idea, index) => {
              const connectedCount = getConnectedIdeasCount(idea)
              return (
                <div
                  key={idea.id}
                  className="idea-card"
                  onClick={() => handleCardClick(idea.id)}
                >
                  {/* 상단: 번호 + 북마크 아이콘 */}
                  <div className="idea-card-top">
                    <div className="idea-number">No. {index + 1}</div>
                    <button
                      className="bookmark-icon-btn"
                      onClick={(e) => handleBookmarkToggle(e, idea)}
                    >
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <path
                          d="M7 7C7 6.44772 7.44772 6 8 6H20C20.5523 6 21 6.44772 21 7V21C21 21.3746 20.7039 21.7038 20.3518 21.8512C19.9996 21.9986 19.5997 21.9602 19.28 21.7467L14 18.0833L8.72 21.7467C8.40028 21.9602 8.00038 21.9986 7.64822 21.8512C7.29606 21.7038 7 21.3746 7 21V7Z"
                          stroke={GRAY_COLORS['800'] || '#1e1e1e'}
                          strokeWidth="1.5"
                          fill={idea.bookmarked ? GRAY_COLORS['800'] || '#1e1e1e' : 'none'}
                        />
                      </svg>
                    </button>
                  </div>

                  {/* 아이디어 제목 */}
                  <h3 className="idea-title">{idea.title}</h3>

                  {/* 키워드 태그들 */}
                  {idea.keywords.length > 0 && (
                    <div className="idea-keywords">
                      {idea.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="keyword-tag-bookmark"
                          style={{
                            backgroundColor: KEYWORD_COLORS[keyword] || '#666666'
                          }}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 하단: 날짜/시간 + 연결된 아이디어 수 */}
                  <div className="idea-card-bottom">
                    <div className="idea-date">{formatDate(idea.createdAt)}</div>
                    <div className="connected-ideas-count">
                      <svg width="14" height="4" viewBox="0 0 14 4" fill="none">
                        <circle cx="2" cy="2" r="2" fill={GRAY_COLORS['800'] || '#1e1e1e'} />
                        <circle cx="7" cy="2" r="2" fill={GRAY_COLORS['800'] || '#1e1e1e'} />
                        <circle cx="12" cy="2" r="2" fill={GRAY_COLORS['800'] || '#1e1e1e'} />
                      </svg>
                      <span>{connectedCount}</span>
                    </div>
                  </div>
                </div>
              )
            })
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
