import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import variablesData from '../variables.json'
import './InsightPage.css'
import { format, startOfWeek, subWeeks } from 'date-fns'
import * as d3 from 'd3'
import { Idea } from '../mockData/types'

// variables.json에서 색상 추출
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

const TAG_COLORS = extractTagColors()
const GRAY_COLORS = extractGrayColors()

// 키워드 색상 매핑
const KEYWORD_COLORS: Record<string, string> = {
  Technology: TAG_COLORS.red || '#ff4848',
  Innovation: TAG_COLORS.orange || '#ffae2b',
  Data: TAG_COLORS.yellow || '#ffff06',
  Design: TAG_COLORS.skyblue || '#0de7ff',
  Business: TAG_COLORS.violet || '#8a38f5',
  Research: TAG_COLORS.green || '#77ff00',
  Development: TAG_COLORS.blue || '#0d52ff',
}

const InsightPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const keywordChartRef = useRef<SVGSVGElement>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)

  // 아이디어 로드 (P2 Connect Map과 동일한 방식)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const loadIdeas = () => {
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
      
      // P2 Connect Map과 동일하게: 아이디어가 있는 키워드만 사용
      // 키워드별 아이디어 그룹화
      const groupsMap = new Map<string, Idea[]>()
      storedIdeas.forEach(idea => {
        idea.keywords.forEach(keyword => {
          if (!groupsMap.has(keyword)) {
            groupsMap.set(keyword, [])
          }
          groupsMap.get(keyword)!.push(idea)
        })
      })
      
      // 아이디어가 있는 키워드만 필터링 (P2와 동일)
      const groupsWithIdeas = Array.from(groupsMap.entries()).filter(([_, ideasList]) => ideasList.length > 0)
      const validKeywords = new Set(groupsWithIdeas.map(([keyword]) => keyword))
      
      // 유효한 키워드를 가진 아이디어만 사용
      const validIdeas = storedIdeas.filter(idea => 
        idea.keywords.some(keyword => validKeywords.has(keyword))
      )
      
      setIdeas(validIdeas)
    }

    loadIdeas()

    // localStorage 변경 감지를 위한 이벤트 리스너
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ideas') {
        loadIdeas()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 주기적으로 확인 (다른 탭에서 변경된 경우)
    const interval = setInterval(loadIdeas, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [isAuthenticated, navigate])

  // 키워드 빈도 계산 (P2 Connect Map에 표시되는 키워드만)
  const keywordFreq = useMemo(() => {
    // P2 Connect Map과 동일하게: 키워드별 아이디어 그룹화
    const groupsMap = new Map<string, Idea[]>()
    ideas.forEach(idea => {
      idea.keywords.forEach(keyword => {
        if (!groupsMap.has(keyword)) {
          groupsMap.set(keyword, [])
        }
        groupsMap.get(keyword)!.push(idea)
      })
    })
    
    // 아이디어가 있는 키워드만 필터링 (P2와 동일)
    const groupsWithIdeas = Array.from(groupsMap.entries()).filter(([_, ideasList]) => ideasList.length > 0)
    const validKeywords = new Set(groupsWithIdeas.map(([keyword]) => keyword))
    
    // 유효한 키워드만 카운트
    const keywordCount: Record<string, number> = {}
    ideas.forEach((idea) => {
      idea.keywords.forEach((keyword) => {
        if (validKeywords.has(keyword)) {
          keywordCount[keyword] = (keywordCount[keyword] || 0) + 1
        }
      })
    })

    return Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .filter((item) => item.count > 0) // 아이디어가 있는 키워드만
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [ideas])

  // 이번 주 키워드 빈도 (최근 7일)
  const thisWeekKeywords = useMemo(() => {
    const weekAgo = subWeeks(new Date(), 1)
    const recentIdeas = ideas.filter(
      (idea) => new Date(idea.createdAt) >= weekAgo
    )

    const keywordCount: Record<string, number> = {}
    recentIdeas.forEach((idea) => {
      idea.keywords.forEach((keyword) => {
        keywordCount[keyword] = (keywordCount[keyword] || 0) + 1
      })
    })

    return Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [ideas])

  // 가장 활성화된 아이디어 (연결 수가 가장 많은 아이디어)
  const mostActiveIdea = useMemo(() => {
    if (ideas.length === 0) return null

    // 각 아이디어의 연결 수 계산 (공유 키워드 기반)
    const connectionCounts: Record<string, number> = {}
    ideas.forEach((idea) => {
      let connections = 0
      ideas.forEach((otherIdea) => {
        if (idea.id !== otherIdea.id) {
          const sharedKeywords = idea.keywords.filter((k) =>
            otherIdea.keywords.includes(k)
          )
          if (sharedKeywords.length > 0) {
            connections++
          }
        }
      })
      connectionCounts[idea.id] = connections
    })

    const maxConnections = Math.max(...Object.values(connectionCounts))
    const mostActive = ideas.find(
      (idea) => connectionCounts[idea.id] === maxConnections
    )

    return mostActive
      ? {
          ...mostActive,
          connections: maxConnections,
        }
      : null
  }, [ideas])

  // 최근 아이디어 (최근 3개)
  const recentIdeas = useMemo(() => {
    return [...ideas]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 3)
  }, [ideas])

  // 키워드 그룹핑 (같은 키워드를 가진 아이디어들을 그룹화, 아이디어가 있는 키워드만)
  const keywordGroups = useMemo(() => {
    const groups: Record<string, Idea[]> = {}
    ideas.forEach((idea) => {
      idea.keywords.forEach((keyword) => {
        if (!groups[keyword]) {
          groups[keyword] = []
        }
        if (!groups[keyword].find((i) => i.id === idea.id)) {
          groups[keyword].push(idea)
        }
      })
    })

    return Object.entries(groups)
      .filter(([keyword, ideaList]) => ideaList.length > 0) // 아이디어가 있는 키워드만
      .map(([keyword, ideaList]) => {
        // 이 그룹 내에서 키워드 빈도 계산
        const keywordCounts: Record<string, number> = {}
        ideaList.forEach((idea) => {
          idea.keywords.forEach((k) => {
            keywordCounts[k] = (keywordCounts[k] || 0) + 1
          })
        })

        const topKeywords = Object.entries(keywordCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([k]) => k)

        return {
          keyword,
          ideas: ideaList,
          count: ideaList.length,
          topKeywords,
          keywordCounts,
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  }, [ideas])

  // 키워드 빈도 그래프 그리기 - 정석적인 d3 바 차트
  useEffect(() => {
    if (!keywordChartRef.current || keywordFreq.length === 0) return

    const svg = d3.select(keywordChartRef.current)
    svg.selectAll('*').remove()

    // 정석적인 margin 설정
    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const svgWidth = 623
    const svgHeight = 280
    const width = svgWidth - margin.left - margin.right
    const height = svgHeight - margin.top - margin.bottom

    const g = svg
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // X축 스케일
    const x = d3
      .scaleBand()
      .range([0, width])
      .padding(0.2)
      .domain(keywordFreq.map((d) => d.keyword))

    // Y축 스케일 - 0, 5, 10, 15로 고정
    const yMax = 15
    const y = d3
      .scaleLinear()
      .range([height, 0])
      .domain([0, yMax])

    // 가이드 라인 (0, 5, 10, 15 위치에 얇은 점선)
    const guideTicks = [0, 5, 10, 15]
    guideTicks.forEach((tickValue) => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', y(tickValue))
        .attr('y2', y(tickValue))
        .attr('stroke', '#1e1e1e')
        .attr('stroke-width', 0.5)
        .attr('stroke-dasharray', '2 2')
        .attr('opacity', 0.3)
    })

    // Y축 텍스트만 표시 (0, 5, 10, 15)
    const yTicks = [0, 5, 10, 15]
    const yAxis = g.append('g').call(
      d3.axisLeft(y)
        .tickValues(yTicks)
        .tickFormat((d) => d.toString())
    )
    
    yAxis.selectAll('text')
      .style('font-family', 'Montserrat')
      .style('font-size', '10px')
      .style('fill', GRAY_COLORS['400'] || '#666666')
    
    // Y축 선 제거 (텍스트만)
    yAxis.selectAll('.domain').remove()
    yAxis.selectAll('.tick line').remove()

    // X축 텍스트만 표시 (키워드 이름)
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
    
    xAxis.selectAll('text')
      .style('font-family', 'Montserrat')
      .style('font-size', '10px')
      .style('fill', GRAY_COLORS['400'] || '#666666')
      .style('text-anchor', 'middle')
    
    // X축 선 제거 (텍스트만)
    xAxis.selectAll('.domain').remove()
    xAxis.selectAll('.tick line').remove()

    // 바 차트
    const bars = g
      .selectAll('.bar')
      .data(keywordFreq)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.keyword) || 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count))
      .attr('rx', 4) // 상단 둥근 모서리
      .attr('ry', 4)
      .attr('fill', (d) => {
        const color = KEYWORD_COLORS[d.keyword] || '#666666'
        return color
      })
      .attr('fill-opacity', 0.05)
      .attr('stroke', (d) => KEYWORD_COLORS[d.keyword] || '#666666')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        setSelectedKeyword(d.keyword)
      })
  }, [keywordFreq])

  // Empty state
  if (ideas.length === 0) {
    return (
      <div className="insight-page">
        <div className="insight-container">
          <div className="insight-title-section">
            <h1 className="insight-title">Insight</h1>
            <p className="insight-total">total ideas: 0</p>
          </div>
          <div className="empty-state">
            <p>분석할 데이터가 없습니다.</p>
            <p>아이디어를 입력하면 인사이트가 표시됩니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="insight-page">
      <div className="insight-container">
        <div className="insight-title-section">
          <h1 className="insight-title">Insight</h1>
          <p className="insight-total">total ideas: {ideas.length}</p>
        </div>

        <div className="insight-content">
          {/* Summary Report & Recent Activity */}
          <div className="summary-section">
            <div className="summary-report">
              <div className="section-title-area">
                <h2 className="section-title">summary report</h2>
                <p className="section-subtitle">
                  This Week's Focus | Top Trending Keywords
                </p>
              </div>
              <div className="ranking-list">
                {thisWeekKeywords.map((item, index) => (
                  <div key={item.keyword} className="ranking-item">
                    <div className="ranking-left">
                      <div className="ranking-number">{index + 1}</div>
                      <span className="ranking-keyword">{item.keyword}</span>
                    </div>
                    <span className="ranking-count">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="recent-activity">
              <div className="section-title-area">
                <div className="empty-title"></div>
                <p className="section-subtitle">Recent Activity Summary</p>
              </div>
              <div className="activity-cards">
                {mostActiveIdea && (
                  <div className="activity-card">
                    <div className="activity-header">
                      <div className="activity-icon">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M10.6667 4.66675H14.6667V8.66675"
                            stroke="#1E1E1E"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M14.6666 4.66675L8.99992 10.3334L5.66659 7.00008L1.33325 11.3334"
                            stroke="#1E1E1E"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <span className="activity-title">Most Active Idea</span>
                    </div>
                    <p className="activity-content">{mostActiveIdea.title}</p>
                    <div className="activity-footer">
                      <span className="activity-connections">
                        {mostActiveIdea.connections} connections
                      </span>
                      <div className="activity-tags">
                        {mostActiveIdea.keywords.slice(0, 2).map((keyword) => (
                          <span
                            key={keyword}
                            className="activity-tag"
                            style={{
                              backgroundColor:
                                KEYWORD_COLORS[keyword] || TAG_COLORS.skyblue,
                            }}
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="activity-card">
                  <div className="activity-header">
                    <div className="activity-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M10 9.33325C10.1333 8.66659 10.4667 8.19992 11 7.66659C11.6667 7.06659 12 6.19992 12 5.33325C12 4.27239 11.5786 3.25497 10.8284 2.50482C10.0783 1.75468 9.06087 1.33325 8 1.33325C6.93913 1.33325 5.92172 1.75468 5.17157 2.50482C4.42143 3.25497 4 4.27239 4 5.33325C4 5.99992 4.13333 6.79992 5 7.66659C5.46667 8.13325 5.86667 8.66659 6 9.33325"
                          stroke="#1E1E1E"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6 12H10"
                          stroke="#1E1E1E"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.66675 14.6667H9.33341"
                          stroke="#1E1E1E"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="activity-title">New Idea</span>
                  </div>
                  <div className="new-ideas-list">
                    {recentIdeas.map((idea, index) => {
                      const firstKeyword = idea.keywords[0] || 'Technology'
                      const color =
                        KEYWORD_COLORS[firstKeyword] || TAG_COLORS.red
                      return (
                        <div key={idea.id} className="new-idea-item">
                          <div
                            className="new-idea-dot"
                            style={{ backgroundColor: color }}
                          ></div>
                          <span className="new-idea-text">
                            {idea.title || idea.content.substring(0, 30)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Keyword Frequency & Grouping */}
          <div className="keyword-section">
            <div className="keyword-frequency">
              <div className="section-title-area">
                <h2 className="section-title">keyword frequency</h2>
                <p className="section-subtitle">Top Ten Most Used Keywords</p>
              </div>
              <div className="chart-container">
                <svg ref={keywordChartRef}></svg>
              </div>
            </div>
          </div>

          {/* Keyword Grouping Panel - 하단에 배치 */}
          <div className="keyword-grouping-section">
            <div className="keyword-grouping-panel">
              {selectedKeyword ? (
                // 선택된 키워드의 아이디어 목록 표시 (Figma 디자인)
                (() => {
                  const selectedIdeas = ideas.filter((idea) =>
                    idea.keywords.includes(selectedKeyword)
                  )
                  const color =
                    KEYWORD_COLORS[selectedKeyword] || TAG_COLORS.skyblue
                  return (
                    <div className="selected-keyword-panel">
                      <div className="selected-keyword-header">
                        <div
                          className="selected-keyword-dot"
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="selected-keyword-name">
                          {selectedKeyword}
                        </span>
                        <span className="selected-keyword-count">
                          ({selectedIdeas.length} ideas)
                        </span>
                      </div>
                      <div className="selected-ideas-list">
                        {selectedIdeas.map((idea) => {
                          // 아이디어의 첫 번째 키워드 색상 사용
                          const ideaColor =
                            KEYWORD_COLORS[idea.keywords[0]] ||
                            TAG_COLORS.red
                          return (
                            <div key={idea.id} className="selected-idea-item">
                              <div
                                className="selected-idea-dot"
                                style={{ backgroundColor: ideaColor }}
                              ></div>
                              <span className="selected-idea-text">
                                {idea.title || idea.content.substring(0, 50)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()
              ) : (
                // 기본 그룹핑 표시
                <div className="keyword-grouping">
                  <div className="section-title-area">
                    <h2 className="section-title">keyword</h2>
                    <p className="section-subtitle">Grouping Keywords</p>
                  </div>
                  <div className="grouping-list">
                    {keywordGroups.map((group) => {
                      const firstKeyword = group.keyword
                      const color =
                        KEYWORD_COLORS[firstKeyword] || TAG_COLORS.skyblue
                      return (
                        <div key={group.keyword} className="grouping-card">
                          <div className="grouping-header">
                            <div
                              className="grouping-dot"
                              style={{ backgroundColor: color }}
                            ></div>
                            <span className="grouping-name">{group.keyword}</span>
                            <span className="grouping-count">
                              ({group.count} ideas)
                            </span>
                          </div>
                          <div className="grouping-tags">
                            {group.topKeywords.map((keyword) => (
                              <span
                                key={keyword}
                                className="grouping-tag"
                                style={{
                                  backgroundColor:
                                    KEYWORD_COLORS[keyword] || TAG_COLORS.skyblue,
                                }}
                              >
                                {keyword}({group.keywordCounts[keyword]})
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InsightPage
