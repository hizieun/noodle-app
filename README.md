# 노포지도 🍜

서울의 숨겨진 노포·야장 맛집을 지도에서 찾아보는 웹 애플리케이션입니다.  
카카오맵 크롤링 데이터 기반, **705개 식당 / 서울 25개 구** 전체 커버.

**🔗 [frontend-kappa-six-36.vercel.app](https://frontend-kappa-six-36.vercel.app)**

<img width="1470" alt="노포지도 스크린샷" src="https://github.com/user-attachments/assets/dfb97daf-2647-49e8-9aa5-a97be89cee9d" />

---

## ✨ 주요 기능

### 탐색 & 필터
- **카테고리 탭**: 🏮 노포(370개) / 🌙 야장(335개) 전환
- **지역 필터**: 서울 25개 구 드롭다운
- **검색**: 가게명·메뉴명 실시간 검색
- **정렬**: 평점순 / 이름순 / 거리순
- **활성 필터 칩**: 걸린 필터를 한눈에 확인하고 X로 즉시 해제

### 내 위치 기반
- **GPS 탐색**: 현재 위치 기반 거리순 정렬
- **반경 필터**: 1km / 3km / 5km 내 식당만 표시
- **지도 원형 표시**: 반경 시각화

### 지도 뷰
- **Leaflet 인터랙티브 지도**: 마커 클릭 시 팝업
- **마커 클러스터링**: 인접 마커를 숫자로 묶어 가독성 향상
- **카테고리별 색상**: 노포 로즈 / 야장 오렌지

### 식당 상세
- **모달**: 주소, 평점, 전화번호, 대표 메뉴 표시
- **미니맵**: OpenStreetMap 위치 미리보기
- **바로가기**: 카카오맵 · 네이버 지도 · 네이버 블로그 후기
- **URL 공유**: `?r=상호명` 파라미터로 특정 식당 링크 공유

### 개인화
- **즐겨찾기** (♡): localStorage 저장, 즐겨찾기만 보기 필터
- **방문 기록** (○/✓): 가본 곳 체크, "안 가본 곳만" 필터
- **랜덤 뽑기** (🎲): 현재 필터 기준으로 랜덤 식당 선택

### 기타
- **PWA**: 홈화면 추가, Service Worker 오프라인 캐시
- **반응형**: 모바일·데스크톱 모두 최적화

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, Vite 7, Vanilla CSS (글래스모피즘 다크 테마) |
| 지도 | Leaflet, react-leaflet v5, react-leaflet-cluster |
| PWA | vite-plugin-pwa, Workbox |
| 크롤러 | Python, Selenium, webdriver-manager |
| 지오코딩 | Nominatim (OpenStreetMap) |
| DB | SQLite (`backend/restaurants.db`) |
| 배포 | Vercel CLI |
| 자동화 | GitHub Actions (주간 크롤링) |

---

## 📁 프로젝트 구조

```
noodle/
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # 메인 컴포넌트 (필터·검색·모달)
│   │   ├── MapView.jsx    # Leaflet 지도 뷰
│   │   └── index.css      # 다크 글래스모피즘 스타일
│   ├── public/
│   │   ├── data.json      # 705개 식당 데이터 (런타임 fetch)
│   │   └── manifest.json  # PWA 설정
│   └── vite.config.js
├── crawling/
│   ├── kakaomap.py        # 카카오맵 크롤러 (--categories 인자 지원)
│   ├── geocode.py         # 주소 → 위도/경도 변환
│   ├── sync_data.py       # DB → data.json 내보내기 + git push
│   └── requirements.txt
├── backend/
│   └── restaurants.db     # SQLite 데이터베이스
└── .github/
    └── workflows/
        └── weekly-crawl.yml  # 매주 월요일 03:00 KST 자동 크롤링
```

---

## 🚀 로컬 실행

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

---

## 🕷 크롤링 파이프라인

```bash
# 전체 크롤링 (노포 + 야장, 약 1~2시간)
python crawling/kakaomap.py

# 특정 카테고리만
python crawling/kakaomap.py --categories 야장

# 좌표 없는 항목 지오코딩
python crawling/geocode.py

# data.json 내보내기 + git push + Vercel 재배포
python crawling/sync_data.py --push
```

GitHub Actions에 의해 **매주 월요일 새벽 3시** 자동으로 실행됩니다.

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
| [docs/01_project-overview.md](./docs/01_project-overview.md) | 프로젝트 전체 구조 |
| [docs/02_crawler-setup.md](./docs/02_crawler-setup.md) | 크롤러 설정 및 사용법 |
| [docs/03_frontend-setup.md](./docs/03_frontend-setup.md) | 프론트엔드 컴포넌트 문서 |
| [docs/04_deployment.md](./docs/04_deployment.md) | Vercel 배포 방법 |
| [docs/05_future-roadmap.md](./docs/05_future-roadmap.md) | 향후 개선 계획 |
