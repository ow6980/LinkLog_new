import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import BookmarkCard from '../components/BookmarkCard'
import BookmarkIcon from '../components/BookmarkIcon'
import { createKeywordColorMap } from '../utils/keywordColors'
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

// Calculate similarity between two ideas (ConnectMapPage와 동일한 로직)
const calculateSimilarity = (idea1: Idea, idea2: Idea): number => {
  // 제목과 내용을 합쳐서 텍스트 준비
  const text1 = `${idea1.title} ${idea1.content || ''}`
  const text2 = `${idea2.title} ${idea2.content || ''}`
  
  // 한국어와 영어 모두 처리
  // 1. 한국어 단어 추출 (한글, 숫자, 영문 포함)
  const koreanWordRegex = /[\uAC00-\uD7A3]+|[a-zA-Z0-9]+/g
  
  const words1 = new Set((text1.match(koreanWordRegex) || []).map(w => w.toLowerCase()))
  const words2 = new Set((text2.match(koreanWordRegex) || []).map(w => w.toLowerCase()))
  
  // 2. 공통 단어 계산
  const commonWords = new Set([...words1].filter(word => words2.has(word)))
  
  // 3. Jaccard 유사도: 교집합 / 합집합
  const union = new Set([...words1, ...words2])
  
  if (union.size === 0) {
    // 단어가 없으면 문자 단위로 비교 (한국어 처리)
    const chars1 = new Set(text1.replace(/\s/g, '').split(''))
    const chars2 = new Set(text2.replace(/\s/g, '').split(''))
    const commonChars = new Set([...chars1].filter(char => chars2.has(char)))
    const unionChars = new Set([...chars1, ...chars2])
    
    if (unionChars.size === 0) return 0
    return commonChars.size / unionChars.size
  }
  
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

  // 연결된 아이디어 수 계산 (ConnectMapPage와 동일한 로직)
  const getConnectedIdeasCount = (idea: Idea): number => {
    if (allIdeas.length === 0) return 0
    
    const otherIdeas = allIdeas.filter(i => i.id !== idea.id)
    const SIMILARITY_THRESHOLD = 0.15 // 연결 임계값 (15%) - ConnectMapPage와 동일
    
    let count = 0
    otherIdeas.forEach(otherIdea => {
      const similarity = calculateSimilarity(idea, otherIdea)
      // 유사도가 임계값 이상이면 연결 (키워드 무시, 유사도만으로 연결)
      if (similarity >= SIMILARITY_THRESHOLD) {
        count++
      }
    })
    
    return count
  }

  // 키워드 색상 맵 생성 (일관된 색상 할당을 위해 공통 함수 사용)
  const keywordColorMap = useMemo(() => {
    const allKeywords: string[] = []
    
    // 모든 아이디어의 키워드 수집
    allIdeas.forEach(idea => {
      if (idea.keywords && idea.keywords.length > 0) {
        idea.keywords.forEach(keyword => {
          if (keyword && keyword !== 'ungrouped' && !allKeywords.includes(keyword)) {
            allKeywords.push(keyword)
          }
        })
      }
    })
    
    return createKeywordColorMap(allKeywords)
  }, [allIdeas])

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
                keywordColorMap={keywordColorMap}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default BookmarkPage
