# Generate Keywords Edge Function

이 Edge Function은 Google Gemini API를 사용하여 아이디어들을 유사성에 따라 그룹화하고 키워드를 생성합니다.

## 설정 방법

### 1. Gemini API 키 발급

1. [Google AI Studio](https://makersuite.google.com/app/apikey)에 접속
2. "Create API Key" 버튼 클릭
3. API 키 복사

### 2. Supabase 환경 변수 설정

Supabase 대시보드에서 다음 환경 변수를 설정하세요:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

설정 위치:
- Supabase Dashboard → Project Settings → Edge Functions → Secrets

### 3. Edge Function 배포

```bash
# Supabase CLI가 설치되어 있어야 합니다
supabase functions deploy generate-keywords
```

또는 Supabase Dashboard에서 직접 배포할 수 있습니다.

## 사용 방법

프론트엔드에서 `generateKeywordsWithGemini` 함수를 호출하면 됩니다:

```typescript
import { generateKeywordsWithGemini, updateKeywordsInDatabase } from '../utils/geminiKeywordGenerator'

const keywordGroups = await generateKeywordsWithGemini(ideas)
await updateKeywordsInDatabase(keywordGroups)
```

## API 응답 형식

```json
{
  "keywordGroups": [
    {
      "keyword": "반복적인 움직임",
      "ideaIds": ["idea-id-1", "idea-id-2", "idea-id-3"]
    },
    {
      "keyword": "감정 표현",
      "ideaIds": ["idea-id-4", "idea-id-5"]
    }
  ]
}
```

## 주의사항

- 무료 Gemini API는 분당 요청 수 제한이 있습니다.
- API 키는 절대 클라이언트 코드에 노출하지 마세요. Edge Function에서만 사용합니다.

