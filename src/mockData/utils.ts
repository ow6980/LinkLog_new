import { mockIdeas, Idea } from './ideas'

/**
 * Mock 데이터를 localStorage에 로드합니다.
 * 기존 데이터가 있으면 덮어씁니다.
 */
export const loadMockData = (): void => {
  localStorage.setItem('ideas', JSON.stringify(mockIdeas))
  console.log(`${mockIdeas.length}개의 mock 아이디어가 로드되었습니다.`)
}

/**
 * Mock 데이터를 localStorage에 추가합니다.
 * 기존 데이터가 있으면 뒤에 추가합니다.
 */
export const appendMockData = (): void => {
  const existing = localStorage.getItem('ideas')
  const existingIdeas: Idea[] = existing ? JSON.parse(existing) : []
  const allIdeas = [...existingIdeas, ...mockIdeas]
  localStorage.setItem('ideas', JSON.stringify(allIdeas))
  console.log(`${mockIdeas.length}개의 mock 아이디어가 추가되었습니다. (총 ${allIdeas.length}개)`)
}

/**
 * localStorage의 아이디어 데이터를 초기화합니다.
 */
export const clearIdeas = (): void => {
  localStorage.removeItem('ideas')
  console.log('아이디어 데이터가 초기화되었습니다.')
}

/**
 * 현재 localStorage에 저장된 아이디어 개수를 반환합니다.
 */
export const getIdeasCount = (): number => {
  const stored = localStorage.getItem('ideas')
  if (!stored) return 0
  const ideas: Idea[] = JSON.parse(stored)
  return ideas.length
}


