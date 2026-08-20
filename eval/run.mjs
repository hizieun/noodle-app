// eval 오케스트레이터 — 문항 로드 → runSet → 집계 → results 적재.
// 사용: node eval/run.mjs [--set golden|edge|smoke|all] [--target prod|local] [--limit N] [--concurrency K] [--baseline]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runSet } from './lib/run-core.mjs';
import { aggregate } from './metrics.mjs';
import { loadSet } from './lib/load-set.mjs';
import { judgeLLM, extractionAgreement } from './judges/llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(`--${k}`);

const SET = arg('set', 'smoke');
const TARGET = arg('target', 'prod');
const LIMIT = parseInt(arg('limit', '0'), 10);
const CONC = parseInt(arg('concurrency', '2'), 10);
const RPM = parseInt(arg('rpm', '12'), 10);
const LLM = parseInt(arg('llm', '0'), 10); // LLM-Judge 샘플 수(0=끔)
const PROMPT_VERSION = process.env.EVAL_PROMPT_VERSION || 'v1';

const items0 = loadSet(SET);
const items = LIMIT > 0 ? items0.slice(0, LIMIT) : items0;
console.log(`▶ set=${SET} target=${TARGET} n=${items.length} conc=${CONC} promptVer=${PROMPT_VERSION}`);

const rows = await runSet(items, {
  target: TARGET, concurrency: CONC, rpm: RPM,
  onProgress: (d, n) => process.stdout.write(`\r  진행 ${d}/${n}`),
});
process.stdout.write('\n');

// LLM-Judge 샘플(고정 시드=성공분 앞 N) + 추출기 교차검증
if (LLM > 0) {
  const sample = rows.filter((r) => !r.error).slice(0, LLM);
  let i = 0;
  for (const r of sample) {
    try {
      const j = await judgeLLM(r.question, r.text);
      r.llm = j;
      r.llm_agreement = j ? extractionAgreement(r.extraction.recommended, j.recommended_names) : null;
    } catch (e) { r.llm_error = e.message; }
    process.stdout.write(`\r  LLM판정 ${++i}/${sample.length}`);
  }
  process.stdout.write('\n');
}

const summary = aggregate(rows, { promptVersion: PROMPT_VERSION, set: SET, target: TARGET });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
mkdirSync(join(__dirname, 'results'), { recursive: true });
const outPath = join(__dirname, 'results', `${PROMPT_VERSION}-${SET}-${stamp}.json`);
writeFileSync(outPath, JSON.stringify({ summary, rows }, null, 2));

if (has('baseline')) {
  writeFileSync(join(__dirname, 'baseline.json'), JSON.stringify(summary, null, 2));
  console.log('📌 baseline.json 갱신');
}

console.log('\n===== 요약 =====');
console.log(JSON.stringify(summary, null, 2));
console.log(`\n결과: ${outPath}`);
