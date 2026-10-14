// chat.js 후보 선별 로직 회귀 테스트 (프레임워크 없이: `node api/chat.test.mjs`)
// findRelevant는 data.json을 읽으므로 실데이터 기반으로 검증한다.
import assert from 'node:assert';
import handler, { matchRegion, findRelevant, extractText, MODELS } from './chat.js';

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

console.log('extractText — Gemini 응답 텍스트 추출');
const resp = (parts) => ({ candidates: [{ content: { parts } }] });
t('여러 part를 모두 이어 붙임 (이전 버그: parts[0]만 읽어 답이 9자로 잘림)', () =>
  assert.equal(extractText(resp([{ text: '부모님과 ' }, { text: '가기 좋은 곳은…' }])), '부모님과 가기 좋은 곳은…'));
t('생각(thought) part는 제외', () =>
  assert.equal(extractText(resp([{ text: '고민 중', thought: true }, { text: '추천 답' }])), '추천 답'));
t('텍스트 없는 part(서명만)는 건너뜀', () =>
  assert.equal(extractText(resp([{ thoughtSignature: 'abc' }, { text: '답' }])), '답'));
t('part가 없으면 빈 문자열 (→ 핸들러가 502)', () => {
  assert.equal(extractText(resp([])), '');
  assert.equal(extractText({}), '');
});

// 모델 대체 — 네트워크 없이 fetch를 흉내 내 순서·조건만 검증
console.log('handler — 모델 대체(429/503 → 다음 모델)');
const realFetch = globalThis.fetch;
const callWith = async (statuses) => {
  process.env.GEMINI_API_KEY = 'test';
  const called = [];
  globalThis.fetch = async (url) => {
    called.push(url.match(/models\/([^:]+):/)[1]);
    const st = statuses[called.length - 1] ?? 200;
    const body = st === 200 ? { candidates: [{ content: { parts: [{ text: '추천 답' }] } }] } : { error: { code: st } };
    return new Response(JSON.stringify(body), { status: st });
  };
  const out = await new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    handler({ method: 'POST', body: { message: '강남 국밥', history: [] } }, res);
  });
  globalThis.fetch = realFetch;
  return { ...out, called };
};
const ta = async (name, fn) => { try { await fn(); pass++; console.log('  ✅', name); } catch (e) { fail++; console.log('  ❌', name, '—', e.message); } };
await ta('첫 모델 429 → 둘째 모델이 답함', async () => {
  const r = await callWith([429]);
  assert.deepEqual(r.called, MODELS.slice(0, 2));
  assert.equal(r.code, 200); assert.equal(r.body.model, MODELS[1]);
});
await ta('503(과부하)도 다음 모델로', async () => {
  const r = await callWith([503]);
  assert.equal(r.body.model, MODELS[1]);
});
await ta('400 등 다른 오류는 대체 안 함(모델 바꿔도 같음)', async () => {
  const r = await callWith([400]);
  assert.equal(r.called.length, 1); assert.equal(r.code, 502);
});
await ta('모든 모델 429면 429 전달 → 화면이 한도 안내', async () => {
  const r = await callWith(MODELS.map(() => 429));
  assert.equal(r.called.length, MODELS.length); assert.equal(r.code, 429);
});

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);
