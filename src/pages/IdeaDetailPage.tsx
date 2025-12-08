import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import { AVAILABLE_KEYWORDS } from '../mockData/keywords'
import variablesData from '../variables.json'
import './IdeaDetailPage.css'

// ... (color helper functions)

// ... (calculateSimilarity)

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

// 유사도 임계값
const SIMILARITY_THRESHOLD_SAME = 0.15 // 같은 키워드 내부 연결 임계값 (15%)
const SIMILARITY_THRESHOLD_CROSS = 0.20 // 다른 키워드 간 연결 임계값 (20%)

const IdeaDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [idea, setIdea] = useState<Idea | null>(null)
  const [content, setContent] = useState('') // This maps to DB title (main idea)
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const [detailedNotes, setDetailedNotes] = useState('') // This maps to DB content (detail memo)
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
          setSourceUrls(currentIdea.source_url ? [currentIdea.source_url] : [])
          setIsBookmarked(currentIdea.bookmarked || false)

          // Suggested keywords
          const contentText = (currentIdea.title || '').toLowerCase()
          const suggested = AVAILABLE_KEYWORDS.filter(
            (keyword) =>
              contentText.includes(keyword.toLowerCase()) &&
              !currentIdea.keywords?.includes(keyword)
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
  }, [content, keywords, detailedNotes, sourceUrls, isBookmarked])

  // ... (textarea resize effects)

  const handleBookmarkToggle = () => {
    setIsBookmarked(!isBookmarked)
  }

  const handleDelete = async () => {
    if (!id) return

    if (confirm('정말 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('ideas')
          .delete()
          .eq('id', id)

        if (error) throw error
        navigate('/connect-map')
      } catch (error) {
        console.error('Error deleting idea:', error)
        alert('삭제 중 오류가 발생했습니다.')
      }
    }
  }

  // ... (handleAddKeyword, handleRemoveKeyword, handleAddSourceUrl, handleRemoveSourceUrl, etc.)

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
      {/* Render content here */}
      <div className="detail-section meta-data-section">
        <h2 className="section-title">Meta Data</h2>
        <div className="meta-data-list">
          <div className="meta-data-item">
            <span className="meta-data-label">Updated Time</span>
            <span className="meta-data-value">
              {formatDate(idea.updated_at || idea.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IdeaDetailPage






