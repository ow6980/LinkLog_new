import './BookmarkIcon.css'

interface BookmarkIconProps {
  marked?: boolean
  onClick?: () => void
}

const BookmarkIcon = ({ marked = false, onClick }: BookmarkIconProps) => {
  return (
    <div className={`bookmark-icon ${marked ? 'marked' : ''}`} onClick={onClick}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 북마크 outline - 항상 표시 */}
        <path
          d="M22.1667 24.5L14 19.8333L5.83334 24.5V5.83333C5.83334 5.21449 6.07917 4.621 6.51675 4.18342C6.95434 3.74583 7.54783 3.5 8.16667 3.5H19.8333C20.4522 3.5 21.0457 3.74583 21.4833 4.18342C21.9208 4.621 22.1667 5.21449 22.1667 5.83333V24.5Z"
          stroke="#1E1E1E"
          strokeWidth="1.66667"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 북마크된 상태일 때만 체크마크 표시 */}
        {marked && (
          <path
            d="M10.5 11.6667L12.8333 14L17.5 9.33334"
            stroke="#1E1E1E"
            strokeWidth="1.66667"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  )
}

export default BookmarkIcon

