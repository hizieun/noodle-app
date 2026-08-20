// 리포트 — 최신 결과를 baseline과 비교, 마크다운 요약 + 회귀 게이트(회귀 시 exit 1).
// CI가 이 마크다운을 PR 코멘트로 남김. variance.json이 있으면 그 임계값(2σ) 사용.
// 사용: node eval/report.mjs [--results <file>] [--gate]
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { compareToBaseline, METRIC_DIRS } from './metrics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const gate = process.argv.includes('--gate');

const resultsDir = join(__dirname, 'results');
let file = arg('results', null);
if (!file) {
  const fs = existsSync(resultsDir) ? readdirSync(resultsDir).filter((f) => f.endsWith('.json')).sort() : [];
  if (!fs.length) { console.error('결과 파일 없음'); process.exit(2); }
  file = join(resultsDir, fs.at(-1));
}
const { summary } = JSON.parse(readFileSync(file, 'utf-8'));
const base = existsSync(join(__dirname, 'baseline.json'))
  ? JSON.parse(readFileSync(join(__dirname, 'baseline.json'), 'utf-8')) : null;
const variance = existsSync(join(__dirname, 'variance.json'))
  ? JSON.parse(readFileSync(join(__dirname, 'variance.json'), 'utf-8')) : null;
const thresholds = {};
if (variance) for (const [m, v] of Object.entries(variance.metrics)) thresholds[m] = v.suggested_threshold;

const cmp = base ? compareToBaseline(summary, base, thresholds) : [];
const regressed = cmp.filter((c) => c.regressed);

const L = [];
L.push(`## 🧪 AI 챗봇 eval — \`${summary.promptVersion}\` / ${summary.set} (n=${summary.n})`);
L.push('');
L.push(`- grounding 위반율: **${summary.grounding_violation_rate}** · 지역정확도: **${summary.region_accuracy_mean ?? '-'}** · 카테고리: **${summary.category_accuracy_mean ?? '-'}** · 영업중: **${summary.opennow_accuracy_mean ?? '-'}**`);
L.push(`- unclassified: ${summary.unclassified_rate} · latency p50 ${summary.latency_ms.p50}ms/p90 ${summary.latency_ms.p90}ms · errors ${summary.errors}`);
if (summary.grounding_violations?.length) {
  L.push('');
  L.push('**환각 검출:**');
  for (const g of summary.grounding_violations) L.push(`- \`${g.id}\` ${g.q} → ${g.names.join(', ')}`);
}
if (base) {
  L.push('');
  L.push('| 지표 | baseline | 현재 | Δ | 임계(2σ) | |');
  L.push('|---|---|---|---|---|---|');
  for (const c of cmp) {
    const s = c.regressed ? '🔴 회귀' : '🟢';
    L.push(`| ${c.metric} | ${c.base} | ${c.cur} | ${c.delta >= 0 ? '+' : ''}${c.delta} | ${c.threshold} | ${s} |`);
  }
} else {
  L.push('\n_(baseline 없음 — 첫 실행)_');
}
L.push('');
L.push(regressed.length ? `### ❌ 회귀 ${regressed.length}건` : '### ✅ 회귀 없음');

const md = L.join('\n');
console.log(md);
try { const { writeFileSync, mkdirSync } = await import('fs'); mkdirSync(resultsDir, { recursive: true }); writeFileSync(join(resultsDir, 'report.md'), md); } catch { /* noop */ }
if (process.env.GITHUB_STEP_SUMMARY) {
  try { readFileSync; const { appendFileSync } = await import('fs'); appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n'); } catch { /* noop */ }
}
if (gate && regressed.length) process.exit(1);
