# 7. 사용자 리뷰 기능 설계 (Phase 1: 텍스트 리뷰 + 평점)

> 상태: **기획 확정, 구현 대기**. 작성 2026-07-24.
> 결정: MVP = 텍스트 리뷰+평점 / 인증 = 카카오 로그인 / 백엔드 = Supabase.

노포지도를 "정적 조회"에서 "사용자가 리뷰를 남기는 커뮤니티"로 확장하는 첫 단계.
현재 구조(정적 프론트 + `data.json` + 서버리스 챗봇)에 **런타임 DB·인증**을 처음 도입한다.

---

## 7.1 스코프

**Phase 1 (이 문서)**: 로그인(카카오) → 식당별 텍스트 리뷰 작성/조회/수정/삭제 + 별점(1~5). 식당 모달에 "커뮤니티 리뷰" 섹션.
**Phase 2 (후속)**: 사진 업로드(Supabase Storage), 이미지 리사이즈·용량 제한.
**Phase 3 (후속)**: 신고 버튼, 스팸/욕설 필터, 카드에 커뮤니티 평점 노출, 기존 로컬 '내 방문 후기'와 통합.

**기존 기능과의 관계**: 지금의 "내 방문 후기"(별점·메모)는 **localStorage 개인 기록**(내 기기 전용)이라 그대로 둔다. 새 "커뮤니티 리뷰"는 **공개·공유**. Phase 1에선 둘을 분리하고 UI 문구로 구분("나만 보기" vs "모두에게 공개"). 통합은 Phase 3에서 검토.

---

## 7.2 아키텍처

```
[React 프론트]
   │  @supabase/supabase-js (anon key)
   ▼
[Supabase]  Postgres(reviews) + Auth(카카오 OAuth) + RLS(행 수준 보안)
```

- **프론트가 Supabase를 직접 호출** (별도 서버리스 API 없이). 보안은 **RLS(Row Level Security)**가 담당 — anon key는 공개돼도 안전한 설계. 솔로 프로젝트에 코드 최소.
- 식당 데이터(`data.json`)는 그대로 정적. 리뷰만 Supabase에 저장. 둘은 **restaurant_key**(`상호명|주소`, 기존 favKey와 동일)로 연결.

**왜 Supabase**: Postgres+Auth+Storage+RLS 원스톱, 무료 티어(DB 500MB·MAU 50k)로 충분, Vercel 궁합 좋음, 카카오 OAuth 프로바이더 내장.

---

## 7.3 데이터 모델

```sql
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  restaurant_key text not null,            -- "상호명|주소" (data.json favKey와 동일)
  restaurant_name text not null,           -- 표시·복원용 denormalize
  restaurant_addr text,
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_name      text not null,            -- 카카오 닉네임 (표시용 denormalize)
  rating         int  not null check (rating between 1 and 5),
  body           text not null check (char_length(body) between 1 and 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (restaurant_key, user_id)         -- 1인 1식당 1리뷰(수정 가능)
);
create index on reviews (restaurant_key, created_at desc);
```

**restaurant_key 안정성**: 크롤 upsert 키가 `(name, address)`라 키가 안정적. 만약 식당명/주소가 바뀌면 과거 리뷰가 고아가 될 수 있으나(저위험), name·addr를 denormalize해 표시/복원 가능.

---

## 7.4 보안 (RLS 정책)

```sql
alter table reviews enable row level security;

-- 읽기: 누구나
create policy "read all" on reviews for select using (true);
-- 작성: 로그인 사용자, 본인 user_id로만
create policy "insert own" on reviews for insert with check (auth.uid() = user_id);
-- 수정/삭제: 본인 것만
create policy "update own" on reviews for update using (auth.uid() = user_id);
create policy "delete own" on reviews for delete using (auth.uid() = user_id);
```

`updated_at` 자동 갱신 트리거는 선택(간단히 클라이언트에서 set).

---

## 7.5 프론트 구현

- **의존성**: `@supabase/supabase-js`
- **클라이언트**: `src/lib/supabase.js` — `createClient(import.meta.env.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- **인증**: `supabase.auth.signInWithOAuth({ provider: 'kakao' })` / `signOut()` / `onAuthStateChange`로 세션 관리. 헤더에 로그인/로그아웃 버튼(작게), 또는 리뷰 작성 시점에 로그인 유도.
- **리뷰 UI** (`RestaurantModal` 내 신규 "커뮤니티 리뷰" 섹션):
  - 커뮤니티 평균 별점 + 리뷰 수
  - 리뷰 목록(별점·본문·작성자 닉네임·날짜)
  - 로그인 시: 내 리뷰 작성/수정/삭제 (1인 1리뷰)
  - 비로그인 시: "카카오로 로그인하고 리뷰 남기기" 유도
- **데이터 호출**: `select` (restaurant_key 필터), `upsert`(본인 리뷰), `delete`. RLS가 권한 강제.
- 컴포넌트 분리 원칙 유지 → `src/components/ReviewSection.jsx` 신규.

---

## 7.6 사람이 해야 하는 수동 셋업 (구현 전 선행)

1. **Supabase 프로젝트 생성** → Project URL + anon key 확보
2. **Kakao Developers 앱** 생성 → 카카오 로그인 활성화, Redirect URI에 Supabase 콜백(`https://<project>.supabase.co/auth/v1/callback`) 등록, REST API 키 확보
3. **Supabase Auth**에서 Kakao 프로바이더 활성화 (Kakao REST 키/시크릿 입력)
4. **SQL 실행** (7.3 테이블 + 7.4 RLS) — Supabase SQL Editor
5. **Vercel 환경변수** 추가: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (빌드타임 노출용 VITE_ 접두)
6. 로컬 `.env`에도 동일 키 (gitignore 유지)

→ 이 셋업이 끝나야 프론트 구현·검증 가능. (Supabase/Kakao 콘솔 작업은 사람만 가능)

---

## 7.7 운영·리스크 (Phase 1 최소)

- **스팸 억제**: 1인 1식당 1리뷰(unique), 본문 1~1000자 제한. 초기엔 관리자(=나)가 Supabase 대시보드에서 악성 리뷰 수동 삭제. 신고 버튼·자동 필터는 Phase 3.
- **비용**: 무료 티어로 충분(리뷰 텍스트만).
- **개인정보**: 카카오 닉네임만 표시(이메일 등 저장 안 함).
- **UX 혼동**: 기존 localStorage '내 방문 후기'와 새 '커뮤니티 리뷰' 구분 문구 필수.

---

## 7.8 단계별 실행 순서 (Phase 1)

1. (사람) 7.6 수동 셋업 → URL/키/카카오 OAuth 준비
2. `@supabase/supabase-js` 설치 + `lib/supabase.js`
3. 카카오 로그인/로그아웃 + 세션 상태
4. `ReviewSection.jsx` — 목록·평균·작성/수정/삭제, 모달 연결
5. 검증: 로그인 → 리뷰 CRUD, RLS(남의 리뷰 수정 불가) 확인, 비로그인 읽기 전용
6. 배포 + 라이브 확인

각 단계 작을 때마다 커밋·검증. Phase 2(사진)는 별도.
