import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'
import variablesData from '../variables.json'
import { extractMeaningfulKeywords } from '../utils/keywordExtractor'
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

// 사용 가능한 색상 목록 (키워드가 많을 경우 순환 사용)
const AVAILABLE_COLORS = [
  TAG_COLORS.red || '#ff4848',
  TAG_COLORS.orange || '#ffae2b',
  TAG_COLORS.yellow || '#ffff06',
  TAG_COLORS.skyblue || '#0de7ff',
  TAG_COLORS.violet || '#8a38f5',
  TAG_COLORS.green || '#77ff00',
  TAG_COLORS.blue || '#0d52ff',
]

// 키워드에 색상 할당 (최대 7개, 각 키워드는 다른 색상) - 현재 사용 안 함 (Gemini로 추후 키워드 생성 예정)
// const getKeywordColor = (keywordIndex: number, isInitial: boolean = false): string => {
//   // 초기 상태(그룹핑 전)는 그레이 색상
//   if (isInitial) {
//     return GRAY_COLORS['500'] || '#666666'
//   }
//   // 그룹핑 후에는 7가지 색상 중에서 할당 (최대 7개)
//   if (keywordIndex >= 0 && keywordIndex < AVAILABLE_COLORS.length) {
//     return AVAILABLE_COLORS[keywordIndex]
//   }
//   // 7개를 초과하면 그레이 색상
//   return GRAY_COLORS['500'] || '#666666'
// }

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
  const text1 = `${idea1.title} ${idea1.content || ''}`.toLowerCase()
  const text2 = `${idea2.title} ${idea2.content || ''}`.toLowerCase()
  
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
  const { isAuthenticated, user } = useAuth()
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

  // 키워드 추출 함수 - 텍스트에서 의미있는 키워드 자동 추출
  const extractKeywords = useCallback((text: string): string[] => {
    if (!text.trim()) return []

    // 새로운 키워드 추출 함수 사용 (최대 7개)
    const extracted = extractMeaningfulKeywords(text, 7)
    
    // 이미 선택된 키워드는 제외
    return extracted.filter(k => !selectedKeywords.includes(k))
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
    
    // 키워드 없이 모든 아이디어를 개별 노드로 처리 (Gemini로 추후 키워드 생성 예정)
    const nodes: IdeaNode[] = []
    const processedIdeaIds = new Set<string>()
    
    // 모든 아이디어를 구 형태로 분산 배치
    ideas.forEach(idea => {
      if (processedIdeaIds.has(idea.id)) return
      processedIdeaIds.add(idea.id)
      
      // 구 형태로 전체 공간에 분산 배치
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const ideaIndex = ideas.findIndex(i => i.id === idea.id)
      const y = ideas.length > 1 ? 1 - (ideaIndex / (ideas.length - 1)) * 2 : 0
        const radius_at_y = Math.sqrt(1 - y * y)
      const theta = goldenAngle * ideaIndex
      const baseRadius = 800
        
        const position = {
        x: Math.cos(theta) * radius_at_y * baseRadius,
        y: y * 600,
        z: Math.sin(theta) * radius_at_y * baseRadius
        }
        
        nodes.push({
          ...idea,
          position,
        keyword: '', // 키워드 없음 (Gemini로 추후 생성 예정)
        })
      })
    
    // 디버깅: 노드 생성 확인
    console.log('노드 생성:', {
      totalIdeas: ideas.length,
      allNodes: nodes.length
    })

    // 키워드 그룹 없이 모든 노드를 그대로 사용
    const groups: KeywordGroup[] = []
    const updatedNodes: IdeaNode[] = [...nodes] // 모든 노드를 그대로 사용

    // 키워드 그룹 없음 (Gemini로 추후 생성 예정)
    setKeywordGroups([])

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

      connectionsWithProjection.forEach(({ conn, source2D, target2D }) => {
        // 키워드 그룹 없이 기본 색상 사용 (회색)
        const defaultColor = GRAY_COLORS['500'] || '#666666'
        const isHighlighted = hoveredIdea === conn.source.id || hoveredIdea === conn.target.id

        // 모든 연결을 동일하게 처리 (키워드 그룹 없음)
        {
          // 그라데이션 연결선
          // 기본 색상 사용 (키워드 그룹 없음)

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
          
          // 레이어 1: 기본 색상 라인 (배경, opacity 50% / 하이라이트 시 80%)
          const colorPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          colorPath.setAttribute('d', pathData)
          colorPath.setAttribute('fill', 'none')
          colorPath.setAttribute('stroke', defaultColor)
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

  const handleFitToScreen = () => {
    setTransform({ x: 0, y: 0, scale: 1 })
    setRotation({ x: -15, y: 25, z: 0 }) // 초기 회전 각도로 리셋
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
          {/* 키워드 그룹 없음 (Gemini로 추후 생성 예정) */}

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
              
              // 노드 크기에 따른 스타일 결정
              const nodeSize = node.nodeSize || 'small'
              let nodeFontSize = 20 // Figma 디자인: 기본 20px
              
              if (nodeSize === 'big') {
                nodeFontSize = 20
              } else if (nodeSize === 'mid') {
                nodeFontSize = 20
              } else {
                nodeFontSize = 20
              }

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
                  {/* 키워드 없는 Default 상태 노드 (Figma 디자인 참고) */}
                      <div
                        className={`idea-node idea-node-${nodeSize}`}
                        style={{
                          backgroundColor: GRAY_COLORS['100'] || '#dddddd',
                          color: GRAY_COLORS['800'] || '#1e1e1e',
                      border: `2px solid ${GRAY_COLORS['300'] || '#949494'}`,
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
                {selectedIdea.keywords.map((keyword, idx) => (
                  <div 
                    key={idx} 
                    className="node-detail-keyword-tag"
                    style={{ backgroundColor: GRAY_COLORS['500'] || '#666666' }}
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
                      // 키워드 그룹 없으므로 기본 색상 사용
                      const dotColor = GRAY_COLORS['500'] || '#666666'
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
