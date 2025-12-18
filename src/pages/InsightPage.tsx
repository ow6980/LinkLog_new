import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
// @ts-expect-error - supabase client type is inferred from createClient
import { supabase } from '../supabaseClient'
import './InsightPage.css'
import { subWeeks } from 'date-fns'
import * as d3 from 'd3'
import { getKeywordColor, GRAY_COLORS } from '../utils/keywordColors'

interface Idea {
  id: string
  title: string
  content: string | null
  keywords: string[]
  created_at: string
  bookmarked?: boolean
  source_url?: string
}

const InsightPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const keywordChartRef = useRef<SVGSVGElement>(null)
  const heatmapContainerRef = useRef<HTMLDivElement>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [touchStartX, setTouchStartX] = useState(0)
  const [touchScrollLeft, setTouchScrollLeft] = useState(0)
  const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null)
  const weeklyChartRef = useRef<SVGSVGElement>(null)
  const [editingKeyword, setEditingKeyword] = useState<string | null>(null)
  const [editingKeywordValue, setEditingKeywordValue] = useState<string>('')

  // 현재 날짜 가져오기
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1

  // 월 목록 생성 (현재 월 기준으로 과거 3개월, 미래 1개월)
  const monthsList = useMemo(() => {
    const months: Array<{ year: number; month: number; label: string }> = []
    for (let i = -3; i <= 1; i++) {
      const date = new Date(currentYear, currentMonth - 1 + i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      months.push({
        year,
        month,
        label: monthLabels[month - 1]
      })
    }
    return months
  }, [currentYear, currentMonth])

  // 현재 월로 스크롤
  useEffect(() => {
    if (!heatmapContainerRef.current) return
    
    // 현재 월의 인덱스 찾기
    const currentMonthIndex = monthsList.findIndex(
      m => m.year === currentYear && m.month === currentMonth
    )
    
    if (currentMonthIndex >= 0) {
      // 각 월의 너비는 249px + gap 20px = 269px
      const monthWidth = 269
      const containerWidth = heatmapContainerRef.current.clientWidth
      const scrollPosition = currentMonthIndex * monthWidth - (containerWidth / 2 - monthWidth / 2)
      
      // 약간의 지연을 두고 스크롤 (렌더링 완료 후)
      setTimeout(() => {
        if (heatmapContainerRef.current) {
          heatmapContainerRef.current.scrollLeft = Math.max(0, scrollPosition)
        }
      }, 100)
    }
  }, [monthsList, currentYear, currentMonth])

  // 아이디어 로드
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin')
      return
    }

    const fetchIdeas = async () => {
      try {
        // @ts-expect-error - supabase client type is inferred
        const { data, error } = await supabase
          .from('ideas')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          // 날짜를 2025년 11월로 조정 (개발/테스트용)
          const adjustedData = data.map((idea: Idea, index: number) => {
            const originalDate = new Date(idea.created_at)
            // 2024년 또는 2025년 11월 이전 데이터를 2025년 11월로 변환
            if (originalDate.getFullYear() < 2025 || 
                (originalDate.getFullYear() === 2025 && originalDate.getMonth() < 10)) {
              // 2025년 11월 1일부터 30일 사이로 분산 배정
              const day = (index % 30) + 1 // 1일부터 30일까지 순환
              const hour = originalDate.getHours()
              const minute = originalDate.getMinutes()
              const newDate = new Date(2025, 10, day, hour, minute) // 10 = 11월 (0-based)
              return {
                ...idea,
                created_at: newDate.toISOString()
              }
            }
            return idea
          })
          setIdeas(adjustedData)
        }
      } catch (error) {
        console.error('Error fetching ideas:', error)
      }
    }

    fetchIdeas()
  }, [isAuthenticated, navigate])

  // 키워드 빈도 계산 (키워드 없는 아이디어 포함)
  const keywordFreq = useMemo(() => {
    const keywordCount: Record<string, number> = {}
    let noKeywordCount = 0
    
    ideas.forEach((idea) => {
      if (!idea.keywords || idea.keywords.length === 0) {
        noKeywordCount++
      } else {
        idea.keywords.forEach((keyword) => {
          keywordCount[keyword] = (keywordCount[keyword] || 0) + 1
        })
      }
    })

    const result = Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // 키워드 없는 아이디어가 있으면 추가
    if (noKeywordCount > 0) {
      result.push({ keyword: 'No Keyword', count: noKeywordCount })
    }

    return result
  }, [ideas])

  // 이번 주 키워드 빈도 (최근 7일)
  const thisWeekKeywords = useMemo(() => {
    const weekAgo = subWeeks(new Date(), 1)
    const recentIdeas = ideas.filter(
      (idea) => new Date(idea.created_at) >= weekAgo
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

  // 가장 활성화된 아이디어
  const mostActiveIdea = useMemo(() => {
    if (ideas.length === 0) return null

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

  // 최근 아이디어
  const recentIdeas = useMemo(() => {
    return [...ideas]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 3)
  }, [ideas])

  // 월별 아이디어 활동량 계산
  const monthlyActivity = useMemo(() => {
    const activityMap: Record<string, number> = {}
    ideas.forEach((idea) => {
      const date = new Date(idea.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const dayKey = `${monthKey}-${String(date.getDate()).padStart(2, '0')}`
      activityMap[dayKey] = (activityMap[dayKey] || 0) + 1
    })
    return activityMap
  }, [ideas])

  // 특정 날짜의 활동량 가져오기
  const getDayActivity = (year: number, month: number, day: number): number => {
    const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return monthlyActivity[dayKey] || 0
  }

  // 활동량에 따른 색상 결정 (많을수록 진하게, 데이터 없으면 기본 색상)
  const getActivityColor = (count: number): string => {
    if (count === 0) return GRAY_COLORS['200'] || '#ccc' // 데이터 없음
    if (count >= 10) return GRAY_COLORS['900'] || '#111'
    if (count >= 7) return GRAY_COLORS['800'] || '#1e1e1e'
    if (count >= 5) return GRAY_COLORS['500'] || '#444'
    if (count >= 3) return GRAY_COLORS['400'] || '#666'
    if (count >= 2) return GRAY_COLORS['300'] || '#949494'
    if (count === 1) return GRAY_COLORS['300'] || '#949494' // 1개도 색상 변화
    return GRAY_COLORS['200'] || '#ccc'
  }

  // 특정 날짜의 아이디어 가져오기
  const getDayIdeas = (year: number, month: number, day: number): Idea[] => {
    const targetDate = new Date(year, month - 1, day)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))
    
    return ideas.filter((idea) => {
      const ideaDate = new Date(idea.created_at)
      return ideaDate >= startOfDay && ideaDate <= endOfDay
    })
  }

  // 선택된 날짜의 주간 데이터 계산
  const weeklyData = useMemo(() => {
    if (!selectedDate) return []
    
    const { year, month, day } = selectedDate
    const selectedDateObj = new Date(year, month - 1, day)
    const dayOfWeek = selectedDateObj.getDay() // 0=일요일, 1=월요일, ...
    
    // 해당 주의 시작일 (일요일)
    const weekStart = new Date(selectedDateObj)
    weekStart.setDate(selectedDateObj.getDate() - dayOfWeek)
    
    // 모든 키워드 수집 (주간 데이터에서 사용되는 키워드들)
    const allKeywords = new Set<string>()
    const weekData = []
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart)
      currentDate.setDate(weekStart.getDate() + i)
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1
      const currentDay = currentDate.getDate()
      const dayIdeas = getDayIdeas(currentYear, currentMonth, currentDay)
      
      // 키워드별로 아이디어 그룹화
      const keywordGroups: Record<string, Idea[]> = {}
      const noKeywordIdeas: Idea[] = []
      
      dayIdeas.forEach((idea) => {
        if (idea.keywords && idea.keywords.length > 0) {
          const firstKeyword = idea.keywords[0]
          if (!keywordGroups[firstKeyword]) {
            keywordGroups[firstKeyword] = []
            allKeywords.add(firstKeyword)
          }
          keywordGroups[firstKeyword].push(idea)
        } else {
          noKeywordIdeas.push(idea)
        }
      })
      
      weekData.push({
        day: currentDay,
        month: currentMonth,
        year: currentYear,
        activity: dayIdeas.length,
        dayIdeas,
        keywordGroups,
        noKeywordCount: noKeywordIdeas.length,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]
      })
    }
    
    // 각 날짜 데이터에 키워드별 카운트 추가
    const sortedKeywords = Array.from(allKeywords).sort()
    const weekDataWithCounts = weekData.map((dayData) => {
      const keywordCounts: Record<string, number> = {}
      sortedKeywords.forEach((keyword) => {
        keywordCounts[keyword] = dayData.keywordGroups[keyword]?.length || 0
      })
      return {
        ...dayData,
        keywordCounts
      }
    })
    
    return { weekData: weekDataWithCounts, keywords: sortedKeywords }
  }, [selectedDate, monthlyActivity, ideas])

  // 주간 그래프 그리기 (라인 그래프)
  useEffect(() => {
    if (!weeklyChartRef.current || !weeklyData || !('weekData' in weeklyData) || weeklyData.weekData.length === 0) return

    const svg = d3.select(weeklyChartRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 40, bottom: 40, left: 40 }
    const svgWidth = 600
    const svgHeight = 200
    const width = svgWidth - margin.left - margin.right
    const height = svgHeight - margin.top - margin.bottom

    const g = svg
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // X축을 scalePoint로 변경 (라인 그래프용)
    const x = d3
      .scalePoint()
      .range([0, width])
      .padding(0.5)
      .domain(weeklyData.weekData.map(d => d.dayName))

    const maxActivity = Math.max(...weeklyData.weekData.map(d => d.activity), 1)
    const yMax = Math.ceil(maxActivity * 1.2)
    const y = d3
      .scaleLinear()
      .range([height, 0])
      .domain([0, yMax])

    // 가이드 라인
    const tickInterval = yMax <= 5 ? 1 : yMax <= 10 ? 2 : 5
    const guideTicks: number[] = []
    for (let i = 0; i <= yMax; i += tickInterval) {
      guideTicks.push(i)
    }
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

    // Y축
    const yAxis = g.append('g').call(
      d3.axisLeft(y)
        .tickValues(guideTicks)
        .tickFormat((d) => d.toString())
    )
    
    yAxis.selectAll('text')
      .style('font-family', 'Montserrat')
      .style('font-size', '10px')
      .style('fill', GRAY_COLORS['400'] || '#666666')
    
    yAxis.selectAll('.domain').remove()
    yAxis.selectAll('.tick line').remove()

    // X축
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
    
    xAxis.selectAll('text')
      .style('font-family', 'Montserrat')
      .style('font-size', '10px')
      .style('fill', GRAY_COLORS['400'] || '#666666')
      .style('text-anchor', 'middle')
    
    xAxis.selectAll('.domain').remove()
    xAxis.selectAll('.tick line').remove()

    // 툴팁 컨테이너
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'weekly-tooltip')
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('pointer-events', 'none')
      .style('background-color', '#1e1e1e')
      .style('color', '#ffffff')
      .style('padding', '12px')
      .style('border-radius', '8px')
      .style('font-family', 'Montserrat, Pretendard, sans-serif')
      .style('font-size', '12px')
      .style('max-width', '300px')
      .style('max-height', '400px')
      .style('overflow-y', 'auto')
      .style('z-index', 1000)
      .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.3)')

    // 라인 생성 함수
    const line = d3.line<typeof weeklyData.weekData[0]>()
      .x((d) => (x(d.dayName) || 0))
      .y((d) => y(d.activity))
      .curve(d3.curveMonotoneX) // 부드러운 곡선

    // 라인 그리기
    g.append('path')
      .datum(weeklyData.weekData)
      .attr('fill', 'none')
      .attr('stroke', GRAY_COLORS['400'] || '#666666')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.5)
      .attr('d', line)

    // 각 날짜별로 원 그리기 (아이디어가 있는 경우)
    weeklyData.weekData.forEach((dayData) => {
      if (dayData.activity > 0) {
        // 첫 번째 키워드 색상 가져오기
        let circleColor = GRAY_COLORS['300'] || '#949494' // 기본값: 키워드 없음
        if (dayData.dayIdeas && dayData.dayIdeas.length > 0) {
          const firstIdea = dayData.dayIdeas[0]
          if (firstIdea.keywords && firstIdea.keywords.length > 0) {
            circleColor = getKeywordColor(firstIdea.keywords[0])
          }
        }

        const xPos = x(dayData.dayName) || 0
        const yPos = y(dayData.activity)

        g.append('circle')
          .attr('cx', xPos)
          .attr('cy', yPos)
          .attr('r', 8) // 원의 반지름
          .attr('fill', circleColor)
          .style('cursor', 'pointer')
          .on('mouseover', function(event) {
            d3.select(this)
              .attr('r', 10)
            
            if (dayData.dayIdeas && dayData.dayIdeas.length > 0) {
              const tooltipContent = `
                <div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
                  ${dayData.year}. ${dayData.month}. ${dayData.day} (${dayData.dayName})
                </div>
                <div style="font-size: 11px; margin-bottom: 8px; color: rgba(255,255,255,0.8);">
                  총 ${dayData.activity}개 아이디어
                </div>
                <div style="max-height: 250px; overflow-y: auto;">
                  ${dayData.dayIdeas.slice(0, 10).map((idea: Idea) => {
                    const ideaKeyword = idea.keywords && idea.keywords.length > 0 ? idea.keywords[0] : null
                    const ideaColor = ideaKeyword ? getKeywordColor(ideaKeyword) : (GRAY_COLORS['300'] || '#949494')
                    return `
                      <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${ideaColor}; flex-shrink: 0; margin-top: 4px;"></div>
                        <div style="flex: 1; font-size: 11px; line-height: 1.4; word-break: break-word;">
                          ${idea.title || 'Untitled'}
                        </div>
                      </div>
                    `
                  }).join('')}
                  ${dayData.dayIdeas.length > 10 ? `<div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 4px;">+ ${dayData.dayIdeas.length - 10}개 더...</div>` : ''}
                </div>
              `
              
              const mouseX = (event as MouseEvent).pageX || (event as MouseEvent).clientX
              const mouseY = (event as MouseEvent).pageY || (event as MouseEvent).clientY
              
              tooltip
                .html(tooltipContent)
                .style('left', `${mouseX + 15}px`)
                .style('top', `${mouseY + 15}px`)
                .style('opacity', 1)
            }
          })
          .on('mousemove', function(event) {
            const mouseX = (event as MouseEvent).pageX || (event as MouseEvent).clientX
            const mouseY = (event as MouseEvent).pageY || (event as MouseEvent).clientY
            
            tooltip
              .style('left', `${mouseX + 15}px`)
              .style('top', `${mouseY + 15}px`)
          })
          .on('mouseout', function() {
            d3.select(this)
              .attr('r', 8)
            
            tooltip.style('opacity', 0)
          })
      }
    })

    // cleanup 함수
    return () => {
      tooltip.remove()
    }
  }, [weeklyData])

  // 달력 생성 함수
  const generateCalendar = (year: number, month: number) => {
    // 해당 월의 첫 번째 날과 마지막 날
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const daysInMonth = lastDay.getDate()
    
    // 첫 번째 날의 요일 (0=일요일, 1=월요일, ...)
    const firstDayOfWeek = firstDay.getDay()
    
    // 달력 그리드 생성 (6주 x 7일 = 42칸)
    const calendar: (number | null)[] = []
    
    // 첫 주의 빈 칸들 (첫 번째 날 이전)
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendar.push(null)
    }
    
    // 실제 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      calendar.push(day)
    }
    
    // 마지막 주의 빈 칸들 (마지막 날 이후)
    const remainingCells = 42 - calendar.length
    for (let i = 0; i < remainingCells; i++) {
      calendar.push(null)
    }
    
    // 6주로 나누기
    const weeks: (number | null)[][] = []
    for (let i = 0; i < 6; i++) {
      weeks.push(calendar.slice(i * 7, (i + 1) * 7))
    }
    
    return weeks
  }

  // 키워드 그룹핑
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
      .filter(([_, ideaList]) => ideaList.length > 0)
      .map(([keyword, ideaList]) => {
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

  // 차트 그리기
  useEffect(() => {
    if (!keywordChartRef.current || keywordFreq.length === 0) return

    const svg = d3.select(keywordChartRef.current)
    svg.selectAll('*').remove()

    // 키워드를 두 줄로 나누는 함수
    const splitKeyword = (keyword: string): string[] => {
      if (keyword === 'No Keyword') return [keyword]
      
      // 구분자 기준으로 나누기: "및", "의", "에", "을", "를", "과", "와", " "
      const separators = [' 및 ', ' 의 ', ' 에 ', ' 을 ', ' 를 ', ' 과 ', ' 와 ', ' ']
      let splitPoint = -1
      
      for (const sep of separators) {
        const index = keyword.indexOf(sep)
        if (index > 0 && index < keyword.length - sep.length) {
          splitPoint = index + Math.floor(sep.length / 2)
          break
        }
      }
      
      // 구분자를 찾지 못했으면 중간 지점에서 나누기
      if (splitPoint === -1) {
        splitPoint = Math.floor(keyword.length / 2)
      }
      
      const line1 = keyword.substring(0, splitPoint).trim()
      const line2 = keyword.substring(splitPoint).trim()
      
      return line2 ? [line1, line2] : [keyword]
    }

    // SVG 컨테이너의 실제 너비 계산 (950px - padding 28px * 2 = 894px)
    const containerElement = keywordChartRef.current?.parentElement
    const containerWidth = containerElement ? containerElement.clientWidth - 56 : 894 // padding 28px * 2
    const svgWidth = containerWidth || 894
    const svgHeight = 280
    
    const margin = { top: 20, right: 20, bottom: 60, left: 50 } // bottom을 60으로 증가
    const width = svgWidth - margin.left - margin.right
    const height = svgHeight - margin.top - margin.bottom

    const g = svg
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleBand()
      .range([0, width])
      .padding(0.3)
      .domain(keywordFreq.map((d) => d.keyword))

    // y축 최대값을 데이터에 맞게 동적으로 설정
    const maxCount = Math.max(...keywordFreq.map(d => d.count), 1)
    const yMax = Math.ceil(maxCount * 1.2) // 여유 공간을 위해 20% 추가
    const y = d3
      .scaleLinear()
      .range([height, 0])
      .domain([0, yMax])

    // 가이드 라인을 yMax에 맞게 동적으로 생성
    const tickInterval = yMax <= 10 ? 2 : yMax <= 20 ? 5 : 10
    const guideTicks: number[] = []
    for (let i = 0; i <= yMax; i += tickInterval) {
      guideTicks.push(i)
    }
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

    const yTicks = guideTicks
    const yAxis = g.append('g').call(
      d3.axisLeft(y)
        .tickValues(yTicks)
        .tickFormat((d) => d.toString())
    )
    
    yAxis.selectAll('text')
      .style('font-family', 'Montserrat')
      .style('font-size', '10px')
      .style('fill', GRAY_COLORS['400'] || '#666666')
    
    yAxis.selectAll('.domain').remove()
    yAxis.selectAll('.tick line').remove()

    // X축 레이블을 두 줄로 표시
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${height})`)
    
    // X축 도메인 라인
    xAxis.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#1e1e1e')
      .attr('stroke-width', 1)
    
    // 각 키워드에 대해 레이블 생성
    keywordFreq.forEach((d) => {
      const xPos = (x(d.keyword) || 0) + x.bandwidth() / 2
      const lines = splitKeyword(d.keyword)
      
      lines.forEach((line, index) => {
        xAxis.append('text')
          .attr('x', xPos)
          .attr('y', 12 + index * 12) // 첫 줄: 12px, 두 번째 줄: 24px
          .attr('text-anchor', 'middle')
          .style('font-family', 'Montserrat')
          .style('font-size', '10px')
          .style('fill', GRAY_COLORS['400'] || '#666666')
          .text(line)
      })
    })

    // 바 차트
    g.selectAll('.bar')
      .data(keywordFreq)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.keyword) || 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.count))
      .attr('height', (d) => height - y(d.count))
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', (d) => {
        if (d.keyword === 'No Keyword') {
          return GRAY_COLORS['300'] || '#949494'
        }
        return getKeywordColor(d.keyword)
      })
      .attr('fill-opacity', 0.05)
      .attr('stroke', (d) => {
        if (d.keyword === 'No Keyword') {
          return GRAY_COLORS['300'] || '#949494'
        }
        return getKeywordColor(d.keyword)
      })
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', function(_, d) {
        setSelectedKeyword(d.keyword)
      })
  }, [keywordFreq])

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
                  <button
                    className="activity-card"
                    onClick={() => navigate(`/idea/${mostActiveIdea.id}`)}
                  >
                    <div className="activity-header">
                      <div className="activity-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10.6667 4.66675H14.6667V8.66675" stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14.6666 4.66675L8.99992 10.3334L5.66659 7.00008L1.33325 11.3334" stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round"/>
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
                              backgroundColor: getKeywordColor(keyword),
                            }}
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                )}

                <div className="activity-card">
                  <div className="activity-header">
                    <div className="activity-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 9.33325C10.1333 8.66659 10.4667 8.19992 11 7.66659C11.6667 7.06659 12 6.19992 12 5.33325C12 4.27239 11.5786 3.25497 10.8284 2.50482C10.0783 1.75468 9.06087 1.33325 8 1.33325C6.93913 1.33325 5.92172 1.75468 5.17157 2.50482C4.42143 3.25497 4 4.27239 4 5.33325C4 5.99992 4.13333 6.79992 5 7.66659C5.46667 8.13325 5.86667 8.66659 6 9.33325" stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 12H10" stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6.66675 14.6667H9.33341" stroke="#1E1E1E" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="activity-title">New Idea</span>
                  </div>
                  <div className="new-ideas-list">
                    {recentIdeas.map((idea) => {
                      // 키워드가 배정되어 있지 않으면 그레이 컬러 사용
                      const hasKeywords = idea.keywords && idea.keywords.length > 0
                      const firstKeyword = hasKeywords ? idea.keywords[0] : null
                      const color = hasKeywords && firstKeyword
                        ? getKeywordColor(firstKeyword)
                        : (GRAY_COLORS['300'] || '#949494')
                      return (
                        <button
                          key={idea.id}
                          className="new-idea-item"
                          onClick={() => navigate(`/idea/${idea.id}`)}
                          style={{
                            background: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left'
                          }}
                        >
                          <div
                            className="new-idea-dot"
                            style={{ backgroundColor: color }}
                          ></div>
                          <span className="new-idea-text">
                            {idea.title || (idea.content ? idea.content.substring(0, 30) : '')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="keyword-section">
            <div className="keyword-frequency">
              <div className="section-title-area">
                <h2 className="section-title">keyword Distribution</h2>
                <p className="section-subtitle">Select a keyword to view related ideas</p>
              </div>
              <div className="chart-wrapper">
                <div className="chart-container">
                  <svg ref={keywordChartRef}></svg>
                </div>
                {selectedKeyword ? (
                  <div className="selected-keyword-panel">
                    <div className="selected-keyword-header">
                      <div
                        className="selected-keyword-dot"
                        style={{ 
                          backgroundColor: selectedKeyword === 'No Keyword' 
                            ? (GRAY_COLORS['300'] || '#949494')
                            : getKeywordColor(selectedKeyword)
                        }}
                      ></div>
                      <span className="selected-keyword-name">
                        {selectedKeyword === 'No Keyword' ? 'No Keyword' : selectedKeyword}
                      </span>
                      <span className="selected-keyword-count">
                        ({selectedKeyword === 'No Keyword' 
                          ? ideas.filter(idea => !idea.keywords || idea.keywords.length === 0).length
                          : ideas.filter(idea => idea.keywords && idea.keywords.includes(selectedKeyword)).length
                        } ideas)
                      </span>
                    </div>
                    <div className="selected-ideas-list">
                      {(selectedKeyword === 'No Keyword'
                        ? ideas.filter(idea => !idea.keywords || idea.keywords.length === 0)
                        : ideas.filter(idea => idea.keywords && idea.keywords.includes(selectedKeyword))
                      ).map((idea) => {
                        // 키워드가 배정되어 있지 않으면 그레이 컬러 사용
                        const hasKeywords = idea.keywords && idea.keywords.length > 0
                        const ideaFirstKeyword = hasKeywords ? idea.keywords[0] : null
                        const ideaColor = hasKeywords && ideaFirstKeyword
                          ? getKeywordColor(ideaFirstKeyword)
                          : (GRAY_COLORS['300'] || '#949494')
                        return (
                          <button
                            key={idea.id}
                            className="selected-idea-item"
                            onClick={() => navigate(`/idea/${idea.id}`)}
                            style={{
                              background: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              width: '100%',
                              textAlign: 'left'
                            }}
                          >
                            <div
                              className="selected-idea-dot"
                              style={{ backgroundColor: ideaColor }}
                            ></div>
                            <span className="selected-idea-text">
                              {idea.title || (idea.content ? idea.content.substring(0, 50) : '')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="selected-keyword-panel">
                    <div className="selected-keyword-header">
                      <div
                        className="selected-keyword-dot"
                        style={{ backgroundColor: keywordFreq.length > 0 && keywordFreq[0].keyword === 'No Keyword'
                          ? (GRAY_COLORS['300'] || '#949494')
                          : (keywordFreq.length > 0 ? getKeywordColor(keywordFreq[0].keyword) : GRAY_COLORS['300'] || '#949494')
                        }}
                      ></div>
                      <span className="selected-keyword-name">
                        {keywordFreq.length > 0 ? keywordFreq[0].keyword : 'Select a keyword'}
                      </span>
                      <span className="selected-keyword-count">
                        ({keywordFreq.length > 0 ? keywordFreq[0].count : 0} ideas)
                      </span>
                    </div>
                    <div className="selected-ideas-list">
                      {(keywordFreq.length > 0
                        ? (keywordFreq[0].keyword === 'No Keyword'
                            ? ideas.filter(idea => !idea.keywords || idea.keywords.length === 0)
                            : ideas.filter(idea => idea.keywords && idea.keywords.includes(keywordFreq[0].keyword))
                          )
                        : []
                      ).slice(0, 10).map((idea) => {
                        // 키워드가 배정되어 있지 않으면 그레이 컬러 사용
                        const hasKeywords = idea.keywords && idea.keywords.length > 0
                        const ideaFirstKeyword = hasKeywords ? idea.keywords[0] : null
                        const ideaColor = hasKeywords && ideaFirstKeyword
                          ? getKeywordColor(ideaFirstKeyword)
                          : (GRAY_COLORS['300'] || '#949494')
                        return (
                          <button
                            key={idea.id}
                            className="selected-idea-item"
                            onClick={() => navigate(`/idea/${idea.id}`)}
                            style={{
                              background: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              width: '100%',
                              textAlign: 'left'
                            }}
                          >
                            <div
                              className="selected-idea-dot"
                              style={{ backgroundColor: ideaColor }}
                            ></div>
                            <span className="selected-idea-text">
                              {idea.title || (idea.content ? idea.content.substring(0, 50) : '')}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="keyword-grouping-section">
            <div className="keyword-grouping">
              <div className="section-title-area">
                <h2 className="section-title">edit keywords</h2>
                <p className="section-subtitle">Edit keywords Name</p>
              </div>
              <div className="grouping-list-horizontal">
                {(() => {
                  // 모든 고유 키워드 추출 및 카운트
                  const allKeywordsMap = new Map<string, number>()
                  ideas.forEach((idea) => {
                    if (idea.keywords && idea.keywords.length > 0) {
                      idea.keywords.forEach((keyword) => {
                        if (keyword && keyword !== 'No Keyword') {
                          allKeywordsMap.set(keyword, (allKeywordsMap.get(keyword) || 0) + 1)
                        }
                      })
                    }
                  })
                  
                  const allKeywords = Array.from(allKeywordsMap.entries())
                    .map(([keyword, count]) => ({ keyword, count }))
                    .sort((a, b) => b.count - a.count)
                  
                  return allKeywords.map((item) => {
                    const color = getKeywordColor(item.keyword)
                    const isEditing = editingKeyword === item.keyword
                    
                    const handleKeywordClick = (e: React.MouseEvent) => {
                      e.stopPropagation()
                      setEditingKeyword(item.keyword)
                      setEditingKeywordValue(item.keyword)
                    }
                    
                    const handleSaveKeyword = async () => {
                      if (!editingKeywordValue.trim() || editingKeywordValue === item.keyword) {
                        setEditingKeyword(null)
                        return
                      }
                      
                      const newKeyword = editingKeywordValue.trim()
                      
                      // 중복 체크
                      if (allKeywords.some(k => k.keyword === newKeyword && k.keyword !== item.keyword)) {
                        alert('이미 존재하는 키워드입니다.')
                        setEditingKeyword(null)
                        setEditingKeywordValue('')
                        return
                      }
                      
                      try {
                        // 해당 키워드를 가진 모든 아이디어 찾기
                        const ideasWithKeyword = ideas.filter(idea => 
                          idea.keywords && idea.keywords.includes(item.keyword)
                        )
                        
                        // 각 아이디어의 keywords 배열에서 기존 키워드를 새 키워드로 교체
                        for (const idea of ideasWithKeyword) {
                          const updatedKeywords = idea.keywords.map(k => 
                            k === item.keyword ? newKeyword : k
                          )
                          
                          // @ts-expect-error - supabase client type is inferred
                          const { error } = await supabase
                            .from('ideas')
                            .update({ keywords: updatedKeywords })
                            .eq('id', idea.id)
                          
                          if (error) throw error
                        }
                        
                        // 로컬 상태 업데이트
                        setIdeas(prevIdeas => 
                          prevIdeas.map(idea => {
                            if (idea.keywords && idea.keywords.includes(item.keyword)) {
                              return {
                                ...idea,
                                keywords: idea.keywords.map(k => 
                                  k === item.keyword ? newKeyword : k
                                )
                              }
                            }
                            return idea
                          })
                        )
                        
                        setEditingKeyword(null)
                      } catch (error) {
                        console.error('Error updating keyword:', error)
                        alert('키워드 업데이트 중 오류가 발생했습니다.')
                      }
                    }
                    
                    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSaveKeyword()
                      } else if (e.key === 'Escape') {
                        setEditingKeyword(null)
                        setEditingKeywordValue('')
                      }
                    }
                    
                    return (
                      <div 
                        key={item.keyword} 
                        className="grouping-card" 
                        style={{ cursor: isEditing ? 'default' : 'pointer' }}
                      >
                        <div className="grouping-header">
                          <div
                            className="grouping-dot"
                            style={{ backgroundColor: color }}
                          ></div>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingKeywordValue}
                              onChange={(e) => setEditingKeywordValue(e.target.value)}
                              onBlur={handleSaveKeyword}
                              onKeyDown={handleKeyDown}
                              onClick={(e) => e.stopPropagation()}
                              className="grouping-name-input"
                              autoFocus
                              style={{
                                fontFamily: 'Montserrat, sans-serif',
                                fontSize: '16px',
                                fontWeight: 400,
                                color: '#1e1e1e',
                                border: '1px solid #1e1e1e',
                                padding: '2px 4px',
                                outline: 'none',
                                background: 'transparent',
                                minWidth: '100px',
                                flex: 1,
                              }}
                            />
                          ) : (
                            <span 
                              className="grouping-name"
                              onClick={handleKeywordClick}
                              style={{ cursor: 'text' }}
                            >
                              {item.keyword}
                            </span>
                          )}
                          <span className="grouping-count">
                            ({item.count} ideas)
                          </span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>

          <div className="timeline-section">
            <div className="monthly-activity">
              <div className="section-title-area">
                <h2 className="section-title">monthly idea activity</h2>
                <p className="section-subtitle">Darker colors indicate higher idea activity</p>
              </div>
              <div className="heatmap-container">
                <div className="heatmap-content">
                  <div 
                    className="heatmap-months"
                    ref={heatmapContainerRef}
                    onMouseDown={(e) => {
                      if (!heatmapContainerRef.current) return
                      setIsDragging(true)
                      setStartX(e.pageX - heatmapContainerRef.current.offsetLeft)
                      setScrollLeft(heatmapContainerRef.current.scrollLeft)
                    }}
                    onMouseLeave={() => {
                      setIsDragging(false)
                    }}
                    onMouseUp={() => {
                      setIsDragging(false)
                    }}
                    onMouseMove={(e) => {
                      if (!isDragging || !heatmapContainerRef.current) return
                      e.preventDefault()
                      const x = e.pageX - heatmapContainerRef.current.offsetLeft
                      const walk = (x - startX) * 2 // 스크롤 속도 조절
                      heatmapContainerRef.current.scrollLeft = scrollLeft - walk
                    }}
                    onTouchStart={(e) => {
                      if (!heatmapContainerRef.current) return
                      setTouchStartX(e.touches[0].pageX - heatmapContainerRef.current.offsetLeft)
                      setTouchScrollLeft(heatmapContainerRef.current.scrollLeft)
                    }}
                    onTouchMove={(e) => {
                      if (!heatmapContainerRef.current) return
                      e.preventDefault()
                      const x = e.touches[0].pageX - heatmapContainerRef.current.offsetLeft
                      const walk = (x - touchStartX) * 2
                      heatmapContainerRef.current.scrollLeft = touchScrollLeft - walk
                    }}
                  >
                    {monthsList.map((monthData, monthIdx) => {
                      const calendar = generateCalendar(monthData.year, monthData.month)
                      const prevMonth = monthIdx > 0 ? monthsList[monthIdx - 1] : null
                      const showYear = !prevMonth || prevMonth.year !== monthData.year || monthData.month === 1
                      
                      return (
                        <div key={`${monthData.year}-${monthData.month}`} className="heatmap-month">
                          {showYear ? (
                            <div className="heatmap-year">{monthData.year}</div>
                          ) : (
                            <div className="heatmap-year-empty"></div>
                          )}
                          <div className="heatmap-month-label">{monthData.label}</div>
                          <div className="heatmap-calendar">
                            {calendar.map((week, weekIdx) => (
                              <div key={weekIdx} className="heatmap-week">
                                {week.map((day, dayIdx) => {
                                  if (day === null) {
                                    return (
                                      <div
                                        key={dayIdx}
                                        className="heatmap-day heatmap-day-empty"
                                      />
                                    )
                                  }
                                  const activity = getDayActivity(monthData.year, monthData.month, day)
                                  const bgColor = getActivityColor(activity)
                                  const isSelected = selectedDate?.year === monthData.year && 
                                                    selectedDate?.month === monthData.month && 
                                                    selectedDate?.day === day
                                  return (
                                    <div
                                      key={dayIdx}
                                      className={`heatmap-day ${isSelected ? 'heatmap-day-selected' : ''}`}
                                      style={{ backgroundColor: bgColor }}
                                      onClick={() => setSelectedDate({ year: monthData.year, month: monthData.month, day })}
                                      title={`${day}일: ${activity}개 아이디어`}
                                    />
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="weekly-activity">
              <div className="section-title-area">
                <h2 className="section-title">weekly idea activity</h2>
                <p className="section-subtitle">Select a day from the heatmap to view weekly activity</p>
              </div>
              <div className="weekly-chart-container">
                <div className="weekly-navigation">
                  <button 
                    className="nav-arrow"
                    onClick={() => {
                      if (!selectedDate) return
                      const currentDate = new Date(selectedDate.year, selectedDate.month - 1, selectedDate.day)
                      currentDate.setDate(currentDate.getDate() - 7)
                      setSelectedDate({
                        year: currentDate.getFullYear(),
                        month: currentDate.getMonth() + 1,
                        day: currentDate.getDate()
                      })
                    }}
                    disabled={!selectedDate}
                  >
                    ‹
                  </button>
                  <span className="weekly-date">
                    {selectedDate && weeklyData && 'weekData' in weeklyData && weeklyData.weekData.length > 0
                      ? `${weeklyData.weekData[0].year}. ${weeklyData.weekData[0].month}. week${Math.ceil((weeklyData.weekData[0].day + new Date(weeklyData.weekData[0].year, weeklyData.weekData[0].month - 1, 1).getDay()) / 7)}`
                      : selectedDate
                      ? `${selectedDate.year}. ${selectedDate.month}. week${Math.ceil((selectedDate.day + new Date(selectedDate.year, selectedDate.month - 1, 1).getDay()) / 7)}`
                      : 'Select a day from the heatmap'
                    }
                  </span>
                  <button 
                    className="nav-arrow"
                    onClick={() => {
                      if (!selectedDate) return
                      const currentDate = new Date(selectedDate.year, selectedDate.month - 1, selectedDate.day)
                      currentDate.setDate(currentDate.getDate() + 7)
                      setSelectedDate({
                        year: currentDate.getFullYear(),
                        month: currentDate.getMonth() + 1,
                        day: currentDate.getDate()
                      })
                    }}
                    disabled={!selectedDate}
                  >
                    ›
                  </button>
                </div>
                <div className="weekly-graph-container">
                  {selectedDate && weeklyData && 'weekData' in weeklyData && weeklyData.weekData.length > 0 ? (
                    <svg ref={weeklyChartRef}></svg>
                  ) : (
                    <div className="weekly-graph-placeholder">
                      <p style={{ color: GRAY_COLORS['400'] || '#666', fontSize: '14px' }}>
                        Select a day from the heatmap to view weekly activity
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InsightPage
