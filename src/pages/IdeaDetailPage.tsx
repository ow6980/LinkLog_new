import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AVAILABLE_KEYWORDS } from '../mockData/keywords'
import variablesData from '../variables.json'
import './IdeaDetailPage.css'

// variables.json에서 색상 추출
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

const TAG_COLORS = extractTagColors()
const GRAY_COLORS = extractGrayColors()

// 키워드 색상 매핑
const KEYWORD_COLORS: Record<string, string> = {
  Technology: TAG_COLORS.red || '#ff4848',
  Innovation: TAG_COLORS.orange || '#ffae2b',
  Data: TAG_COLORS.yellow || '#ffff06',
  Design: TAG_COLORS.skyblue || '#0de7ff',
  Business: TAG_COLORS.violet || '#8a38f5',
  Research: TAG_COLORS.green || '#77ff00',
  Development: TAG_COLORS.blue || '#0d52ff',
}

// 텍스트 유사도 계산 함수 (P2와 동일)
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

// 연결 임계값 (P2와 동일)
const SIMILARITY_THRESHOLD_SAME = 0.15 // 같은 키워드 내부 연결 임계값 (15%)
const SIMILARITY_THRESHOLD_CROSS = 0.20 // 다른 키워드 간 연결 임계값 (20%)

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  sourceUrl?: string
  sourceUrls?: string[]
  detailedNotes?: string
  bookmarked?: boolean
  createdAt: string
  updatedAt?: string
}

const IdeaDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [idea, setIdea] = useState<Idea | null>(null)
  const [content, setContent] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const [detailedNotes, setDetailedNotes] = useState('')
  const [sourceUrls, setSourceUrls] = useState<string[]>([])
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [connectedIdeas, setConnectedIdeas] = useState<Idea[]>([])
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)
  const keywordInputRef = useRef<HTMLInputElement>(null)

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
        setContent(found.content || found.title)
        setKeywords(found.keywords || [])
        setDetailedNotes(found.detailedNotes || '')
        setSourceUrls(found.sourceUrls || (found.sourceUrl ? [found.sourceUrl] : []))
        setIsBookmarked(found.bookmarked || false)

        // Suggested keywords 추출
        const contentText = (found.content || found.title).toLowerCase()
        const suggested = AVAILABLE_KEYWORDS.filter(
          (keyword) =>
            contentText.includes(keyword.toLowerCase()) &&
            !found.keywords?.includes(keyword)
        )
        setSuggestedKeywords(suggested)

        // 연결된 아이디어 찾기 (P2와 동일한 로직)
        const connected: Idea[] = []
        
        ideas.forEach((otherIdea) => {
          if (otherIdea.id === found.id) return
          
          // 유사도 계산
          const similarity = calculateSimilarity(found, otherIdea)
          
          // 같은 키워드 공유 여부 확인
          const hasCommonKeyword = found.keywords?.some((kw) => 
            otherIdea.keywords?.includes(kw)
          )
          
          // 같은 키워드가 있고 유사도가 임계값 이상이면 연결
          if (hasCommonKeyword && similarity >= SIMILARITY_THRESHOLD_SAME) {
            connected.push(otherIdea)
          }
          // 다른 키워드지만 유사도가 임계값 이상이면 연결
          else if (!hasCommonKeyword && similarity >= SIMILARITY_THRESHOLD_CROSS) {
            connected.push(otherIdea)
          }
        })
        
        setConnectedIdeas(connected)
      }
    }
  }, [id, isAuthenticated, navigate])

  // 자동 저장
  const autoSave = () => {
    if (!id) return

    const stored = localStorage.getItem('ideas')
    if (stored) {
      const ideas = JSON.parse(stored) as Idea[]
      const updated = ideas.map((idea) => {
        if (idea.id === id) {
          return {
            ...idea,
            content,
            keywords,
            detailedNotes,
            sourceUrls,
            bookmarked: isBookmarked,
            updatedAt: new Date().toISOString(),
          }
        }
        return idea
      })
      localStorage.setItem('ideas', JSON.stringify(updated))
    }
  }

  // 자동 저장 트리거
  useEffect(() => {
    if (idea) {
      const timer = setTimeout(() => {
        autoSave()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [content, keywords, detailedNotes, sourceUrls, isBookmarked])

  // textarea 높이 자동 조절 (콘텐츠에 맞춰 hug)
  useEffect(() => {
    if (contentTextareaRef.current) {
      contentTextareaRef.current.style.height = 'auto'
      const scrollHeight = contentTextareaRef.current.scrollHeight
      contentTextareaRef.current.style.height = `${Math.max(51, scrollHeight)}px`
    }
  }, [content])

  useEffect(() => {
    if (notesTextareaRef.current) {
      notesTextareaRef.current.style.height = 'auto'
      const scrollHeight = notesTextareaRef.current.scrollHeight
      notesTextareaRef.current.style.height = `${Math.max(63, scrollHeight)}px`
    }
  }, [detailedNotes])

  const handleBookmarkToggle = () => {
    setIsBookmarked(!isBookmarked)
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

  const handleAddKeyword = (keyword?: string) => {
    const keywordToAdd = keyword || newKeyword.trim()
    if (keywordToAdd && !keywords.includes(keywordToAdd)) {
      setKeywords([...keywords, keywordToAdd])
      setNewKeyword('')
      setSuggestedKeywords(suggestedKeywords.filter((k) => k !== keywordToAdd))
    }
  }

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword))
  }

  const handleAddSourceUrl = () => {
    const url = newSourceUrl.trim()
    if (url && !sourceUrls.includes(url)) {
      // 간단한 URL 검증
      try {
        new URL(url.startsWith('http') ? url : `https://${url}`)
        setSourceUrls([...sourceUrls, url])
        setNewSourceUrl('')
      } catch {
        alert('올바른 URL 형식이 아닙니다.')
      }
    }
  }

  const handleRemoveSourceUrl = (url: string) => {
    setSourceUrls(sourceUrls.filter((u) => u !== url))
  }

  const handleSuggestedKeywordClick = (keyword: string) => {
    handleAddKeyword(keyword)
  }

  const handleConnectedIdeaClick = (ideaId: string) => {
    navigate(`/idea/${ideaId}`)
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${year}. ${month}. ${day}.  |  ${displayHours}:${minutes} ${ampm}`
  }

  const getKeywordColor = (keyword: string): string => {
    return KEYWORD_COLORS[keyword] || TAG_COLORS.red || '#ff4848'
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
      <div className="idea-detail-container">
        {/* Title Section */}
        <div className="detail-title-section">
          <div className="detail-title-wrapper">
            <h1 className="detail-title">Idea Detail</h1>
            <div className="detail-title-actions">
              <button className="back-button" onClick={() => navigate(-1)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 12L6 8L10 4"
                    stroke={GRAY_COLORS['800'] || '#1e1e1e'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Back</span>
              </button>
              <button className="delete-button" onClick={handleDelete}>
                delete this idea
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="detail-grid">
          {/* Left Column */}
          <div className="detail-left-column">
            {/* Idea Content Section */}
            <div className="detail-section idea-content-section">
              <div className="section-header">
                <h2 className="section-title">Idea Content</h2>
                <button
                  className={`bookmark-icon-btn ${isBookmarked ? 'active' : ''}`}
                  onClick={handleBookmarkToggle}
                >
                  {isBookmarked ? (
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.1667 24.5L14 19.8333L5.83334 24.5V5.83333C5.83334 5.21449 6.07918 4.621 6.51676 4.18342C6.95435 3.74583 7.54784 3.5 8.16668 3.5H19.8333C20.4522 3.5 21.0457 3.74583 21.4833 4.18342C21.9208 4.621 22.1667 5.21449 22.1667 5.83333V24.5Z" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M10.5 11.6667L12.8333 14L17.5 9.33333" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.1667 24.5L14 19.8333L5.83334 24.5V5.83333C5.83334 5.21449 6.07918 4.621 6.51676 4.18342C6.95435 3.74583 7.54784 3.5 8.16668 3.5H19.8333C20.4522 3.5 21.0457 3.74583 21.4833 4.18342C21.9208 4.621 22.1667 5.21449 22.1667 5.83333V24.5Z" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="idea-content-input-wrapper">
                <textarea
                  ref={contentTextareaRef}
                  className="idea-content-input"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter a brief idea in one sentence..."
                />
              </div>
            </div>

            {/* Keywords Section */}
            <div className="detail-section keywords-section">
              <h2 className="section-title">Keywords</h2>
              <div className="keywords-input-container">
                <div className="keywords-chips">
                  {keywords.map((keyword, idx) => {
                    const keywordColor = KEYWORD_COLORS[keyword] || TAG_COLORS.red || '#ff4848'
                    return (
                      <div
                        key={idx}
                        className="keyword-chip active"
                        style={{ backgroundColor: keywordColor }}
                      >
                        <span className="keyword-chip-text">{keyword}</span>
                        <button
                          className="keyword-chip-remove"
                          onClick={() => handleRemoveKeyword(keyword)}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
                <input
                  ref={keywordInputRef}
                  type="text"
                  className="keyword-input"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddKeyword()
                    }
                  }}
                  placeholder="Type and press Enter to add keywords"
                />
              </div>
              {suggestedKeywords.length > 0 && (
                <div className="suggested-keywords-section">
                  <p className="suggested-keywords-label">Suggested Keywords</p>
                  <div className="suggested-keywords-list">
                    {suggestedKeywords.map((keyword, idx) => (
                      <button
                        key={idx}
                        className="suggested-keyword-chip"
                        onClick={() => handleSuggestedKeywordClick(keyword)}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Meta Data Section */}
            <div className="detail-section meta-data-section">
              <h2 className="section-title">Meta Data</h2>
              <div className="meta-data-list">
                <div className="meta-data-item">
                  <span className="meta-data-label">Updated Time</span>
                  <span className="meta-data-value">
                    {formatDate(idea.updatedAt || idea.createdAt)}
                  </span>
                </div>
                <div className="meta-data-item">
                  <span className="meta-data-label">Connected</span>
                  <span className="meta-data-value">{connectedIdeas.length} Ideas</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="detail-right-column">
            {/* Detailed Notes Section */}
            <div className="detail-section detailed-notes-section">
              <h2 className="section-title">Detailed Notes</h2>
              <textarea
                ref={notesTextareaRef}
                className="detailed-notes-input"
                value={detailedNotes}
                onChange={(e) => setDetailedNotes(e.target.value)}
                    placeholder="Write detailed notes, explanations, or related thoughts about this idea..."
              />
            </div>

            {/* References & Links Section */}
            <div className="detail-section references-section">
              <h2 className="section-title">References & Links</h2>
              <div className="references-list">
                {sourceUrls.map((url, idx) => {
                  const fullUrl = url.startsWith('http') ? url : `https://${url}`
                  return (
                    <div key={idx} className="reference-item">
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reference-link"
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        <span className="reference-text">reference link: {url}</span>
                      </a>
                      <button
                        className="reference-remove-btn"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveSourceUrl(url)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
                <div className="reference-input-container">
                  <input
                    type="url"
                    className="reference-input"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSourceUrl()
                      }
                    }}
                    placeholder="Add reference link and press Enter"
                  />
                </div>
              </div>
            </div>

            {/* Connected Ideas Section */}
            <div className="detail-section connected-ideas-section">
              <h2 className="section-title">Connected Idea</h2>
              <div className="connected-ideas-list">
                {connectedIdeas.length > 0 ? (
                  connectedIdeas.map((connectedIdea) => {
                    const firstKeyword = connectedIdea.keywords?.[0] || ''
                    const color = getKeywordColor(firstKeyword)
                    return (
                      <div
                        key={connectedIdea.id}
                        className="connected-idea-item"
                        onClick={() => handleConnectedIdeaClick(connectedIdea.id)}
                      >
                        <div
                          className="connected-idea-dot"
                          style={{ backgroundColor: color }}
                        />
                        <span className="connected-idea-text">
                          {connectedIdea.content || connectedIdea.title}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="no-connected-ideas">No connected ideas</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IdeaDetailPage
