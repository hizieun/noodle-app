// Negative control — 탐지기가 실제로 "불이 켜지는지" 증명.
// "환각률 0%"가 진짜 0인지, 탐지기가 아무것도 안 하는지 구분하는 대조군.
// 일부러 위반이 든 합성 응답을 넣어 grounding/지역 탐지가 반드시 잡는지 검증(안 잡으면 CI 레드).
import assert from 'assert';
import { extract } from './extract.mjs';
import { judgeRule } from './judges/rule.mjs';

let pass = 0, fail = 0;
const check = (name, cond) => cond
  ? (pass++, console.log('✅', name))
  : (fail++, console.log('❌', name));

// ① 미실존 이름을 헤더로 추천 → 환각 탐지 필수
const invented = `추천드릴게요!\n\n### 1. **강남불백순대국천국**\n- 특징: 존재하지 않는 가짜 식당\n\n### 2. **을지로환상의국밥집**\n- 특징: 이것도 가짜`;
{
  const ex = extract(invented);
  const v = judgeRule({ id: 'nc1', expect: {} }, ex);
  check('① 미실존 이름 2개 환각 탐지', ex.hallucinated.length >= 2 && v.grounding_ok === false);
}

// ② 실존 이름이지만 요청과 다른 지역 → 지역 정확도 0 탐지 (원강=강남구인데 종로구로 요청)
const wrongRegion = `종로구 맛집 추천!\n\n### 1. **원강**\n- 특징: 실존하지만 강남구 식당`;
{
  const ex = extract(wrongRegion);
  const v = judgeRule({ id: 'nc2', expect: { region: '종로구' } }, ex);
  check('② 지역 불일치 탐지(정확도 0)', v.region_accuracy === 0 && v.region_misses.length === 1);
}

// ③ 정상(실존 + 올바른 지역) → 위반 없음이어야 (false positive 방지)
const clean = `강남구 회식 추천!\n\n### 1. **원강**\n- 특징: 강남구 실존 노포`;
{
  const ex = extract(clean);
  const v = judgeRule({ id: 'nc3', expect: { region: '강남구' } }, ex);
  check('③ 정상 케이스는 통과(오탐 없음)', v.grounding_ok === true && v.region_accuracy === 1);
}

// ④ 혼합: 실존 1 + 미실존 1 → 환각 탐지 + 실존만 지역 채점
const mixed = `추천!\n\n### 1. **원강**\n### 2. **가짜식당이름123**`;
{
  const ex = extract(mixed);
  const v = judgeRule({ id: 'nc4', expect: { region: '강남구' } }, ex);
  check('④ 혼합: 환각 탐지 + 실존만 채점', ex.hallucinated.length === 1 && ex.recommended.includes('원강'));
}

console.log(`\nnegative control: ${pass} pass, ${fail} fail`);
assert.strictEqual(fail, 0, '탐지기가 위반을 못 잡음 — 지표 0%가 무의미해짐');
