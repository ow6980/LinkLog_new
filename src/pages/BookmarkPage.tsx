import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import variablesData from '../variables.json'
import './BookmarkPage.css'

// color helpers
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
  Keyword1: TAG_COLORS.red || '#ff4848',
  Keyword2: TAG_COLORS.yellow || '#ffff06',
  Keyword3: TAG_COLORS.skyblue || '#0de7ff',
  Technology: TAG_COLORS.red || '#ff4848',
  Innovation: TAG_COLORS.orange || '#ffae2b',
  Data: TAG_COLORS.yellow || '#ffff06',
  Design: TAG_COLORS.skyblue || '#0de7ff',
  Business: TAG_COLORS.violet || '#8a38f5',
  Research: TAG_COLORS.green || '#77ff00',
  Development: TAG_COLORS.blue || '#0d52ff',
}

interface Idea {
  id: string
  title: string
  content: string | null
  keywords: string[]
  created_at: string
  bookmarked?: boolean
  source_url?: string
}

type SortOrder = 'desc' | 'asc'

// ... (calculateSimilarity function remains same - needs to handle nullable content)
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

const BookmarkPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]) // Store all ideas for connection calculation
  // const [sortOrder, setSortOrder] = useState<SortOrder>('desc') // unused for now

  const sortIdeas = useCallback((list: Idea[], order: SortOrder) => {
    return [...list].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime()
      const bTime = new Date(b.created_at).getTime()
      return order === 'desc' ? bTime - aTime : aTime - bTime
    })
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const fetchBookmarks = async () => {
      try {
        // Fetch all ideas to calculate connections later
        const { data: allData, error: allError } = await supabase
          .from('ideas')
          .select('*')
        
        if (allError) throw allError
        if (allData) setAllIdeas(allData)

        // Filter for bookmarks from the fetched data
        const bookmarked = allData?.filter((idea: Idea) => idea.bookmarked) || []
        const sortedBookmarked = sortIdeas(bookmarked, 'desc')
        setIdeas(sortedBookmarked)
      } catch (error) {
        console.error('Error fetching bookmarks:', error)
      }
    }

    fetchBookmarks()
  }, [isAuthenticated, navigate, sortIdeas])

  // 연결된 아이디어 수 계산
  const getConnectedIdeasCount = (idea: Idea): number => {
    if (allIdeas.length === 0) return 0
    
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
  }

  const handleCardClick = (id: string) => {
    navigate(`/idea/${id}`)
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

  const ideaSavedText = `${ideas.length} IDEA SAVED`

  return (
    <div className="bookmark-page">
      <div className="bookmark-container">
        <header className="bookmark-header">
          <div className="bookmark-title-block">
            <div className="title-row">
              <div className="title-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M6 4h12a2 2 0 0 1 2 2v14l-8-4-8 4V6a2 2 0 0 1 2-2Z" stroke="#1E1E1E" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M9 9h6" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="bookmark-title">Bookmarked Nodes</h1>
            </div>
            <p className="bookmark-subtitle">{ideaSavedText}</p>
          </div>
        </header>

        <div className="bookmark-grid">
          {ideas.length === 0 ? (
            <div className="empty-state">No bookmarked ideas</div>
          ) : (
            ideas.map((idea, index) => {
              const connectedCount = getConnectedIdeasCount(idea)
              // const contentPreview = getContentPreview(idea.content || undefined) // not shown in design
              return (
                <article
                  key={idea.id}
                  className="bookmark-card"
                  onClick={() => handleCardClick(idea.id)}
                >
                  <div className="card-top">
                    <div className="card-number">
                      <span className="card-number-text">NO. {index + 1}</span>
                    </div>
                    <button className="bookmark-icon-btn" aria-label="bookmark">
                      <div className="bookmark-icon-wrapper">
                        <svg className="bookmark-base" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.1666 24.5L13.9999 19.8333L5.83325 24.5V5.83333C5.83325 5.21449 6.07908 4.621 6.51667 4.18342C6.95425 3.74583 7.54775 3.5 8.16659 3.5H19.8333C20.4521 3.5 21.0456 3.74583 21.4832 4.18342C21.9208 4.621 22.1666 5.21449 22.1666 5.83333V24.5Z" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </button>
                  </div>

                  <div className="card-content">
                    <h3 className="idea-title">{idea.title}</h3>
                  </div>

                  <div className="idea-keywords">
                    {idea.keywords.slice(0, 2).map((keyword, idx) => (
                      <span
                        key={idx}
                        className="keyword-tag-bookmark"
                        style={{
                          backgroundColor: KEYWORD_COLORS[keyword] || '#f2f2f2',
                        }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>

                  <div className="idea-card-bottom">
                    <div className="idea-date">{formatDate(idea.created_at)}</div>
                    <div className="connected-ideas-count">
                      <div className="dot-icon">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                      </div>
                      <span className="count-text">{connectedCount}</span>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarkPage
