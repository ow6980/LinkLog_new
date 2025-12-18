import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import { suggestSimilarKeywords } from '../utils/keywordSuggester'
import { generateKeywordsWithGemini, updateKeywordsInDatabase } from '../utils/geminiKeywordGenerator'
import { createKeywordColorMap, GRAY_COLORS } from '../utils/keywordColors'
import './ConnectMapPage.css'


interface Idea {
  id: string
  title: string
  content: string | null
  keywords: string[]
  created_at?: string
  source_url?: string
  bookmarked?: boolean
  user_id?: string
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


const ConnectMapPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([])
  const [keywordColorMap, setKeywordColorMap] = useState<Map<string, string>>(new Map())
  const [ideaNodes, setIdeaNodes] = useState<IdeaNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [hoveredIdea, setHoveredIdea] = useState<string | null>(null)
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false)
  
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

  // 유사도 기반 키워드 추천
  useEffect(() => {
    if (ideaInput && isAddIdeaModalOpen) {
      // 기존 키워드가 있는 아이디어들만 필터링
      const ideasWithKeywords = ideas.filter(
        idea => idea.keywords && idea.keywords.length > 0
      )

      if (ideasWithKeywords.length > 0) {
        // 유사도 기반 키워드 추천
        const suggested = suggestSimilarKeywords(ideaInput, ideasWithKeywords, 7, 0.1)
        // 이미 선택된 키워드는 제외
        const filtered = suggested.filter(k => !selectedKeywords.includes(k))
        setSuggestedKeywords(filtered)
      } else {
        // 키워드가 있는 아이디어가 없으면 빈 배열
        setSuggestedKeywords([])
      }
    } else {
      setSuggestedKeywords([])
    }
  }, [ideaInput, selectedKeywords, ideas, isAddIdeaModalOpen])

  // textarea 높이 자동 조절
  useEffect(() => {
    if (ideaTextareaRef.current) {
      ideaTextareaRef.current.style.height = 'auto'
      ideaTextareaRef.current.style.height = `${ideaTextareaRef.current.scrollHeight}px`
    }
  }, [ideaInput])

  const handleKeywordSelect = (keyword: string) => {
    if (!selectedKeywords.includes(keyword) && selectedKeywords.length < 1) {
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

  const handleAddIdeaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!ideaInput.trim() || !user) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('ideas')
        .insert({
          title: ideaInput,
          content: null,
          keywords: selectedKeywords.length > 0 ? selectedKeywords : [],
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setIdeas([data, ...ideas])
        handleCloseAddIdeaModal()
      }
    } catch (error) {
      console.error('Error adding idea:', error)
      alert('아이디어 추가 중 오류가 발생했습니다.')
    }
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!e.shiftKey) {
        handleAddIdeaSubmit(e as any)
      }
    }
  }

  // 아이디어 로드 (Supabase fetch)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const fetchIdeas = async () => {
      try {
        const { data, error } = await supabase
          .from('ideas')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          setIdeas(data)
        }
      } catch (error) {
        console.error('Error fetching ideas:', error)
      }
    }

    fetchIdeas()
  }, [isAuthenticated, navigate])

  // ... (rest of render)
  // We'll update the createdAt field access in the render method below as well

  // 키워드 그룹 생성 및 3D 배치 (유사도 기반 클러스터링)
  useEffect(() => {
    if (ideas.length === 0) return

    // 1단계: 유사도 기반 클러스터링
    const CLUSTERING_SIMILARITY_THRESHOLD = 0.15 // 클러스터링 유사도 임계값
    const MIN_GROUP_SIZE = 1 // 최소 그룹 크기 (1개 이상으로 변경 - 모든 아이디어 표시)
    
    // 모든 아이디어 쌍의 유사도 계산
    const similarityMatrix: Map<string, Map<string, number>> = new Map()
    ideas.forEach(idea1 => {
      const row = new Map<string, number>()
      ideas.forEach(idea2 => {
        if (idea1.id !== idea2.id) {
          const similarity = calculateSimilarity(idea1, idea2)
          if (similarity >= CLUSTERING_SIMILARITY_THRESHOLD) {
            row.set(idea2.id, similarity)
          }
        }
      })
      similarityMatrix.set(idea1.id, row)
    })
    
    // 2단계: 클러스터링 (간단한 연결 컴포넌트 알고리즘)
    const visited = new Set<string>()
    const clusters: Idea[][] = []
    
    ideas.forEach(idea => {
      if (visited.has(idea.id)) return
      
      // BFS로 연결된 아이디어들 찾기
      const cluster: Idea[] = []
      const queue: Idea[] = [idea]
      visited.add(idea.id)
      
      while (queue.length > 0) {
        const current = queue.shift()!
        cluster.push(current)
        
        const similarIdeas = similarityMatrix.get(current.id)
        if (similarIdeas) {
          similarIdeas.forEach((_similarity, otherId) => {
            if (!visited.has(otherId)) {
              const otherIdea = ideas.find(i => i.id === otherId)
              if (otherIdea) {
                visited.add(otherId)
                queue.push(otherIdea)
              }
            }
          })
        }
      }
      
      // 최소 그룹 크기 이상인 클러스터만 추가
      if (cluster.length >= MIN_GROUP_SIZE) {
        clusters.push(cluster)
      }
    })
    
    // 클러스터에 포함되지 않은 아이디어들도 개별 클러스터로 추가
    const clusteredIdeaIds = new Set<string>()
    clusters.forEach(cluster => {
      cluster.forEach(idea => clusteredIdeaIds.add(idea.id))
    })
    
    ideas.forEach(idea => {
      if (!clusteredIdeaIds.has(idea.id)) {
        // 클러스터에 포함되지 않은 아이디어는 개별 클러스터로 추가
        clusters.push([idea])
      }
    })
    
    // 3단계: 클러스터를 크기 순으로 정렬
    clusters.sort((a, b) => b.length - a.length)
    
    // 키워드별로 아이디어 그룹화
    const keywordMap = new Map<string, Idea[]>()
    
    ideas.forEach(idea => {
      // 키워드가 있으면 첫 번째 키워드로 그룹화, 없으면 'ungrouped'로 분류
      const keyword = idea.keywords && idea.keywords.length > 0 ? idea.keywords[0] : 'ungrouped'
      if (!keywordMap.has(keyword)) {
        keywordMap.set(keyword, [])
      }
      keywordMap.get(keyword)!.push(idea)
    })
    
    // 키워드 그룹 생성 (ungrouped 제외)
    const keywordGroupsList = Array.from(keywordMap.entries())
      .filter(([keyword]) => keyword !== 'ungrouped')
      .map(([keyword, ideas]) => ({ keyword, ideas }))
    
    // 키워드별 색상 할당 (일관된 색상 할당을 위해 공통 함수 사용)
    const allKeywords = keywordGroupsList.map(({ keyword }) => keyword)
    const newKeywordColorMap = createKeywordColorMap(allKeywords)
    setKeywordColorMap(newKeywordColorMap)
    
    // KeywordGroup 타입에 맞게 변환
    const keywordGroups: KeywordGroup[] = keywordGroupsList.map(({ keyword, ideas }) => ({
      keyword,
      color: newKeywordColorMap.get(keyword) || GRAY_COLORS['500'] || '#666666',
      ideas,
      position: { x: 0, y: 0, z: 0 }, // 3D 박스 렌더링 안 함
      boxSize: { width: 0, height: 0, depth: 0 }, // 3D 박스 렌더링 안 함
    }))
    
    setKeywordGroups(keywordGroups)
    
    // 키워드별로 아이디어 그룹화
    const keywordIdeasMap = new Map<string, Idea[]>()
    const ungroupedIdeas: Idea[] = []
    
    ideas.forEach(idea => {
      const keyword = idea.keywords && idea.keywords.length > 0 ? idea.keywords[0] : ''
      if (keyword) {
        if (!keywordIdeasMap.has(keyword)) {
          keywordIdeasMap.set(keyword, [])
        }
        keywordIdeasMap.get(keyword)!.push(idea)
      } else {
        ungroupedIdeas.push(idea)
      }
    })
    
    // 1단계: 키워드 그룹별로 박스 영역 정의 (Figma 디자인처럼)
    const keywordBoxAreas = new Map<string, {
      center: { x: number; y: number; z: number }
      size: { width: number; height: number; depth: number }
    }>()
    
    const keywordGroupsArray = Array.from(keywordIdeasMap.entries())
    const totalGroups = keywordGroupsArray.length + (ungroupedIdeas.length > 0 ? 1 : 0)
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const boxBaseRadius = 900 // 박스 중심 간 거리
    
    // 키워드 그룹별 박스 영역 배치
    keywordGroupsArray.forEach(([keyword, groupIdeas], groupIndex) => {
      const y = totalGroups > 1 ? 1 - (groupIndex / (totalGroups - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(1 - y * y)
      const theta = goldenAngle * groupIndex
        
      // 박스 중심 위치
      const boxCenter = {
        x: Math.cos(theta) * radius_at_y * boxBaseRadius,
          y: y * 700,
        z: Math.sin(theta) * radius_at_y * boxBaseRadius
      }
      
      // 박스 크기 계산 (노드 개수와 키워드 이름 특성에 따라 직육면체 또는 정육면체)
      const nodeCount = groupIdeas.length
      const baseBoxSize = 400 // 기본 박스 크기
      const maxBoxSize = 1000 // 최대 박스 크기
      
      // 키워드 이름의 길이와 특성 확인 (긴 키워드나 복합 키워드는 가로로 넓게)
      const keywordLength = keyword.length
      const hasMultipleWords = keyword.includes(' ') || keyword.includes('및') || keyword.includes('및') || keyword.length > 8
      const shouldBeWide = hasMultipleWords || keywordLength > 10
      
      let boxWidth: number
      let boxHeight: number
      let boxDepth: number
      
      if (nodeCount <= 5) {
        if (shouldBeWide) {
          // 긴 키워드는 가로로 넓게
          boxWidth = baseBoxSize * 1.5
          boxHeight = baseBoxSize * 0.8
          boxDepth = baseBoxSize * 0.8
        } else {
          // 노드가 적으면 정육면체
          boxWidth = baseBoxSize
          boxHeight = baseBoxSize
          boxDepth = baseBoxSize
        }
      } else if (nodeCount <= 10) {
        // 노드가 중간이면 약간 직육면체 (가로로 길게)
        const widthMultiplier = shouldBeWide ? 1.8 : 1.0
        boxWidth = (baseBoxSize + (nodeCount - 5) * 40) * widthMultiplier
        boxHeight = baseBoxSize * (shouldBeWide ? 0.75 : 1.0)
        boxDepth = baseBoxSize * 0.8
      } else {
        // 노드가 많으면 직육면체 (가로로 더 길게)
        const extraNodes = nodeCount - 10
        const widthMultiplier = shouldBeWide ? 1.8 : 1.0
        boxWidth = Math.min(maxBoxSize, (baseBoxSize + extraNodes * 50) * widthMultiplier)
        boxHeight = baseBoxSize * (shouldBeWide ? 0.7 : 0.9)
        boxDepth = baseBoxSize * 0.7
      }
      
      keywordBoxAreas.set(keyword, {
        center: boxCenter,
        size: { width: boxWidth, height: boxHeight, depth: boxDepth }
      })
    })
    
    // 키워드 없는 아이디어들도 박스 영역 정의
    if (ungroupedIdeas.length > 0) {
      const ungroupedIndex = keywordGroupsArray.length
      const y = totalGroups > 1 ? 1 - (ungroupedIndex / (totalGroups - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(1 - y * y)
      const theta = goldenAngle * ungroupedIndex
        
      const boxCenter = {
        x: Math.cos(theta) * radius_at_y * boxBaseRadius,
          y: y * 700,
        z: Math.sin(theta) * radius_at_y * boxBaseRadius
      }
      
      const nodeCount = ungroupedIdeas.length
      const baseBoxSize = 400
      const maxBoxSize = 800
      
      let boxWidth: number
      let boxHeight: number
      let boxDepth: number
      
      if (nodeCount <= 5) {
        boxWidth = baseBoxSize
        boxHeight = baseBoxSize
        boxDepth = baseBoxSize
      } else if (nodeCount <= 10) {
        boxWidth = baseBoxSize + (nodeCount - 5) * 40
        boxHeight = baseBoxSize
        boxDepth = baseBoxSize * 0.8
      } else {
        const extraNodes = nodeCount - 10
        boxWidth = Math.min(maxBoxSize, baseBoxSize + extraNodes * 50)
        boxHeight = baseBoxSize * 0.9
        boxDepth = baseBoxSize * 0.7
      }
      
      keywordBoxAreas.set('', {
        center: boxCenter,
        size: { width: boxWidth, height: boxHeight, depth: boxDepth }
      })
    }
    
    // 2단계: 각 박스 영역 안에 노드들을 배열
    const nodes: IdeaNode[] = []
    const processedIdeaIds = new Set<string>()
    
    keywordGroupsArray.forEach(([keyword, groupIdeas]) => {
      const boxArea = keywordBoxAreas.get(keyword)
      if (!boxArea) return
      
      const { center: boxCenter, size: boxSize } = boxArea
      const { width, height, depth } = boxSize
      
      // 박스 내부에 노드들을 구 형태로 배치
      groupIdeas.forEach((idea, ideaIndex) => {
        if (processedIdeaIds.has(idea.id)) return
        processedIdeaIds.add(idea.id)
        
        // 박스 내부의 상대적 위치 (0~1 범위)
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
        const relativeY = groupIdeas.length > 1 ? 1 - (ideaIndex / (groupIdeas.length - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(1 - relativeY * relativeY)
        const theta = goldenAngle * ideaIndex
        
        // 박스 크기의 80% 내부에 배치 (여유 공간 확보)
        const innerRadius = 0.4 // 박스 크기의 40% 반경 사용
        const nodeX = Math.cos(theta) * radius_at_y * width * innerRadius
        const nodeY = relativeY * height * innerRadius
        const nodeZ = Math.sin(theta) * radius_at_y * depth * innerRadius
        
        const position = {
          x: boxCenter.x + nodeX,
          y: boxCenter.y + nodeY,
          z: boxCenter.z + nodeZ
        }
        
        nodes.push({
          ...idea,
          position,
        keyword,
        })
      })
    })
    
    // 키워드 없는 아이디어들도 박스 안에 배치
    if (ungroupedIdeas.length > 0) {
      const boxArea = keywordBoxAreas.get('')
      if (boxArea) {
        const { center: boxCenter, size: boxSize } = boxArea
        const { width, height, depth } = boxSize
        
        ungroupedIdeas.forEach((idea, ideaIndex) => {
          if (processedIdeaIds.has(idea.id)) return
          processedIdeaIds.add(idea.id)
          
        const goldenAngle = Math.PI * (3 - Math.sqrt(5))
          const relativeY = ungroupedIdeas.length > 1 ? 1 - (ideaIndex / (ungroupedIdeas.length - 1)) * 2 : 0
          const radius_at_y = Math.sqrt(1 - relativeY * relativeY)
          const theta = goldenAngle * ideaIndex
          
          const innerRadius = 0.4
          const nodeX = Math.cos(theta) * radius_at_y * width * innerRadius
          const nodeY = relativeY * height * innerRadius
          const nodeZ = Math.sin(theta) * radius_at_y * depth * innerRadius
          
          const position = {
            x: boxCenter.x + nodeX,
            y: boxCenter.y + nodeY,
            z: boxCenter.z + nodeZ
          }
          
          nodes.push({
            ...idea,
            position,
            keyword: '',
          })
        })
      }
    }
    
    // 디버깅: 노드 생성 확인
    console.log('노드 생성:', {
      totalIdeas: ideas.length,
      allNodes: nodes.length,
      keywordGroups: keywordGroups.length,
      nodesWithKeywords: nodes.filter(n => n.keyword).length,
      keywordColorMapSize: newKeywordColorMap.size
    })

    // 모든 노드를 그대로 사용
    const updatedNodes: IdeaNode[] = [...nodes]

    // 연결선 생성 (유사도 기반, 키워드 무시)
    const conns: Connection[] = []
    // 모든 노드를 연결 대상에 포함
    const allNodesForConnections = updatedNodes.length > 0 ? updatedNodes : nodes
    
    const nodesForConnections = allNodesForConnections
    
    // 디버깅: 최종 노드 확인
    console.log('최종 노드:', {
      totalNodes: nodesForConnections.length,
      updatedNodes: updatedNodes.length,
      originalNodes: nodes.length
    })
    const SIMILARITY_THRESHOLD = 0.15 // 연결 임계값 (15%)
    
    // 모든 노드 쌍에 대해 유사도 계산 및 연결
    for (let i = 0; i < nodesForConnections.length; i++) {
      for (let j = i + 1; j < nodesForConnections.length; j++) {
        const node1 = nodesForConnections[i]
        const node2 = nodesForConnections[j]
        
        // 유사도 계산
        const similarity = calculateSimilarity(node1, node2)
        
        // 유사도가 임계값 이상이면 연결 (키워드 무시, 유사도만으로 연결)
        if (similarity >= SIMILARITY_THRESHOLD) {
          // 모든 연결을 cross-keyword로 처리 (키워드 그룹 없음)
          const isDotted = similarity < 0.25 // 유사도가 0.25 미만이면 점선
          
          conns.push({
            source: node1,
            target: node2,
            type: 'cross-keyword', // 키워드 그룹이 없으므로 모두 cross-keyword
            isDotted,
          })
        }
      }
    }

    // 각 노드의 연결 개수 계산 및 연결된 키워드 수집
    const nodeConnectionCounts = new Map<string, number>()
    const nodeConnectedKeywords = new Map<string, Set<string>>() // 노드별 연결된 키워드들
    
    nodesForConnections.forEach(node => {
      nodeConnectionCounts.set(node.id, 0)
      // 노드의 키워드가 있으면 사용, 없으면 빈 문자열
      const nodeKeyword = node.keyword || (node.keywords && node.keywords.length > 0 ? node.keywords[0] : '')
      nodeConnectedKeywords.set(node.id, new Set(nodeKeyword ? [nodeKeyword] : [])) // 자기 자신의 키워드 포함
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
    
    // 키워드 그룹의 박스 영역 정보 업데이트 (이미 정의된 박스 영역 사용)
    const updatedKeywordGroups = keywordGroups.map(group => {
      // 키워드별로 정의된 박스 영역 찾기
      const keyword = group.keyword
      const boxArea = keywordBoxAreas.get(keyword)
      
      if (boxArea) {
        return {
          ...group,
          position: boxArea.center,
          boxSize: boxArea.size
        }
      }
      
      // 박스 영역이 없으면 기본값
      return {
        ...group,
        position: { x: 0, y: 0, z: 0 },
        boxSize: { width: 0, height: 0, depth: 0 }
      }
    })
    
    setKeywordGroups(updatedKeywordGroups)
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

      // 그라데이션 ID 카운터 (각 연결마다 고유한 그라데이션 생성)
      let gradientIdCounter = 0

      connectionsWithProjection.forEach(({ conn, source2D, target2D }) => {
        // 연결된 두 노드의 키워드 확인
        const sourceNode = ideaNodes.find(n => n.id === conn.source.id)
        const targetNode = ideaNodes.find(n => n.id === conn.target.id)
        const sourceKeyword = sourceNode?.keyword || ''
        const targetKeyword = targetNode?.keyword || ''
        
        // 키워드 색상 가져오기
        const sourceColor = sourceKeyword && keywordColorMap.has(sourceKeyword)
          ? keywordColorMap.get(sourceKeyword)!
          : GRAY_COLORS['300'] || '#949494'
        const targetColor = targetKeyword && keywordColorMap.has(targetKeyword)
          ? keywordColorMap.get(targetKeyword)!
          : GRAY_COLORS['300'] || '#949494'
        
        // 같은 키워드: 해당 키워드 색상 사용
        // 다른 키워드: 그라데이션 사용
        const isSameKeyword = sourceKeyword && targetKeyword && sourceKeyword === targetKeyword
        let lineColor = sourceColor
        let useGradient = false
        let gradientId = ''
        
        if (!isSameKeyword && sourceKeyword && targetKeyword) {
          // 다른 키워드끼리 연결: 그라데이션 사용
          useGradient = true
          gradientId = `gradient-${conn.source.id}-${conn.target.id}-${gradientIdCounter++}`
        }

        const isHighlighted = hoveredIdea === conn.source.id || hoveredIdea === conn.target.id

        // 모든 연결을 동일하게 처리 (키워드 그룹 없음)
        {
          // 더 다이나믹한 곡선 연결선 (Cubic Bezier 곡선)
          const dx = target2D.x - source2D.x
          const dy = target2D.y - source2D.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // 거리에 따라 곡률 조정 (더 긴 선은 더 큰 곡률, 더 다이나믹한 곡선)
          const baseCurvature = Math.min(distance * 0.5, 250) // 곡률 증가 (0.4 -> 0.5, 최대 200 -> 250)
          const perpX = -dy / distance
          const perpY = dx / distance
          
          // 유사도에 따라 곡률 변동 추가 (더 유사한 노드는 더 직선에 가깝게)
          const similarity = calculateSimilarity(conn.source, conn.target)
          const curvatureVariation = (1 - similarity) * 0.3 // 유사도가 낮을수록 더 큰 곡률
          const dynamicCurvature = baseCurvature * (1 + curvatureVariation)
          
          // 두 개의 제어점을 사용하여 더 부드럽고 다이나믹한 곡선 생성
          // 제어점 위치를 다양하게 하여 더 자연스러운 곡선
          const control1X = source2D.x + dx * 0.25 + perpX * dynamicCurvature * 0.7
          const control1Y = source2D.y + dy * 0.25 + perpY * dynamicCurvature * 0.7
          const control2X = source2D.x + dx * 0.75 + perpX * dynamicCurvature * 0.3
          const control2Y = source2D.y + dy * 0.75 + perpY * dynamicCurvature * 0.3

          // Cubic Bezier 곡선 사용 (더 부드럽고 자연스러운 곡선)
          const pathData = `M ${source2D.x} ${source2D.y} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${target2D.x} ${target2D.y}`
          
          // 다른 키워드끼리 연결 시 그라데이션 생성 (path 방향에 맞춤)
          if (useGradient) {
            const defs = svg.querySelector('defs') || svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'))
          const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
          gradient.setAttribute('id', gradientId)
            // userSpaceOnUse로 설정하여 실제 좌표 사용
          gradient.setAttribute('gradientUnits', 'userSpaceOnUse')
          gradient.setAttribute('x1', String(source2D.x))
          gradient.setAttribute('y1', String(source2D.y))
          gradient.setAttribute('x2', String(target2D.x))
          gradient.setAttribute('y2', String(target2D.y))
          
          const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
          stop1.setAttribute('offset', '0%')
            stop1.setAttribute('stop-color', sourceColor)
          gradient.appendChild(stop1)
          
          const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
          stop2.setAttribute('offset', '100%')
            stop2.setAttribute('stop-color', targetColor)
          gradient.appendChild(stop2)
          
          defs.appendChild(gradient)
          }
          
          // 연결 개수에 따라 두께 결정 (thick: 3개 이상, thin: 0-2개)
          const sourceConnections = sourceNode?.connectionCount || 0
          const targetConnections = targetNode?.connectionCount || 0
          const avgConnections = (sourceConnections + targetConnections) / 2
          const lineSize = avgConnections >= 3 ? 'Thick' : 'thin'
          
          // 레이어 1: 키워드 색상, 그라데이션 또는 기본 그레이 라인 (배경, opacity 50% / 하이라이트 시 80%)
          const colorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          colorPath.setAttribute('d', pathData)
          colorPath.setAttribute('fill', 'none')
          if (useGradient) {
            colorPath.setAttribute('stroke', `url(#${gradientId})`)
          } else {
            colorPath.setAttribute('stroke', lineColor)
          }
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

          // 레이어 2: 점선 (dashline, dark gray / 하이라이트 시 더 진하게) - 애니메이션 추가
          const dashPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          dashPath.setAttribute('d', pathData)
          dashPath.setAttribute('fill', 'none')
          dashPath.setAttribute('stroke', GRAY_COLORS['800'] || '#1e1e1e')
          const dashWidth = lineSize === 'Thick' ? '1' : '0.5'
          const highlightedDashWidth = isHighlighted ? (lineSize === 'Thick' ? '1.5' : '0.75') : dashWidth
          dashPath.setAttribute('stroke-width', String(highlightedDashWidth))
          dashPath.setAttribute('stroke-dasharray', '4,4') // 점선 패턴
          dashPath.setAttribute('stroke-dashoffset', '0')
          dashPath.setAttribute('stroke-opacity', isHighlighted ? '1' : '1')
          dashPath.setAttribute('stroke-linecap', 'round')
          dashPath.setAttribute('stroke-linejoin', 'round')
          
          // 점선 흐르는 애니메이션 추가
          const dashAnimation = document.createElementNS('http://www.w3.org/2000/svg', 'animate')
          dashAnimation.setAttribute('attributeName', 'stroke-dashoffset')
          dashAnimation.setAttribute('values', '0;8')
          dashAnimation.setAttribute('dur', '1s')
          dashAnimation.setAttribute('repeatCount', 'indefinite')
          dashPath.appendChild(dashAnimation)
          
          svg.appendChild(dashPath)
        }
      })
    }, [connections, project3DTo2D, hoveredIdea, ideaNodes, animationFrame])

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

  // Gemini API를 사용하여 키워드 생성
  const handleGenerateKeywords = async () => {
    if (!ideas || ideas.length === 0) {
      alert('키워드를 생성할 아이디어가 없습니다.')
      return
    }

    if (isGeneratingKeywords) {
      return
    }

    setIsGeneratingKeywords(true)

    try {
      // 키워드가 없는 아이디어들만 필터링 (선택사항: 모든 아이디어 사용)
      const ideasToProcess = ideas.filter(idea => !idea.keywords || idea.keywords.length === 0)
      
      if (ideasToProcess.length < 3) {
        alert('키워드를 생성하려면 최소 3개 이상의 아이디어가 필요합니다.')
        setIsGeneratingKeywords(false)
        return
      }

      // Gemini API를 통해 키워드 생성
      const keywordGroups = await generateKeywordsWithGemini(ideasToProcess)

      if (keywordGroups.length === 0) {
        alert('생성된 키워드 그룹이 없습니다.')
        setIsGeneratingKeywords(false)
        return
      }

      // 데이터베이스에 키워드 업데이트
      await updateKeywordsInDatabase(keywordGroups)

      // 아이디어 다시 로드
      const { data: updatedIdeas, error } = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (updatedIdeas) {
        setIdeas(updatedIdeas)
        alert(`성공적으로 ${keywordGroups.length}개의 키워드 그룹을 생성했습니다.`)
      }
    } catch (error) {
      console.error('Error generating keywords:', error)
      alert(`키워드 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGeneratingKeywords(false)
    }
  }

  const handleFitToScreen = () => {
    const container = containerRef.current
    if (ideaNodes.length === 0 || !container) {
    setTransform({ x: 0, y: 0, scale: 1 })
      setRotation({ x: -15, y: 25, z: 0 })
      return
    }

    // 초기 회전 각도로 설정
    const initialRotation = { x: -15, y: 25, z: 0 }
    setRotation(initialRotation)

    // 임시로 초기 rotation으로 2D 투영 계산
    const perspective = 2000
    const radX = (-initialRotation.x * Math.PI) / 180
    const radY = (-initialRotation.y * Math.PI) / 180

    // 모든 노드의 2D 투영 범위 계산
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let sumX = 0
    let sumY = 0
    let nodeCount = 0

    // 노드 크기 추정 (텍스트 길이 기반)
    const estimateNodeSize = (node: IdeaNode) => {
      const textLength = node.title.length
      const nodeSize = node.nodeSize || 'small'
      
      // 노드 크기에 따른 대략적인 크기 (텍스트 길이도 고려)
      let baseWidth = 200 // 기본 너비
      let baseHeight = 34 // 기본 높이
      
      if (nodeSize === 'big') {
        baseWidth = Math.max(200, textLength * 12) // 텍스트 길이에 따라 조정
        baseHeight = 34
      } else if (nodeSize === 'mid') {
        baseWidth = Math.max(150, textLength * 10)
        baseHeight = 23
      } else {
        baseWidth = Math.max(154, textLength * 8)
        baseHeight = 18
      }
      
      return { width: baseWidth, height: baseHeight }
    }

    const centerX = container.clientWidth / 2
    const centerY = container.clientHeight / 2

    ideaNodes.forEach(node => {
      // 3D 좌표를 2D로 투영 (scale=1, transform={0,0} 기준)
      let rx = node.position.x
      let ry = node.position.y * Math.cos(radX) - node.position.z * Math.sin(radX)
      let rz = node.position.y * Math.sin(radX) + node.position.z * Math.cos(radX)

      const finalX = rx * Math.cos(radY) - rz * Math.sin(radY)
      const finalZ = rx * Math.sin(radY) + rz * Math.cos(radY)
      const finalY = ry

      const adjustedZ = finalZ + perspective
      const factor = Math.max(0.2, Math.min(3, perspective / adjustedZ))

      // scale=1, transform={0,0}일 때의 화면 좌표
      const baseScreenX = centerX + finalX * factor
      const baseScreenY = centerY + finalY * factor

      // 노드의 실제 크기 추정
      const nodeSize = estimateNodeSize(node)
      const nodeHalfWidth = nodeSize.width / 2
      const nodeHalfHeight = nodeSize.height / 2

      // 노드의 경계를 고려한 범위 계산
      minX = Math.min(minX, baseScreenX - nodeHalfWidth)
      maxX = Math.max(maxX, baseScreenX + nodeHalfWidth)
      minY = Math.min(minY, baseScreenY - nodeHalfHeight)
      maxY = Math.max(maxY, baseScreenY + nodeHalfHeight)

      // 중심점 계산을 위한 합계
      sumX += baseScreenX
      sumY += baseScreenY
      nodeCount++
    })

    // 노드 범위에 충분한 여백 추가 (화면 가장자리 여유 공간)
    const padding = Math.max(150, Math.min(container.clientWidth, container.clientHeight) * 0.1) // 화면 크기의 10% 또는 최소 150px
    const nodeWidth = maxX - minX + padding * 2
    const nodeHeight = maxY - minY + padding * 2

    // 화면 크기 (실제 사용 가능한 영역)
    const screenWidth = container.clientWidth
    const screenHeight = container.clientHeight

    // 적절한 scale 계산 (화면에 맞게, 약간 여유 있게)
    const scaleX = (screenWidth * 0.95) / nodeWidth // 95% 사용 (여유 공간)
    const scaleY = (screenHeight * 0.95) / nodeHeight
    const optimalScale = Math.min(scaleX, scaleY, 1.5) // 최대 1.5배까지만 확대
    const finalScale = Math.max(0.2, optimalScale) // 최소 0.2배

    // 노드들의 중심점 계산 (scale=1, transform={0,0}일 때의 좌표)
    // 실제 노드 중심점들의 평균 사용 (더 정확함)
    const centerNodeX = nodeCount > 0 ? sumX / nodeCount : (minX + maxX) / 2
    const centerNodeY = nodeCount > 0 ? sumY / nodeCount : (minY + maxY) / 2
    const centerScreenX = screenWidth / 2
    const centerScreenY = screenHeight / 2

    // project3DTo2D 함수의 로직을 고려하여 transform 계산
    // 최종 screenX = centerX + finalX * factor * scale + transform.x
    // 목표: 최종 screenX = centerScreenX (화면 중앙)
    // 
    // centerNodeX는 baseScreenX들의 평균 = centerX + (평균 finalX * factor)
    // 최종 screenX = centerX + (평균 finalX) * factor * finalScale + transform.x
    // 목표: centerScreenX = centerX + (평균 finalX) * factor * finalScale + transform.x
    // 
    // centerNodeX = centerX + (평균 finalX) * factor 이므로:
    // (평균 finalX) * factor = centerNodeX - centerX
    // (평균 finalX) * factor * finalScale = (centerNodeX - centerX) * finalScale
    // 
    // 따라서: centerScreenX = centerX + (centerNodeX - centerX) * finalScale + transform.x
    // transform.x = centerScreenX - centerX - (centerNodeX - centerX) * finalScale
    // transform.x = centerScreenX - centerX * (1 - finalScale) - centerNodeX * finalScale
    // 
    // centerX = centerScreenX이므로:
    // transform.x = centerScreenX - centerScreenX * (1 - finalScale) - centerNodeX * finalScale
    // transform.x = centerScreenX * finalScale - centerNodeX * finalScale
    // transform.x = (centerScreenX - centerNodeX) * finalScale

    const offsetX = (centerScreenX - centerNodeX) * finalScale
    const offsetY = (centerScreenY - centerNodeY) * finalScale

    setTransform({ 
      x: offsetX, 
      y: offsetY, 
      scale: finalScale
    })
  }

  // 3D 육면체 컴포넌트 - 각 면을 3D 투영으로 렌더링 (현재 사용 안 함 - 키워드 그룹 없음)
  
  
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
          {/* 키워드 그룹 육면체 프레임 */}
          {keywordGroups
            .filter(group => group.boxSize.width > 0 && group.boxSize.height > 0 && group.boxSize.depth > 0)
            .map((group) => {
              const projected = project3DTo2D(group.position.x, group.position.y, group.position.z)
              const { width, height, depth } = group.boxSize
              
              // 육면체의 8개 꼭짓점 계산
              const halfWidth = width / 2
              const halfHeight = height / 2
              const halfDepth = depth / 2
              
              const corners = [
                { x: -halfWidth, y: -halfHeight, z: -halfDepth }, // 0: 왼쪽 아래 앞
                { x: halfWidth, y: -halfHeight, z: -halfDepth },  // 1: 오른쪽 아래 앞
                { x: halfWidth, y: halfHeight, z: -halfDepth },   // 2: 오른쪽 위 앞
                { x: -halfWidth, y: halfHeight, z: -halfDepth }, // 3: 왼쪽 위 앞
                { x: -halfWidth, y: -halfHeight, z: halfDepth }, // 4: 왼쪽 아래 뒤
                { x: halfWidth, y: -halfHeight, z: halfDepth },  // 5: 오른쪽 아래 뒤
                { x: halfWidth, y: halfHeight, z: halfDepth },   // 6: 오른쪽 위 뒤
                { x: -halfWidth, y: halfHeight, z: halfDepth },  // 7: 왼쪽 위 뒤
              ]
              
              // 각 꼭짓점을 3D 투영
              const projectedCorners = corners.map(corner => {
                const worldX = group.position.x + corner.x
                const worldY = group.position.y + corner.y
                const worldZ = group.position.z + corner.z
                return project3DTo2D(worldX, worldY, worldZ)
              })
              
              // 육면체의 6개 면 정의
              const faces = [
                { vertices: [0, 1, 2, 3], name: 'front' },   // 앞면
                { vertices: [4, 5, 6, 7], name: 'back' },    // 뒷면
                { vertices: [0, 1, 5, 4], name: 'bottom' },  // 아래면
                { vertices: [2, 3, 7, 6], name: 'top' },      // 위면
                { vertices: [0, 3, 7, 4], name: 'left' },    // 왼쪽면
                { vertices: [1, 2, 6, 5], name: 'right' },   // 오른쪽면
              ]
              
              // 육면체의 12개 모서리 (실선)
              const edges = [
                [0, 1], [1, 2], [2, 3], [3, 0], // 앞면
                [4, 5], [5, 6], [6, 7], [7, 4], // 뒷면
                [0, 4], [1, 5], [2, 6], [3, 7], // 연결선
              ]
              
              // SVG viewBox 계산 (모든 꼭짓점을 포함하도록)
              const allX = projectedCorners.map(c => c.x)
              const allY = projectedCorners.map(c => c.y)
              const minX = Math.min(...allX)
              const maxX = Math.max(...allX)
              const minY = Math.min(...allY)
              const maxY = Math.max(...allY)
              const svgWidth = maxX - minX + 100
              const svgHeight = maxY - minY + 100
              const svgX = minX - 50
              const svgY = minY - 50

            return (
              <div 
                  key={`keyword-box-${group.keyword}`}
                  className="keyword-group-box"
                style={{
                  position: 'absolute',
                    left: `${projected.x}px`,
                    top: `${projected.y}px`,
                    transform: `translate(-50%, -50%)`,
                  pointerEvents: 'none',
                    zIndex: Math.floor(projected.z * 10) + 50,
                  }}
                >
                  <svg
                    width={svgWidth}
                    height={svgHeight}
                    viewBox={`${svgX} ${svgY} ${svgWidth} ${svgHeight}`}
                  style={{
                    position: 'absolute',
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      overflow: 'visible',
                    }}
                  >
                    {/* 면 채우기 (opacity 5%) */}
                    {faces.map((face, faceIdx) => {
                      const facePoints = face.vertices.map(idx => {
                        const corner = projectedCorners[idx]
                        return `${corner.x},${corner.y}`
                      }).join(' ')
                      
                      return (
                        <polygon
                          key={`face-${faceIdx}`}
                          points={facePoints}
                          fill={group.color}
                          fillOpacity="0.05"
                          stroke="none"
                        />
                      )
                    })}
                    
                    {/* 모서리 실선 (1px) */}
                    {edges.map(([startIdx, endIdx], idx) => {
                      const start = projectedCorners[startIdx]
                      const end = projectedCorners[endIdx]
                      return (
                        <line
                          key={`edge-${idx}`}
                          x1={start.x}
                          y1={start.y}
                          x2={end.x}
                          y2={end.y}
                          stroke={group.color}
                          strokeWidth="1"
                          strokeOpacity="1"
                        />
                      )
                    })}
                  </svg>
                  
                  {/* 키워드 라벨 (육면체 위쪽 면 위에 배치) */}
                  {(() => {
                    // 위쪽 면(top face)의 중심점 계산 (꼭짓점: 2, 3, 7, 6)
                    const topFaceCorners = [2, 3, 7, 6].map(idx => projectedCorners[idx])
                    const topFaceCenterX = topFaceCorners.reduce((sum, c) => sum + c.x, 0) / topFaceCorners.length
                    // 위쪽 면의 가장 위쪽 점 찾기 (Y가 가장 작은 값)
                    const topMostY = Math.min(...topFaceCorners.map(c => c.y))
                    
                    return (
                <div
                  className="keyword-tag"
                  style={{
                    position: 'absolute',
                          left: `${topFaceCenterX - projected.x}px`,
                          top: `${topMostY - projected.y - 40}px`, // 육면체 위에 약간 떨어진 위치
                          transform: 'translate(-50%, 0)',
                    backgroundColor: group.color,
                    color: GRAY_COLORS['800'] || '#1e1e1e',
                          padding: '0 20px',
                          height: '34px',
                          fontSize: '20px',
                          lineHeight: '16px',
                          fontWeight: 400,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          textTransform: 'capitalize',
                          fontFamily: "'Montserrat', 'Pretendard', sans-serif",
                          letterSpacing: '0.6px',
                          pointerEvents: 'none',
                          zIndex: Math.floor(projected.z * 10) + 100, // 육면체보다 위에 표시
                  }}
                >
                  {group.keyword}
                </div>
                    )
                  })()}
              </div>
            )
          })}

          {/* 아이디어 노드들 (z 순서대로 정렬, 부유 애니메이션) */}
          {ideaNodes && ideaNodes.length > 0 ? ideaNodes
            .map(node => {
              const projected = project3DTo2D(node.position.x, node.position.y, node.position.z)
              const floatOffset = isDragging ? 0 : Math.sin(animationFrame * 0.01 + node.id.charCodeAt(0) * 0.1) * 3
              return { node, projected, floatOffset }
            })
            .sort((a, b) => a.projected.z - b.projected.z) // 뒤에서 앞으로 정렬
            .map(({ node, projected: nodeProjected, floatOffset }) => {
              const isHovered = hoveredIdea === node.id
              const nodeSize = node.nodeSize || 'small'
              
              // 키워드 태그와 동일한 scale 범위 사용 (텍스트 선명도 유지)
              const baseScale = Math.max(1.0, Math.min(1.5, nodeProjected.scale))
              const isSelected = selectedIdea?.id === node.id
              const hoverScale = (isHovered || isSelected) ? 1.05 : 1
              const finalScale = baseScale * hoverScale

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
                    zIndex: (isHovered || selectedIdea?.id === node.id) ? 10000 : Math.floor(nodeProjected.z * 10) + 100,
                    willChange: isDragging ? 'transform, left, top' : 'auto',
                    pointerEvents: 'auto',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                  }}
                  onMouseEnter={() => !isDragging && setHoveredIdea(node.id)}
                  onMouseLeave={() => {
                    if (selectedIdea?.id !== node.id) {
                      setHoveredIdea(null)
                    }
                  }}
                  onClick={() => {
                    if (!isDragging) {
                      setSelectedIdea(node)
                      setHoveredIdea(node.id)
                    }
                  }}
                >
                  {/* 키워드에 따라 stroke 색상만 바뀌는 노드 */}
                      <div
                        className={`idea-node idea-node-${nodeSize}`}
                        style={{
                          // 배경색은 항상 고정 (color/gray/100)
                          backgroundColor: GRAY_COLORS['100'] || '#dddddd',
                          color: GRAY_COLORS['800'] || '#1e1e1e',
                          // stroke 색상만 키워드에 따라 변경
                          border: node.keyword && keywordColorMap.has(node.keyword)
                            ? `2px solid ${keywordColorMap.get(node.keyword) || GRAY_COLORS['300'] || '#949494'}`
                            : `2px solid ${GRAY_COLORS['300'] || '#949494'}`,
                        boxShadow: (isHovered || selectedIdea?.id === node.id)
                            ? `0px 0px 10px rgba(0, 0, 0, 0.4)`
                          : `0px 0px 10px rgba(0, 0, 0, 0.25)`,
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
            )
          }) : (
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              color: GRAY_COLORS['800'] || '#1e1e1e',
              fontSize: '16px'
            }}>
              노드가 없습니다. 아이디어를 추가해주세요.
            </div>
          )}
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
          <button 
            className="control-btn" 
            onClick={handleGenerateKeywords} 
            title="Generate Keywords with AI"
            disabled={isGeneratingKeywords}
            style={{ opacity: isGeneratingKeywords ? 0.5 : 1 }}
          >
            {isGeneratingKeywords ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="6" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="9.42" strokeDashoffset="4.71">
                  <animate attributeName="stroke-dasharray" values="9.42;28.27;9.42" dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="stroke-dashoffset" values="0;-18.85;0" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
                <path d="M8 2V14" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 8H14" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 5L8 8L5 5" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 11L8 8L5 11" stroke="#666666" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
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
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!selectedIdea) return
                  
                  const newBookmarkedState = !selectedIdea.bookmarked
                  
                  // Optimistic update
                  const updatedIdeas = ideas.map(idea => 
                    idea.id === selectedIdea.id 
                      ? { ...idea, bookmarked: newBookmarkedState }
                      : idea
                  )
                  setIdeas(updatedIdeas)
                  setSelectedIdea({ ...selectedIdea, bookmarked: newBookmarkedState })

                  // DB Update
                  try {
                    const { error } = await supabase
                      .from('ideas')
                      .update({ bookmarked: newBookmarkedState })
                      .eq('id', selectedIdea.id)
                    
                    if (error) throw error
                  } catch (error) {
                    console.error('Error updating bookmark:', error)
                    // Rollback
                    const revertedIdeas = ideas.map(idea => 
                      idea.id === selectedIdea.id 
                        ? { ...idea, bookmarked: !newBookmarkedState }
                        : idea
                    )
                    setIdeas(revertedIdeas)
                    setSelectedIdea({ ...selectedIdea, bookmarked: !newBookmarkedState })
                  }
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
              <p className="node-detail-content-text">{selectedIdea.title}</p>
            </div>

            {/* Keywords */}
            <div className="node-detail-section">
              <h3 className="node-detail-section-title">keywords</h3>
              <div className="node-detail-keywords">
                {selectedIdea.keywords.map((keyword, idx) => {
                  // 키워드 색상 가져오기
                  const keywordColor = keywordColorMap.has(keyword)
                    ? keywordColorMap.get(keyword)!
                    : GRAY_COLORS['500'] || '#666666'
                  
                  return (
                  <div 
                    key={idx} 
                    className="node-detail-keyword-tag"
                      style={{ backgroundColor: keywordColor }}
                  >
                    {keyword}
                  </div>
                  )
                })}
              </div>
            </div>

            {/* Meta Data */}
            <div className="node-detail-section">
              <h3 className="node-detail-section-title">meta data</h3>
              <div className="node-detail-metadata">
                <div className="node-detail-metadata-row">
                  <span>Updated Time</span>
                  <span>
                    {selectedIdea.created_at 
                      ? new Date(selectedIdea.created_at).toLocaleString('en-US', {
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
                      // 연결된 아이디어의 키워드 색상 가져오기
                      const ideaKeyword = idea.keyword || (idea.keywords && idea.keywords.length > 0 ? idea.keywords[0] : '')
                      const dotColor = ideaKeyword && keywordColorMap.has(ideaKeyword)
                        ? keywordColorMap.get(ideaKeyword)!
                        : GRAY_COLORS['500'] || '#666666'
                      
                      return (
                        <div key={idea.id} className="node-detail-connected-idea-item">
                          <div 
                            className="node-detail-connected-idea-dot"
                            style={{ backgroundColor: dotColor }}
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
