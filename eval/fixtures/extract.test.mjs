// 추출기 고정 테스트 — 손 라벨한 실제 응답 fixture로 검증.
// 프롬프트를 바꿔 응답 포맷이 달라지면 지표가 아니라 이 테스트가 먼저 빨갛게 터져야 함(계측기 고장 조기 감지).
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { extract, extractStructured } from '../extract.mjs';
import { judgeRule } from '../judges/rule.mjs';

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
// 구조화 경로 — 서버 매핑을 믿지 않고 DB 대조가 살아 있는지 (깨진 매핑 = 환각으로 잡혀야 함)
{
  const got = extractStructured([{ 상호명: '청진옥' }, { 상호명: '존재하지않는식당123' }]);
  const ok = eqSet(got.recommended, ['청진옥']) && eqSet(got.hallucinated, ['존재하지않는식당123'])
    && got.excluded.length === 0 && got.unclassified.length === 0;
  if (ok) { pass++; console.log('✅ structured (실존→추천, 미실존→환각)'); }
  else { fail++; console.log('❌ structured', JSON.stringify(got)); }
}
// 동명 상호 — 이름만 보면 도봉구 '조개일번지'를 집어 지역 오답으로 채점했던 버그(실측 g0012)
{
  const ex = extractStructured([{ 상호명: '조개일번지', 주소: '서울 강북구 도봉로8길 37 1층' }]);
  const v = judgeRule({ id: 't', expect: { region: '강북구' } }, ex);
  if (ex.records[0].지역 === '강북구' && v.region_accuracy === 1) { pass++; console.log('✅ structured 동명 상호는 주소로 구분'); }
  else { fail++; console.log('❌ structured 동명 상호', ex.records[0]?.지역, v.region_accuracy); }
}
console.log(`\n추출기 fixture: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
