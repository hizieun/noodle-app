// 골든셋 생성 — data.json 층화 샘플. 커버리지 가중(구별 최소 2 + 데이터량 가중), 의도 균등, 결정적.
// 출력: golden.jsonl. 재생성해도 동일(랜덤 없음) → 회귀 노이즈 없음.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { REGIONS, byRegion } from '../lib/data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 의도축 — 템플릿 + 카테고리 명시 여부(명시해야 rule judge가 카테고리 채점). 자연스러운 한국어.
const INTENTS = [
  { key: '회식',   q: (r) => `${r}에서 회식하기 좋은 곳 추천해줘` },
  { key: '혼밥',   q: (r) => `${r}에서 혼밥하기 좋은 노포 알려줘`, category: '노포' },
  { key: '해장',   q: (r) => `${r} 해장하기 좋은 국밥집 추천해줘` },
  { key: '데이트', q: (r) => `${r}에서 분위기 좋은 데이트 맛집 알려줘` },
  { key: '부모님', q: (r) => `${r}에서 부모님 모시고 갈 만한 곳 추천해줘` },
  { key: '늦은밤', q: (r) => `${r}에서 늦은밤에 갈 만한 야장 추천해줘`, category: '야장' },
];

const FLOOR = 2;        // 구별 최소 문항
const TARGET = 125;     // 층화 목표(+엣지 25 = 150)
const OPEN_EVERY = 11;  // 대략 이 간격마다 "지금 영업중" 변형(영업중 정확도 축)

// 데이터량 가중 배분: 총 TARGET을 floor 보장하며 count 비례로.
const counts = REGIONS.map((r) => (byRegion.get(r) || []).length);
const total = counts.reduce((a, b) => a + b, 0);
const extra = Math.max(0, TARGET - REGIONS.length * FLOOR);
const alloc = REGIONS.map((r, i) => FLOOR + Math.round((counts[i] / total) * extra));

const items = [];
let n = 0;
REGIONS.forEach((region, ri) => {
  for (let j = 0; j < alloc[ri]; j++) {
    const intent = INTENTS[(ri * 7 + j) % INTENTS.length]; // 결정적으로 의도 분산
    const openNow = n % OPEN_EVERY === 5;                  // 일부를 "지금 영업중"으로
    const base = intent.q(region);
    const question = openNow ? `지금 영업중인 ${region} ${intent.key} 맛집 알려줘` : base;
    n++;
    items.push({
      id: `g${String(n).padStart(4, '0')}`,
      question,
      axes: { region, intent: intent.key, category: intent.category || null },
      expect: {
        region,
        category: intent.category || null,
        openNow: openNow || null,
      },
    });
  }
});

const out = items.map((it) => JSON.stringify(it)).join('\n') + '\n';
writeFileSync(join(__dirname, 'golden.jsonl'), out);

// 요약(생성 검증)
const perRegion = {};
const perIntent = {};
for (const it of items) {
  perRegion[it.axes.region] = (perRegion[it.axes.region] || 0) + 1;
  perIntent[it.axes.intent] = (perIntent[it.axes.intent] || 0) + 1;
}
const minRegion = Math.min(...Object.values(perRegion));
console.log(`골든 ${items.length}문항 생성 (구 ${REGIONS.length}개, 구별 최소 ${minRegion})`);
console.log('의도 분포:', perIntent);
console.log('openNow 문항:', items.filter((i) => i.expect.openNow).length);
