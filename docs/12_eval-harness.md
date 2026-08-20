# 12. AI 챗봇 평가(eval) 하네스

> 목적: `frontend/api/chat.js`(Gemini 3.6 Flash, data.json grounding)의 추천 품질을 **자동·재현 가능**하게 측정. "RAG 품질을 어떻게 재나"에 코드로 답하는 실물.
> 스택: **Node**(chat.js의 `findRelevant`/`matchRegion` 재사용, no new deps, 내장 fetch). 작성 2026-08-19.

---

## 12.1 설계 원칙 (합의된 결정)

1. **grounding 로직 단일 출처**: eval은 `chat.js`의 `findRelevant`·`matchRegion`을 import해서 씀 → 프로덕션과 판정 로직이 갈라지지 않음.
2. **추출기: 헤더 휴리스틱 + full-DB 대조**. 추천은 리스트-헤더/볼드 위치(`### **1. 이름**`, `1. **이름**`), 제외/부연은 산문 문장. 순수 substring은 "제외 언급"을 오탐하므로(실측: 종로 질문에서 억조·영춘옥이 "제외"라 적혔는데 substring이 추천으로 셈) 위치로 추천/제외를 가름.
   - **안전장치 A — 고정 fixture 테스트**: 손 라벨한 실제 응답을 `eval/fixtures/`에 커밋, CI에서 추출기 검증. 프롬프트를 바꿔 포맷이 달라지면 **지표가 아니라 이 테스트가 먼저 빨갛게** 터져야 함(계측기 고장을 성능 변화로 오인 방지).
   - **안전장치 B — unclassified 버킷**: 헤더도 명시적 제외도 아닌 애매한 이름은 pass로 삼키지 말고 별도 카운트. 증가 = 추출기 신뢰도 저하 신호.
3. **비용/CI**: 판정하려면 질문마다 **생성 호출 1회** 필요(생성이 비용/지연의 본체, 판정은 무료). Gemini 3.6 Flash라 200문항 비용≈0이지만 지연 때문에 **PR=고정시드 스모크 30 / 야간·수동=전량**.

## 12.2 골든셋 (목표 ~150)

- **층화**: 축 = 지역(서울 25구) × 의도(회식/혼밥/해장/데이트/부모님/늦은밤) × 카테고리(노포/야장).
- **완전교차 아님, 커버리지 가중**: 데이터 적은 구(도봉·중랑)에서 억지 질문 방지.
  - 25개 구 **전부 최소 2문항**(커버리지 바닥), 나머지는 데이터량 가중 분배.
  - 의도축 균등 배분.
- **적대적 엣지케이스 ~25 수기**(`edge-cases.jsonl`): 존재하지 않는 지역("서울 판교"), 데이터에 없는 메뉴, 모순 조건("강남인데 홍대"), 결과 0건 유도.
- 각 문항: `{ id, question, axes:{region,intent,category}, expect:{region,category?,openNow?} }` — expect가 rule judge 채점 타깃.

## 12.3 판정 (이중)

- **rule judge (결정적·무료, 전량)**
  - **grounding 위반(환각)**: 추출된 추천 이름 중 DB에 매칭 안 되는 것.
  - **지역 정확도**: 추천이 expect.region에 속하는 비율.
  - **카테고리 일치**: 질문이 야장/노포 명시 시.
  - **영업중 일치**: 질문이 "지금 영업중" 류일 때 `isOpenAtServer` 재사용.
- **LLM-as-Judge (Gemini, 샘플)**: 규칙이 못 재는 *의도 부합·유용성* 루브릭 채점. + **추출기 교차검증**(추천 집합 agreement 리포트).

## 12.4 신뢰성 장치 (이 하네스의 핵심 차별점)

- **① negative control**: 일부러 grounding을 망가뜨린 대조군(후보 0개/무관 지역 주입)으로 환각을 유도 → rule judge가 실제로 **불이 켜지는지** 검증. "0%가 진짜 0인지"를 증명. (rule judge 완성 시점 Day 2–3)
- **② variance k=3**: 같은 문항 세트를 3회 반복 → 점수 편차 측정 → **회귀 게이트 임계값을 감이 아니라 데이터로**. (모의면접 "10문항 +30%가 유의한가"에 대한 직접 답)
- **③ baseline + PR 코멘트**: `eval/baseline.json` 스냅샷 커밋(게이트 비교 기준). CI가 PR에 마크다운 요약 코멘트 → 포트폴리오 스크린샷.

## 12.5 지표
grounding violation rate · 지역 정확도 · 카테고리 일치 · 영업중 정확도 · 의도 부합(LLM) · 응답 latency · **unclassified rate**(추출기 건강).

## 12.6 CI (`.github/workflows/eval.yml`, 기존 test.yml·weekly-crawl.yml 불변)
- PR: 고정 시드 스모크 30 → rule judge 전량 + LLM 샘플 소량, baseline 대비 회귀 시 실패, PR 코멘트.
- 수동/야간(`workflow_dispatch`/cron): 전량.

## 12.7 파일
```
eval/
  golden/{generate.mjs, golden.jsonl, edge-cases.jsonl, smoke.jsonl}
  fixtures/{*.json(라벨), extract.test.mjs}
  extract.mjs · lib/{data.mjs, generate-response.mjs}
  judges/{rule.mjs, llm.mjs}
  run.mjs · metrics.mjs · report.mjs · baseline.json
  results/<promptVersion>-<ts>.json
```

## 12.8 진행 상태

### ✅ Day 1 완료 (2026-08-19) — 돌아가는 최소
- **골든셋 149문항**: 층화 124(구별 최소 4, 의도 균등 20~21, openNow 11) + 적대적 엣지 25(존재하지 않는 지역·데이터없는 메뉴·모순·0건 유도 등). `node eval/golden/generate.mjs`로 결정적 재생성.
- **추출기**(`extract.mjs`) + **고정 fixture 6종**: 실제 응답 손 라벨 → `node eval/fixtures/extract.test.mjs` **6/6 통과**. 개발 중 fixture가 실제 버그 2개를 잡음:
  - 초단어 DB명("정") substring 오탐 → **경계검사(앞뒤 한글연속 무효)** 로 차단.
  - 속성 불릿("- **특징**")을 추천 헤더로 오인 → 추천 헤더를 **제목/번호 리스트로 한정**.
  - 도메인 일반어와 충돌하는 실존 상호명(서대문구 **"야장"**) → STOP_NAMES blocklist.
  - **unclassified 버킷** 도입(애매한 이름을 pass로 삼키지 않고 카운트).
- **rule judge**(`judges/rule.mjs`): grounding(환각) + 지역 정확도.
- **negative control**(`negative-control.test.mjs`) **4/4 통과** — 합성 위반(미실존 이름·지역 불일치)을 탐지기가 실제로 잡고 정상은 오탐 없음 확인. → **"0%가 진짜 0"임을 보증**.
- **오케스트레이터**(`run.mjs`): 생성→추출→판정→results 적재 + 요약(grounding violation rate·지역 정확도·unclassified rate·latency p50/p90).
- **실측 스냅샷(prod, 성공분)**: grounding 위반 0, 지역 정확도 1.0, unclassified ~0.09.

### ⚠️ 발견된 운영 이슈 (Day 2 우선)
- prod 반복 호출 시 **Gemini 무료 티어 RPM 한도** → chat.js가 502("모델 응답 오류") 반환, eval 에러율↑. **대책**: 요청 간 페이싱 + 전용 키(높은 쿼터)로 `--target local` 실행, 실패 문항 재시도. (전량 149문항 안정 실행의 전제)

### ✅ Day 2–3 완료 (2026-08-20)
- **category / 영업중 규칙**(`judges/rule.mjs`): 카테고리 일치율 + 영업중 정확도. `isOpenAtServer`를 chat.js에서 export해 재사용(로직 드리프트 0).
- **metrics/report 분리**: `metrics.mjs`(집계+회귀비교 단일 정의), `report.mjs`(baseline 대비 마크다운 + 게이트 exit code). PR 코멘트 포맷 실동작 확인.
- **페이싱**(`run-core.mjs`): `--rpm`로 요청 시작 간격 제한 → 무료 티어 RPM 회피. `loadSet`을 `lib/load-set.mjs`로 분리(사이드이펙트 import 버그 수정).
- **variance k=3**(`variance.mjs`): 같은 세트 k회 → 지표 stddev → suggested_threshold(2σ). **코드 완성**.
- **baseline.json**: 실측 성공분으로 복원(provisional, grounding 0 / region 1.0).
- 실측(쿼터 소진 전): grounding 0 · region 1.0 · category 1.0(n=2) · openNow 1.0(n=1).

### ⚠️ 운영 현실 — Gemini 무료 티어 쿼터
반복 실행으로 **일일 쿼터(RPD) 소진 → 429**. 하네스 결함 아님(페이싱은 RPM은 잡지만 RPD 한도엔 무력). **전량(149)·variance 정식 실행 전제**: (a) 결제 연결 프로젝트 키, 또는 (b) 일일 리셋 후 실행. 명령:
```
GEMINI_API_KEY=<키> node eval/run.mjs --set all --target local --rpm 10 --baseline
GEMINI_API_KEY=<키> node eval/variance.mjs --k 3 --limit 20 --rpm 10   # → variance.json(임계값)
```

### 오프라인 검증(쿼터 불필요, CI에서 항상 통과해야)
```
node eval/fixtures/extract.test.mjs     # 추출기 6/6
node eval/negative-control.test.mjs     # 탐지기 4/4
node eval/golden/generate.mjs           # 골든셋 결정적 재생성
```

### ✅ Day 4–5 완료 (2026-08-20, 코드 — 실행은 쿼터 확보 시)
- **LLM-Judge**(`judges/llm.mjs`): 루브릭(intent_fit·usefulness·honest_on_missing) JSON 채점, **해시 캐시**(eval/cache, 재호출 금지), `run.mjs --llm N`으로 샘플. + **추출기 교차검증**(LLM recommended vs rule recommended, Jaccard agreement → 휴리스틱 신뢰도).
- **`eval.yml`**(기존 test.yml·weekly-crawl.yml 불변):
  - `offline` 잡: 추출기 fixture + negative control + 골든 재생성 — **쿼터 불필요, 매 PR 항상**.
  - `eval` 잡: `GEMINI_API_KEY` secret 있을 때만 생성 eval → report **게이트(회귀 시 실패)** + **PR 코멘트 업서트**. 키 없으면 스킵(실패 아님).
  - `workflow_dispatch`로 수동 전량/세트 지정.
- **프롬프트 A/B**: `EVAL_PROMPT_VERSION=v2 node eval/run.mjs ...` → 결과가 `results/v2-*.json`로 분리 적재. chat.js `buildSystemPrompt` 수정 후 버전만 바꿔 비교. (포맷 바뀌면 fixture 테스트가 먼저 경보)

### ▶ 쿼터 확보 시 마무리 명령 (1회)
```
export GEMINI_API_KEY=<billing 키 or 리셋 후>
node eval/run.mjs --set smoke --target local --rpm 10 --llm 8 --baseline   # 정식 baseline
node eval/variance.mjs --k 3 --limit 20 --rpm 10                            # variance.json(임계값 확정)
node eval/run.mjs --set all --target local --rpm 10                         # 전량 149 스냅샷
```
그 후 `eval/baseline.json`·`eval/variance.json` 커밋 → CI 게이트가 데이터 기반 임계값으로 작동.

### 상태 요약
- ✅ Day 1–5 코드 전량 완성 + 오프라인 검증(추출기 6/6·negative control 4/4) + 부분 실측(grounding 0·지역/카테고리/영업중 1.0).
- ⏳ 전량·variance·LLM-Judge **실행**만 Gemini 쿼터 대기(무료 RPD 소진). billing 키/리셋 후 위 3줄로 완결.
