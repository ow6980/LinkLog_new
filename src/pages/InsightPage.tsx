import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as d3 from 'd3'
import './InsightPage.css'
import { format, subWeeks, startOfWeek } from 'date-fns'

interface Idea {
  id: string
  keywords: string[]
  createdAt: string
  sourceUrl?: string
}

const InsightPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const keywordChartRef = useRef<SVGSVGElement>(null)
  const weeklyChartRef = useRef<SVGSVGElement>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [keywordFreq, setKeywordFreq] = useState<
    Array<{ keyword: string; count: number }>
  >([])
  const [weeklyData, setWeeklyData] = useState<
    Array<{ week: string; count: number }>
  >([])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const stored = localStorage.getItem('ideas')
    if (stored) {
      const loadedIdeas = JSON.parse(stored) as Idea[]
      setIdeas(loadedIdeas)
    }
  }, [])

  useEffect(() => {
    if (ideas.length === 0) return

    // 키워드 빈도 계산
    const keywordCount: Record<string, number> = {}
    ideas.forEach((idea) => {
      idea.keywords.forEach((keyword) => {
        keywordCount[keyword] = (keywordCount[keyord] || 0) + 1
      })
    })

    const sorted = Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    setKeywordFreq(sorted)

    // 주별 아이디어 그래프
    const weeklyCount: Record<string, number> = {}
    ideas.forEach((idea) => {
      const week = format(
        startOfWeek(new Date(idea.createdAt)),
        'yyyy-MM-dd'
      )
      weeklyCount[week] = (weeklyCount[week] || 0) + 1
    })

    const weekly = Object.entries(weeklyCount)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8) // 최근 8주

    setWeeklyData(weekly)
  }, [ideas])

  useEffect(() => {
    if (keywordChartRef.current && keywordFreq.length > 0) {
      drawKeywordChart()
    }
  }, [keywordFreq])

  useEffect(() => {
    if (weeklyChartRef.current && weeklyData.length > 0) {
      drawWeeklyChart()
    }
  }, [weeklyData])

  const drawKeywordChart = () => {
    if (!keywordChartRef.current) return

    const svg = d3.select(keywordChartRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 20, bottom: 60, left: 60 }
    const width = 600 - margin.left - margin.right
    const height = 400 - margin.top - margin.bottom

    const g = svg
      .attr('width', 600)
      .attr('height', 400)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleBand()
      .range([0, width])
      .padding(0.2)
      .domain(keywordFreq.map((d) => d.keyword))

    const y = d3
      .scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(keywordFreq, (d) => d.count) || 0])

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')

    g.append('g').call(d3.axisLeft(y))

    g.selectAll('.bar')
      .data(keywordFreq)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.keyword) || 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count))
      .attr('fill', '#666666')
  }

  const drawWeeklyChart = () => {
    if (!weeklyChartRef.current) return

    const svg = d3.select(weeklyChartRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 20, bottom: 60, left: 60 }
    const width = 600 - margin.left - margin.right
    const height = 400 - margin.top - margin.bottom

    const g = svg
      .attr('width', 600)
      .attr('height', 400)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleBand()
      .range([0, width])
      .padding(0.2)
      .domain(weeklyData.map((d) => d.week))

    const y = d3
      .scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(weeklyData, (d) => d.count) || 0])

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')

    g.append('g').call(d3.axisLeft(y))

    g.selectAll('.bar')
      .data(weeklyData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.week) || 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count))
      .attr('fill', '#666666')
  }

  if (ideas.length === 0) {
    return (
      <div className="insight-page">
        <div className="empty-state">
          <p>분석할 데이터가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="insight-page">
      <div className="insight-container">
        <h1 className="page-title">Insight</h1>

        <div className="charts-section">
          <div className="chart-card">
            <h2 className="chart-title">키워드 빈도</h2>
            <svg ref={keywordChartRef}></svg>
          </div>

          <div className="chart-card">
            <h2 className="chart-title">주별 아이디어</h2>
            <svg ref={weeklyChartRef}></svg>
          </div>
        </div>

        <div className="stats-section">
          <div className="stat-card">
            <h3>전체 아이디어</h3>
            <p className="stat-value">{ideas.length}</p>
          </div>
          <div className="stat-card">
            <h3>고유 키워드</h3>
            <p className="stat-value">
              {new Set(ideas.flatMap((i) => i.keywords)).size}
            </p>
          </div>
          <div className="stat-card">
            <h3>출처 URL</h3>
            <p className="stat-value">
              {ideas.filter((i) => i.sourceUrl).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InsightPage
