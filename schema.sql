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

-- Initial Mock Data Insertion
-- Re-mapped keywords to strictly match the 7 available keywords:
-- Technology, Innovation, Data, Design, Business, Research, Development
insert into ideas (title, content, keywords, source_url, bookmarked, created_at, user_id) values
('AI 기반 개인화 추천 시스템', '머신러닝을 활용하여 사용자의 행동 패턴을 분석하고 개인화된 콘텐츠를 추천하는 시스템을 개발하고 싶다.', ARRAY['Technology', 'Data'], 'https://example.com/ai-recommendation', true, '2024-01-15T10:30:00.000Z', 'USER_ID_HERE'),
('블록체인을 활용한 디지털 신원 인증', '분산 원장 기술을 사용하여 개인의 신원 정보를 안전하게 관리하고 검증할 수 있는 시스템.', ARRAY['Technology', 'Innovation'], 'https://example.com/blockchain-identity', true, '2024-01-18T14:20:00.000Z', 'USER_ID_HERE'),
('실시간 협업 에디터 개발', '여러 사용자가 동시에 문서를 편집할 수 있는 실시간 협업 에디터.', ARRAY['Development', 'Technology'], 'https://example.com/collaborative-editor', false, '2024-01-20T09:15:00.000Z', 'USER_ID_HERE'),
('IoT 센서 데이터 시각화 대시보드', '다양한 IoT 센서에서 수집된 데이터를 실시간으로 모니터링하고 시각화하는 대시보드.', ARRAY['Data', 'Design'], 'https://example.com/iot-dashboard', true, '2024-01-22T16:45:00.000Z', 'USER_ID_HERE'),
('음성 인식 기반 스마트 홈 제어', '자연어 처리와 음성 인식을 결합하여 음성 명령으로 집안의 전자기기를 제어하는 시스템.', ARRAY['Technology', 'Innovation'], 'https://example.com/voice-control', false, '2024-01-25T11:30:00.000Z', 'USER_ID_HERE'),
('그래프 데이터베이스를 활용한 소셜 네트워크 분석', 'Neo4j나 ArangoDB 같은 그래프 데이터베이스를 사용하여 소셜 네트워크의 관계를 모델링하고 분석한다.', ARRAY['Data', 'Research'], 'https://example.com/graph-database', true, '2024-01-28T13:20:00.000Z', 'USER_ID_HERE'),
('마이크로서비스 아키텍처 설계 패턴', '대규모 애플리케이션을 작은 독립적인 서비스로 분해하는 마이크로서비스 아키텍처.', ARRAY['Development', 'Design'], 'https://example.com/microservices', false, '2024-02-01T10:00:00.000Z', 'USER_ID_HERE'),
('컴퓨터 비전을 활용한 의료 이미지 분석', '딥러닝 모델을 사용하여 X-ray, CT 스캔, MRI 이미지를 분석하고 질병을 조기 진단하는 시스템.', ARRAY['Technology', 'Research'], 'https://example.com/medical-ai', true, '2024-02-03T15:30:00.000Z', 'USER_ID_HERE'),
('서버리스 함수를 활용한 이벤트 처리 파이프라인', 'AWS Lambda나 Google Cloud Functions를 사용하여 이벤트 기반 아키텍처를 구현한다.', ARRAY['Development', 'Technology'], 'https://example.com/serverless', false, '2024-02-05T09:45:00.000Z', 'USER_ID_HERE'),
('증강현실(AR) 기반 쇼핑 경험', 'AR 기술을 활용하여 사용자가 가상으로 제품을 체험할 수 있는 쇼핑 앱.', ARRAY['Technology', 'Design'], 'https://example.com/ar-shopping', true, '2024-02-08T12:15:00.000Z', 'USER_ID_HERE'),
('자동화된 테스트 프레임워크 구축', 'CI/CD 파이프라인에 통합할 수 있는 자동화된 테스트 프레임워크.', ARRAY['Development', 'Innovation'], 'https://example.com/testing-framework', false, '2024-02-10T14:00:00.000Z', 'USER_ID_HERE'),
('엣지 컴퓨팅을 활용한 실시간 데이터 처리', '클라우드 대신 엣지 디바이스에서 데이터를 처리하여 지연 시간을 최소화한다.', ARRAY['Technology', 'Data'], 'https://example.com/edge-computing', true, '2024-02-12T16:30:00.000Z', 'USER_ID_HERE'),
('자연어 생성 모델을 활용한 콘텐츠 작성 도구', 'GPT나 BART 같은 언어 모델을 활용하여 블로그 포스트, 마케팅 문구, 이메일 초안 등을 자동으로 생성하는 도구.', ARRAY['Business', 'Innovation'], 'https://example.com/nlg-tool', false, '2024-02-15T10:20:00.000Z', 'USER_ID_HERE'),
('분산 추적 시스템 구현', '마이크로서비스 환경에서 요청의 흐름을 추적하는 분산 추적 시스템.', ARRAY['Development', 'Data'], 'https://example.com/distributed-tracing', true, '2024-02-18T13:45:00.000Z', 'USER_ID_HERE'),
('웹소켓을 활용한 실시간 채팅 시스템', 'WebSocket을 사용하여 다중 사용자 간 실시간 채팅을 구현한다.', ARRAY['Development', 'Technology'], 'https://example.com/realtime-chat', false, '2024-02-20T11:00:00.000Z', 'USER_ID_HERE'),
('강화학습을 활용한 게임 AI', 'Deep Q-Network(DQN)나 Proximal Policy Optimization(PPO) 같은 강화학습 알고리즘을 사용하여 게임 AI를 학습시킨다.', ARRAY['Research', 'Technology'], 'https://example.com/rl-game-ai', true, '2024-02-22T15:15:00.000Z', 'USER_ID_HERE'),
('GraphQL API 설계 및 최적화', 'REST API 대신 GraphQL을 사용하여 클라이언트가 필요한 데이터만 요청할 수 있게 한다.', ARRAY['Development', 'Data'], 'https://example.com/graphql-api', false, '2024-02-25T09:30:00.000Z', 'USER_ID_HERE'),
('쿠버네티스 클러스터 자동 스케일링', 'Horizontal Pod Autoscaler(HPA)와 Cluster Autoscaler를 설정하여 트래픽에 따라 자동으로 파드와 노드를 스케일링한다.', ARRAY['Development', 'Technology'], 'https://example.com/k8s-autoscaling', true, '2024-02-28T14:00:00.000Z', 'USER_ID_HERE'),
('차세대 웹 표준: WebAssembly 활용', 'WebAssembly를 사용하여 C/C++/Rust로 작성된 고성능 코드를 브라우저에서 실행한다.', ARRAY['Technology', 'Development'], 'https://example.com/webassembly', false, '2024-03-02T10:45:00.000Z', 'USER_ID_HERE'),
('데이터 레이크 아키텍처 설계', '대용량 데이터를 저장하고 분석하기 위한 데이터 레이크를 구축한다.', ARRAY['Data', 'Business'], 'https://example.com/data-lake', true, '2024-03-05T16:20:00.000Z', 'USER_ID_HERE');
