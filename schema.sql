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

-- 움직임 관련 아이디어 데이터 (키워드 제외, 타이틀만)
-- 유사도 기반 클러스터링을 위해 관련된 움직임 아이디어들로 구성
-- 주의: user_id는 실제 사용자 ID로 교체해야 합니다 (RLS 정책 때문에)
-- INSERT INTO ideas (title, content, keywords, source_url, bookmarked, created_at, user_id) VALUES
-- ('일정한 간격으로 앞뒤로 흔들리는 금속 막대의 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-15T10:30:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('초침이 일정한 속도로 계속 회전하는 아날로그 시계의 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-16T11:00:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('박자에 맞춰 좌우로 흔들리는 메트로놈의 추', NULL, ARRAY[]::text[], NULL, false, '2024-01-17T14:20:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('기계가 작동 중일 때 규칙적으로 왕복하는 피스톤의 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-18T09:15:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('고양이가 졸릴 때 천천히 깜빡이는 눈의 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-19T16:45:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('긴장했을 때 손끝이 미세하게 떨리는 현상', NULL, ARRAY[]::text[], NULL, false, '2024-01-20T10:30:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('사람이 집중할수록 호흡이 점점 느려지는 변화', NULL, ARRAY[]::text[], NULL, false, '2024-01-21T11:20:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('강아지가 관심 있을 때 귀가 미묘하게 움직이는 반응', NULL, ARRAY[]::text[], NULL, false, '2024-01-22T13:10:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('무언가를 재촉하듯 빠르게 고개를 까딱이는 동작', NULL, ARRAY[]::text[], NULL, false, '2024-01-23T15:00:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('실망한 느낌을 주기 위해 천천히 아래로 기울어지는 형태', NULL, ARRAY[]::text[], NULL, false, '2024-01-24T09:30:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('반가움을 표현하듯 짧고 빠르게 흔들리는 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-25T10:15:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('귀찮음을 표현하듯 힘없이 축 처지는 동작', NULL, ARRAY[]::text[], NULL, false, '2024-01-26T14:45:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('사용자가 오랫동안 반응하지 않으면 점점 커지는 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-27T11:30:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('처음에는 작게, 시간이 지날수록 점점 눈에 띄게 반복되는 동작', NULL, ARRAY[]::text[], NULL, false, '2024-01-28T16:20:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('특정 시간이 되면 짧게 한 번만 움직여 존재를 알리는 방식', NULL, ARRAY[]::text[], NULL, false, '2024-01-29T09:00:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('바람이 불 때 천천히 좌우로 흔들리는 풀잎의 움직임', NULL, ARRAY[]::text[], NULL, false, '2024-01-30T10:30:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('물 위에 떠 있는 물체가 잔잔하게 출렁이는 모습', NULL, ARRAY[]::text[], NULL, false, '2024-01-31T13:15:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('해가 질 때 점점 낮아지며 사라지는 빛의 변화', NULL, ARRAY[]::text[], NULL, false, '2024-02-01T15:45:00.000Z', 'YOUR_USER_ID_HERE'),
-- ('파도가 밀려왔다가 다시 빠져나가는 반복적인 흐름', NULL, ARRAY[]::text[], NULL, false, '2024-02-02T11:20:00.000Z', 'YOUR_USER_ID_HERE');

