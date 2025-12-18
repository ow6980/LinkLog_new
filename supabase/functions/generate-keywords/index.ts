// Supabase Edge Function: Gemini API를 사용하여 아이디어들을 그룹화하고 키워드 생성
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
// Gemini API v1beta 사용
// gemini-1.5-flash는 무료 티어에서 사용 가능하고 빠릅니다
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'

interface Idea {
  id: string
  title: string
  content: string | null
}

interface KeywordGroup {
  keyword: string
  ideaIds: string[]
}

// CORS 헤더 헬퍼 함수
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    // Supabase 클라이언트 생성
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase configuration missing' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // 사용자 인증 확인 (토큰에서 직접 추출)
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    // 요청 본문 파싱
    const { ideas } = await req.json()

    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Ideas array is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    // Gemini API 키 확인
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    // 아이디어들을 텍스트로 변환
    const ideasText = ideas
      .map((idea: Idea, index: number) => `${index + 1}. ${idea.title}${idea.content ? ` - ${idea.content}` : ''}`)
      .join('\n')

    // Gemini API에 전송할 프롬프트 작성
    const prompt = `다음은 사용자가 입력한 아이디어들입니다. 이 아이디어들을 유사성에 따라 그룹화하고, 각 그룹에 대한 주제(키워드)를 추출해주세요.

아이디어 목록:
${ideasText}

요구사항:
1. 유사한 아이디어들을 3개 이상 묶어서 하나의 그룹으로 만드세요.
2. 각 그룹에 대한 주제(키워드)를 추출하세요. 키워드는 단어가 아니라 개념적인 주제여야 합니다 (예: "반복적인 움직임", "감정 표현", "시간 기반 변화" 등).
3. 응답은 반드시 다음 JSON 형식으로만 제공하세요:
{
  "groups": [
    {
      "keyword": "주제명",
      "ideaIds": ["아이디어1의 인덱스", "아이디어2의 인덱스", "아이디어3의 인덱스"]
    }
  ]
}

주의사항:
- ideaIds는 0부터 시작하는 인덱스 번호를 사용하세요 (예: 0, 1, 2)
- 그룹에 속하지 않은 아이디어는 포함하지 않아도 됩니다.
- 키워드는 한국어로 작성하세요.
- JSON 형식만 반환하고 다른 설명은 포함하지 마세요.`

    // Gemini API 호출
    const geminiResponse = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to call Gemini API', details: errorText }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      return new Response(
        JSON.stringify({ error: 'No response from Gemini API' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders,
          } 
        }
      )
    }

    // JSON 응답 파싱 (마크다운 코드 블록 제거)
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    const parsedResponse = JSON.parse(jsonText)
    const groups: KeywordGroup[] = parsedResponse.groups || []

    // 인덱스를 실제 아이디어 ID로 변환
    const keywordGroups = groups.map((group) => ({
      keyword: group.keyword,
      ideaIds: group.ideaIds.map((idx: string | number) => {
        const index = typeof idx === 'string' ? parseInt(idx, 10) : idx
        return ideas[index]?.id
      }).filter((id: string | undefined) => id !== undefined),
    }))

    return new Response(
      JSON.stringify({ keywordGroups }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack,
        type: error instanceof Error ? error.constructor.name : typeof error
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders,
        } 
      }
    )
  }
})

