-- 아이디어 생성 날짜를 2025년 11월 중으로 변경하는 SQL 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 2025년 11월 1일부터 30일까지 랜덤하게 날짜 배정
UPDATE ideas
SET created_at = (
  '2025-11-01'::date + 
  (RANDOM() * 29)::int * INTERVAL '1 day' +
  (RANDOM() * 23)::int * INTERVAL '1 hour' +
  (RANDOM() * 59)::int * INTERVAL '1 minute'
)
WHERE created_at < '2025-11-01'::date OR created_at > '2025-11-30'::date;

-- 또는 특정 날짜 범위로 변경하려면:
-- UPDATE ideas
-- SET created_at = created_at + INTERVAL '1 year 10 months'
-- WHERE created_at < '2025-11-01'::date;

