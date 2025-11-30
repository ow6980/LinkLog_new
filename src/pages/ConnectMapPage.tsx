import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import './ConnectMapPage.css'

interface Idea {
  id: string
  title: string
  content: string
  keywords: string[]
}

const ConnectMapPage = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])

  useEffect(() => {
    // 아이디어 로드
    const stored = localStorage.getItem('ideas')
    if (stored) {
      const loadedIdeas = JSON.parse(stored) as Idea[]
      setIdeas(loadedIdeas)
    }
  }, [])

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || ideas.length === 0) return

    const svg = d3.select(svgRef.current)
    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    svg.attr('width', width).attr('height', height)

    // 기존 요소 제거
    svg.selectAll('*').remove()

    // 노드와 링크 생성
    const nodes: Array<{ id: string; idea: Idea; cluster: number }> = []
    const links: Array<{ source: string; target: string; strength: number }> = []
    const keywordMap = new Map<string, string[]>()

    // 키워드 기반 노드 생성
    ideas.forEach((idea) => {
      nodes.push({ id: idea.id, idea, cluster: 0 })
      idea.keywords.forEach((keyword) => {
        if (!keywordMap.has(keyword)) {
          keywordMap.set(keyword, [])
        }
        keywordMap.get(keyword)!.push(idea.id)
      })
    })

    // 키워드를 통한 링크 생성
    keywordMap.forEach((ideaIds, keyword) => {
      for (let i = 0; i < ideaIds.length; i++) {
        for (let j = i + 1; j < ideaIds.length; j++) {
          links.push({
            source: ideaIds[i],
            target: ideaIds[j],
            strength: 1,
          })
        }
      }
    })

    // 클러스터 색상
    const colors = d3.schemeCategory10

    // 시뮬레이션 설정
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))

    // 링크 그리기
    const link = svg
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#B3B3B3')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // 노드 그리기
    const node = svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 15)
      .attr('fill', (d) => colors[d.cluster % colors.length] as string)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedIdea(d.idea)
      })
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 20)
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('r', 15)
      })

    // 드래그 기능
    const dragHandler = d3
      .drag<SVGCircleElement, any>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(dragHandler)

    // 줌 기능
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        svg.select('g.container').attr('transform', event.transform.toString())
      })

    svg.call(zoom)
    const containerGroup = svg.append('g').attr('class', 'container')
    containerGroup.append(() => link.node()?.parentNode)
    containerGroup.append(() => node.node()?.parentNode)

    // 시뮬레이션 업데이트
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y)
    })

    return () => {
      simulation.stop()
    }
  }, [ideas])

  const handleFitToScreen = () => {
    // 화면에 맞추기 구현
    if (svgRef.current && containerRef.current) {
      const svg = d3.select(svgRef.current)
      svg
        .transition()
        .duration(750)
        .call(
          d3
            .zoom<SVGSVGElement, unknown>()
            .transform as any,
          d3.zoomIdentity
        )
    }
  }

  return (
    <div className="connect-map-page">
      <div className="map-container" ref={containerRef}>
        <svg ref={svgRef}></svg>
        <button className="fit-button" onClick={handleFitToScreen}>
          Fit to Screen
        </button>
      </div>
      {selectedIdea && (
        <div className="side-panel">
          <button
            className="close-button"
            onClick={() => setSelectedIdea(null)}
          >
            ×
          </button>
          <h3>{selectedIdea.title}</h3>
          <p>{selectedIdea.content}</p>
          <div className="keywords-panel">
            {selectedIdea.keywords.map((keyword, idx) => (
              <span key={idx} className="keyword-tag">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ConnectMapPage
