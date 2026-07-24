// chat.js 후보 선별 로직 회귀 테스트 (프레임워크 없이: `node api/chat.test.mjs`)
// findRelevant는 data.json을 읽으므로 실데이터 기반으로 검증한다.
import assert from 'node:assert';
import { matchRegion, findRelevant } from './chat.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✅', name); } catch (e) { fail++; console.log('  ❌', name, '—', e.message); } };

console.log('matchRegion — 지역 유연 매칭');
t('정식 구 이름', () => assert.equal(matchRegion('강남구 국밥'), '강남구'));
t('구 접미사 생략("강남")', () => assert.equal(matchRegion('강남에서 혼밥'), '강남구'));
t('종로 어간', () => assert.equal(matchRegion('종로 노포 술집'), '종로구'));
t('동네 별칭 홍대→마포구', () => assert.equal(matchRegion('홍대 맛집'), '마포구'));
t('동네 별칭 성수→성동구', () => assert.equal(matchRegion('성수 카페'), '성동구'));
t('지역 없으면 null', () => assert.equal(matchRegion('부모님 모시고 갈 곳'), null));
t('"중"만으론 오탐 안 남', () => assert.equal(matchRegion('중식 먹고싶어'), null));

console.log('findRelevant — 후보 선별');
t('지역 질문은 해당 구 위주 반환', () => {
  const r = findRelevant('강남 국밥집');
  assert.ok(r.length >= 3, '후보 3+');
  const gangnam = r.filter(x => x.지역 === '강남구').length;
  assert.ok(gangnam >= 1, '강남구 식당이 후보에 포함되어야 함(이전 버그: 0)');
});
t('최대 40곳', () => assert.ok(findRelevant('노포 맛집').length <= 40));
t('매칭 적어도 폴백으로 최소 후보 확보', () => {
  const r = findRelevant('zzz존재하지않는키워드zzz');
  assert.ok(r.length >= 3, '폴백 후보');
});
t('의도어(부모님) 반영 — 결과 존재', () => {
  const r = findRelevant('부모님 모시고 갈 깔끔한 곳');
  assert.ok(r.length >= 3);
});

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
