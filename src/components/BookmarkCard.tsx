import { useNavigate } from 'react-router-dom'
import BookmarkIcon from './BookmarkIcon'
import './BookmarkCard.css'
import variablesData from '../variables.json'

// Color helpers
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
      <div className="idea-number">NO. {ideaNumber}</div>
      <div className="idea-title">{idea.title}</div>
      <div className="keywords-container">
        {idea.keywords.slice(0, 2).map((keyword, index) => (
          <span
            key={index}
            className="keyword-tag"
            style={{
              backgroundColor: KEYWORD_COLORS[keyword] || '#666666',
              color: '#1e1e1e',
            }}
          >
            {keyword}
          </span>
        ))}
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
