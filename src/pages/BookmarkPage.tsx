import { useState, useEffect, useCallback } from 'react'
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

type SortOrder = 'desc' | 'asc'

// 텍스트 유사도 계산 함수 (ConnectMapPage와 동일 로직)
const calculateSimilarity = (idea1: Idea, idea2: Idea): number => {
  const text1 = `${idea1.title} ${idea1.content}`.toLowerCase()
  const text2 = `${idea2.title} ${idea2.content}`.toLowerCase()
  
  const words1 = new Set(text1.match(/[a-z0-9]+/g) || [])
  const words2 = new Set(text2.match(/[a-z0-9]+/g) || [])
  
  const commonWords = new Set([...words1].filter(word => words2.has(word)))
  const union = new Set([...words1, ...words2])
  
  if (union.size === 0) return 0
  
  return commonWords.size / union.size
}

const BookmarkPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [ideas, setIdeas] = useState<Idea[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortOrder] = useState<SortOrder>('desc')

  const sortIdeas = useCallback((list: Idea[], order: SortOrder) => {
    return [...list].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return order === 'desc' ? bTime - aTime : aTime - bTime
    })
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const stored = localStorage.getItem('ideas')
    if (stored) {
      const allIdeas = JSON.parse(stored) as Idea[]
      const bookmarked = allIdeas.filter((idea) => idea.bookmarked)
      const sortedBookmarked = sortIdeas(bookmarked, 'desc')
      setIdeas(sortedBookmarked)
    }
  }, [isAuthenticated, navigate, sortIdeas])

  // 연결된 아이디어 수 계산 (P2 ConnectMapPage 로직 기반)
  const getConnectedIdeasCount = (idea: Idea): number => {
    const stored = localStorage.getItem('ideas')
    if (!stored) return 0
    
    try {
      const allIdeas = JSON.parse(stored) as Idea[]
      // 자기 자신 제외
      const otherIdeas = allIdeas.filter(i => i.id !== idea.id)
      
      let count = 0
      const myKeyword = idea.keywords[0] || 'Technology'
      
      otherIdeas.forEach(otherIdea => {
        const otherKeyword = otherIdea.keywords[0] || 'Technology'
        const similarity = calculateSimilarity(idea, otherIdea)
        
        // 같은 키워드: 유사도 0.15 이상이면 연결
        if (myKeyword === otherKeyword) {
           if (similarity >= 0.15) count++
        } 
        // 다른 키워드: 유사도 0.20 이상이면 연결
        else {
           if (similarity >= 0.20) count++
        }
      })
      
      return count
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
        const sortedBookmarked = sortIdeas(bookmarked, sortOrder)
        setIdeas(sortedBookmarked)
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

  const getContentPreview = (content?: string): string => {
    if (!content) return ''
    const trimmed = content.trim()
    if (trimmed.length <= 140) return trimmed
    return `${trimmed.slice(0, 140)}...`
  }

  return (
    <div className="bookmark-page">
      <div className="bookmark-container">
        <div className="bookmark-header">
          <div className="bookmark-title-block">
            <div className="title-row">
              <div className="title-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 7C7 6.44772 7.44772 6 8 6H20C20.5523 6 21 6.44772 21 7V21C21 21.3746 20.7039 21.7038 20.3518 21.8512C19.9996 21.9986 19.5997 21.9602 19.28 21.7467L14 18.0833L8.72 21.7467C8.40028 21.9602 8.00038 21.9986 7.64822 21.8512C7.29606 21.7038 7 21.3746 7 21V7Z" fill="#1E1E1E"/>
                </svg>
              </div>
              <h1 className="bookmark-title">Bookmarked Nodes</h1>
            </div>
            <p className="bookmark-subtitle">
              {ideas.length} IDEA SAVED
            </p>
          </div>
        </div>

        <div className="bookmark-grid">
          {ideas.length > 0 ? (
            ideas.map((idea, index) => {
              const connectedCount = getConnectedIdeasCount(idea)
              const contentPreview = getContentPreview(idea.content)
              return (
                <article
                  key={idea.id}
                  className="bookmark-card"
                  onClick={() => handleCardClick(idea.id)}
                >
                  <div className="card-top">
                    <div className="card-number">
                      <span className="card-number-text">No. {index + 1}</span>
                    </div>
                    <button
                      className={`bookmark-icon-btn ${idea.bookmarked ? 'active' : ''}`}
                      onClick={(e) => handleBookmarkToggle(e, idea)}
                      aria-label="bookmark toggle"
                    >
                      {/* Updated Bookmark Icon from Figma 8:4628 */}
                      <div className="bookmark-icon-wrapper">
                        {/* Base flag shape */}
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="bookmark-base">
                          <path d="M7 7C7 6.44772 7.44772 6 8 6H20C20.5523 6 21 6.44772 21 7V21C21 21.3746 20.7039 21.7038 20.3518 21.8512C19.9996 21.9986 19.5997 21.9602 19.28 21.7467L14 18.0833L8.72 21.7467C8.40028 21.9602 8.00038 21.9986 7.64822 21.8512C7.29606 21.7038 7 21.3746 7 21V7Z" 
                            stroke={GRAY_COLORS['800'] || '#1E1E1E'}
                            strokeWidth="1.5" 
                            fill="none" // Always outline, checkmark indicates 'marked'
                          />
                        </svg>
                        
                        {/* Checkmark - visible when bookmarked */}
                        {idea.bookmarked && (
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="bookmark-check">
                            <path d="M10.5 11.6667L12.8333 14L17.5 9.33333" stroke={GRAY_COLORS['800'] || '#1E1E1E'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="card-content">
                    <h3 className="idea-title">{idea.title}</h3>
                  </div>

                  {contentPreview && (
                    <div className="idea-snippet-wrapper">
                    </div>
                  )}

                  {idea.keywords.length > 0 && (
                    <div className="idea-keywords">
                      {idea.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="keyword-tag-bookmark"
                          style={{
                            backgroundColor: KEYWORD_COLORS[keyword] || '#666666',
                            color: '#1e1e1e'
                          }}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="idea-card-bottom">
                    <div className="idea-date">{formatDate(idea.createdAt)}</div>
                    <div className="connected-ideas-count">
                      <div className="dot-icon">
                         <div className="dot"></div>
                         <div className="dot"></div>
                         <div className="dot-bar"></div>
                      </div>
                      <span className="count-text">{connectedCount}</span>
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="empty-state">
              <p>북마크된 아이디어가 없습니다.</p>
              <span>아이디어 상세 페이지에서 북마크를 추가해 보세요.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarkPage
