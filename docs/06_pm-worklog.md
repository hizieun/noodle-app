# 6. PM 작업 로그 & 우선순위 백로그

> 이 문서가 **현재 기준 로드맵의 단일 출처(source of truth)**입니다.
> `05_future-roadmap.md`는 초기 기획 문서로, GPS·지도·챗봇·즐겨찾기 등 이미 구현된 항목이
> 다수라 현황과 맞지 않습니다. 앞으로의 우선순위는 이 문서를 보세요.
>
> 작성: 2026-06-25 (PM 관점 코드 점검 세션)

---

## 6.1 프로젝트 현황 요약

**노포지도** — 서울 노포(370)·야장(335) 맛집 **705곳**을 지도/리스트로 탐색하는 React 19 PWA.

| 영역 | 스택 | 비고 |
|------|------|------|
| frontend | React 19 + Vite 7, `public/data.json` 런타임 fetch | `App.jsx` 993줄에 로직 집중 |
| AI 추천 | Vercel 서버리스 `api/chat.js` + Gemini 2.5 Flash | 키워드 스코어링으로 식당 추려 grounding |
| 크롤러 | Python + Selenium → SQLite → `data.json` + git push | 영업시간 추출 코드 보유 |
| backend | FastAPI(`backend/main.py`, Railway) `/api/restaurants` | **프론트가 사용하지 않음 — 사용 여부 확인 필요** |
| 자동화 | GitHub Actions 주간 크롤(월 03:00 KST) | `weekly-crawl.yml` |

---

## 6.2 이번 세션에서 한 일 (완료)

### 코드 수정 3건 (build·test 통과 확인)

1. **챗봇 grounding 버그 수정** — `frontend/api/chat.js`
   - 문제: 식당 데이터(systemPrompt)가 **첫 번째 질문에만** 주입되어, 후속 질문부터는
     모델이 데이터 없이 답해 환각 발생.
   - 수정: 데이터를 Gemini `systemInstruction`으로 분리 → **모든 턴에서 grounding 보장**.

2. **"지금 영업중" 필터 데이터 미스매치 방어** — `frontend/src/App.jsx`
   - 문제: 영업시간 데이터가 **703/705(99.7%) 비어있어** 필터를 켜면 결과가 ~0개로 붕괴.
   - 수정: `showOpenNowFeature` 게이트 추가 — 영업시간 커버리지가 **30% 이상일 때만**
     필터·칩 노출. 크롤로 데이터가 채워지면 자동으로 다시 나타남.
     (영업/종료 배지는 원래 `unknown`이면 안 떠서 그대로 둠.)

3. **회귀 테스트 추가** — `frontend/src/businessHours.test.js` (신규)
   - 자정 넘김 영업(예: 18:00–02:00), 브레이크타임, 휴무, 24h, 데이터 없음 케이스 검증.
   - 실행: `node src/businessHours.test.js` → 통과.

### 크롤러 장애 진단 & 복구 (버그 2개)

크롤러를 재실행하는 과정에서 **연쇄된 버그 2개**를 발견·수정했다.

**버그 ① 드라이버 초기화 무한 대기**
- **증상**: 로컬 크롤 실행 시 23시간 동안 0% CPU로 멈춤. DB·로그에 아무 기록 없음.
- **근본 원인**: `ChromeDriverManager().install()`가 `storage.googleapis.com`에서
  드라이버를 받으려다 **네트워크 타임아웃에 무한 대기**(타임아웃 미설정).
- **수정** — `crawling/kakaomap.py` `init_driver`:
  `CHROMEDRIVER_PATH` 환경변수가 있으면 그 드라이버를 직접 사용, 없으면 기존 자동 해석.
  → 로컬은 캐시 드라이버로 네트워크 회피, CI(리눅스)는 영향 없음.

**버그 ② CSV 저장 크래시로 DB 저장이 매번 스킵됨 (조용한 데이터 유실)**
- **증상**: ①을 고친 뒤 크롤이 끝까지 돌았는데도 영업시간이 2건 그대로. DB에 아무것도 안 들어감.
- **근본 원인**: 영업시간 기능 추가 시 행(dict)에 `영업시간/휴무일/결제수단` 키가 생겼는데,
  `save_to_csv`의 `fieldnames`엔 빠져 있어 `csv.DictWriter`가 매 지역 예외 발생.
  루프상 **CSV 저장이 DB 저장보다 먼저** 호출돼서, 예외→`except`로 점프→`save_to_db` 미실행.
  모든 지역에서 DB 저장이 조용히 건너뛰어졌고, 루프 밖 마지막 CSV 저장에서 예외가 잡히지 않아 크래시.
- **수정** — `save_to_csv`의 DictWriter에 `extrasaction='ignore'` (CSV엔 영업시간 안 쓰므로 추가 키 무시).
- **검증**: 강남구 단일 스모크 → "✅ 저장 완료" 출력, `with_hours` 2→13, 자정 넘김·브레이크타임 정상.
- **실행 방법(로컬)**:
  ```bash
  CHROMEDRIVER_PATH=~/.wdm/drivers/chromedriver/mac64/<버전>/chromedriver-mac-arm64/chromedriver \
    venv/bin/python -u crawling/kakaomap.py
  ```
  ※ 캐시 드라이버 버전은 설치된 Chrome의 **major 버전과 일치**해야 함
  (`Google Chrome --version`으로 확인).
- **현재**: 전체 재크롤 진행 중(25개 구 × 2 카테고리, 1~2시간). 완료 후 영업시간/좌표 보강 예정.

---

## 6.3 앞으로 할 일 — 우선순위 백로그

> 기준: 사용자 영향(Impact) × 노력(Effort). 위에서부터 권장 순서.

### 🔴 P0 — 진행 중 / 즉시
- [ ] **전체 재크롤 완료 → 영업시간·메뉴 데이터 채우기** (진행 중)
  영업시간 99.7% 결손이 가장 큰 가치 공백. 채워지면 "지금 영업중" 필터·배지가 실제 작동.
- [ ] **`geocode.py` 재실행 → 좌표 없는 18%(131곳) 보강**
  지도 중심 앱인데 1/5이 지도에 안 뜨고 거리순/반경 필터에서 누락됨.
- [ ] **`sync_data.py`로 `data.json` 갱신 → diff 확인 후 배포(push)**
  push는 외부 배포이므로 **사람이 diff 확인 후** 실행.

### 🟠 P1 — 데이터 신선도 / 정합성
- [ ] **폐업 식당 정리 전략** — 주간 크롤이 신규는 upsert하지만 폐업 감지·제거 로직은 없음.
  검색 결과에서 사라진 항목을 비활성 처리하는 규칙 검토.
- [ ] **`정보검증일` 노출 강화** — 오래된 데이터일수록 신뢰도 표시(이미 모달엔 있음, 카드에도?).

### 🟡 P2 — 기술 부채 / 유지보수
- [ ] **`backend/` FastAPI 사용 여부 확정** — 프론트가 `data.json`만 fetch하고
  `/api/restaurants`는 안 씀. 미사용이면 삭제(Railway 비용·혼란 제거), 쓸 거면 프론트 연동.
- [ ] **기존 lint 에러 6건 정리** — 빈 `catch {}` 3곳, `Math.random` 순수성 경고 등
  (`npm run lint`). 이번 세션 변경분이 아닌 기존 문제.
- [ ] **`App.jsx`(993줄) 분리** — 모달/카드/필터 컴포넌트 추출. **단, 현재 정상 작동하므로
  후순위.** 새 기능 추가가 잦아질 때 착수.

### 🟢 P3 — 신규 기능 아이디어
- [ ] 사용자 리뷰/사진(현재는 localStorage 개인 메모만) — 백엔드·인증·스토리지 필요, 큰 작업.
- [ ] 챗봇 멀티턴 품질 개선 — 매 턴 `findRelevant` 재계산은 되지만, 대화 맥락 누적 시
  관련 식당 폭이 좁아질 수 있음. 필요 시 검색 범위 동적 조정.

---

## 6.4 참고 — 알아두면 좋은 것

- **데이터 파이프라인**: `kakaomap.py`(크롤) → SQLite(`backend/restaurants.db`) →
  `sync_data.py`(→ `public/data.json` + git push). 프론트는 `data.json`만 읽음.
- **upsert 키**: `(name, address)`. 영업시간/좌표는 `COALESCE`로 **기존 값 보존**(새 값 있을 때만 덮음).
- **배포**: 반드시 `frontend/` 디렉토리에서 `vercel --prod`.
