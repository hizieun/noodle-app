// Variance — 같은 문항 세트를 k회 반복 실행해 지표 편차 측정.
// "몇 %p 이상 움직여야 진짜 회귀인가"를 감이 아니라 데이터로 정함(회귀 게이트 임계값 근거).
// 모의면접 "10문항 +30%가 통계적으로 유의한가"에 대한 직접 답 자산.
// 사용: node eval/variance.mjs [--k 3] [--limit 20] [--target local]
//       node eval/variance.mjs --from a.json,b.json,c.json [--out path]   # 이미 있는 같은 코드·세트 결과로 계산(재실행 없음)
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runSet } from './lib/run-core.mjs';
import { aggregate, METRIC_DIRS } from './metrics.mjs';
import { loadSet } from './lib/load-set.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const K = parseInt(arg('k', '3'), 10);
const LIMIT = parseInt(arg('limit', '20'), 10);
const TARGET = arg('target', 'local');
const CONC = parseInt(arg('concurrency', '2'), 10);
const RPM = parseInt(arg('rpm', '12'), 10);

const FROM = arg('from', '');
const OUT = arg('out', join(__dirname, 'variance.json'));

const runs = [];
let items = [];
if (FROM) {
  // 무료 한도가 하루 500회라 같은 코드로 이미 돌린 결과를 재사용 — 파일마다 summary 1개 = 1회 실행
  for (const f of FROM.split(',')) runs.push(JSON.parse(readFileSync(f, 'utf-8')).summary);
  console.log(`▶ variance from ${runs.length} result files`);
} else {
  // 고정 서브셋(사과 대 사과) — 결정적 순서로 앞 LIMIT개
  items = loadSet('golden').slice(0, LIMIT);
  console.log(`▶ variance k=${K} n=${items.length} target=${TARGET}`);
}

for (let i = 0; !FROM && i < K; i++) {
  process.stdout.write(`  run ${i + 1}/${K} …`);
  const rows = await runSet(items, { target: TARGET, concurrency: CONC, rpm: RPM });
  const s = aggregate(rows, { run: i + 1 });
  runs.push(s);
  process.stdout.write(` grounding=${s.grounding_violation_rate} region=${s.region_accuracy_mean} err=${s.errors}\n`);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

// 측정 해상도 바닥: 3회 반복에서 늘 1.0/0인 지표는 σ=0이 나오는데, 이건 "노이즈 없음"이 아니라 "구분 못 함"이다.
// 2σ=0을 그대로 쓰면 식당 하나만 다른 구로 골라도 CI가 떨어진다 → 문항 하나가 움직이는 폭보다 작게 잡지 않는다.
// 환각만 무관용: 바닥 없이 2σ(=0) — 하나라도 생기면 회귀.
const ZERO_TOLERANCE = new Set(['grounding_violation_rate']);
const resolution = (m) => {
  const key = m.endsWith('_accuracy_mean') ? m.replace('_accuracy_mean', '_scored') : 'n';
  const counts = runs.map((r) => r[key]).filter((c) => c > 0);
  return counts.length ? 1 / Math.min(...counts) : 0;
};

const n = runs[0]?.n ?? items.length;
const report = { k: runs.length, n, set: runs[0]?.set ?? 'golden', target: runs[0]?.target ?? TARGET, sources: FROM ? FROM.split(',').map((f) => f.split('/').pop()) : undefined, metrics: {}, informational: {} };
for (const m of Object.keys(METRIC_DIRS)) {
  const vals = runs.map((r) => r[m]).filter((v) => v != null);
  if (vals.length < 2) continue;
  const sd = +std(vals).toFixed(4);
  const floor = ZERO_TOLERANCE.has(m) ? 0 : +resolution(m).toFixed(4);
  report.metrics[m] = {
    values: vals, mean: +mean(vals).toFixed(4), stddev: sd,
    suggested_threshold: +Math.max(2 * sd, floor).toFixed(4), // 2σ 초과 이동 = 노이즈 넘어선 회귀 후보
    floor_applied: floor > 2 * sd,
  };
}
// 게이트엔 안 쓰지만 A/B 해석용: LLM 채점 점수·응답 시간의 실행 간 편차 ("이 차이가 노이즈냐?")
const INFO = {
  llm_intent_fit_mean: (r) => r.llm_intent_fit_mean, llm_usefulness_mean: (r) => r.llm_usefulness_mean,
  llm_honest_rate: (r) => r.llm_honest_rate, latency_p50_ms: (r) => r.latency_ms?.p50,
};
for (const [m, get] of Object.entries(INFO)) {
  const vals = runs.map(get).filter((v) => v != null);
  if (vals.length < 2) continue;
  const sd = std(vals);
  report.informational[m] = { values: vals, mean: +mean(vals).toFixed(4), stddev: +sd.toFixed(4), two_sigma: +(2 * sd).toFixed(4) };
}

mkdirSync(join(__dirname, 'results'), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('\n===== variance =====');
console.log(JSON.stringify({ metrics: report.metrics, informational: report.informational }, null, 2));
console.log('\n→ 각 지표 suggested_threshold(2σ)를 회귀 게이트 임계값으로. variance.json 저장.');
