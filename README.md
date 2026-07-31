# 노포지도 🍜

서울의 숨겨진 노포·야장 맛집을 지도에서 찾아보는 웹 애플리케이션입니다.  
카카오맵 크롤링 데이터 기반, **서울 25개 구 전체 · 800여 곳** 커버 (주간 자동 갱신).

**🔗 [frontend-kappa-six-36.vercel.app](https://frontend-kappa-six-36.vercel.app)**

<img width="1470" alt="노포지도 스크린샷" src="https://github.com/user-attachments/assets/dfb97daf-2647-49e8-9aa5-a97be89cee9d" />

---

## ✨ 주요 기능

### 탐색 & 필터
- **카테고리 탭**: 🏮 노포 / 🌙 야장 전환 — 각 카테고리마다 전용 테마
- **지역 필터**: 서울 25개 구 드롭다운
- **검색**: 가게명·메뉴명 실시간 검색 (인라인 지우기)
- **정렬**: 평점순(리뷰 수 반영 베이지안 가중) / 이름순 / 거리순
- **영업 필터**: "지금 영업중"인 곳만 보기 (영업시간 데이터 기반)
- **활성 필터 칩**: 걸린 필터를 한눈에 확인하고 X로 즉시 해제, 결과 수 상시 표시

### AI 맛집 추천 🤖
- **Gemini 3.6 Flash** 기반 대화형 추천 (Vercel 서버리스 `api/chat.js`)
- 노포지도 데이터로 **grounding** — 실제 존재하는 식당만 추천
- 지역 유연 매칭("강남"·"홍대" 등 자연어), 의도어 매핑(회식/혼밥/부모님/해장 등)
- 답변 속 식당명을 클릭하면 바로 상세 모달로 연결

### 내 위치 기반
- **GPS 탐색**: 현재 위치 기반 거리순 정렬 (거리순 선택 시 자동 위치 요청)
- **반경 필터**: 1km / 3km / 5km 내 식당만 표시
- **지도 원형 표시**: 반경 시각화

### 지도 뷰
- **Leaflet 인터랙티브 지도**: 마커 클릭 시 팝업, 화면 꽉 채우는 높이
- **마커 클러스터링**: 인접 마커를 숫자로 묶어 가독성 향상
- **카테고리별 색상**: 노포 앰버 / 야장 네온 민트

### 식당 상세
- **모달**: 주소, 평점, 전화번호, 대표 메뉴, 영업시간·휴무·결제수단 표시 (포커스 트랩 접근성)
- **미니맵**: OpenStreetMap 위치 미리보기
- **바로가기**: 카카오맵 · 네이버 지도 · 네이버 블로그 후기
- **URL 공유**: `?r=상호명` 파라미터로 특정 식당 링크 공유

### 개인화
- **즐겨찾기** (♡): localStorage 저장, 즐겨찾기만 보기 필터
- **즐겨찾기 공유**: 내 리스트를 URL로 친구에게 공유 (`?share=`)
- **방문 기록**: 가본 곳 체크, "안 가본 곳만" 필터, 방문 별점·메모
- **랜덤 뽑기** (🎲): 현재 필터 기준으로 랜덤 식당 선택
- **오늘의 발견**: 홈 화면 featured 카드 (매일 바뀌는 고평점 픽)

### 디자인 & 기타
- **듀얼 톤 아트 디렉션**: 노포=따뜻한 빈티지(브라운·앰버·Serif·종이 그레인) / 야장=밤거리 네온(퍼플·민트·글로우)
- **PWA**: 홈화면 추가, Service Worker 오프라인 캐시
- **반응형·접근성**: 모바일·데스크톱 최적화, WCAG AA 대비, `prefers-reduced-motion` 존중, 로딩 스켈레톤

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, Vite 7, Vanilla CSS (듀얼 톤 다크 테마) |
| 폰트 | Pretendard (본문) · Noto Serif KR (제목) |
| 지도 | Leaflet, react-leaflet v5, react-leaflet-cluster |
| AI 추천 | Gemini 3.6 Flash (Vercel Serverless Function) |
| PWA | vite-plugin-pwa, Workbox |
| 크롤러 | Python, Selenium, webdriver-manager |
| 지오코딩 | Nominatim (OpenStreetMap) + Kakao Local API 폴백 |
| DB | SQLite (`backend/restaurants.db`) |
| 배포 | Vercel (main push 시 자동 배포) |
| 자동화 | GitHub Actions (주간 크롤링·지오코딩·폐업 정리) |

---

## 📁 프로젝트 구조

```
noodle/
├── frontend/
│   ├── api/
│   │   └── chat.js          # AI 추천 서버리스 함수 (Gemini 3.6 Flash)
│   ├── src/
│   │   ├── App.jsx          # 메인 (상태·필터·레이아웃 오케스트레이터)
│   │   ├── components/      # RestaurantModal·RestaurantCard·FeaturedCard·Skeleton
│   │   ├── utils/           # format(이모지·키·정렬)·geo(haversine)
│   │   ├── ChatPanel.jsx    # AI 추천 챗봇 패널
│   │   ├── MapView.jsx      # Leaflet 지도 뷰
│   │   ├── businessHours.js # 영업시간 판정 (자정 넘김·브레이크타임)
│   │   └── index.css        # 듀얼 톤 테마·질감·모션
│   ├── public/
│   │   ├── data.json        # 식당 데이터 (런타임 fetch)
│   │   └── manifest.json    # PWA 설정
│   └── vite.config.js
├── crawling/
│   ├── kakaomap.py          # 카카오맵 크롤러 (메뉴·영업시간·리뷰수·폐업 sweep)
│   ├── geocode.py           # 주소 → 좌표 (Nominatim)
│   ├── geocode_kakao.py     # 좌표 폴백 (Kakao Local API)
│   ├── sync_data.py         # DB → data.json 내보내기 + git push
│   └── requirements.txt
├── backend/
│   ├── restaurants.db       # SQLite 데이터베이스
│   ├── init_db.py           # DB 초기화
│   └── migrate_*.py         # idempotent 스키마 마이그레이션 (hours·review_count·active)
└── .github/
    └── workflows/
        └── weekly-crawl.yml # 매주 월요일 03:00 KST 자동 파이프라인
```

---

## 🚀 로컬 실행

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

> AI 추천(`/api/chat`)은 Vercel 서버리스 함수라 `vite dev`에선 동작하지 않습니다.
> 로컬에서 테스트하려면 `vercel dev` + `GEMINI_API_KEY` 환경변수가 필요합니다.

---

## 🕷 크롤링 파이프라인

```bash
# 전체 크롤링 (노포 + 야장, 약 1~2시간)
python crawling/kakaomap.py

# 특정 카테고리만
python crawling/kakaomap.py --categories 야장

# 좌표 없는 항목 지오코딩 (Nominatim → Kakao 폴백)
python crawling/geocode.py
KAKAO_REST_API_KEY=... python crawling/geocode_kakao.py

# data.json 내보내기 + git push + 자동 재배포
python crawling/sync_data.py --push
```

**파이프라인**: 크롤(메뉴·영업시간·리뷰수 수집 + 폐업 sweep) → 지오코딩 → `data.json` export → git push → Vercel 자동 배포.
GitHub Actions가 **매주 월요일 새벽 3시** 전 과정을 자동 실행합니다. 검색에서 3회 연속 사라진 식당은 자동으로 숨겨집니다(재발견 시 복구).

> 로컬 크롤 시 드라이버 다운로드 무한 대기를 피하려면 `CHROMEDRIVER_PATH` 환경변수로 캐시 드라이버를 지정하세요.

---

## 🌐 배포

`main` 브랜치에 push하면 Vercel이 **자동 배포**합니다 (noodle 프로젝트, Root Directory `frontend` / Framework Vite).

수동 배포가 필요하면 `frontend/` 디렉토리에서:

```bash
cd frontend
vercel --prod
```

---

## 📖 상세 문서

| 문서 | 내용 |
|------|------|
| [STATUS.md](./STATUS.md) | **프로젝트 현황 스냅샷 + 우선순위 백로그** |
| [docs/06_pm-worklog.md](./docs/06_pm-worklog.md) | 작업 로그 (단일 출처) |
| [docs/07_reviews-feature.md](./docs/07_reviews-feature.md) | 사용자 리뷰 기능 설계·셋업 |
| [docs/08_design-system.md](./docs/08_design-system.md) | **디자인 개선 체계**(토큰·리뷰 체크리스트·프로세스) |
| [docs/01_project-overview.md](./docs/01_project-overview.md) | 프로젝트 전체 구조 |
| [docs/02_crawler-setup.md](./docs/02_crawler-setup.md) | 크롤러 설정 및 사용법 |
| [docs/03_frontend-setup.md](./docs/03_frontend-setup.md) | 프론트엔드 컴포넌트 문서 |
| [docs/04_deployment.md](./docs/04_deployment.md) | Vercel 배포 방법 |
</content>
