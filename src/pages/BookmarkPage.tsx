import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import BookmarkCard from '../components/BookmarkCard'
import BookmarkIcon from '../components/BookmarkIcon'
import './BookmarkPage.css'

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

// Calculate similarity between two ideas
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

  const handleBookmarkToggle = async (ideaId: string) => {
    try {
      const idea = ideas.find(i => i.id === ideaId)
      if (!idea) return
      const newBookmarkedState = !idea.bookmarked

      // Optimistic remove when unbookmarking
      if (!newBookmarkedState) setIdeas(prev => prev.filter(i => i.id !== ideaId))

      const { error } = await supabase
        .from('ideas')
        .update({ bookmarked: newBookmarkedState })
        .eq('id', ideaId)

      if (error) throw error
    } catch (error) {
      console.error('Error toggling bookmark:', error)
    }
  }

  return (
    <div className="bookmark-page">
      <div className="bookmark-container">
        <div className="bookmark-header">
          <div className="bookmark-title-block">
            <div className="title-row">
              <div className="title-icon">
                <BookmarkIcon marked />
              </div>
              <h1 className="bookmark-title">Bookmarks</h1>
            </div>
            <p className="bookmark-subtitle">{ideas.length} ideas saved</p>
          </div>
        </div>
        
        {ideas.length === 0 ? (
          <div className="empty-state">
            <p>No bookmarked ideas yet.</p>
          </div>
        ) : (
          <div className="bookmark-grid">
            {ideas.map((idea, index) => (
              <BookmarkCard
                key={idea.id}
                idea={idea}
                ideaNumber={index + 1}
                connectedCount={getConnectedIdeasCount(idea)}
                onBookmarkToggle={handleBookmarkToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookmarkPage
