// eval 오케스트레이터 — 문항 로드 → 응답 생성 → 추출 → rule judge → 결과 적재 + 요약.
// 사용: node eval/run.mjs [--set golden|edge|smoke|all] [--target prod|local] [--limit N] [--concurrency K]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { generate } from './lib/generate-response.mjs';
import { extract } from './extract.mjs';
import { judgeRule } from './judges/rule.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };

const SET = arg('set', 'smoke');
const TARGET = arg('target', 'prod');
const LIMIT = parseInt(arg('limit', '0'), 10);
const CONC = parseInt(arg('concurrency', '3'), 10);
const PROMPT_VERSION = process.env.EVAL_PROMPT_VERSION || 'v1';

const readJsonl = (f) => existsSync(f)
  ? readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

function loadSet() {
  const golden = readJsonl(join(__dirname, 'golden', 'golden.jsonl'));
  const edge = readJsonl(join(__dirname, 'golden', 'edge-cases.jsonl'));
  if (SET === 'golden') return golden;
  if (SET === 'edge') return edge;
  if (SET === 'all') return [...golden, ...edge];
  // smoke = 고정 시드 서브셋(사과 대 사과) — golden 앞 12 + edge 앞 6
  return [...golden.slice(0, 12), ...edge.slice(0, 6)];
}

// 동시성 풀
async function pool(items, k, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(k, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

const items0 = loadSet();
const items = LIMIT > 0 ? items0.slice(0, LIMIT) : items0;
console.log(`▶ set=${SET} target=${TARGET} n=${items.length} conc=${CONC} promptVer=${PROMPT_VERSION}`);

let done = 0;
const rows = await pool(items, CONC, async (item) => {
  const g = await generate(item.question, { target: TARGET });
  const ex = extract(g.text);
  const rule = judgeRule(item, ex);
  process.stdout.write(`\r  진행 ${++done}/${items.length}`);
  return { ...item, latency_ms: g.latency_ms, error: g.error, extraction: ex, rule };
});
process.stdout.write('\n');

// 집계
const errs = rows.filter((r) => r.error);
const withRec = rows.filter((r) => r.rule.n_recommended > 0);
const groundingViol = rows.filter((r) => !r.rule.grounding_ok);
const regionRows = rows.filter((r) => r.rule.region_accuracy != null);
const meanRegionAcc = regionRows.length
  ? regionRows.reduce((s, r) => s + r.rule.region_accuracy, 0) / regionRows.length : null;
const totalRec = rows.reduce((s, r) => s + r.rule.n_recommended, 0);
const totalUnc = rows.reduce((s, r) => s + r.rule.n_unclassified, 0);
const latencies = rows.filter((r) => !r.error).map((r) => r.latency_ms).sort((a, b) => a - b);
const p = (q) => latencies.length ? latencies[Math.floor((latencies.length - 1) * q)] : null;

const summary = {
  promptVersion: PROMPT_VERSION, set: SET, target: TARGET, n: items.length,
  errors: errs.length,
  grounding_violation_rate: +(groundingViol.length / rows.length).toFixed(4),
  grounding_violations: groundingViol.map((r) => ({ id: r.id, q: r.question, names: r.rule.hallucinated })),
  region_accuracy_mean: meanRegionAcc != null ? +meanRegionAcc.toFixed(4) : null,
  region_scored_questions: regionRows.length,
  unclassified_rate: totalRec ? +(totalUnc / (totalRec + totalUnc)).toFixed(4) : 0,
  latency_ms: { p50: p(0.5), p90: p(0.9), max: latencies.at(-1) ?? null },
};

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = join(__dirname, 'results');
mkdirSync(dir, { recursive: true });
const outPath = join(dir, `${PROMPT_VERSION}-${SET}-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2));

console.log('\n===== 요약 =====');
console.log(JSON.stringify(summary, null, 2));
console.log(`\n결과: ${outPath}`);
