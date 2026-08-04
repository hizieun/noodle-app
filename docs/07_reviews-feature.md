# 7. 사용자 리뷰 기능 설계 (Phase 1: 텍스트 리뷰 + 평점)

> 상태: **Phase 1 배포 완료 (2026-07-30)**. 작성 2026-07-24.
> 결정: MVP = 텍스트 리뷰+평점 / 인증 = 카카오 로그인 / 백엔드 = Supabase.
> 라이브 동작 확인: 카카오 로그인 + 리뷰 작성/수정/삭제. 실전 셋업 함정은 7.9 참고.

노포지도를 "정적 조회"에서 "사용자가 리뷰를 남기는 커뮤니티"로 확장하는 첫 단계.
현재 구조(정적 프론트 + `data.json` + 서버리스 챗봇)에 **런타임 DB·인증**을 처음 도입한다.

---

## 7.1 스코프

**Phase 1 (이 문서)**: 로그인(카카오) → 식당별 텍스트 리뷰 작성/조회/수정/삭제 + 별점(1~5). 식당 모달에 "커뮤니티 리뷰" 섹션.
**Phase 2 (후속)**: 사진 업로드(Supabase Storage), 이미지 리사이즈·용량 제한.
**Phase 1.5 (완료)**: 카드·featured에 커뮤니티 평점 배지(💬 평점·개수) 노출 + 등록/삭제 직후 자동 갱신.
**Phase 3 (후속)**: 신고 버튼, 스팸/욕설 필터, 리뷰 정렬 옵션, 기존 로컬 '내 방문 후기'와 통합.

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

---

## 7.9 실전 셋업 노트 (2026-07-30 Phase 1 배포 완료)

Phase 1 라이브 배포 완료 — 카카오 로그인 + 리뷰 CRUD 정상 동작 확인. 카카오 OAuth 셋업에서 겪은 함정을 **해결 순서대로** 기록(재세팅·인수인계용). 카카오 콘솔 UI가 자주 바뀌므로 위치보다 **증상→원인**에 집중.

### 확정 값
- Supabase Project: `flqzsywacukvmngyxyvu` (Region: Seoul)
- Kakao REST API 키 = OAuth client_id: `b38212...` (지오코더와 동일 키)
- Supabase 콜백: `https://flqzsywacukvmngyxyvu.supabase.co/auth/v1/callback`

### 겪은 에러 → 해결 (순서대로)
1. **`provider is not enabled`** (Supabase) → Supabase Authentication → Providers → Kakao **Enable 토글 ON + Save**. 토글만 켜고 저장 안 하면 반영 안 됨.
2. **KOE205** (동의항목/scope 오류) → **원인은 Supabase가 카카오에 `account_email profile_image profile_nickname`을 강제 요청**하는데(클라이언트에서 제거 불가 — 알려진 Supabase 한계, GH #36878), `account_email`이 개인 앱엔 "권한 없음"이라 거부. **해결: 카카오 콘솔 → 비즈니스 → "개인 개발자 등록"**(사업자등록 불필요) → account_email scope 열림 → 동의항목에서 account_email·profile_nickname 사용 설정.
   - 참고: 클라 코드에서 `scopes: 'profile_nickname'`만 넘겨도 Supabase가 기본 scope에 **append**만 함(replace 아님). 그래서 개인 등록이 실질 해결책.
3. **KOE006** (redirect_uri mismatch) → 카카오 로그인 Redirect URI에 위 Supabase 콜백 등록. (이 콘솔 버전에선 카카오 로그인 → 일반/고급에 필드가 잘 안 보임 — 에러 페이지의 "어떻게 해결할 수 있나요?"가 정확한 경로를 안내. 개인 등록 후 필드가 나타남)
4. **로그인 후 `localhost:3000` 연결 거부** → **Supabase Authentication → URL Configuration**: **Site URL** = `https://frontend-kappa-six-36.vercel.app`, **Redirect URLs**에 `https://frontend-kappa-six-36.vercel.app/**` 추가. Supabase는 `redirectTo`가 허용 목록에 없으면 무시하고 Site URL(기본 localhost:3000)로 보냄.

### 환경변수
- Vercel + 로컬 `frontend/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (VITE_ 접두 = 빌드타임 인라인). anon key는 공개 안전(보안은 RLS).

### 교훈
- 정상 순서: Supabase 프로바이더 → **개인 개발자 등록**(KOE205 예방) → Redirect URI(KOE006) → **Site URL/Redirect URLs**(복귀). 이 순서로 하면 헤맬 일 없음.
- 개인 사이드 프로젝트 + 카카오 OAuth는 `account_email` 강제 요청 때문에 **개인 개발자 등록이 사실상 필수**.

---

## 7.10 Phase 2 — 사진 리뷰 (2026-08-04)

> **배포·검증 완료 (2026-08-04)**: 셋업(컬럼·버킷·RLS) 후 실기기에서 카카오 로그인→사진 첨부→등록→썸네일→라이트박스 정상. 업로드 실측 WebP 55KB(폰 원본 대비 ~98%↓), anon 업로드는 RLS로 차단 확인.

리뷰에 사진 첨부(최대 3장). 원본이 아니라 **클라이언트에서 리사이즈·압축한 WebP**를 Supabase Storage에 올려 무료 티어 용량·전송을 아낀다.

### 구현
- `lib/uploadPhoto.js`: 캔버스로 긴 변 1600px·quality 0.8 축소 → WebP(미지원 시 JPEG) → `review-photos/{user_id}/{ts}-{idx}.webp` 업로드 → 공개 URL. EXIF 회전은 `createImageBitmap(..., {imageOrientation:'from-image'})`로 반영. 원본 12MB 상한.
- `ReviewSection.jsx`: 에디터에 사진 칩(추가/삭제), 제출 시 새 파일만 업로드하고 기존 URL은 순서 유지. 목록엔 썸네일 → 탭하면 라이트박스. 리뷰 삭제 시 스토리지 best-effort 정리(`deleteReviewPhotos`).
- `photos text[]` 컬럼에 공개 URL 배열 저장(조인 테이블 없이 단순).

### 수동 셋업 (Supabase SQL Editor에서 실행 — 사람만 가능)
```sql
-- 1) reviews에 사진 컬럼
alter table reviews add column if not exists photos text[];

-- 2) 공개 읽기 스토리지 버킷
insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do nothing;

-- 3) 스토리지 RLS: 읽기는 누구나, 쓰기/삭제는 본인 폴더(={uid}/...)만
create policy "review photos public read"
  on storage.objects for select
  using ( bucket_id = 'review-photos' );

create policy "review photos insert own"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text );

create policy "review photos delete own"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text );
```
> 버킷을 콘솔(Storage → New bucket, Public 체크)로 만들어도 되고, 위 SQL로 한 번에 처리해도 된다. 정책 이름이 이미 있으면 `drop policy` 후 재생성.

### 운영·리스크
- **용량**: WebP 축소본(장당 ~100–300KB) × 3장이라 무료 1GB로 수천 리뷰 감당. 초과 전 정리/유료 검토.
- **부적절 이미지**: 초기엔 관리자(=나)가 대시보드에서 수동 삭제. 신고·자동 필터는 후속.
- **고아 파일**: 리뷰 유지한 채 사진만 뺀 경우 스토리지에 남을 수 있음(저위험, 정기 정리로 충분). 리뷰 삭제 시엔 자동 정리.
