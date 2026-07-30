// Supabase 클라이언트 — 리뷰 저장·카카오 로그인용.
// env 미설정 시 null 반환(빌드·로컬 dev가 키 없이도 안 깨지게). 소비 측에서 null 가드.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
