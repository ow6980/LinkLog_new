// Gemini API를 사용하여 아이디어들을 그룹화하고 키워드를 생성하는 유틸리티

import { supabase } from '../supabaseClient'

export interface Idea {
  id: string
  title: string
  content: string | null
  keywords?: string[]
}

export interface KeywordGroup {
  keyword: string
  ideaIds: string[]
}

/**
 * Gemini API를 통해 아이디어들을 그룹화하고 키워드를 생성합니다.
 * @param ideas 그룹화할 아이디어 배열
 * @returns 키워드 그룹 배열
 */
export async function generateKeywordsWithGemini(
  ideas: Idea[]
): Promise<KeywordGroup[]> {
  if (!ideas || ideas.length === 0) {
    return []
  }

  try {
    // Supabase Edge Function 호출 (Supabase 클라이언트의 functions.invoke 사용)
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('User not authenticated')
    }

    console.log('Calling Edge Function: generate-keywords')
    console.log('Ideas count:', ideas.length)

    // Supabase functions.invoke를 사용하면 CORS 문제를 피할 수 있습니다
    const { data, error } = await supabase.functions.invoke('generate-keywords', {
      body: { ideas },
    })

    if (error) {
      console.error('Edge Function error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      
      // 에러 메시지에서 더 자세한 정보 추출
      let errorMessage = error.message || 'Failed to call Edge Function'
      if (error.context) {
        errorMessage += `: ${JSON.stringify(error.context)}`
      }
      
      throw new Error(errorMessage)
    }

    if (!data) {
      throw new Error('No data returned from Edge Function')
    }

    if (data.error) {
      console.error('Edge Function returned error:', data.error)
      throw new Error(data.error || 'Edge Function returned an error')
    }

    if (!data.keywordGroups) {
      console.warn('No keywordGroups in response:', data)
      return []
    }

    return data.keywordGroups || []
  } catch (error) {
    console.error('Error generating keywords with Gemini:', error)
    console.error('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
    console.error('Error details:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * 생성된 키워드를 데이터베이스에 업데이트합니다.
 * @param keywordGroups 키워드 그룹 배열
 */
export async function updateKeywordsInDatabase(
  keywordGroups: KeywordGroup[]
): Promise<void> {
  try {
    // 각 아이디어에 키워드 할당
    for (const group of keywordGroups) {
      for (const ideaId of group.ideaIds) {
        // 기존 키워드에 새 키워드 추가 (중복 제거)
        const { data: existingIdea } = await supabase
          .from('ideas')
          .select('keywords')
          .eq('id', ideaId)
          .single()

        if (existingIdea) {
          const existingKeywords = existingIdea.keywords || []
          const updatedKeywords = Array.from(
            new Set([...existingKeywords, group.keyword])
          )

          await supabase
            .from('ideas')
            .update({ keywords: updatedKeywords })
            .eq('id', ideaId)
        }
      }
    }
  } catch (error) {
    console.error('Error updating keywords in database:', error)
    throw error
  }
}

