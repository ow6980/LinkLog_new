// 브라우저 콘솔에서 실행할 디자인 아이디어 삽입 스크립트
// 사용법: 브라우저 개발자 도구 콘솔에서 이 코드를 복사하여 실행

// Supabase 클라이언트가 전역에 노출되어 있다고 가정
// 또는 import { supabase } from './src/supabaseClient' 형태로 사용

const designIdeas = [
  // UI/UX 디자인 관련
  { title: '모바일 앱의 직관적인 네비게이션 디자인', bookmarked: false },
  { title: '사용자 경험을 개선하는 마이크로 인터랙션 디자인', bookmarked: true },
  { title: '접근성을 고려한 UI 컴포넌트 디자인 시스템', bookmarked: false },
  { title: '다크모드와 라이트모드 전환 애니메이션', bookmarked: true },
  { title: '터치 제스처 기반 인터페이스 디자인', bookmarked: false },
  
  // 웹 디자인 관련
  { title: '반응형 웹사이트의 그리드 레이아웃 시스템', bookmarked: true },
  { title: '스크롤 기반 스토리텔링 웹 디자인', bookmarked: false },
  { title: '패럴랙스 스크롤을 활용한 랜딩 페이지', bookmarked: true },
  { title: '웹 폰트와 타이포그래피 시스템 구축', bookmarked: false },
  { title: 'CSS 그리드와 플렉스박스를 활용한 레이아웃', bookmarked: true },
  
  // 브랜딩 및 그래픽 디자인
  { title: '브랜드 아이덴티티를 반영한 로고 디자인', bookmarked: false },
  { title: '컬러 팔레트와 브랜드 가이드라인 제작', bookmarked: true },
  { title: '일관된 비주얼 언어를 위한 디자인 시스템', bookmarked: false },
  { title: '인포그래픽을 활용한 데이터 시각화', bookmarked: true },
  { title: '일러스트레이션 스타일 가이드 개발', bookmarked: false },
  
  // 인터랙션 디자인
  { title: '프로토타이핑 도구를 활용한 인터랙션 설계', bookmarked: true },
  { title: '사용자 플로우와 와이어프레임 설계', bookmarked: false },
  { title: '애니메이션 타이밍과 이징 함수 연구', bookmarked: true },
  { title: '피드백 메커니즘을 통한 사용자 경험 개선', bookmarked: false },
  { title: '모션 디자인 원칙과 베스트 프랙티스', bookmarked: true },
  
  // 디자인 도구 및 워크플로우
  { title: 'Figma 컴포넌트 라이브러리 구축', bookmarked: false },
  { title: '디자인 토큰과 변수를 활용한 시스템', bookmarked: true },
  { title: '디자이너와 개발자 간 협업 워크플로우', bookmarked: false },
  { title: '디자인 시스템 문서화와 유지보수', bookmarked: true },
  { title: '자동화된 디자인 검증 도구 개발', bookmarked: false },
];

// 날짜 생성 (순차적으로)
const baseDate = new Date('2024-01-15T10:30:00.000Z');
const dates = designIdeas.map((_, index) => {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + index);
  return date.toISOString();
});

async function insertDesignIdeas() {
  try {
    // 현재 사용자 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('로그인이 필요합니다:', userError);
      alert('로그인이 필요합니다. 먼저 로그인해주세요.');
      return;
    }

    console.log('현재 사용자:', user.id);

    // 기존 데이터 삭제 (선택사항)
    const { error: deleteError } = await supabase
      .from('ideas')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.warn('기존 데이터 삭제 중 오류 (무시 가능):', deleteError);
    } else {
      console.log('기존 아이디어 데이터 삭제 완료');
    }

    // 새 아이디어 삽입
    const ideasToInsert = designIdeas.map((idea, index) => ({
      title: idea.title,
      content: null,
      keywords: [],
      source_url: null,
      bookmarked: idea.bookmarked,
      created_at: dates[index],
      user_id: user.id,
    }));

    const { data, error } = await supabase
      .from('ideas')
      .insert(ideasToInsert)
      .select();

    if (error) {
      console.error('아이디어 삽입 오류:', error);
      alert('아이디어 삽입 중 오류가 발생했습니다: ' + error.message);
      return;
    }

    console.log(`${data.length}개의 디자인 아이디어가 성공적으로 삽입되었습니다!`, data);
    alert(`${data.length}개의 디자인 아이디어가 삽입되었습니다.`);
    
    // 페이지 새로고침
    window.location.reload();
  } catch (error) {
    console.error('예상치 못한 오류:', error);
    alert('오류가 발생했습니다: ' + error.message);
  }
}

// 실행
insertDesignIdeas();

