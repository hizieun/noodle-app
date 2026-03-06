# 3. 프론트엔드 설정 및 컴포넌트 문서

## 기술 스택
- **Vite 7** + **React 19** (JavaScript, `.jsx`)
- **Vanilla CSS** (TailwindCSS 불사용 - 완전 커스텀 디자인 시스템)
- Google Fonts: **Inter**

---

## 초기 세팅 방법 (처음 세팅하는 경우)

### 1. Vite React 프로젝트 생성
```bash
npx create-vite@latest frontend --template react
cd frontend
npm install
```

### 2. 프로젝트 실행 (개발 서버)
```bash
cd frontend
npm run dev
```
→ `http://localhost:5173` 에서 확인

---

## 폴더 및 파일 역할

### `index.html`
- SEO용 `<title>`, `<meta description>` 설정
- Google Fonts `Inter` 로드

### `src/main.jsx`
- React 앱 진입점. `App`을 ReactDOM으로 렌더링.

### `src/data.json`
- 크롤러로 수집한 맛집 데이터. 구조:
```json
[
  {
    "지역": "강동구",
    "상호명": "개성김치손만두",
    "주소": "서울 강동구 동남로85길 70 1층",
    "평점": "4.8",
    "전화번호": "02-428-3871",
    "대표메뉴": "찐만두, (특)떡만둣국, (특)만둣국, 떡만둣국",
    "카카오맵_링크": "https://place.map.kakao.com/14935600",
    "네이버블로그_링크": "...",
    "네이버지도_링크": "..."
  }
]
```
> 현재 크롤러는 상호명에서 알파벳 접두사를 제거하여 수집하며, 메뉴 데이터까지 포함합니다.

### `src/App.jsx`
핵심 컴포넌트 파일. 아래 두 가지 역할을 담당합니다.

#### ① `getRestaurantEmoji(name)` 함수
상호명 텍스트에서 음식 종류를 파악해 적절한 이모지를 반환합니다.
```js
if (/냉면|국수|면|우동/.test(name)) return "🍜";
if (/만두|교자/.test(name)) return "🥟";
if (/국밥|해장국|탕|찌개/.test(name)) return "🍲";
// ... 등
```

#### ② `formatRestaurantName(name)` 함수
카카오맵에서 자동으로 붙는 알파벳 접두사(예: "A 개성김치손만두")를 제거하고 이모지를 앞에 붙입니다.
```js
const cleanName = name.replace(/^[a-zA-Z]\s+/, '');
return `${emoji} ${cleanName}`;
```

#### ③ `RestaurantCard` 컴포넌트
식당 한 건의 정보를 카드 형태로 렌더링합니다.
- 카드 제목 (이모지 + 상호명)
- 지역 태그 (우측 상단)
- 주소 (지도 아이콘 + 텍스트)
- 평점 (별 아이콘 + 텍스트)
- **클릭 이벤트**: 클릭 시 해당 식당의 모달을 오픈합니다.

#### ④ `RestaurantModal` 컴포넌트 (NEW)
선택된 식당의 상세 정보를 보여주는 레이어입니다.
- **기본 정보**: 주소, 평점, 전화번호
- **대표 메뉴**: 크롤링된 메뉴 태그들을 칩 스타일로 나열
- **바로가기 버튼**: 🗺️ 카카오맵, 📍 네이버지도, 📝 블로그 후기로 연결되는 액션 버튼들
- **닫기 로직**: X 버튼, ESC 키, 투명 배경 클릭 지원

#### ⑤ `App` 메인 컴포넌트
- `selectedRestaurant` 상태 관리 (모달 오픈 여부 결정)
- 지역구 목록을 `data.json`에서 추출 → 가나다 정렬 후 앞에 `전체` 고정
- 드롭다운 `<select>` 로 선택한 지역에 맞게 카드 필터링
- `useMemo`로 필터링 결과 성능 최적화

### `src/index.css`
전체 디자인 시스템을 정의하는 CSS 파일.

**핵심 CSS 변수 (`--var` 방식)**
```css
:root {
  --bg-primary: #0a0a0c;         /* 최상위 배경 */
  --bg-secondary: #141418;       /* 카드 배경 */
  --text-accent: #f43f5e;        /* 강조 색상 (로즈) */
  --glass-bg: rgba(20,20,24,0.6) /* 헤더 글래스모피즘 */
}
```

**주요 클래스**
| 클래스 | 역할 |
|--------|------|
| `.glass` | 글래스모피즘 효과 (헤더에 사용) |
| `.card` | 식당 카드 기본 스타일 + 호버 애니메이션 |
| `.filter-select` | 지역 선택 드롭다운 스타일 |
| `.animate-fade-in` | 카드 순차 등장 애니메이션 |
| `.restaurant-grid` | 반응형 카드 그리드 레이아웃 |

---

## 데이터 흐름 다이어그램

```
keywords.txt
     ↓
kakaomap.py (크롤러)
     ↓
맛집_평점순_정렬.csv
     ↓
csv_to_json.py (변환 스크립트)
     ↓
frontend/src/data.json
     ↓
App.jsx (React)
     ↓
브라우저 (카드 UI)
```
