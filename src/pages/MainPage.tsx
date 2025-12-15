import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import './MainPage.css'
import { extractMeaningfulKeywords } from '../utils/keywordExtractor'

const MainPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [ideaInput, setIdeaInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 텍스트에서 의미있는 키워드 자동 추출
  const extractKeywords = (text: string): string[] => {
    if (!text.trim()) return []

    // 새로운 키워드 추출 함수 사용 (최대 7개)
    const extracted = extractMeaningfulKeywords(text, 7)
    
    // 이미 선택된 키워드는 제외
    return extracted.filter(k => !selectedKeywords.includes(k))
  }

  useEffect(() => {
    if (ideaInput) {
      const extracted = extractKeywords(ideaInput)
      setSuggestedKeywords(extracted)
    } else {
      setSuggestedKeywords([])
    }
  }, [ideaInput, selectedKeywords])

  // textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [ideaInput])


  const handleKeywordSelect = (keyword: string) => {
    if (!selectedKeywords.includes(keyword) && selectedKeywords.length < 2) {
      setSelectedKeywords([...selectedKeywords, keyword])
      setSuggestedKeywords(suggestedKeywords.filter((k: string) => k !== keyword))
    }
  }

  const handleKeywordRemove = (keyword: string) => {
    setSelectedKeywords(selectedKeywords.filter((k: string) => k !== keyword))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!isAuthenticated || !user) {
      navigate('/signin')
      return
    }

    if (!ideaInput.trim()) {
      return
    }

    try {
      const { error } = await supabase
        .from('ideas')
        .insert({
          title: ideaInput, // 입력된 전체 내용을 제목(Content)으로 저장
          content: null,    // 상세 내용은 초기에는 없음
          keywords: selectedKeywords,
          user_id: user.id
        })

      if (error) throw error

      // 입력 필드 초기화
      setIdeaInput('')
      setSelectedKeywords([])
      setSuggestedKeywords([])

      // P2 Connect Map 페이지로 이동
      navigate('/connect-map')
    } catch (error) {
      console.error('Error creating idea:', error)
      alert('아이디어 저장 중 오류가 발생했습니다.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.closest('form')
      if (form) {
        handleSubmit(e as any)
      }
    }
  }

  return (
    <div className="p1-main-page">
      <div className="main-container">
        <div className="main-input-section">
          <div className="title-section">
            <h1 className="main-title">Create Idea</h1>
            <p className="subtitle">Visualize your thoughts</p>
          </div>

          <form onSubmit={handleSubmit} className="input-area">
            <div className="idea-input-wrapper">
              <div className="selected-keywords">
                {selectedKeywords.length > 0 ? (
                  selectedKeywords.map((keyword, index) => (
                    <div key={index} className="keyword-tag-selected">
                      <span>{keyword}</span>
                      <button
                        type="button"
                        className="keyword-remove"
                        onClick={() => handleKeywordRemove(keyword)}
                      >
                        x
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="keyword-placeholder"></div>
                )}
              </div>
              <div className="text-area-wrapper">
                <div className="input-container">
                  <textarea
                    ref={textareaRef}
                    className="idea-textarea"
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter a new idea, thought, or concept..."
                    rows={1}
                  />
                  <button
                    type="submit"
                    className="enter-button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }}
                    disabled={!ideaInput.trim()}
                  >
                    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="42" height="42" fill="#1E1E1E"/>
                      <path d="M9 21H32M32 21L22.1429 11M32 21L22.1429 31" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {suggestedKeywords.length > 0 && (
              <div className="suggested-keywords-section">
                <p className="suggested-label">Suggested Keywords</p>
                <div className="suggested-keywords">
                  {suggestedKeywords.map((keyword, index) => (
                    <button
                      key={index}
                      type="button"
                      className="keyword-button"
                      onClick={() => handleKeywordSelect(keyword)}
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default MainPage