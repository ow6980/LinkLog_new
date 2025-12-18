import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 환경 변수 확인
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// 환경 변수가 없어도 앱이 로드되도록 더미 클라이언트 생성
let supabase: SupabaseClient;
if (!isSupabaseConfigured) {
  console.warn('Missing Supabase environment variables. Using dummy client.');
  // 더미 URL과 키로 클라이언트 생성 (실제 사용 시 에러 발생)
  supabase = createClient('https://dummy.supabase.co', 'dummy-key');
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

