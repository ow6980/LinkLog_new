import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import mockIdeas from '../mockData/ideas.json'
import variablesData from '../variables.json'
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


const ConnectMapPage = () => {
  const navigate = useNavigate()
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
  const [autoRotate, setAutoRotate] = useState(false) // 자동 회전 모드
  const [animationFrame, setAnimationFrame] = useState(0) // 애니메이션 프레임

  // 아이디어 로드 (localStorage 우선, 없으면 mock 데이터 사용)
  useEffect(() => {
    const stored = localStorage.getItem('ideas')
    if (stored && stored !== '[]') {
      try {
      const loadedIdeas = JSON.parse(stored) as Idea[]
        if (loadedIdeas.length > 0) {
      setIdeas(loadedIdeas)
          return
        }
      } catch (e) {
        console.error('Error parsing localStorage ideas:', e)
      }
    }
    // Mock 데이터 사용
    setIdeas(mockIdeas as Idea[])
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

    // 키워드 그룹 배열 생성 및 3D 배치 (구 형태로 배치)
    const groups: KeywordGroup[] = []
    const groupCount = groupsMap.size
    const radius = 400
    
    // 구 형태로 키워드 그룹 배치
    let index = 0

    groupsMap.forEach((ideasList, keyword) => {
      const ideaCount = ideasList.length
      const boxSize = {
        width: Math.max(400, Math.min(800, ideaCount * 60)),
        height: Math.max(300, Math.min(600, ideaCount * 50)),
        depth: Math.max(200, Math.min(500, ideaCount * 40)),
      }

      // 구 형태로 배치 (피보나치 스파이럴 패턴 사용)
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // 약 2.4 radians
      const y = 1 - (index / (groupCount - 1)) * 2 // -1 to 1
      const radius_at_y = Math.sqrt(1 - y * y)
      const theta = goldenAngle * index
      const x = Math.cos(theta) * radius_at_y * radius
      const z = Math.sin(theta) * radius_at_y * radius
      
      const position = { x, y: y * 300, z } // y는 약간 압축
      
      groups.push({
        keyword,
        color: KEYWORD_COLORS[keyword] || '#666666',
        ideas: ideasList,
        position,
        boxSize,
      })
      index++
    })

    setKeywordGroups(groups)

    // 아이디어 노드 생성 (각 아이디어는 한 번만 표시)
    const nodes: IdeaNode[] = []
    const processedIdeaIds = new Set<string>()
    
    // 각 아이디어를 주 키워드(첫 번째 키워드)에만 배치
    ideas.forEach(idea => {
      if (processedIdeaIds.has(idea.id)) return // 이미 처리된 아이디어는 건너뛰기
      processedIdeaIds.add(idea.id)
      
      // 아이디어의 첫 번째 키워드를 주 키워드로 사용
      const primaryKeyword = idea.keywords[0] || 'Technology'
      const group = groups.find(g => g.keyword === primaryKeyword)
      
      if (!group) return
      
      // 해당 그룹 내에서 이 아이디어의 인덱스 찾기
      const groupIdeas = Array.from(new Set(group.ideas.map(i => i.id))).map(id => 
        group.ideas.find(i => i.id === id)!
      )
      const ideaIndex = groupIdeas.findIndex(i => i.id === idea.id)
      
      if (ideaIndex === -1) return
      
      // 3D 공간에 구 형태로 아이디어 배치 (육면체 내부에 떠있는 느낌)
      const goldenAngle = Math.PI * (3 - Math.sqrt(5))
      const ideaY = groupIdeas.length > 1 ? 1 - (ideaIndex / (groupIdeas.length - 1)) * 2 : 0 // -1 to 1
      const radius_at_y = Math.sqrt(Math.max(0, 1 - ideaY * ideaY))
      const theta = goldenAngle * ideaIndex
      
      // 육면체 내부에 구 형태로 배치 (약간의 랜덤 오프셋 추가)
      const sphereRadius = Math.min(group.boxSize.width, group.boxSize.height, group.boxSize.depth) * 0.35
      const jitter = 0.8 + (ideaIndex % 3) * 0.1 // 미묘한 위치 변화
      const x = group.position.x + Math.cos(theta) * radius_at_y * sphereRadius * jitter
      const y = group.position.y + ideaY * sphereRadius * jitter
      const z = group.position.z + Math.sin(theta) * radius_at_y * sphereRadius * jitter

      nodes.push({
        ...idea,
        position: { x, y, z },
        keyword: primaryKeyword,
      })
    })

    setIdeaNodes(nodes)

    // 연결선 생성
    const conns: Connection[] = []
    
    // 같은 키워드 내부 연결
    groups.forEach(group => {
      const groupNodes = nodes.filter(n => n.keyword === group.keyword)
      for (let i = 0; i < groupNodes.length; i++) {
        for (let j = i + 1; j < groupNodes.length; j++) {
          // 일부만 연결 (너무 많으면 시각적 혼잡)
          if (Math.random() > 0.7) {
            conns.push({
              source: groupNodes[i],
              target: groupNodes[j],
              type: 'same-keyword',
              isDotted: Math.random() > 0.5, // 일부는 점선
            })
          }
        }
      }
    })

    // 다른 키워드 간 연결 (공통 키워드를 가진 아이디어들)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].keyword !== nodes[j].keyword) {
          // 두 아이디어가 공통 키워드를 가지고 있는지 확인
          const commonKeywords = nodes[i].keywords.filter(k => 
            nodes[j].keywords.includes(k)
          )
          if (commonKeywords.length > 0 && Math.random() > 0.85) {
            conns.push({
              source: nodes[i],
              target: nodes[j],
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
    
    nodes.forEach(node => {
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

    // 노드 크기 결정 및 업데이트
    const updatedNodes = nodes.map(node => {
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

    setIdeaNodes(updatedNodes)
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

  // 육면체 면 생성 (와이어프레임 스타일)
  const createCubeFace = (
    width: number,
    height: number,
    depth: number,
    face: 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom',
    color: string
  ) => {
    const faces: Record<string, { transform: string; width: number; height: number }> = {
      front: { transform: `translateZ(${depth / 2}px)`, width, height },
      back: { transform: `translateZ(${-depth / 2}px) rotateY(180deg)`, width, height },
      right: { transform: `rotateY(90deg) translateZ(${depth / 2}px)`, width: depth, height },
      left: { transform: `rotateY(-90deg) translateZ(${depth / 2}px)`, width: depth, height },
      top: { transform: `rotateX(90deg) translateZ(${height / 2}px)`, width, height: depth },
      bottom: { transform: `rotateX(-90deg) translateZ(${height / 2}px)`, width, height: depth },
    }

    const faceConfig = faces[face]
    return (
      <div
        key={face}
        className="cube-face wireframe"
        style={{
          width: `${faceConfig.width}px`,
          height: `${faceConfig.height}px`,
          transform: faceConfig.transform,
          backgroundColor: 'transparent',
          opacity: 0.3,
          border: `1px dashed ${color}`,
          position: 'absolute',
          left: `${-faceConfig.width / 2}px`,
          top: `${-faceConfig.height / 2}px`,
          backfaceVisibility: 'hidden',
          pointerEvents: 'none',
          boxShadow: `inset 0 0 20px ${color}40`,
        }}
      />
    )
  }
  
  // 자동 회전 애니메이션
  useEffect(() => {
    if (!autoRotate) return

    let frameId: number
    let lastTime = performance.now()
    const animate = (currentTime: number) => {
      const delta = currentTime - lastTime
      lastTime = currentTime
      
      setAnimationFrame(prev => prev + 1)
      setRotation(prev => ({
        ...prev,
        y: prev.y + 0.1 * (delta / 16), // 프레임 독립적인 회전
      }))
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [autoRotate])
  
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
            const projected = project3DTo2D(group.position.x, group.position.y, group.position.z)
            const tagProjected = project3DTo2D(
              group.position.x,
              group.position.y - group.boxSize.height / 2 - 40,
              group.position.z
            )

            return (
              <div key={`group-${group.keyword}`} className="keyword-group">
                {/* 키워드 태그 */}
                <div
                  className="keyword-tag"
                  style={{
                    position: 'absolute',
                    left: `${tagProjected.x}px`,
                    top: `${tagProjected.y}px`,
                    backgroundColor: group.color,
                    transform: `translate(-50%, -50%) scale(${Math.max(0.5, tagProjected.scale)})`,
                    transformOrigin: 'center',
                    zIndex: 100,
                  }}
                >
                  {group.keyword}
                </div>

                {/* 3D 육면체 */}
                <div
                  className="cube-container"
                  style={{
                    position: 'absolute',
                    left: `${projected.x}px`,
                    top: `${projected.y}px`,
                    transform: `translate(-50%, -50%) scale(${Math.max(0.3, projected.scale)})`,
                    transformOrigin: 'center',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <div
                    className="cube"
                    style={{
                      width: `${group.boxSize.width}px`,
                      height: `${group.boxSize.height}px`,
                      transform: `translateZ(${-group.boxSize.depth / 2}px)`,
                      transformStyle: 'preserve-3d',
                      position: 'relative',
                    }}
                  >
                    {['front', 'back', 'right', 'left', 'top', 'bottom'].map((face) =>
                      createCubeFace(
                        group.boxSize.width,
                        group.boxSize.height,
                        group.boxSize.depth,
                        face as any,
                        group.color
                      )
                    )}
                  </div>
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

              const baseScale = Math.max(0.5, Math.min(1.5, nodeProjected.scale))
              const hoverScale = isHovered ? 1.05 : 1
              const finalScale = baseScale * hoverScale

              return (
                <div
                  key={`idea-${node.id}`}
                  className={`idea-node-wrapper ${isHovered ? 'hovered' : ''}`}
                  style={{
                    position: 'absolute',
                    left: `${nodeProjected.x}px`,
                    top: `${nodeProjected.y + floatOffset}px`,
                    transform: `translate(-50%, -50%) scale(${finalScale})`,
                    transformOrigin: 'center center',
                    zIndex: isHovered ? 200 : Math.floor(nodeProjected.z / 5),
                    willChange: isDragging ? 'transform, left, top' : 'transform',
                    pointerEvents: 'auto',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={() => !isDragging && setHoveredIdea(node.id)}
                  onMouseLeave={() => setHoveredIdea(null)}
                  onClick={() => !isDragging && navigate(`/idea/${node.id}`)}
                >
                  {/* 키워드 색상 테두리만 사용 */}
                  <div
                    className={`idea-node idea-node-${nodeSize}`}
                    style={{
                      backgroundColor: GRAY_COLORS['100'] || '#dddddd',
                      borderColor: group?.color || '#666666',
                      color: GRAY_COLORS['800'] || '#1e1e1e',
                      height: `${nodeHeight}px`,
                      fontSize: `${nodeFontSize}px`,
                      width: nodeWidth,
                      boxShadow: isHovered 
                        ? `0px 0px 10px rgba(0, 0, 0, 0.4), 0 0 20px ${group?.color || '#666'}60`
                        : `0px 0px 10px rgba(0, 0, 0, 0.25)`,
                    }}
                  >
                    {node.title.substring(0, 30)}{node.title.length > 30 ? '...' : ''}
                  </div>
                </div>
              )
            })}
        </div>

        {/* 컨트롤 버튼 */}
        <div className="map-controls">
          <button className="control-btn" onClick={handleZoomIn} title="Zoom In">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" />
              <circle cx="8" cy="8" r="1" fill="currentColor" />
            </svg>
          </button>
          <button className="control-btn" onClick={handleZoomOut} title="Zoom Out">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <button className="control-btn" onClick={handleFitToScreen} title="Fit to Screen">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 6h4V2M10 2v4h4M14 10h-4v4M6 14v-4H2" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <button 
            className={`control-btn ${autoRotate ? 'active' : ''}`} 
            onClick={() => setAutoRotate(!autoRotate)} 
            title="Auto Rotate"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M8 2 L10 6 L8 10 L6 6 Z" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Add New Idea 버튼 */}
        <button className="add-idea-btn" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" />
          </svg>
          ADD NEW IDEA
        </button>
      </div>

      {/* 사이드 패널 */}
      {selectedIdea && (
        <div className="side-panel">
          <button className="close-button" onClick={() => setSelectedIdea(null)}>
            ×
          </button>
          <h3>{selectedIdea.title}</h3>
          <p>{selectedIdea.content}</p>
          <div className="keywords-panel">
            {selectedIdea.keywords.map((keyword, idx) => (
              <span key={idx} className="keyword-tag-small" style={{ backgroundColor: KEYWORD_COLORS[keyword] || '#666666' }}>
                {keyword}
              </span>
            ))}
          </div>
          <button
            className="view-detail-btn"
            onClick={() => navigate(`/idea/${selectedIdea.id}`)}
          >
            View Details
          </button>
        </div>
      )}
    </div>
  )
}

export default ConnectMapPage
