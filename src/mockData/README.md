# Mock Data 설명

이 폴더에는 다른 페이지 디자인을 위한 mock 데이터가 포함되어 있습니다.

## 파일 구조

### `ideas.json`
20개의 다양한 아이디어 mock 데이터를 포함합니다.

각 아이디어는 다음 필드를 포함합니다:
- `id`: 고유 식별자
- `title`: 아이디어 제목
- `content`: 아이디어 상세 내용
- `keywords`: 키워드 배열 (2-5개)
- `createdAt`: 생성 날짜 (ISO 8601 형식)
- `sourceUrl`: 출처 URL (optional)
- `bookmarked`: 북마크 여부 (optional)

## 사용 방법

### localStorage에 로드하기
```typescript
import mockIdeas from './mockData/ideas.json'

// localStorage에 저장
localStorage.setItem('ideas', JSON.stringify(mockIdeas))
```

### 특정 페이지에서 사용하기
```typescript
import mockIdeas from './mockData/ideas.json'

// Connect Map 페이지용
const ideasForMap = mockIdeas

// Bookmark 페이지용 (북마크된 것만)
const bookmarkedIdeas = mockIdeas.filter(idea => idea.bookmarked)

// Insight 페이지용 (전체 데이터)
const allIdeas = mockIdeas
```

## 데이터 특징

- **다양한 주제**: AI/ML, Blockchain, Quantum Computing, IoT, Healthcare 등
- **키워드 다양성**: 각 아이디어마다 2-5개의 관련 키워드
- **날짜 분포**: 최근 3주간의 다양한 날짜
- **북마크 분포**: 일부는 북마크됨, 일부는 북마크 안 됨
- **출처 URL**: 대부분의 아이디어에 출처 포함

## 디자인 테스트에 유용한 이유

1. **Connect Map**: 다양한 키워드 조합으로 클러스터링 테스트 가능
2. **Bookmark**: 북마크된 아이디어만 필터링하여 UI 테스트
3. **Insight**: 충분한 데이터로 그래프 및 통계 시각화 테스트
4. **Idea Detail**: 다양한 길이의 콘텐츠로 레이아웃 테스트

