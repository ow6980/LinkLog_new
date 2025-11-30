# LinkLog - 아이디어 연결 및 관리 앱

React + TypeScript + Vite 기반의 아이디어 관리 웹 애플리케이션입니다.

## 주요 기능

- **P1 Main**: 아이디어 입력, 키워드 자동 추출, 최근 아이디어 관리
- **P2 Connect Map**: 노드/선 기반 아이디어 연결 시각화
- **P3 Idea Detail**: 아이디어 상세 수정, 키워드 관리, 북마크
- **P4 Bookmark**: 북마크된 아이디어 목록
- **P5 Insight**: 키워드 빈도 및 주별 아이디어 분석

## 기술 스택

- React 18
- TypeScript
- Vite
- React Router
- D3.js (그래프 시각화)
- Supabase (백엔드, 준비 중)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 프로젝트 구조

```
src/
├── components/       # 공통 컴포넌트
│   ├── Header.tsx   # 헤더 네비게이션
│   └── Layout.tsx   # 레이아웃 래퍼
├── pages/           # 페이지 컴포넌트
│   ├── MainPage.tsx # P1 메인 페이지
│   ├── ConnectMapPage.tsx
│   ├── BookmarkPage.tsx
│   ├── IdeaDetailPage.tsx
│   └── InsightPage.tsx
├── App.tsx          # 라우팅 설정
└── main.tsx         # 진입점
```

## 디자인 시스템

- **폰트**: Montserrat (Regular, Medium, SemiBold)
- **색상**: 
  - 배경: #DDDDDD
  - 헤더: #666666
  - 텍스트: #1E1E1E, #666666, #949494
  - 키워드 태그: #CCCCCC, #1E1E1E

## 개발 상태

- [x] P1 Main 페이지 구현
- [ ] Supabase 연동
- [ ] 인증 시스템
- [ ] 다른 페이지 디자인 적용

