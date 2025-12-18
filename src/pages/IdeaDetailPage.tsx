import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import { extractMeaningfulKeywords } from '../utils/keywordExtractor'
import variablesData from '../variables.json'
import BookmarkIcon from '../components/BookmarkIcon'
import { AVAILABLE_KEYWORDS } from '../mockData/keywords'
import './IdeaDetailPage.css'

// color helpers (reuse minimal subset)
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
const KEYWORD_COLORS: Record<string, string> = {
  Technology: TAG_COLORS.red || '#ff4848',
  Innovation: TAG_COLORS.orange || '#ffae2b',
  Data: TAG_COLORS.yellow || '#ffff06',
  Design: TAG_COLORS.skyblue || '#0de7ff',
  Business: TAG_COLORS.violet || '#8a38f5',
  Research: TAG_COLORS.green || '#77ff00',
  Development: TAG_COLORS.blue || '#0d52ff',
}

// 유사도 임계값
const SIMILARITY_THRESHOLD_SAME = 0.15 // 같은 키워드 내부 연결 임계값 (15%)
const SIMILARITY_THRESHOLD_CROSS = 0.20 // 다른 키워드 간 연결 임계값 (20%)

// 텍스트 유사도 계산 함수 (0 ~ 1 사이의 값)
const calculateSimilarity = (idea1: Idea, idea2: Idea): number => {
  const text1 = `${idea1.title} ${idea1.content || ''}`.toLowerCase()
  const text2 = `${idea2.title} ${idea2.content || ''}`.toLowerCase()
  
  const words1 = new Set(text1.match(/[a-z0-9]+/g) || [])
  const words2 = new Set(text2.match(/[a-z0-9]+/g) || [])
  
  const commonWords = new Set([...words1].filter(word => words2.has(word)))
  const union = new Set([...words1, ...words2])
  
  if (union.size === 0) return 0
  
  return commonWords.size / union.size
}

const getKeywordColor = (keyword: string) => KEYWORD_COLORS[keyword] || '#666666'

interface Idea {
  id: string
  title: string
  content: string | null
  keywords: string[]
  source_url?: string
  bookmarked?: boolean
  created_at: string
  updated_at?: string
  user_id?: string
}

const IdeaDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [idea, setIdea] = useState<Idea | null>(null)
  const [content, setContent] = useState('') // This maps to DB title (main idea)
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [detailedNotes, setDetailedNotes] = useState('') // This maps to DB content (detail memo)
  const [sourceUrls, setSourceUrls] = useState<string[]>([])
  const [references, setReferences] = useState<string[]>([])
  const [newReferenceInput, setNewReferenceInput] = useState('')
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isEditingReferences, setIsEditingReferences] = useState(false)
  const [connectedIdeas, setConnectedIdeas] = useState<Idea[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const ideaContentRef = useRef<HTMLTextAreaElement>(null)
  const detailedNotesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const fetchIdeaAndRelated = async () => {
      if (!id) return

      try {
        // Fetch current idea
        const { data: currentIdea, error: fetchError } = await supabase
          .from('ideas')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError

        if (currentIdea) {
          setIdea(currentIdea)
          setContent(currentIdea.title) // Title is the main content
          setKeywords(currentIdea.keywords || [])
          setDetailedNotes(currentIdea.content || '') // Content is the detailed notes
          const initialRefs = currentIdea.source_url ? [currentIdea.source_url] : []
          setSourceUrls(initialRefs)
          setReferences(initialRefs)
          setIsBookmarked(currentIdea.bookmarked || false)

          // Suggested keywords - 텍스트에서 의미있는 키워드 추출
          const contentText = `${currentIdea.title || ''} ${currentIdea.content || ''}`
          const extracted = extractMeaningfulKeywords(contentText, 7)
          // 이미 선택된 키워드는 제외
          const suggested = extracted.filter(
            (keyword: string) => !currentIdea.keywords?.includes(keyword)
          )
          setSuggestedKeywords(suggested)

          // Fetch all ideas for connection logic
          const { data: allIdeas, error: allError } = await supabase
            .from('ideas')
            .select('*')
          
          if (allError) throw allError

          if (allIdeas) {
             const connected: Idea[] = []
             allIdeas.forEach((otherIdea) => {
               if (otherIdea.id === currentIdea.id) return
               
               const similarity = calculateSimilarity(currentIdea, otherIdea)
               const hasCommonKeyword = currentIdea.keywords?.some((kw: string) => 
                 otherIdea.keywords?.includes(kw)
               )
               
               if (hasCommonKeyword && similarity >= SIMILARITY_THRESHOLD_SAME) {
                 connected.push(otherIdea)
               } else if (!hasCommonKeyword && similarity >= SIMILARITY_THRESHOLD_CROSS) {
                 connected.push(otherIdea)
               }
             })
             setConnectedIdeas(connected)
          }
        }
      } catch (error) {
        console.error('Error fetching idea details:', error)
        navigate('/connect-map')
      }
    }

    fetchIdeaAndRelated()
  }, [id, isAuthenticated, navigate])

  // 자동 저장
  const autoSave = async () => {
    if (!id || !user) return

    try {
      const { error } = await supabase
        .from('ideas')
        .update({
          title: content, // Save main content as title
          content: detailedNotes, // Save detailed notes as content
          keywords: keywords,
          source_url: sourceUrls[0] || null, // Currently supporting single URL in DB schema
          bookmarked: isBookmarked,
          // updated_at is handled by trigger usually, but we can set it if needed or rely on created_at for now
        })
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error auto-saving idea:', error)
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
  }, [content, keywords, detailedNotes, sourceUrls, isBookmarked, idea, id, user])

  // 텍스트 영역 높이 자동 조절
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return
    
    // Reset height to auto to allow scrollHeight to calculate correctly
    textarea.style.height = 'auto'
    
    // Force a reflow by accessing offsetHeight
    void textarea.offsetHeight
    
    // Get scrollHeight which includes padding and content
    const scrollHeight = textarea.scrollHeight
    
    // Set height to scrollHeight to fit all content (minimum 86px)
    const newHeight = Math.max(86, scrollHeight)
    textarea.style.height = `${newHeight}px`
  }

  useEffect(() => {
    if (ideaContentRef.current) {
      adjustTextareaHeight(ideaContentRef.current)
    }
  }, [content])

  useEffect(() => {
    if (detailedNotesRef.current) {
      adjustTextareaHeight(detailedNotesRef.current)
    }
  }, [detailedNotes])

  // content나 detailedNotes가 변경될 때 키워드 추천 업데이트
  useEffect(() => {
    if (content || detailedNotes) {
      const fullText = `${content} ${detailedNotes}`.trim()
      if (fullText) {
        const extracted = extractMeaningfulKeywords(fullText, 7)
        // 이미 선택된 키워드는 제외
        const suggested = extracted.filter(
          (keyword: string) => !keywords.includes(keyword)
        )
        setSuggestedKeywords(suggested)
      } else {
        setSuggestedKeywords([])
      }
    }
  }, [content, detailedNotes, keywords])

  const handleBookmarkToggle = () => setIsBookmarked(!isBookmarked)

  const handleKeywordAdd = (value?: string) => {
    const next = (value ?? keywordInput).trim()
    if (!next) return
    // Check if keyword is in available keywords
    if (!AVAILABLE_KEYWORDS.includes(next as any)) {
      alert(`키워드는 다음 중 하나여야 합니다: ${AVAILABLE_KEYWORDS.join(', ')}`)
      setKeywordInput('')
      return
    }
    if (keywords.includes(next)) {
      setKeywordInput('')
      return
    }
    if (keywords.length >= 2) {
      alert('최대 2개의 키워드만 추가할 수 있습니다.')
      return
    }
    setKeywords([...keywords, next])
    setKeywordInput('')
  }

  const handleKeywordRemove = (value: string) => {
    setKeywords(keywords.filter((k) => k !== value))
  }

  const handleReferenceChange = (index: number, value: string) => {
    const newReferences = [...references]
    newReferences[index] = value
    setReferences(newReferences)
  }

  const handleReferenceRemove = (index: number) => {
    const newReferences = references.filter((_, i) => i !== index)
    setReferences(newReferences)
  }

  const handleReferenceSave = () => {
    setSourceUrls(references.length > 0 ? [references[0]] : [])
    setIsEditingReferences(false)
    setNewReferenceInput('')
  }

  const handleReferenceAdd = () => {
    if (newReferenceInput.trim()) {
      setReferences([...references, newReferenceInput.trim()])
      setNewReferenceInput('')
    }
  }

  const handleReferenceLinkClick = (url: string, e: React.MouseEvent) => {
    if (!isEditingReferences) {
      e.preventDefault()
      if (url.startsWith('http://') || url.startsWith('https://')) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        window.open(`http://${url}`, '_blank', 'noopener,noreferrer')
      }
    }
  }

  const handleDelete = async () => {
    if (!id || !window.confirm('이 아이디어를 삭제하시겠습니까?')) return
    
    try {
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      navigate('/connect-map')
    } catch (error) {
      console.error('Error deleting idea:', error)
      alert('아이디어 삭제 중 오류가 발생했습니다.')
    }
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

  // Early return if idea is not loaded
  if (!idea) {
    return (
      <div className="idea-detail-page">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="idea-detail-page">
      <div className="idea-detail-container">
        {/* Title Section */}
        <div className="detail-title-section">
          <div className="detail-title-wrapper">
            <div className="detail-title">
              <h1>Idea Detail</h1>
            </div>
            <div className="detail-title-actions">
              <button className="back-button" onClick={() => navigate(-1)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 12L6 8L10 4" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                <BookmarkIcon marked={isBookmarked} onClick={handleBookmarkToggle} />
              </div>
              <div className="idea-content-input-wrapper">
                <textarea
                  ref={ideaContentRef}
                  className="idea-content-input"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value)
                    adjustTextareaHeight(e.target)
                  }}
                  placeholder="Collaborative filtering improves recommendations..."
                />
              </div>
            </div>

            {/* Keywords Section */}
            <div className="detail-section keywords-section">
              <h2 className="section-title">Keywords</h2>
              <div className="keywords-input-container">
                {keywords.map((kw) => (
                  <div
                    key={kw}
                    className="keyword-chip"
                    style={{ backgroundColor: KEYWORD_COLORS[kw] || '#ff4848' }}
                  >
                    <span className="keyword-chip-text">{kw}</span>
                    <button
                      type="button"
                      className="keyword-chip-remove"
                      onClick={() => handleKeywordRemove(kw)}
                    >
                      x
                    </button>
                  </div>
                ))}
                <input
                  className="keyword-input"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleKeywordAdd()
                    }
                  }}
                  placeholder="Type and press Enter to add keywords"
                />
              </div>
              <div className="suggested-keywords-section">
                <p className="suggested-keywords-label">Suggested Keywords</p>
                <div className="suggested-keywords-list">
                  {suggestedKeywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      className="suggested-keyword-chip"
                      onClick={() => handleKeywordAdd(kw)}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Meta Data Section */}
            <div className="detail-section meta-data-section">
              <h2 className="section-title">Meta Data</h2>
              <div className="meta-data-list">
                <div className="meta-data-item">
                  <span className="meta-data-label">Updated Time</span>
                  <span className="meta-data-value">{formatDate(idea.updated_at || idea.created_at)}</span>
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
                ref={detailedNotesRef}
                className="detailed-notes-input"
                value={detailedNotes}
                onChange={(e) => {
                  setDetailedNotes(e.target.value)
                  adjustTextareaHeight(e.target)
                }}
                placeholder="write detailed notes, or realted thoughts about this idea...."
              />
            </div>

            {/* References & Links Section */}
            <div className="detail-section references-section">
              <div className="section-header-with-edit">
                <h2 className="section-title">References & Links</h2>
                <button
                  type="button"
                  className="reference-edit-btn"
                  onClick={() => {
                    if (isEditingReferences) {
                      handleReferenceSave()
                    } else {
                      setIsEditingReferences(true)
                    }
                  }}
                >
                  {isEditingReferences ? 'save' : 'edit'}
                </button>
              </div>
              <div className="references-list">
                {references.length === 0 && !isEditingReferences ? (
                  <div className="reference-item">
                    <span className="reference-text">No references</span>
                  </div>
                ) : (
                  <>
                    {references.map((ref, idx) => (
                      <div key={idx} className="reference-item">
                        {isEditingReferences ? (
                          <>
                            <input
                              type="text"
                              className="reference-input-field"
                              placeholder="reference link: http://example.com"
                              value={ref}
                              onChange={(e) => handleReferenceChange(idx, e.target.value)}
                            />
                            <button
                              type="button"
                              className="reference-remove-btn"
                              onClick={() => handleReferenceRemove(idx)}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 4L4 12M4 4L12 12" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </>
                        ) : (
                          <a
                            href={ref.startsWith('http://') || ref.startsWith('https://') ? ref : `http://${ref}`}
                            className="reference-link"
                            onClick={(e) => handleReferenceLinkClick(ref, e)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="reference-text">{ref}</span>
                          </a>
                        )}
                      </div>
                    ))}
                    {isEditingReferences && (
                      <div className="reference-item">
                        <input
                          type="text"
                          className="reference-input-field"
                          placeholder="reference link: http://example.com"
                          value={newReferenceInput}
                          onChange={(e) => setNewReferenceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newReferenceInput.trim()) {
                              e.preventDefault()
                              handleReferenceAdd()
                            }
                          }}
                          onBlur={handleReferenceAdd}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Connected Idea Section */}
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
                        onClick={() => navigate(`/idea/${connectedIdea.id}`)}
                      >
                        <span
                          className="connected-idea-dot"
                          style={{ backgroundColor: color }}
                        />
                        <span className="connected-idea-text">
                          {connectedIdea.title}
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
