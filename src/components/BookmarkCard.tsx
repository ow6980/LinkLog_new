import { useNavigate } from 'react-router-dom'
import BookmarkIcon from './BookmarkIcon'
import './BookmarkCard.css'
import { getKeywordColor as getKeywordColorUtil, GRAY_COLORS } from '../utils/keywordColors'

interface Idea {
  id: string
  title: string
  content: string | null
  keywords: string[]
  created_at: string
  bookmarked?: boolean
}

interface BookmarkCardProps {
  idea: Idea
  ideaNumber: number
  connectedCount: number
  onBookmarkToggle?: (id: string) => void
  keywordColorMap?: Map<string, string> // 키워드 색상 맵 (선택적)
}

const BookmarkCard = ({
  idea,
  ideaNumber,
  connectedCount,
  onBookmarkToggle,
  keywordColorMap,
}: BookmarkCardProps) => {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/idea/${idea.id}`)
  }

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onBookmarkToggle) {
      onBookmarkToggle(idea.id)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = date.getHours()
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${year}.${month}.${day} | ${String(displayHours).padStart(2, '0')}:${minutes} ${ampm}`
  }

  return (
    <div className="bookmark-card" onClick={handleCardClick}>
      <div className="card-top">
        <div className="idea-number">NO. {ideaNumber}</div>
        <div className="bookmark-icon-wrapper" onClick={handleBookmarkClick}>
          <BookmarkIcon marked={idea.bookmarked || false} />
        </div>
      </div>
      <div className="idea-title">{idea.title}</div>
      <div className="keywords-container">
        {idea.keywords.slice(0, 2).map((keyword, index) => {
          // 키워드 색상 가져오기 (keywordColorMap이 있으면 사용, 없으면 공통 함수 사용)
          let keywordColor = GRAY_COLORS['500'] || '#666666'
          if (keywordColorMap && keywordColorMap.has(keyword)) {
            keywordColor = keywordColorMap.get(keyword)!
          } else if (keyword) {
            // keywordColorMap이 없을 때는 공통 함수 사용 (일관된 색상)
            keywordColor = getKeywordColorUtil(keyword)
          }
          
          return (
            <span
              key={index}
              className="keyword-tag"
              style={{
                backgroundColor: keywordColor,
                color: '#1e1e1e',
              }}
            >
              {keyword}
            </span>
          )
        })}
      </div>
      <div className="card-footer">
        <div className="idea-date">{formatDate(idea.created_at)}</div>
        <div className="connected-count">
          <div className="dots-icon">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="count-number">{connectedCount}</span>
        </div>
      </div>
    </div>
  )
}

export default BookmarkCard
