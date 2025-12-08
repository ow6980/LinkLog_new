import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import mockIdeas from '../mockData/ideas.json'
import variablesData from '../variables.json'
import { AVAILABLE_KEYWORDS } from '../mockData/keywords'
import './ConnectMapPage.css'

// variables.json에서 색상 추출 (RGB를 HEX로 변환)
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

// 키워드 색상 매핑 (variables.json의 tag 색상 사용)
const KEYWORD_COLORS: Record<string, string> = {
  Technology: TAG_COLORS.red || '#ff4848',
  Innovation: TAG_COLORS.orange || '#ffae2b',
  Data: TAG_COLORS.yellow || '#ffff06',
  Design: TAG_COLORS.skyblue || '#0de7ff',
  Business: TAG_COLORS.violet || '#8a38f5',
  Research: TAG_COLORS.green || '#77ff00',
  Development: TAG_COLORS.blue || '#0d52ff',
}

// Gray 색상 추출
const extractGrayColors = () => {
  const grayColors: Record<string, string> = {}
  variablesData.variables.forEach((variable: any) => {
    if (variable.name.startsWith('color/gray/')) {
      const grayLevel = variable.name.replace('color/gray/', '')
      const rgb = variable.resolvedValuesByMode['12:0'].resolvedValue
      grayColors[grayLevel] = rgbToHex(rgb.r, rgb.g, rgb.b)
    }
  })
  return grayColors
}

const GRAY_COLORS = extractGrayColors()

// 키워드를 태그 색상 이름으로 매핑
const getKeywordColorName = (keyword: string): string => {
  const mapping: Record<string, string> = {
    'Technology': 'red',
    'Innovation': 'orange',
    'Data': 'yellow',
    'Design': 'skyblue',
    'Business': 'violet',
    'Research': 'green',
    'Development': 'blue',
  }
  return mapping[keyword] || 'red'
}

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
  createdAt?: string
  sourceUrl?: string
  bookmarked?: boolean
}

interface KeywordGroup {
  keyword: string
  color: string
  ideas: Idea[]
  position: { x: number; y: number; z: number }
  boxSize: { width: number; height: number; depth: number }
}

interface IdeaNode extends Idea {
  position: { x: number; y: number; z: number }
  keyword: string
  connectionCount?: number // 연결된 노드 개수
  nodeSize?: 'big' | 'mid' | 'small' // 노드 크기
  connectedKeywords?: string[] // 연결된 키워드 목록 (다른 키워드와 연결된 경우)
}

interface Connection {
  source: IdeaNode
  target: IdeaNode
  type: 'same-keyword' | 'cross-keyword'
  isDotted?: boolean
}

// 텍스트 유사도 계산 함수 (0 ~ 1 사이의 값)
const calculateSimilarity = (idea1: Idea, idea2: Idea): number => {
  // 제목과 내용을 합쳐서 텍스트 준비
  const text1 = `${idea1.title} ${idea1.content}`.toLowerCase()
  const text2 = `${idea2.title} ${idea2.content}`.toLowerCase()
  
  // 단어로 분리 (영문, 숫자만 추출, 중복 제거)
  const words1 = new Set(text1.match(/[a-z0-9]+/g) || [])
  const words2 = new Set(text2.match(/[a-z0-9]+/g) || [])
  
  // 공통 단어 계산
  const commonWords = new Set([...words1].filter(word => words2.has(word)))
  
  // Jaccard 유사도: 교집합 / 합집합
  const union = new Set([...words1, ...words2])
  
  if (union.size === 0) return 0
  
  return commonWords.size / union.size
}


const ConnectMapPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([])
  const [ideaNodes, setIdeaNodes] = useState<IdeaNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [hoveredIdea, setHoveredIdea] = useState<string | null>(null)
  
  // 3D 공간 상태
  const [rotation, setRotation] = useState({ x: -15, y: 25, z: 0 }) // 초기 회전 각도
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate') // 드래그 모드
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, rotationX: 0, rotationY: 0, transformX: 0, transformY: 0 })
  const [animationFrame, setAnimationFrame] = useState(0) // 애니메이션 프레임
  
  // Add Idea 모달 상태
  const [isAddIdeaModalOpen, setIsAddIdeaModalOpen] = useState(false)
  const [ideaInput, setIdeaInput] = useState('')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([])
  const ideaTextareaRef = useRef<HTMLTextAreaElement>(null)
  const DEFAULT_SUGGESTED: string[] = []
  const displaySuggestedKeywords =
    suggestedKeywords.length > 0 ? suggestedKeywords : DEFAULT_SUGGESTED

  // 키워드 추출 함수 (MainPage와 동일)
  const extractKeywords = useCallback((text: string): string[] => {
    if (!text.trim()) return []

    const textLower = text.toLowerCase()
    const keywordScores: Array<{ keyword: string; score: number }> = []

    AVAILABLE_KEYWORDS.forEach(keyword => {
      if (selectedKeywords.includes(keyword)) return

      const keywordLower = keyword.toLowerCase()
      let score = 0

      const exactMatches = (textLower.match(new RegExp(`\\b${keywordLower}\\b`, 'gi')) || []).length
      score += exactMatches * 10

      const relatedWords: Record<string, string[]> = {
        'technology': ['tech', 'technical', 'technological', 'software', 'hardware', 'system', 'platform', 'application', 'algorithm', 'computing', 'digital', 'electronic', 'ai', 'ml', 'iot', 'cloud'],
        'innovation': ['innovative', 'innovate', 'novel', 'new', 'breakthrough', 'revolutionary', 'disruptive', 'creative', 'original', 'pioneering'],
        'data': ['dataset', 'database', 'analytics', 'analysis', 'information', 'dataset', 'processing', 'mining', 'collection', 'storage'],
        'design': ['designing', 'designed', 'architecture', 'structure', 'layout', 'interface', 'ui', 'ux', 'user experience', 'visual'],
        'business': ['business', 'commercial', 'enterprise', 'company', 'organization', 'market', 'customer', 'client', 'revenue', 'profit'],
        'research': ['research', 'study', 'investigation', 'experiment', 'academic', 'scientific', 'analysis', 'findings', 'discovery'],
        'development': ['develop', 'developing', 'building', 'creating', 'construction', 'implementation', 'programming', 'coding', 'engineering']
      }

      if (relatedWords[keywordLower]) {
        relatedWords[keywordLower].forEach(word => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi')
          const matches = textLower.match(regex)
          if (matches) {
            score += matches.length * 3
          }
        })
      }

      const firstSentence = text.split(/[.!?。！？\n]/)[0]?.toLowerCase() || ''
      if (firstSentence.includes(keywordLower)) {
        score += 5
      }

      if (score > 0) {
        keywordScores.push({ keyword, score })
      }
    })

    return keywordScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map(item => item.keyword)
      .filter(k => k && !selectedKeywords.includes(k))
  }, [selectedKeywords])

  // 키워드 추출 useEffect
  useEffect(() => {
    if (ideaInput && isAddIdeaModalOpen) {
      const extracted = extractKeywords(ideaInput)
      setSuggestedKeywords(extracted)
    } else {
      setSuggestedKeywords([])
    }
  }, [ideaInput, selectedKeywords, extractKeywords, isAddIdeaModalOpen])

  // textarea 높이 자동 조절
  useEffect(() => {
    if (ideaTextareaRef.current) {
      ideaTextareaRef.current.style.height = 'auto'
      ideaTextareaRef.current.style.height = `${ideaTextareaRef.current.scrollHeight}px`
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

  const handleOpenAddIdeaModal = () => {
    setIsAddIdeaModalOpen(true)
  }

  const handleCloseAddIdeaModal = () => {
    setIsAddIdeaModalOpen(false)
    setIdeaInput('')
    setSelectedKeywords([])
    setSuggestedKeywords([])
  }

  const handleAddIdeaSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ideaInput.trim()) {
      return
    }

    const newIdea: Idea = {
      id: Date.now().toString(),
      title: ideaInput.split('\n')[0].substring(0, 50),
      content: ideaInput,
      keywords: selectedKeywords.length > 0 ? selectedKeywords : [],
      createdAt: new Date().toISOString(),
      bookmarked: false,
    }

    // 현재 ideas 상태를 직접 사용하여 업데이트
    const updatedIdeas = [newIdea, ...ideas]
    localStorage.setItem('ideas', JSON.stringify(updatedIdeas))
    
    // 상태 업데이트 후 모달 닫기
    setIdeas(updatedIdeas)
    handleCloseAddIdeaModal()
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!e.shiftKey) {
        handleAddIdeaSubmit(e as any)
      }
    }
  }

  // 아이디어 로드 (localStorage와 mock 데이터 병합)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const stored = localStorage.getItem('ideas')
    let storedIdeas: Idea[] = []
    
    if (stored && stored !== '[]' && stored.trim() !== '[]') {
      try {
        const parsed = JSON.parse(stored) as Idea[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          storedIdeas = parsed
        }
      } catch (e) {
        console.error('Error parsing localStorage ideas:', e)
      }
    }
    
    // mock 데이터와 localStorage 데이터 병합 (중복 제거)
    const mockData = mockIdeas as Idea[]
    const mockIds = new Set(mockData.map(idea => idea.id))
    
    // localStorage에 있는 아이디어 중 mock 데이터에 없는 것만 필터링
    const userAddedIdeas = storedIdeas.filter(idea => !mockIds.has(idea.id))
    
    // mock 데이터 + 사용자가 추가한 아이디어
    const allIdeas = [...mockData, ...userAddedIdeas]
    
    setIdeas(allIdeas)
    
    // localStorage에도 병합된 데이터 저장
    if (allIdeas.length > 0) {
      localStorage.setItem('ideas', JSON.stringify(allIdeas))
    }
  }, [])

  // 키워드 그룹 생성 및 3D 배치
  useEffect(() => {
    if (ideas.length === 0) return

    // 키워드별 아이디어 그룹화
    const groupsMap = new Map<string, Idea[]>()
    
    ideas.forEach(idea => {
      idea.keywords.forEach(keyword => {
        if (!groupsMap.has(keyword)) {
          groupsMap.set(keyword, [])
        }
        groupsMap.get(keyword)!.push(idea)
      })
    })

    // 아이디어가 있는 키워드만 필터링
    const groupsWithIdeas = Array.from(groupsMap.entries()).filter(([_, ideasList]) => ideasList.length > 0)
    const groupCount = groupsWithIdeas.length
    const radius = 700 // 키워드 그룹 간 간격
    
    // 먼저 아이디어 노드들의 위치를 계산 (임시 그룹 중심 사용)
    const tempGroups = new Map<string, { ideas: Idea[], tempPosition: { x: number, y: number, z: number } }>()
    let index = 0
    
    groupsWithIdeas.forEach(([keyword, ideasList]) => {
      // 구 형태로 임시 그룹 중심 배치
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const y = groupCount > 1 ? 1 - (index / (groupCount - 1)) * 2 : 0
      const radius_at_y = Math.sqrt(1 - y * y)
      const theta = goldenAngle * index
      const x = Math.cos(theta) * radius_at_y * radius
      const z = Math.sin(theta) * radius_at_y * radius
      
      tempGroups.set(keyword, {
        ideas: ideasList,
        tempPosition: { x, y: y * 500, z }
      })
      index++
    })

    // 아이디어 노드 생성 (각 아이디어는 한 번만 표시)
    const nodes: IdeaNode[] = []
    const processedIdeaIds = new Set<string>()
    
    // 각 아이디어를 주 키워드(첫 번째 키워드)에만 배치
    // 단, 키워드가 2개인 경우 두 키워드 영역 사이에 배치
    ideas.forEach(idea => {
      if (processedIdeaIds.has(idea.id)) return
      processedIdeaIds.add(idea.id)
      
      const primaryKeyword = idea.keywords[0] || 'Technology'
      const secondaryKeyword = idea.keywords[1]
      const hasTwoKeywords = idea.keywords.length >= 2 && secondaryKeyword && tempGroups.has(secondaryKeyword)
      
      let finalPosition: { x: number; y: number; z: number }
      let finalKeyword: string
      
      if (hasTwoKeywords) {
        // 키워드가 2개인 경우: 두 키워드 그룹 위치의 중간 지점에 배치
        const primaryGroup = tempGroups.get(primaryKeyword)
        const secondaryGroup = tempGroups.get(secondaryKeyword)
        
        if (!primaryGroup || !secondaryGroup) {
          // 두 그룹이 모두 존재하지 않으면 기본 로직 사용
          const tempGroup = primaryGroup || tempGroups.get(primaryKeyword)
          if (!tempGroup) return
          const groupIdeas = Array.from(new Set(tempGroup.ideas.map(i => i.id))).map(id => 
            tempGroup.ideas.find(i => i.id === id)!
          )
          const ideaIndex = groupIdeas.findIndex(i => i.id === idea.id)
          if (ideaIndex === -1) return
          
          const goldenAngle = Math.PI * (3 - Math.sqrt(5))
          const ideaY = groupIdeas.length > 1 ? 1 - (ideaIndex / (groupIdeas.length - 1)) * 2 : 0
          const radius_at_y = Math.sqrt(Math.max(0, 1 - ideaY * ideaY))
          const theta = goldenAngle * ideaIndex
          // 노드 간 간격을 늘리기 위해 박스 크기와 배치 반경 증가
          const minNodeSpacing = 150
          const tempBoxWidth = Math.max(400, Math.min(1000, groupIdeas.length * minNodeSpacing))
          const tempBoxHeight = Math.max(300, Math.min(900, groupIdeas.length * minNodeSpacing * 0.8))
          const tempBoxDepth = Math.max(200, Math.min(700, groupIdeas.length * minNodeSpacing * 0.6))
          const safeRadiusX = (tempBoxWidth / 2) * 0.65 // 0.7 -> 0.65로 감소하여 간격 증가
          const safeRadiusY = (tempBoxHeight / 2) * 0.65
          const safeRadiusZ = (tempBoxDepth / 2) * 0.65
          const sphereRadius = Math.min(safeRadiusX, safeRadiusZ)
          
          finalPosition = {
            x: tempGroup.tempPosition.x + Math.cos(theta) * radius_at_y * sphereRadius,
            y: tempGroup.tempPosition.y + ideaY * safeRadiusY,
            z: tempGroup.tempPosition.z + Math.sin(theta) * radius_at_y * sphereRadius
          }
          finalKeyword = primaryKeyword
        } else {
          // 두 그룹 위치의 중간 지점
          finalPosition = {
            x: (primaryGroup.tempPosition.x + secondaryGroup.tempPosition.x) / 2,
            y: (primaryGroup.tempPosition.y + secondaryGroup.tempPosition.y) / 2,
            z: (primaryGroup.tempPosition.z + secondaryGroup.tempPosition.z) / 2,
          }
          finalKeyword = primaryKeyword // 렌더링용으로는 primaryKeyword 사용
        }
      } else {
        // 키워드가 1개인 경우: 기존 로직 사용
        const tempGroup = tempGroups.get(primaryKeyword)
        if (!tempGroup) return
        
        const groupIdeas = Array.from(new Set(tempGroup.ideas.map(i => i.id))).map(id => 
          tempGroup.ideas.find(i => i.id === id)!
        )
        const ideaIndex = groupIdeas.findIndex(i => i.id === idea.id)
        if (ideaIndex === -1) return
        
        // 노드 간 간격을 늘리기 위해 박스 크기와 배치 반경 증가
        const minNodeSpacing = 200 // 더 큰 간격
        const tempBoxWidth = Math.max(500, groupIdeas.length * minNodeSpacing)
        const tempBoxHeight = Math.max(400, groupIdeas.length * minNodeSpacing * 0.8)
        const tempBoxDepth = Math.max(300, groupIdeas.length * minNodeSpacing * 0.6)
        
        const safeRadiusX = (tempBoxWidth / 2) * 0.8 // 더 넓게
        const safeRadiusY = (tempBoxHeight / 2) * 0.8
        const safeRadiusZ = (tempBoxDepth / 2) * 0.8
        
        // 노드 ID를 기반으로 고유한 시드 생성
        const nodeSeed = idea.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const uniqueIdx = ideaIndex + (nodeSeed % 100) / 1000 // 0.000~0.099 범위의 고유 오프셋
        
        // 구 형태로 배치하되 각도와 반경을 더 균등하게
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        const ideaY = groupIdeas.length > 1 ? 1 - (uniqueIdx / (groupIdeas.length - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(Math.max(0, 1 - ideaY * ideaY))
        // 각 노드마다 고유한 각도 부여 (노드 ID 기반)
        const theta = goldenAngle * uniqueIdx + (nodeSeed % 1000) * 0.001
        
        const sphereRadius = Math.min(safeRadiusX, safeRadiusZ) * 0.75
        finalPosition = {
          x: tempGroup.tempPosition.x + Math.cos(theta) * radius_at_y * sphereRadius,
          y: tempGroup.tempPosition.y + ideaY * safeRadiusY * 0.75,
          z: tempGroup.tempPosition.z + Math.sin(theta) * radius_at_y * sphereRadius
        }
        finalKeyword = primaryKeyword
      }

      nodes.push({
        ...idea,
        position: finalPosition,
        keyword: finalKeyword,
      })
    })

    // 각 키워드 그룹별로 노드들의 실제 위치 범위 계산 및 재조정
    const keywordNodes = new Map<string, IdeaNode[]>()
    nodes.forEach(node => {
      if (!keywordNodes.has(node.keyword)) {
        keywordNodes.set(node.keyword, [])
      }
      keywordNodes.get(node.keyword)!.push(node)
    })

    const groups: KeywordGroup[] = []
    const updatedNodes: IdeaNode[] = []
    const twoKeywordNodesMap = new Map<string, IdeaNode>() // 키워드가 2개인 노드들 (ID로 중복 제거)
    
    groupsWithIdeas.forEach(([keyword, ideasList]) => {
      const keywordNodeList = keywordNodes.get(keyword) || []
      if (keywordNodeList.length === 0) return
      
      // 키워드가 2개인 노드는 별도로 수집 (나중에 교집합 위치에 배치)
      keywordNodeList.forEach(node => {
        const hasTwoKeywords = node.keywords && node.keywords.length >= 2
        if (hasTwoKeywords) {
          twoKeywordNodesMap.set(node.id, node)
        }
      })
      
      // 키워드가 2개가 아닌 노드들의 위치만 사용하여 박스 크기 계산
      const singleKeywordNodePositions = keywordNodeList
        .filter(node => !(node.keywords && node.keywords.length >= 2))
        .map(n => n.position)
      
      // 노드가 하나일 때와 여러 개일 때 처리
      let minX, maxX, minY, maxY, minZ, maxZ
      if (singleKeywordNodePositions.length === 1) {
        const pos = singleKeywordNodePositions[0]
        const singleNodePadding = 100
        minX = pos.x - singleNodePadding
        maxX = pos.x + singleNodePadding
        minY = pos.y - singleNodePadding
        maxY = pos.y + singleNodePadding
        minZ = pos.z - singleNodePadding
        maxZ = pos.z + singleNodePadding
      } else if (singleKeywordNodePositions.length > 1) {
        minX = Math.min(...singleKeywordNodePositions.map(p => p.x))
        maxX = Math.max(...singleKeywordNodePositions.map(p => p.x))
        minY = Math.min(...singleKeywordNodePositions.map(p => p.y))
        maxY = Math.max(...singleKeywordNodePositions.map(p => p.y))
        minZ = Math.min(...singleKeywordNodePositions.map(p => p.z))
        maxZ = Math.max(...singleKeywordNodePositions.map(p => p.z))
      } else {
        // 단일 키워드 노드가 없으면 기본값 사용
        const defaultPos = keywordNodeList[0]?.position || { x: 0, y: 0, z: 0 }
        minX = maxX = defaultPos.x
        minY = maxY = defaultPos.y
        minZ = maxZ = defaultPos.z
      }
      
      // 박스 크기는 노드 범위 + 여백 (노드가 박스 안에 확실히 들어가도록)
      // 노드 간 간격을 늘리기 위해 padding과 최소 크기 증가
      const padding = 120
      const minNodeSpacing = 150 // 노드 간 최소 간격
      const nodeCount = keywordNodeList.filter(n => !(n.keywords && n.keywords.length >= 2)).length
      
      // 노드 개수에 따라 최소 박스 크기 계산
      const minBoxWidth = Math.max(400, nodeCount * minNodeSpacing)
      const minBoxHeight = Math.max(300, nodeCount * minNodeSpacing * 0.8)
      const minBoxDepth = Math.max(200, nodeCount * minNodeSpacing * 0.6)
      
      const boxWidth = Math.max(minBoxWidth, maxX - minX + padding * 2)
      const boxHeight = Math.max(minBoxHeight, maxY - minY + padding * 2)
      const boxDepth = Math.max(minBoxDepth, maxZ - minZ + padding * 2)
      
      // 박스 중심은 노드들의 중심
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const centerZ = (minZ + maxZ) / 2
      
      // 박스 경계 내부에서 노드들이 확실히 들어가도록 위치 재조정
      const halfWidth = boxWidth / 2 - padding
      const halfHeight = boxHeight / 2 - padding
      const halfDepth = boxDepth / 2 - padding
      
      // 키워드가 2개가 아닌 노드들만 필터링하여 정확한 인덱스 계산
      const singleKeywordNodes = keywordNodeList.filter(node => {
        return !(node.keywords && node.keywords.length >= 2)
      })
      
      // 노드 간 최소 거리 보장
      const minDistance = 250 // 노드 간 최소 거리 증가 (픽셀)
      const placedNodes: Array<{ x: number; y: number; z: number }> = []
      
      singleKeywordNodes.forEach((node, idx) => {
        // 노드 ID를 기반으로 고유한 시드 생성 (같은 인덱스라도 다른 위치)
        const nodeSeed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const uniqueIdx = idx + (nodeSeed % 100) / 1000 // 0.000~0.099 범위의 고유 오프셋
        
        // 노드를 박스 중심 기준으로 재배치
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        const ideaY = singleKeywordNodes.length > 1 ? 1 - (uniqueIdx / (singleKeywordNodes.length - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(Math.max(0, 1 - ideaY * ideaY))
        // 각 노드마다 고유한 각도 부여 (노드 ID 기반 고유성 보장)
        const theta = goldenAngle * uniqueIdx + (nodeSeed % 1000) * 0.001
        
        // 박스 경계 정의 (더 엄격한 경계)
        const boxMinX = centerX - halfWidth
        const boxMaxX = centerX + halfWidth
        const boxMinY = centerY - halfHeight
        const boxMaxY = centerY + halfHeight
        const boxMinZ = centerZ - halfDepth
        const boxMaxZ = centerZ + halfDepth
        
        // 박스 내부에 구 형태로 배치 (반경을 더 줄여서 박스 내부에 확실히 포함)
        // 안전 여유 공간을 고려한 반경 계산
        const safeMargin = 50 // 안전 여유 공간
        const maxSafeRadius = Math.min(
          halfWidth - safeMargin,
          halfDepth - safeMargin,
          Math.min(halfWidth, halfDepth) * 0.6 // 더 보수적인 반경
        )
        let sphereRadius = Math.max(50, maxSafeRadius) // 최소 50px 보장
        let x = centerX + Math.cos(theta) * radius_at_y * sphereRadius
        let y = centerY + ideaY * Math.max(halfHeight * 0.65, 100) // 최소 높이 보장
        let z = centerZ + Math.sin(theta) * radius_at_y * sphereRadius
        
        // 초기 배치 후 즉시 박스 경계 내로 클리핑
        x = Math.max(boxMinX + safeMargin, Math.min(boxMaxX - safeMargin, x))
        y = Math.max(boxMinY + safeMargin, Math.min(boxMaxY - safeMargin, y))
        z = Math.max(boxMinZ + safeMargin, Math.min(boxMaxZ - safeMargin, z))
        
        // 이미 배치된 노드들과 충돌 검사 및 최소 거리 보장
        let attempts = 0
        const maxAttempts = 100
        while (attempts < maxAttempts) {
          let tooClose = false
          for (const placed of placedNodes) {
            const distance = Math.sqrt(
              Math.pow(x - placed.x, 2) + 
              Math.pow(y - placed.y, 2) + 
              Math.pow(z - placed.z, 2)
            )
            if (distance < minDistance) {
              tooClose = true
              // 충돌 방지를 위해 각도와 반경을 약간 조정 (박스 경계 내에서)
              const adjustAngle = (attempts * 0.15) % (Math.PI * 2)
              // 반경 증가를 더 제한하여 박스 경계를 넘지 않도록
              const maxAllowedRadius = Math.min(halfWidth - safeMargin, halfDepth - safeMargin) * 0.9
              const adjustRadius = Math.min(maxSafeRadius * 0.3, (attempts * 0.015) % maxSafeRadius)
              const newRadius = Math.min(sphereRadius + adjustRadius, maxAllowedRadius)
              
              x = centerX + Math.cos(theta + adjustAngle) * radius_at_y * newRadius
              y = centerY + ideaY * Math.max(halfHeight * 0.65, 100) + (attempts % 3 - 1) * minDistance * 0.15
              z = centerZ + Math.sin(theta + adjustAngle) * radius_at_y * newRadius
              
              // 박스 경계 내에 확실히 위치하도록 클리핑 (더 엄격하게)
              x = Math.max(boxMinX + safeMargin, Math.min(boxMaxX - safeMargin, x))
              y = Math.max(boxMinY + safeMargin, Math.min(boxMaxY - safeMargin, y))
              z = Math.max(boxMinZ + safeMargin, Math.min(boxMaxZ - safeMargin, z))
              break
            }
          }
          if (!tooClose) break
          attempts++
        }
        
        // 최종 위치가 박스 경계 내에 있는지 확인 및 클리핑 (더 엄격하게)
        const finalSafeMargin = 50
        x = Math.max(boxMinX + finalSafeMargin, Math.min(boxMaxX - finalSafeMargin, x))
        y = Math.max(boxMinY + finalSafeMargin, Math.min(boxMaxY - finalSafeMargin, y))
        z = Math.max(boxMinZ + finalSafeMargin, Math.min(boxMaxZ - finalSafeMargin, z))
        
        placedNodes.push({ x, y, z })
        
        updatedNodes.push({
          ...node,
          position: { x, y, z },
        })
      })
      
      groups.push({
        keyword,
        color: KEYWORD_COLORS[keyword] || '#666666',
        ideas: ideasList,
        position: { x: centerX, y: centerY, z: centerZ },
        boxSize: {
          width: boxWidth,
          height: boxHeight,
          depth: boxDepth,
        },
      })
    })
    
    // 키워드가 2개인 노드들을 두 박스의 교집합 위치에 배치 (각 노드마다 고유한 위치 보장)
    const twoKeywordNodesList = Array.from(twoKeywordNodesMap.values())
    const twoKeywordPlacedNodes: Array<{ x: number; y: number; z: number }> = []
    const twoKeywordMinDistance = 350 // 노드 간 최소 거리 증가 (250 -> 350)
    const intersectionPadding = 150 // 교집합 영역 확장을 위한 padding
    
    twoKeywordNodesList.forEach((node, idx) => {
      if (updatedNodes.find(n => n.id === node.id)) return // 이미 추가된 노드는 스킵
      
      const primaryKeyword = node.keywords[0]
      const secondaryKeyword = node.keywords[1]
      if (!primaryKeyword || !secondaryKeyword) return
      
      const primaryGroup = groups.find(g => g.keyword === primaryKeyword)
      const secondaryGroup = groups.find(g => g.keyword === secondaryKeyword)
      
      if (!primaryGroup || !secondaryGroup) {
        // 두 그룹이 모두 없으면 원래 위치 유지
        updatedNodes.push(node)
        return
      }
      
      // 두 박스의 교집합 계산
      const box1 = {
        minX: primaryGroup.position.x - primaryGroup.boxSize.width / 2,
        maxX: primaryGroup.position.x + primaryGroup.boxSize.width / 2,
        minY: primaryGroup.position.y - primaryGroup.boxSize.height / 2,
        maxY: primaryGroup.position.y + primaryGroup.boxSize.height / 2,
        minZ: primaryGroup.position.z - primaryGroup.boxSize.depth / 2,
        maxZ: primaryGroup.position.z + primaryGroup.boxSize.depth / 2,
      }
      
      const box2 = {
        minX: secondaryGroup.position.x - secondaryGroup.boxSize.width / 2,
        maxX: secondaryGroup.position.x + secondaryGroup.boxSize.width / 2,
        minY: secondaryGroup.position.y - secondaryGroup.boxSize.height / 2,
        maxY: secondaryGroup.position.y + secondaryGroup.boxSize.height / 2,
        minZ: secondaryGroup.position.z - secondaryGroup.boxSize.depth / 2,
        maxZ: secondaryGroup.position.z + secondaryGroup.boxSize.depth / 2,
      }
      
      // 교집합 영역 계산 (padding 추가하여 영역 확장)
      const intersectionMinX = Math.max(box1.minX, box2.minX) - intersectionPadding
      const intersectionMaxX = Math.min(box1.maxX, box2.maxX) + intersectionPadding
      const intersectionMinY = Math.max(box1.minY, box2.minY) - intersectionPadding
      const intersectionMaxY = Math.min(box1.maxY, box2.maxY) + intersectionPadding
      const intersectionMinZ = Math.max(box1.minZ, box2.minZ) - intersectionPadding
      const intersectionMaxZ = Math.min(box1.maxZ, box2.maxZ) + intersectionPadding
      
      let finalPosition: { x: number; y: number; z: number }
      
      // 교집합이 존재하는 경우 (박스가 겹치는 경우)
      if (intersectionMinX < intersectionMaxX && 
          intersectionMinY < intersectionMaxY && 
          intersectionMinZ < intersectionMaxZ) {
        // 교집합 영역 내에서 노드 ID 기반 고유 위치 계산
        const intersectionCenter = {
          x: (intersectionMinX + intersectionMaxX) / 2,
          y: (intersectionMinY + intersectionMaxY) / 2,
          z: (intersectionMinZ + intersectionMaxZ) / 2,
        }
        
        // 교집합 영역 크기
        const intersectionWidth = intersectionMaxX - intersectionMinX
        const intersectionHeight = intersectionMaxY - intersectionMinY
        const intersectionDepth = intersectionMaxZ - intersectionMinZ
        
        // 노드 ID를 기반으로 고유한 시드 생성
        const nodeSeed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        
        // 교집합 영역 내에서 구 형태로 배치 (여러 노드가 있을 경우)
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        const uniqueIdx = idx + (nodeSeed % 100) / 1000
        const ideaY = twoKeywordNodesList.length > 1 ? 1 - (uniqueIdx / (twoKeywordNodesList.length - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(Math.max(0, 1 - ideaY * ideaY))
        const theta = goldenAngle * uniqueIdx + (nodeSeed % 1000) * 0.001
        
        // 교집합 영역의 반경 (최소 거리를 고려하여 더 넓게)
        const maxRadius = Math.min(intersectionWidth, intersectionDepth) / 2 - twoKeywordMinDistance / 2
        const sphereRadius = Math.max(150, Math.min(maxRadius, 300)) // 최소 반경 150, 최대 300
        
        let x = intersectionCenter.x + Math.cos(theta) * radius_at_y * sphereRadius
        let y = intersectionCenter.y + ideaY * Math.max(intersectionHeight / 2 - twoKeywordMinDistance / 2, 150) * 0.9
        let z = intersectionCenter.z + Math.sin(theta) * radius_at_y * sphereRadius
        
        // 교집합 영역 내에 확실히 위치하도록 클리핑 (더 큰 여유 공간)
        x = Math.max(intersectionMinX + 100, Math.min(intersectionMaxX - 100, x))
        y = Math.max(intersectionMinY + 100, Math.min(intersectionMaxY - 100, y))
        z = Math.max(intersectionMinZ + 100, Math.min(intersectionMaxZ - 100, z))
        
        // 이미 배치된 노드들과 충돌 검사
        let attempts = 0
        const maxAttempts = 50
        while (attempts < maxAttempts) {
          let tooClose = false
          for (const placed of twoKeywordPlacedNodes) {
            const distance = Math.sqrt(
              Math.pow(x - placed.x, 2) + 
              Math.pow(y - placed.y, 2) + 
              Math.pow(z - placed.z, 2)
            )
            if (distance < twoKeywordMinDistance) {
              tooClose = true
              // 충돌 방지를 위해 위치 조정 (더 큰 간격)
              const adjustAngle = (attempts * 0.3) % (Math.PI * 2)
              const adjustRadius = Math.min(sphereRadius * 1.5, twoKeywordMinDistance * (attempts * 0.15 + 1))
              x = intersectionCenter.x + Math.cos(theta + adjustAngle) * radius_at_y * adjustRadius
              y = intersectionCenter.y + ideaY * Math.max(intersectionHeight / 2, 150) * 0.9 + (attempts % 3 - 1) * twoKeywordMinDistance * 0.3
              z = intersectionCenter.z + Math.sin(theta + adjustAngle) * radius_at_y * adjustRadius
              // 클리핑 재적용
              x = Math.max(intersectionMinX + 100, Math.min(intersectionMaxX - 100, x))
              y = Math.max(intersectionMinY + 100, Math.min(intersectionMaxY - 100, y))
              z = Math.max(intersectionMinZ + 100, Math.min(intersectionMaxZ - 100, z))
              break
            }
          }
          if (!tooClose) break
          attempts++
        }
        
        finalPosition = { x, y, z }
      } else {
        // 교집합이 없는 경우 (박스가 겹치지 않는 경우) 두 박스 중심의 중간 지점
        const midPoint = {
          x: (primaryGroup.position.x + secondaryGroup.position.x) / 2,
          y: (primaryGroup.position.y + secondaryGroup.position.y) / 2,
          z: (primaryGroup.position.z + secondaryGroup.position.z) / 2,
        }
        
        // 노드 ID 기반으로 약간의 오프셋 추가하여 겹침 방지 (더 큰 오프셋)
        const nodeSeed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        const uniqueIdx = idx + (nodeSeed % 100) / 1000
        const ideaY = twoKeywordNodesList.length > 1 ? 1 - (uniqueIdx / (twoKeywordNodesList.length - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(Math.max(0, 1 - ideaY * ideaY))
        const theta = goldenAngle * uniqueIdx + (nodeSeed % 1000) * 0.001
        
        // 중간 지점 주변에 구 형태로 배치
        const sphereRadius = twoKeywordMinDistance * 0.8
        let x = midPoint.x + Math.cos(theta) * radius_at_y * sphereRadius
        let y = midPoint.y + ideaY * sphereRadius * 0.8
        let z = midPoint.z + Math.sin(theta) * radius_at_y * sphereRadius
        
        // 충돌 검사
        let attempts = 0
        while (attempts < 50) {
          let tooClose = false
          for (const placed of twoKeywordPlacedNodes) {
            const distance = Math.sqrt(
              Math.pow(x - placed.x, 2) + 
              Math.pow(y - placed.y, 2) + 
              Math.pow(z - placed.z, 2)
            )
            if (distance < twoKeywordMinDistance) {
              tooClose = true
              const adjustAngle = (attempts * 0.3) % (Math.PI * 2)
              const adjustRadius = twoKeywordMinDistance * (attempts * 0.2 + 1)
              x = midPoint.x + Math.cos(theta + adjustAngle) * radius_at_y * adjustRadius
              y = midPoint.y + ideaY * adjustRadius * 0.8 + (attempts % 3 - 1) * twoKeywordMinDistance * 0.3
              z = midPoint.z + Math.sin(theta + adjustAngle) * radius_at_y * adjustRadius
              break
            }
          }
          if (!tooClose) break
          attempts++
        }
        
        finalPosition = { x, y, z }
      }
      
      twoKeywordPlacedNodes.push(finalPosition)
      
      updatedNodes.push({
        ...node,
        position: finalPosition,
      })
    })

    setKeywordGroups(groups)

    // 연결선 생성
    const conns: Connection[] = []
    
    // 같은 키워드 내부 연결 (유사도 기반)
    const nodesForConnections = updatedNodes.length > 0 ? updatedNodes : nodes
    const SIMILARITY_THRESHOLD_SAME = 0.15 // 같은 키워드 내부 연결 임계값 (15%)
    const SIMILARITY_THRESHOLD_CROSS = 0.20 // 다른 키워드 간 연결 임계값 (20%)
    
    groups.forEach(group => {
      const groupNodes = nodesForConnections.filter((n: IdeaNode) => n.keyword === group.keyword)
      for (let i = 0; i < groupNodes.length; i++) {
        for (let j = i + 1; j < groupNodes.length; j++) {
          // 유사도 계산
          const similarity = calculateSimilarity(groupNodes[i], groupNodes[j])
          
          // 유사도가 임계값 이상이면 연결
          if (similarity >= SIMILARITY_THRESHOLD_SAME) {
            // 유사도가 낮을수록 점선 확률 증가
            const isDotted = similarity < 0.25 // 유사도가 0.25 미만이면 점선
            conns.push({
              source: groupNodes[i],
              target: groupNodes[j],
              type: 'same-keyword',
              isDotted,
            })
          }
        }
      }
    })

    // 다른 키워드 간 연결 (유사도 기반)
    for (let i = 0; i < nodesForConnections.length; i++) {
      for (let j = i + 1; j < nodesForConnections.length; j++) {
        if (nodesForConnections[i].keyword !== nodesForConnections[j].keyword) {
          // 유사도 계산
          const similarity = calculateSimilarity(nodesForConnections[i], nodesForConnections[j])
          
          // 유사도가 임계값 이상이면 연결 (유사한 맥락이나 내용)
          if (similarity >= SIMILARITY_THRESHOLD_CROSS) {
            conns.push({
              source: nodesForConnections[i],
              target: nodesForConnections[j],
              type: 'cross-keyword',
              isDotted: false,
            })
          }
        }
      }
    }

    // 각 노드의 연결 개수 계산 및 연결된 키워드 수집
    const nodeConnectionCounts = new Map<string, number>()
    const nodeConnectedKeywords = new Map<string, Set<string>>() // 노드별 연결된 키워드들
    
    nodesForConnections.forEach(node => {
      nodeConnectionCounts.set(node.id, 0)
      nodeConnectedKeywords.set(node.id, new Set([node.keyword])) // 자기 자신의 키워드 포함
    })
    
    conns.forEach(conn => {
      const sourceCount = nodeConnectionCounts.get(conn.source.id) || 0
      const targetCount = nodeConnectionCounts.get(conn.target.id) || 0
      nodeConnectionCounts.set(conn.source.id, sourceCount + 1)
      nodeConnectionCounts.set(conn.target.id, targetCount + 1)
      
      // 다른 키워드와 연결된 경우 키워드 수집
      if (conn.type === 'cross-keyword') {
        const sourceKeywords = nodeConnectedKeywords.get(conn.source.id) || new Set()
        const targetKeywords = nodeConnectedKeywords.get(conn.target.id) || new Set()
        sourceKeywords.add(conn.target.keyword)
        targetKeywords.add(conn.source.keyword)
        nodeConnectedKeywords.set(conn.source.id, sourceKeywords)
        nodeConnectedKeywords.set(conn.target.id, targetKeywords)
      }
    })

    // 노드 크기 결정 및 업데이트 (박스 내부에 재배치된 노드들 사용)
    const nodesWithSizes = nodesForConnections.map(node => {
      const connectionCount = nodeConnectionCounts.get(node.id) || 0
      let nodeSize: 'big' | 'mid' | 'small' = 'small'
      
      if (connectionCount >= 3) {
        nodeSize = 'big'
      } else if (connectionCount === 2) {
        nodeSize = 'mid'
      } else {
        nodeSize = 'small'
      }
      
      // 연결된 키워드들 가져오기
      const connectedKeywords = Array.from(nodeConnectedKeywords.get(node.id) || [])
      
      return {
        ...node,
        connectionCount,
        nodeSize,
        connectedKeywords, // 연결된 키워드 목록 추가
      }
    })

    // 최종 노드 배열: 박스 내부에 재배치된 노드들 + 연결 개수 기반 크기 정보
    const finalNodesWithSizes = nodesWithSizes.length > 0 ? nodesWithSizes : nodesForConnections
    
    setIdeaNodes(finalNodesWithSizes)
    setConnections(conns)
  }, [ideas])

  // 3D 좌표를 2D 화면 좌표로 변환 (카메라 회전/이동 적용)
  const project3DTo2D = useCallback((x: number, y: number, z: number) => {
    const perspective = 2000
    const scale = transform.scale
    const centerX = (containerRef.current?.clientWidth || 0) / 2
    const centerY = (containerRef.current?.clientHeight || 0) / 2
    
    // 카메라 회전 (역변환 - 카메라를 회전시키는 대신 공간을 반대로 회전)
    const radX = (-rotation.x * Math.PI) / 180
    const radY = (-rotation.y * Math.PI) / 180
    
    // X축 회전 (수직)
    let rx = x
    let ry = y * Math.cos(radX) - z * Math.sin(radX)
    let rz = y * Math.sin(radX) + z * Math.cos(radX)
    
    // Y축 회전 (수평)
    const finalX = rx * Math.cos(radY) - rz * Math.sin(radY)
    const finalZ = rx * Math.sin(radY) + rz * Math.cos(radY)
    const finalY = ry
    
    // 원근 투영
    const adjustedZ = finalZ + perspective
    const factor = Math.max(0.2, Math.min(3, perspective / adjustedZ))
    
    // 화면 이동(패닝) 적용
    const screenX = centerX + finalX * factor * scale + transform.x
    const screenY = centerY + finalY * factor * scale + transform.y
    
    return { x: screenX, y: screenY, scale: factor * scale, z: adjustedZ }
  }, [transform, rotation])

    // SVG 연결선 업데이트 (아이디어 노드와 정확히 같은 좌표 계산)
    useEffect(() => {
      if (!svgRef.current || connections.length === 0 || ideaNodes.length === 0) return

      const svg = svgRef.current
      // 기존 내용 완전히 제거 (잔상 방지)
      svg.innerHTML = ''

      // 그라데이션 및 필터 정의
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
      
      // Glow 필터 추가 (하이라이트 효과용)
      const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
      glowFilter.setAttribute('id', 'glow')
      glowFilter.setAttribute('x', '-50%')
      glowFilter.setAttribute('y', '-50%')
      glowFilter.setAttribute('width', '200%')
      glowFilter.setAttribute('height', '200%')
      
      const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur')
      feGaussianBlur.setAttribute('stdDeviation', '3')
      feGaussianBlur.setAttribute('result', 'coloredBlur')
      glowFilter.appendChild(feGaussianBlur)
      
      const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge')
      const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode')
      feMergeNode1.setAttribute('in', 'coloredBlur')
      feMerge.appendChild(feMergeNode1)
      const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode')
      feMergeNode2.setAttribute('in', 'SourceGraphic')
      feMerge.appendChild(feMergeNode2)
      glowFilter.appendChild(feMerge)
      
      defs.appendChild(glowFilter)
      svg.appendChild(defs)

      // 연결선을 투영된 Z 순서대로 정렬 (뒤에서 앞으로 그리기)
      const connectionsWithProjection = connections.map(conn => {
        const sourceNode = ideaNodes.find(n => n.id === conn.source.id)
        const targetNode = ideaNodes.find(n => n.id === conn.target.id)
        
        if (!sourceNode || !targetNode) return null
        
        const source2D = project3DTo2D(
          sourceNode.position.x,
          sourceNode.position.y,
          sourceNode.position.z
        )
        const target2D = project3DTo2D(
          targetNode.position.x,
          targetNode.position.y,
          targetNode.position.z
        )
        
        return {
          conn,
          source2D,
          target2D,
          avgZ: (source2D.z + target2D.z) / 2
        }
      }).filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => a.avgZ - b.avgZ)

      connectionsWithProjection.forEach(({ conn, source2D, target2D }, idx) => {

        const sourceGroup = keywordGroups.find(g => g.keyword === conn.source.keyword)
        const targetGroup = keywordGroups.find(g => g.keyword === conn.target.keyword)
        
        if (!sourceGroup || !targetGroup) return

        const isHighlighted = hoveredIdea === conn.source.id || hoveredIdea === conn.target.id

        if (conn.type === 'cross-keyword') {
          // 그라데이션 연결선
          // 그라데이션 방향을 화면상의 선 방향에 맞춤 (항상 소스->타겟 방향)
          const gradientId = `gradient-${idx}`
          const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
          gradient.setAttribute('id', gradientId)
          // gradientUnits를 userSpaceOnUse로 설정하여 실제 화면 좌표 기준으로 그라데이션 적용
          gradient.setAttribute('gradientUnits', 'userSpaceOnUse')
          
          // 그라데이션 방향을 화면상의 선 방향에 맞춤 (항상 소스->타겟 방향)
          gradient.setAttribute('x1', String(source2D.x))
          gradient.setAttribute('y1', String(source2D.y))
          gradient.setAttribute('x2', String(target2D.x))
          gradient.setAttribute('y2', String(target2D.y))
          
          const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
          stop1.setAttribute('offset', '0%')
          stop1.setAttribute('stop-color', sourceGroup.color)
          gradient.appendChild(stop1)
          
          const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
          stop2.setAttribute('offset', '100%')
          stop2.setAttribute('stop-color', targetGroup.color)
          gradient.appendChild(stop2)
          
          defs.appendChild(gradient)

          // 곡선 연결선 (베지어 곡선)
          const midX = (source2D.x + target2D.x) / 2
          const midY = (source2D.y + target2D.y) / 2
          const dx = target2D.x - source2D.x
          const dy = target2D.y - source2D.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const curvature = distance * 0.3
          const perpX = -dy / distance
          const perpY = dx / distance
          const controlX = midX + perpX * curvature
          const controlY = midY + perpY * curvature

          // 다른 키워드 간 연결선도 두 레이어 구조로 (그라데이션 라인 + 점선)
          const pathData = `M ${source2D.x} ${source2D.y} Q ${controlX} ${controlY} ${target2D.x} ${target2D.y}`
          
          // 연결 개수에 따라 두께 결정 (thick: 3개 이상, thin: 0-2개)
          const sourceNode = ideaNodes.find(n => n.id === conn.source.id)
          const targetNode = ideaNodes.find(n => n.id === conn.target.id)
          const sourceConnections = sourceNode?.connectionCount || 0
          const targetConnections = targetNode?.connectionCount || 0
          const avgConnections = (sourceConnections + targetConnections) / 2
          const lineSize = avgConnections >= 3 ? 'Thick' : 'thin'
          
          // 레이어 1: 그라데이션 라인 (배경, opacity 50% / 하이라이트 시 80%)
          const gradientPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          gradientPath.setAttribute('d', pathData)
          gradientPath.setAttribute('fill', 'none')
          gradientPath.setAttribute('stroke', `url(#${gradientId})`)
          const strokeWidth = lineSize === 'Thick' ? '15' : '7'
          const highlightedWidth = isHighlighted ? (lineSize === 'Thick' ? '18' : '9') : strokeWidth
          gradientPath.setAttribute('stroke-width', String(highlightedWidth))
          gradientPath.setAttribute('stroke-opacity', isHighlighted ? '0.8' : '0.5')
          gradientPath.setAttribute('stroke-linecap', 'round')
          gradientPath.setAttribute('stroke-linejoin', 'round')
          if (isHighlighted) {
            // 하이라이트 시 glow 효과
            gradientPath.setAttribute('filter', 'url(#glow)')
          }
          svg.appendChild(gradientPath)

          // 레이어 2: 점선 (dashline, dark gray / 하이라이트 시 더 진하게)
          const dashPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          dashPath.setAttribute('d', pathData)
          dashPath.setAttribute('fill', 'none')
          dashPath.setAttribute('stroke', GRAY_COLORS['800'] || '#1e1e1e')
          const dashWidth = lineSize === 'Thick' ? '1' : '0.5'
          const highlightedDashWidth = isHighlighted ? (lineSize === 'Thick' ? '1.5' : '0.75') : dashWidth
          dashPath.setAttribute('stroke-width', String(highlightedDashWidth))
          dashPath.setAttribute('stroke-dasharray', '4,4') // 점선 패턴
          dashPath.setAttribute('stroke-opacity', isHighlighted ? '1' : '1')
          dashPath.setAttribute('stroke-linecap', 'round')
          dashPath.setAttribute('stroke-linejoin', 'round')
          svg.appendChild(dashPath)
        } else {
          // 같은 키워드 내부 연결 (피그마 디자인: 두 레이어 구조)
          const midX = (source2D.x + target2D.x) / 2
          const midY = (source2D.y + target2D.y) / 2
          const dx = target2D.x - source2D.x
          const dy = target2D.y - source2D.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const curvature = distance * 0.2
          const perpX = -dy / distance
          const perpY = dx / distance
          const controlX = midX + perpX * curvature
          const controlY = midY + perpY * curvature

          const pathData = `M ${source2D.x} ${source2D.y} Q ${controlX} ${controlY} ${target2D.x} ${target2D.y}`
          
          // 연결 개수에 따라 두께 결정 (thick: 3개 이상, thin: 0-2개)
          const sourceNode = ideaNodes.find(n => n.id === conn.source.id)
          const targetNode = ideaNodes.find(n => n.id === conn.target.id)
          const sourceConnections = sourceNode?.connectionCount || 0
          const targetConnections = targetNode?.connectionCount || 0
          const avgConnections = (sourceConnections + targetConnections) / 2
          const lineSize = avgConnections >= 3 ? 'Thick' : 'thin'
          
          // 같은 키워드 내부 연결은 항상 해당 키워드 색상 사용 (그라데이션 사용 안 함)
          
          // 레이어 1: 키워드 색상 라인 (배경, opacity 50% / 하이라이트 시 80%)
          const colorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          colorPath.setAttribute('d', pathData)
          colorPath.setAttribute('fill', 'none')
          colorPath.setAttribute('stroke', sourceGroup.color)
          
          const strokeWidth = lineSize === 'Thick' ? '15' : '7'
          const highlightedWidth = isHighlighted ? (lineSize === 'Thick' ? '18' : '9') : strokeWidth
          colorPath.setAttribute('stroke-width', String(highlightedWidth))
          colorPath.setAttribute('stroke-opacity', isHighlighted ? '0.8' : '0.5')
          colorPath.setAttribute('stroke-linecap', 'round')
          colorPath.setAttribute('stroke-linejoin', 'round')
          if (isHighlighted) {
            // 하이라이트 시 glow 효과
            colorPath.setAttribute('filter', 'url(#glow)')
          }
          svg.appendChild(colorPath)

          // 레이어 2: 점선 (dashline, dark gray / 하이라이트 시 더 진하게)
          const dashPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          dashPath.setAttribute('d', pathData)
          dashPath.setAttribute('fill', 'none')
          dashPath.setAttribute('stroke', GRAY_COLORS['800'] || '#1e1e1e')
          const dashWidth = lineSize === 'Thick' ? '1' : '0.5'
          const highlightedDashWidth = isHighlighted ? (lineSize === 'Thick' ? '1.5' : '0.75') : dashWidth
          dashPath.setAttribute('stroke-width', String(highlightedDashWidth))
          dashPath.setAttribute('stroke-dasharray', '4,4') // 점선 패턴
          dashPath.setAttribute('stroke-opacity', isHighlighted ? '1' : '1')
          dashPath.setAttribute('stroke-linecap', 'round')
          dashPath.setAttribute('stroke-linejoin', 'round')
          svg.appendChild(dashPath)
        }
      })
    }, [connections, project3DTo2D, keywordGroups, hoveredIdea, ideaNodes, animationFrame])

  // 마우스 드래그 처리
  const handleMouseDown = (e: React.MouseEvent) => {
    // 오른쪽 클릭: 회전
    if (e.button === 2) {
      setIsDragging(true)
      setDragMode('rotate')
      setDragStart({ 
        x: e.clientX, 
        y: e.clientY,
        rotationX: rotation.x,
        rotationY: rotation.y,
        transformX: transform.x,
        transformY: transform.y,
      })
      e.preventDefault()
    }
    // 휠 클릭(중간 버튼): 화면 이동
    else if (e.button === 1) {
      setIsDragging(true)
      setDragMode('pan')
      setDragStart({ 
        x: e.clientX, 
        y: e.clientY,
        rotationX: rotation.x,
        rotationY: rotation.y,
        transformX: transform.x,
        transformY: transform.y,
      })
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      
      if (dragMode === 'rotate') {
        // 회전 모드
        const rotationSpeed = 0.5
        setRotation({
          x: dragStart.rotationX - deltaY * rotationSpeed,
          y: dragStart.rotationY + deltaX * rotationSpeed,
          z: rotation.z,
        })
      } else if (dragMode === 'pan') {
        // 화면 이동 모드 (패닝)
        const panSpeed = 1
        setTransform({
          ...transform,
          x: dragStart.transformX + deltaX * panSpeed,
          y: dragStart.transformY + deltaY * panSpeed,
        })
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      setIsDragging(false)
      setDragMode('rotate')
    }
  }
  
  // 휠 줌 처리
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.001
    setTransform({
      ...transform,
      scale: Math.max(0.3, Math.min(2, transform.scale + delta)),
    })
  }

  // 줌 처리
  const handleZoomIn = () => {
    setTransform({ ...transform, scale: Math.min(transform.scale * 1.2, 3) })
  }

  const handleZoomOut = () => {
    setTransform({ ...transform, scale: Math.max(transform.scale / 1.2, 0.5) })
  }

  const handleFitToScreen = () => {
    setTransform({ x: 0, y: 0, scale: 1 })
    setRotation({ x: -15, y: 25, z: 0 }) // 초기 회전 각도로 리셋
  }

  // 3D 육면체 컴포넌트 - 각 면을 3D 투영으로 렌더링
  const Cube3D = ({
    centerX,
    centerY,
    centerZ,
    width,
    height,
    depth,
    color,
    project3DTo2D,
    rotation,
  }: {
    centerX: number
    centerY: number
    centerZ: number
    width: number
    height: number
    depth: number
    color: string
    project3DTo2D: (x: number, y: number, z: number) => { x: number; y: number; z: number; scale: number }
    rotation: { x: number; y: number; z: number }
  }) => {
    // 육면체의 8개 꼭짓점 계산
    const w2 = width / 2
    const h2 = height / 2
    const d2 = depth / 2

    const vertices = [
      // 앞면 (front) - z가 큰 쪽
      { x: centerX - w2, y: centerY - h2, z: centerZ + d2 }, // 좌상
      { x: centerX + w2, y: centerY - h2, z: centerZ + d2 }, // 우상
      { x: centerX + w2, y: centerY + h2, z: centerZ + d2 }, // 우하
      { x: centerX - w2, y: centerY + h2, z: centerZ + d2 }, // 좌하
      // 뒷면 (back) - z가 작은 쪽
      { x: centerX - w2, y: centerY - h2, z: centerZ - d2 }, // 좌상
      { x: centerX + w2, y: centerY - h2, z: centerZ - d2 }, // 우상
      { x: centerX + w2, y: centerY + h2, z: centerZ - d2 }, // 우하
      { x: centerX - w2, y: centerY + h2, z: centerZ - d2 }, // 좌하
    ]

    // 각 꼭짓점을 2D로 투영
    const projectedVertices = vertices.map(v => project3DTo2D(v.x, v.y, v.z))

    // 각 면 정의 (정점 인덱스)
    const faces = [
      { name: 'front', indices: [0, 1, 2, 3] },
      { name: 'back', indices: [5, 4, 7, 6] },
      { name: 'right', indices: [1, 5, 6, 2] },
      { name: 'left', indices: [4, 0, 3, 7] },
      { name: 'top', indices: [4, 5, 1, 0] },
      { name: 'bottom', indices: [3, 2, 6, 7] },
    ]

    // 면의 깊이(평균 z)로 정렬 (뒤에서 앞으로)
    const sortedFaces = faces
      .map(face => {
        const avgZ = face.indices.reduce((sum, idx) => sum + projectedVertices[idx].z, 0) / face.indices.length
        return { ...face, avgZ }
      })
      .sort((a, b) => a.avgZ - b.avgZ)

    // SVG를 viewBox 없이 절대 좌표로 렌더링 (화면 이동과 동기화)
    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
          overflow: 'visible',
        }}
      >
        {sortedFaces.map((face, idx) => {
          const points = face.indices.map(i => {
            const v = projectedVertices[i]
            return `${v.x},${v.y}`
          }).join(' ')

          // 면이 보이는지 확인 (법선 벡터 계산)
          const v0 = vertices[face.indices[0]]
          const v1 = vertices[face.indices[1]]
          const v2 = vertices[face.indices[2]]

          // 면의 두 벡터
          const vec1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z }
          const vec2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z }

          // 외적으로 법선 벡터 계산
          const normal = {
            x: vec1.y * vec2.z - vec1.z * vec2.y,
            y: vec1.z * vec2.x - vec1.x * vec2.z,
            z: vec1.x * vec2.y - vec1.y * vec2.x,
          }

          // 카메라 방향 (회전된 z축)
          const radX = (-rotation.x * Math.PI) / 180
          const radY = (-rotation.y * Math.PI) / 180
          const cameraDir = {
            x: Math.sin(radY),
            y: Math.sin(radX),
            z: Math.cos(radX) * Math.cos(radY),
          }

          // 면이 카메라를 향하는지 확인 (dot product)
          const dot = normal.x * cameraDir.x + normal.y * cameraDir.y + normal.z * cameraDir.z
          const isFrontFace = dot > 0

          // 앞면과 뒷면의 투명도 차이
          const fillOpacity = isFrontFace ? 0.05 : 0.02
          const strokeOpacity = isFrontFace ? 1 : 0.6

          return (
            <g key={`face-${face.name}-${idx}`}>
              {/* 면의 fill */}
              <polygon
                points={points}
                fill={color}
                fillOpacity={fillOpacity}
              />
              {/* 면의 경계선 */}
              <polygon
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="0.5"
                strokeOpacity={strokeOpacity}
                strokeLinejoin="miter"
                strokeMiterlimit="10"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>
    )
  }
  
  
  // 드래그 중에는 애니메이션 일시정지
  useEffect(() => {
    if (isDragging) {
      setAnimationFrame(prev => prev) // 애니메이션 프레임 고정
    }
  }, [isDragging])

  return (
    <div className="connect-map-page">
        <div
          className={`map-container ${isDragging ? `dragging-${dragMode}` : ''}`}
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()} // 우클릭 메뉴 방지
        >
        <svg ref={svgRef} className="connections-svg" />
        
        <div className="map-3d-space">
          {keywordGroups.map((group) => {
            // 키워드 태그 위치를 육면체 상단에 더 명확하게 배치
            const tagTopProjected = project3DTo2D(
              group.position.x,
              group.position.y - group.boxSize.height / 2 - 50,
              group.position.z
            )

            return (
              <div 
                key={`group-${group.keyword}`} 
                className="keyword-group"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                {/* 3D 육면체 - 각 면을 3D 투영으로 렌더링 */}
                <Cube3D
                  centerX={group.position.x}
                  centerY={group.position.y}
                  centerZ={group.position.z}
                  width={group.boxSize.width}
                  height={group.boxSize.height}
                  depth={group.boxSize.depth}
                  color={group.color}
                  project3DTo2D={project3DTo2D}
                  rotation={rotation}
                />

                {/* 키워드 태그 - 육면체 상단에 배치 */}
                <div
                  className="keyword-tag"
                  style={{
                    position: 'absolute',
                    left: `${tagTopProjected.x}px`,
                    top: `${tagTopProjected.y}px`,
                    backgroundColor: group.color,
                    color: GRAY_COLORS['800'] || '#1e1e1e',
                    transform: `translate(-50%, -50%) scale(${Math.max(1.0, tagTopProjected.scale)})`,
                    transformOrigin: 'center',
                    zIndex: 1000, // 키워드 태그는 가장 앞에
                    pointerEvents: 'auto',
                    borderRadius: 0,
                  }}
                >
                  {group.keyword}
                </div>
              </div>
            )
          })}

          {/* 아이디어 노드들 (z 순서대로 정렬, 부유 애니메이션) */}
          {ideaNodes
            .map(node => {
              const projected = project3DTo2D(node.position.x, node.position.y, node.position.z)
              const floatOffset = isDragging ? 0 : Math.sin(animationFrame * 0.01 + node.id.charCodeAt(0) * 0.1) * 3
              return { node, projected, floatOffset }
            })
            .sort((a, b) => a.projected.z - b.projected.z) // 뒤에서 앞으로 정렬
            .map(({ node, projected: nodeProjected, floatOffset }) => {
              const isHovered = hoveredIdea === node.id
              const group = keywordGroups.find(g => g.keyword === node.keyword)
              
              // 키워드가 2개인지 확인
              const hasTwoKeywords = node.keywords && node.keywords.length >= 2
              const secondKeyword = hasTwoKeywords ? node.keywords[1] : null
              const secondGroup = secondKeyword ? keywordGroups.find(g => g.keyword === secondKeyword) : null
              
              // 노드 크기에 따른 스타일 결정
              const nodeSize = node.nodeSize || 'small'
              let nodeHeight = 18 // small
              let nodeFontSize = 10 // small
              let nodeWidth = 'auto' // small는 width 154px 고정
              
              if (nodeSize === 'big') {
                nodeHeight = 34
                nodeFontSize = 20
                nodeWidth = 'auto'
              } else if (nodeSize === 'mid') {
                nodeHeight = 23
                nodeFontSize = 12
                nodeWidth = 'auto'
              } else {
                nodeHeight = 18
                nodeFontSize = 10
                nodeWidth = '154px'
              }

              // 키워드 태그와 동일한 scale 범위 사용 (텍스트 선명도 유지)
              const baseScale = Math.max(1.0, Math.min(1.5, nodeProjected.scale))
              const isSelected = selectedIdea?.id === node.id
              const hoverScale = (isHovered || isSelected) ? 1.05 : 1
              const finalScale = baseScale * hoverScale
              
              // 그라데이션 테두리를 위한 색상
              const primaryColor = group?.color || KEYWORD_COLORS[node.keyword] || '#666666'
              const secondaryColor = secondGroup?.color || KEYWORD_COLORS[secondKeyword || ''] || primaryColor
              const useGradient = hasTwoKeywords && secondGroup && primaryColor !== secondaryColor && secondKeyword

              return (
                <div
                  key={`idea-${node.id}`}
                  className={`idea-node-wrapper ${isHovered ? 'hovered' : ''} ${selectedIdea?.id === node.id ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${nodeProjected.x}px`,
                    top: `${nodeProjected.y + floatOffset}px`,
                    transform: `translate(-50%, -50%) translateZ(0) scale(${finalScale})`,
                    transformOrigin: 'center center',
                    zIndex: (isHovered || selectedIdea?.id === node.id) ? 10000 : Math.floor(nodeProjected.z * 10) + 100, // 더 세밀한 z-index 계산
                    willChange: isDragging ? 'transform, left, top' : 'auto',
                    pointerEvents: 'auto',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out, box-shadow 0.15s ease',
                    // 텍스트 선명도 개선 - GPU 가속 및 렌더링 최적화
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  onMouseEnter={() => !isDragging && setHoveredIdea(node.id)}
                  onMouseLeave={() => {
                    // 선택된 노드는 hover 상태를 유지
                    if (selectedIdea?.id !== node.id) {
                      setHoveredIdea(null)
                    }
                  }}
                  onClick={() => {
                    if (!isDragging) {
                      setSelectedIdea(node)
                      setHoveredIdea(node.id) // 선택된 노드는 hover 상태 유지
                    }
                  }}
                >
                  {useGradient ? (
                    // 그라데이션 테두리: 외부 div에 그라데이션 배경, 내부 div로 테두리 효과
                    <div
                      style={{
                        background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                        padding: '2px',
                        height: `${nodeHeight + 4}px`,
                        width: nodeWidth === 'auto' ? 'auto' : `calc(${nodeWidth} + 4px)`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: (isHovered || selectedIdea?.id === node.id)
                          ? `0px 0px 10px rgba(0, 0, 0, 0.4), 0 0 20px ${primaryColor}60`
                          : `0px 0px 10px rgba(0, 0, 0, 0.25)`,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        className={`idea-node idea-node-${nodeSize}`}
                        style={{
                          backgroundColor: GRAY_COLORS['100'] || '#dddddd',
                          color: GRAY_COLORS['800'] || '#1e1e1e',
                          height: `${nodeHeight}px`,
                          fontSize: `${nodeFontSize}px`,
                          width: nodeWidth,
                          border: 'none',
                          padding: '2px 22px',
                          boxSizing: 'border-box',
                          filter: 'blur(0)',
                          WebkitFontSmoothing: 'antialiased',
                          MozOsxFontSmoothing: 'grayscale',
                        }}
                      >
                        <span 
                          className="idea-node-text"
                          style={{
                            transform: `scale(${1 / finalScale})`,
                            display: 'inline-block',
                          }}
                        >
                          {node.title}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // 단색 테두리
                    <div
                      className={`idea-node idea-node-${nodeSize}`}
                      style={{
                        backgroundColor: GRAY_COLORS['100'] || '#dddddd',
                        borderColor: primaryColor,
                        color: GRAY_COLORS['800'] || '#1e1e1e',
                        height: `${nodeHeight}px`,
                        fontSize: `${nodeFontSize}px`,
                        width: nodeWidth,
                        boxShadow: (isHovered || selectedIdea?.id === node.id)
                          ? `0px 0px 10px rgba(0, 0, 0, 0.4), 0 0 20px ${primaryColor}60`
                          : `0px 0px 10px rgba(0, 0, 0, 0.25)`,
                        filter: 'blur(0)',
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                      }}
                    >
                      <span 
                        className="idea-node-text"
                        style={{
                          transform: `scale(${1 / finalScale})`,
                          display: 'inline-block',
                        }}
                      >
                        {node.title}
                      </span>
                    </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 컨트롤 버튼 */}
        <div className="map-controls">
          <button className="control-btn" onClick={handleZoomIn} title="Zoom In">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
              <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14L11.1 11.1" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7.33333 5.33334V9.33334" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.33333 7.33334H9.33333" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="control-btn" onClick={handleZoomOut} title="Zoom Out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
              <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14L11.1 11.1" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.33333 7.33334H9.33333" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="control-btn" onClick={handleFitToScreen} title="Fit to Screen">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
              <path d="M10 2H14V6" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 2L9.33333 6.66667" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 14L6.66667 9.33333" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 14H2V10" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </button>
      </div>

        {/* Add New Idea 버튼 */}
        <button className="add-idea-btn" onClick={handleOpenAddIdeaModal}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" />
          </svg>
          ADD NEW IDEA
        </button>
      </div>

      {/* Node Detail Panel */}
      {selectedIdea && (
        <div className="node-detail-panel-backdrop" onClick={() => setSelectedIdea(null)}>
          <div className="node-detail-panel" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="node-detail-header">
              <h2 className="node-detail-title">IDEA DETAIL</h2>
          <button
                className="node-detail-bookmark-btn" 
                onClick={(e) => {
                  e.stopPropagation()
                  const updatedIdeas = ideas.map(idea => 
                    idea.id === selectedIdea.id 
                      ? { ...idea, bookmarked: !idea.bookmarked }
                      : idea
                  )
                  setIdeas(updatedIdeas)
                  localStorage.setItem('ideas', JSON.stringify(updatedIdeas))
                  setSelectedIdea(updatedIdeas.find(i => i.id === selectedIdea.id) || null)
                }}
              >
                {selectedIdea.bookmarked ? (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.1666 24.5L13.9999 19.8333L5.83325 24.5V5.83333C5.83325 5.21449 6.07908 4.621 6.51667 4.18342C6.95425 3.74583 7.54775 3.5 8.16659 3.5H19.8333C20.4521 3.5 21.0456 3.74583 21.4832 4.18342C21.9208 4.621 22.1666 5.21449 22.1666 5.83333V24.5Z" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10.5 11.6667L12.8333 14L17.5 9.33333" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.1666 24.5L13.9999 19.8333L5.83325 24.5V5.83333C5.83325 5.21449 6.07908 4.621 6.51667 4.18342C6.95425 3.74583 7.54775 3.5 8.16659 3.5H19.8333C20.4521 3.5 21.0456 3.74583 21.4832 4.18342C21.9208 4.621 22.1666 5.21449 22.1666 5.83333V24.5Z" stroke="#1E1E1E" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
          </button>
            </div>

            {/* Idea Content */}
            <div className="node-detail-section">
              <h3 className="node-detail-section-title">Idea content</h3>
              <p className="node-detail-content-text">{selectedIdea.content || selectedIdea.title}</p>
            </div>

            {/* Keywords */}
            <div className="node-detail-section">
              <h3 className="node-detail-section-title">keywords</h3>
              <div className="node-detail-keywords">
            {selectedIdea.keywords.map((keyword, idx) => (
                  <div 
                    key={idx} 
                    className="node-detail-keyword-tag"
                    style={{ backgroundColor: KEYWORD_COLORS[keyword] || '#666666' }}
                  >
                {keyword}
                  </div>
                ))}
              </div>
            </div>

            {/* Meta Data */}
            <div className="node-detail-section">
              <h3 className="node-detail-section-title">meta data</h3>
              <div className="node-detail-metadata">
                <div className="node-detail-metadata-row">
                  <span>Updated Time</span>
                  <span>
                    {selectedIdea.createdAt 
                      ? new Date(selectedIdea.createdAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }).replace(/(\d+)\/(\d+)\/(\d+), (.+)/, '$3. $1. $2.  |  $4')
                      : 'N/A'
                    }
              </span>
                </div>
                <div className="node-detail-metadata-row">
                  <span>Connected</span>
                  <span>
                    {connections.filter(c => 
                      c.source.id === selectedIdea.id || c.target.id === selectedIdea.id
                    ).length} Ideas
                  </span>
                </div>
              </div>
            </div>

            {/* Connected Ideas */}
            {(() => {
              const connectedIdeas = connections
                .filter(c => c.source.id === selectedIdea.id || c.target.id === selectedIdea.id)
                .map(c => c.source.id === selectedIdea.id ? c.target : c.source)
                .filter((idea, index, self) => self.findIndex(i => i.id === idea.id) === index)
                .slice(0, 3) // 최대 3개만 표시
              
              return connectedIdeas.length > 0 && (
                <div className="node-detail-section">
                  <h3 className="node-detail-section-title">connected idea</h3>
                  <div className="node-detail-connected-ideas">
                    {connectedIdeas.map((idea) => {
                      const ideaKeyword = idea.keywords[0] || 'Technology'
                      return (
                        <div key={idea.id} className="node-detail-connected-idea-item">
                          <div 
                            className="node-detail-connected-idea-dot"
                            style={{ backgroundColor: KEYWORD_COLORS[ideaKeyword] || '#666666' }}
                          />
                          <p className="node-detail-connected-idea-text">{idea.title}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* View Detail Button */}
            <button
              className="node-detail-view-btn"
              onClick={() => {
                navigate(`/idea/${selectedIdea.id}`)
                setSelectedIdea(null)
              }}
            >
              view detail
            </button>
          </div>
        </div>
      )}

      {/* Add Idea Modal */}
      {isAddIdeaModalOpen && (
        <div className="add-idea-modal-backdrop" onClick={handleCloseAddIdeaModal}>
          <div className="add-idea-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleAddIdeaSubmit} className="add-idea-form">
              <div className="idea-input-area">
                {selectedKeywords.length > 0 && (
                  <div className="selected-keywords-row">
                    {selectedKeywords.map((keyword, index) => (
                      <div key={index} className="selected-keyword-tag">
                        <span>{keyword}</span>
                        <button
                          type="button"
                          onClick={() => handleKeywordRemove(keyword)}
                          className="keyword-remove-btn"
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="idea-textarea-wrapper">
                  <div className="idea-textarea-input">
                    <textarea
                      ref={ideaTextareaRef}
                      className="idea-textarea"
                      value={ideaInput}
                      onChange={(e) => setIdeaInput(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="Enter a new idea, thought, or concept..."
                      rows={1}
                    />
                  </div>
                  <button
                    type="submit"
                    className="idea-submit-btn"
                    onClick={handleAddIdeaSubmit}
                  >
                    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="42" height="42" fill="#1e1e1e"/>
                      <path d="M17 14L26 21L17 28" stroke="#dddddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </button>
                </div>
              </div>
              {displaySuggestedKeywords.length > 0 && (
                <div className="suggested-keywords-section">
                  <div className="suggested-keywords-label">Suggested Keywords</div>
                  <div className="suggested-keywords-row">
                    {displaySuggestedKeywords.map((keyword, index) => (
                      <button
                        key={index}
                        type="button"
                        className="suggested-keyword-tag"
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
      )}
    </div>
  )
}

export default ConnectMapPage
