// 추출기 고정 테스트 — 손 라벨한 실제 응답 fixture로 검증.
// 프롬프트를 바꿔 응답 포맷이 달라지면 지표가 아니라 이 테스트가 먼저 빨갛게 터져야 함(계측기 고장 조기 감지).
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { extract } from '../extract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const eqSet = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

const files = readdirSync(__dirname).filter((f) => /^f\d+\.json$/.test(f)).sort();
let pass = 0, fail = 0;
for (const file of files) {
  const fx = JSON.parse(readFileSync(join(__dirname, file), 'utf-8'));
  const got = extract(fx.text);
  const exp = fx.expected;
  const buckets = ['recommended', 'excluded', 'unclassified', 'hallucinated'];
  const bad = buckets.filter((b) => !eqSet(got[b], exp[b]));
  if (bad.length === 0) { pass++; console.log(`✅ ${fx.id} (${fx.question})`); }
  else {
    fail++;
    console.log(`❌ ${fx.id} (${fx.question})`);
    for (const b of bad) console.log(`   ${b}: 기대 ${JSON.stringify(exp[b])} / 실제 ${JSON.stringify(got[b])}`);
  }
}
console.log(`\n추출기 fixture: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
