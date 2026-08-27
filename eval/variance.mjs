// Variance — 같은 문항 세트를 k회 반복 실행해 지표 편차 측정.
// "몇 %p 이상 움직여야 진짜 회귀인가"를 감이 아니라 데이터로 정함(회귀 게이트 임계값 근거).
// 모의면접 "10문항 +30%가 통계적으로 유의한가"에 대한 직접 답 자산.
// 사용: node eval/variance.mjs [--k 3] [--limit 20] [--target local]
import { writeFileSync, mkdirSync } from 'fs';
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

// 고정 서브셋(사과 대 사과) — 결정적 순서로 앞 LIMIT개
const items = loadSet('golden').slice(0, LIMIT);
console.log(`▶ variance k=${K} n=${items.length} target=${TARGET}`);

const runs = [];
for (let i = 0; i < K; i++) {
  process.stdout.write(`  run ${i + 1}/${K} …`);
  const rows = await runSet(items, { target: TARGET, concurrency: CONC, rpm: RPM });
  const s = aggregate(rows, { run: i + 1 });
  runs.push(s);
  process.stdout.write(` grounding=${s.grounding_violation_rate} region=${s.region_accuracy_mean} err=${s.errors}\n`);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

const report = { k: K, n: items.length, target: TARGET, metrics: {} };
for (const m of Object.keys(METRIC_DIRS)) {
  const vals = runs.map((r) => r[m]).filter((v) => v != null);
  if (vals.length < 2) continue;
  const sd = +std(vals).toFixed(4);
  report.metrics[m] = {
    values: vals, mean: +mean(vals).toFixed(4), stddev: sd,
    suggested_threshold: +(2 * sd).toFixed(4), // 2σ 초과 이동 = 노이즈 넘어선 회귀 후보
  };
}

mkdirSync(join(__dirname, 'results'), { recursive: true });
writeFileSync(join(__dirname, 'variance.json'), JSON.stringify(report, null, 2));
console.log('\n===== variance =====');
console.log(JSON.stringify(report.metrics, null, 2));
console.log('\n→ 각 지표 suggested_threshold(2σ)를 회귀 게이트 임계값으로. variance.json 저장.');
