-- Ideas Table Schema
create table ideas (
  id uuid default gen_random_uuid() primary key,
  title text not null, -- This is the main idea content
  content text, -- This is the detail memo (nullable)
  keywords text[] default '{}' check (
    array_length(keywords, 1) <= 2
    -- Postgres doesn't have easy array element check in check constraint without helper function, 
    -- but we will enforce this in application logic.
  ),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  source_url text,
  bookmarked boolean default false,
  user_id uuid references auth.users(id)
);

-- Enable RLS (Row Level Security)
alter table ideas enable row level security;

-- Create policies
create policy "Users can view their own ideas"
  on ideas for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ideas"
  on ideas for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ideas"
  on ideas for update
  using (auth.uid() = user_id);

create policy "Users can delete their own ideas"
  on ideas for delete
  using (auth.uid() = user_id);

-- 디자인 분야 아이디어 데이터 (키워드 제외, 타이틀만)
-- 유사도 기반 클러스터링을 위해 관련된 디자인 아이디어들로 구성
INSERT INTO ideas (title, content, keywords, source_url, bookmarked, created_at, user_id) VALUES
-- UI/UX 디자인 관련
('모바일 앱의 직관적인 네비게이션 디자인', NULL, ARRAY[]::text[], NULL, false, '2024-01-15T10:30:00.000Z', NULL),
('사용자 경험을 개선하는 마이크로 인터랙션 디자인', NULL, ARRAY[]::text[], NULL, true, '2024-01-16T11:00:00.000Z', NULL),
('접근성을 고려한 UI 컴포넌트 디자인 시스템', NULL, ARRAY[]::text[], NULL, false, '2024-01-17T14:20:00.000Z', NULL),
('다크모드와 라이트모드 전환 애니메이션', NULL, ARRAY[]::text[], NULL, true, '2024-01-18T09:15:00.000Z', NULL),
('터치 제스처 기반 인터페이스 디자인', NULL, ARRAY[]::text[], NULL, false, '2024-01-19T16:45:00.000Z', NULL),

-- 웹 디자인 관련
('반응형 웹사이트의 그리드 레이아웃 시스템', NULL, ARRAY[]::text[], NULL, true, '2024-01-20T10:30:00.000Z', NULL),
('스크롤 기반 스토리텔링 웹 디자인', NULL, ARRAY[]::text[], NULL, false, '2024-01-21T11:20:00.000Z', NULL),
('패럴랙스 스크롤을 활용한 랜딩 페이지', NULL, ARRAY[]::text[], NULL, true, '2024-01-22T13:10:00.000Z', NULL),
('웹 폰트와 타이포그래피 시스템 구축', NULL, ARRAY[]::text[], NULL, false, '2024-01-23T15:00:00.000Z', NULL),
('CSS 그리드와 플렉스박스를 활용한 레이아웃', NULL, ARRAY[]::text[], NULL, true, '2024-01-24T09:30:00.000Z', NULL),

-- 브랜딩 및 그래픽 디자인
('브랜드 아이덴티티를 반영한 로고 디자인', NULL, ARRAY[]::text[], NULL, false, '2024-01-25T10:15:00.000Z', NULL),
('컬러 팔레트와 브랜드 가이드라인 제작', NULL, ARRAY[]::text[], NULL, true, '2024-01-26T14:45:00.000Z', NULL),
('일관된 비주얼 언어를 위한 디자인 시스템', NULL, ARRAY[]::text[], NULL, false, '2024-01-27T11:30:00.000Z', NULL),
('인포그래픽을 활용한 데이터 시각화', NULL, ARRAY[]::text[], NULL, true, '2024-01-28T16:20:00.000Z', NULL),
('일러스트레이션 스타일 가이드 개발', NULL, ARRAY[]::text[], NULL, false, '2024-01-29T09:00:00.000Z', NULL),

-- 인터랙션 디자인
('프로토타이핑 도구를 활용한 인터랙션 설계', NULL, ARRAY[]::text[], NULL, true, '2024-01-30T10:30:00.000Z', NULL),
('사용자 플로우와 와이어프레임 설계', NULL, ARRAY[]::text[], NULL, false, '2024-01-31T13:15:00.000Z', NULL),
('애니메이션 타이밍과 이징 함수 연구', NULL, ARRAY[]::text[], NULL, true, '2024-02-01T15:45:00.000Z', NULL),
('피드백 메커니즘을 통한 사용자 경험 개선', NULL, ARRAY[]::text[], NULL, false, '2024-02-02T11:20:00.000Z', NULL),
('모션 디자인 원칙과 베스트 프랙티스', NULL, ARRAY[]::text[], NULL, true, '2024-02-03T14:00:00.000Z', NULL),

-- 디자인 도구 및 워크플로우
('Figma 컴포넌트 라이브러리 구축', NULL, ARRAY[]::text[], NULL, false, '2024-02-04T09:30:00.000Z', NULL),
('디자인 토큰과 변수를 활용한 시스템', NULL, ARRAY[]::text[], NULL, true, '2024-02-05T16:10:00.000Z', NULL),
('디자이너와 개발자 간 협업 워크플로우', NULL, ARRAY[]::text[], NULL, false, '2024-02-06T10:45:00.000Z', NULL),
('디자인 시스템 문서화와 유지보수', NULL, ARRAY[]::text[], NULL, true, '2024-02-07T13:30:00.000Z', NULL),
('자동화된 디자인 검증 도구 개발', NULL, ARRAY[]::text[], NULL, false, '2024-02-08T15:20:00.000Z', NULL);
