import { useNavigate } from 'react-router-dom'
import BookmarkIcon from './BookmarkIcon'
import KeywordTag from './KeywordTag'
import './BookmarkCard.css'

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  createdAt: string
  bookmarked?: boolean
}

interface BookmarkCardProps {
  idea: Idea
  ideaNumber: number
  connectedCount: number
  onBookmarkToggle?: (id: string) => void
}

const BookmarkCard = ({
  idea,
  ideaNumber,
  connectedCount,
  onBookmarkToggle,
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
      <div className="idea-number">NO. {ideaNumber}</div>
      <div className="idea-title">{idea.title}</div>
      <div className="keywords-container">
        {idea.keywords.slice(0, 2).map((keyword, index) => (
          <KeywordTag key={index} keyword={keyword} index={index} />
        ))}
      </div>
      <div className="card-footer">
        <div className="idea-date">{formatDate(idea.createdAt)}</div>
        <div className="connected-count">
          <div className="dots-icon">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="count-number">{connectedCount}</span>
        </div>
      </div>
      <div className="bookmark-icon-wrapper" onClick={handleBookmarkClick}>
        <BookmarkIcon marked={idea.bookmarked || false} />
      </div>
      <div className="corner-decoration top-left"></div>
      <div className="corner-decoration top-right"></div>
      <div className="corner-decoration bottom-left"></div>
      <div className="corner-decoration bottom-right"></div>
    </div>
  )
}

export default BookmarkCard


