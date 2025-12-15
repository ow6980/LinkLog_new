import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import variablesData from '../variables.json'
import './BookmarkPage.css'

// ... (RGB to HEX, extractTagColors, extractGrayColors functions remain same)

// ... (KEYWORD_COLORS, GRAY_COLORS mappings remain same)

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sortOrder] = useState<SortOrder>('desc')

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

  const handleBookmarkToggle = async (e: React.MouseEvent, idea: Idea) => {
    e.stopPropagation() // 카드 클릭 이벤트 방지
    
    try {
      const newBookmarkedState = !idea.bookmarked
      
      // Optimistic update
      const updatedIdeas = ideas.filter(i => i.id !== idea.id) // Remove from list if unbookmarked (or re-fetch?)
      // Actually, if we toggle in bookmark page, it usually means removing it.
      // But let's just toggle state locally first.
      // If unbookmarked, it should disappear from the list.
      
      if (!newBookmarkedState) {
         setIdeas(updatedIdeas)
      }

      const { error } = await supabase
        .from('ideas')
        .update({ bookmarked: newBookmarkedState })
        .eq('id', idea.id)

      if (error) throw error
      
    } catch (error) {
      console.error('Error toggling bookmark:', error)
      // Revert if error (fetching again might be easier)
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
    // In bookmark card, we might want to show title or part of content
    // Based on previous design, it showed 'content' which is now 'detailedNotes' (DB content)
    // But 'title' is the main idea. Let's show detailed notes if available, else nothing or title?
    // User asked: "title is content, content is detailed memo". 
    // Usually card shows the main idea (Title). The snippet might be from detailed memo.
    
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
                  <path d="M14 2L17.09 10.26L26 11.27L19 17.14L20.18 26.02L14 22L7.82 26.02L9 17.14L2 11.27L10.91 10.26L14 2Z" fill="#1e1e1e"/>
                </svg>
              </div>
              <h1 className="bookmark-title">Bookmarks</h1>
            </div>
            <p className="bookmark-subtitle">Your saved ideas</p>
          </div>
        </div>
        
        {ideas.length === 0 ? (
          <div className="empty-state">
            <p>No bookmarked ideas yet.</p>
          </div>
        ) : (
          <div className="bookmark-grid">
            {ideas.map((idea, index) => {
              const connectedCount = getConnectedIdeasCount(idea)
              // Use content (detailed notes) for preview if available
              const contentPreview = getContentPreview(idea.content || undefined) 
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
                    <div 
                      className="bookmark-icon-btn"
                      onClick={(e) => handleBookmarkToggle(e, idea)}
                    >
                      {/* Bookmark icon will be added here if needed */}
                    </div>
                  </div>
                  
                  <div className="card-content">
                    <h3 className="idea-title">{idea.title}</h3>
                  </div>

                  {contentPreview && (
                    <div className="idea-snippet-wrapper">
                      <p className="idea-snippet">{contentPreview}</p>
                    </div>
                  )}

                  {idea.keywords && idea.keywords.length > 0 && (
                    <div className="idea-keywords">
                      {idea.keywords.slice(0, 2).map((keyword, idx) => (
                        <span key={idx} className="keyword-tag-bookmark">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="idea-card-bottom">
                    <div className="idea-date">{formatDate(idea.created_at)}</div>
                    <div className="connected-ideas-count">
                      <div className="dot-icon">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                      <span className="count-text">{connectedCount}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookmarkPage
