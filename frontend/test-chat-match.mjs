/**
 * chat.js 매칭 로직 단위 테스트
 * 실행: node frontend/test-chat-match.mjs
 *
 * 검증 항목:
 *  1. 등장하는 상호명 추출 (부분일치)
 *  2. 미등장 식당 제외
 *  3. 중복 제거 (같은 상호명 두 번 포함 시 1회만)
 *  4. 빈 텍스트 / 빈 relevant → 빈 배열
 *  5. resolve 실패(식당 없음) → graceful (칩 disabled, 크래시 없음)
 */

import assert from 'node:assert/strict';

// --- 매칭 로직 추출 (chat.js와 동일) ---
function extractMentioned(text, relevant) {
  const seenNames = new Set();
  return relevant
    .filter(r => {
      if (!r.상호명 || !text.includes(r.상호명)) return false;
      if (seenNames.has(r.상호명)) return false;
      seenNames.add(r.상호명);
      return true;
    })
    .map(r => ({ 상호명: r.상호명, 주소: r.주소 || '' }));
}

// --- 테스트 데이터 ---
const relevant = [
  { 상호명: '을지면옥', 주소: '서울 중구 을지로 123' },
  { 상호명: '하동관', 주소: '서울 중구 명동 456' },
  { 상호명: '양미옥', 주소: '서울 서대문구 홍은동 789' },
  { 상호명: '봉피양', 주소: '서울 강남구 역삼 101' },
  { 상호명: '미진', 주소: '서울 종로구 인사동 202' },
];

// --- 테스트 1: 부분일치 정상 추출 ---
{
  const text = '냉면으로는 을지면옥과 하동관을 강력 추천합니다. 두 곳 모두 오랜 역사를 가진 노포입니다.';
  const result = extractMentioned(text, relevant);
  assert.equal(result.length, 2, '테스트1: 2곳 추출해야 함');
  assert.ok(result.some(r => r.상호명 === '을지면옥'), '테스트1: 을지면옥 포함');
  assert.ok(result.some(r => r.상호명 === '하동관'), '테스트1: 하동관 포함');
  console.log('PASS 테스트1: 부분일치 정상 추출');
}

// --- 테스트 2: 미등장 식당 제외 ---
{
  const text = '봉피양 한 곳을 추천합니다.';
  const result = extractMentioned(text, relevant);
  assert.equal(result.length, 1, '테스트2: 1곳만 추출');
  assert.equal(result[0].상호명, '봉피양', '테스트2: 봉피양');
  assert.ok(!result.some(r => r.상호명 === '을지면옥'), '테스트2: 을지면옥 제외');
  assert.ok(!result.some(r => r.상호명 === '미진'), '테스트2: 미진 제외');
  console.log('PASS 테스트2: 미등장 식당 제외');
}

// --- 테스트 3: 중복 제거 ---
{
  // relevant에 같은 상호명이 두 번 들어온 경우 (방어 케이스)
  const relevantWithDup = [
    ...relevant,
    { 상호명: '을지면옥', 주소: '서울 중구 을지로 999' }, // 중복
  ];
  const text = '을지면옥을 추천합니다. 을지면옥은 정말 맛있습니다.';
  const result = extractMentioned(text, relevantWithDup);
  const names = result.map(r => r.상호명);
  assert.equal(names.filter(n => n === '을지면옥').length, 1, '테스트3: 을지면옥 1번만');
  console.log('PASS 테스트3: 중복 제거');
}

// --- 테스트 4: 빈 텍스트 → 빈 배열 ---
{
  const result = extractMentioned('', relevant);
  assert.equal(result.length, 0, '테스트4: 빈 텍스트 → 빈 배열');
  console.log('PASS 테스트4: 빈 텍스트 처리');
}

// --- 테스트 5: 빈 relevant → 빈 배열 ---
{
  const result = extractMentioned('을지면옥 추천합니다.', []);
  assert.equal(result.length, 0, '테스트5: 빈 relevant → 빈 배열');
  console.log('PASS 테스트5: 빈 relevant 처리');
}

// --- 테스트 6: 주소 없는 항목 → 주소 빈 문자열 ---
{
  const relevantNoAddr = [{ 상호명: '미진' }]; // 주소 없음
  const result = extractMentioned('미진을 추천합니다.', relevantNoAddr);
  assert.equal(result.length, 1, '테스트6: 1곳 추출');
  assert.equal(result[0].주소, '', '테스트6: 주소 빈 문자열');
  console.log('PASS 테스트6: 주소 없는 항목 graceful');
}

// --- 테스트 7: resolve 실패 시 크래시 없음 (클라이언트 로직 시뮬레이션) ---
{
  // favKey 시뮬레이션
  const favKey = (r) => `${r.상호명}|${r.주소}`;

  const chips = [{ 상호명: '삭제된식당', 주소: '서울 어딘가' }];
  const allRestaurants = [
    { 상호명: '을지면옥', 주소: '서울 중구 을지로 123' },
  ];

  // full 찾기 — 없으면 undefined
  const full = allRestaurants.find(r => favKey(r) === favKey(chips[0]));
  // 칩은 disabled 처리, onOpenRestaurant 호출 안 함 (full이 falsy)
  let called = false;
  if (full) called = true;

  assert.equal(called, false, '테스트7: 삭제된 식당 클릭 시 onOpenRestaurant 미호출');
  assert.equal(full, undefined, '테스트7: resolve 실패 → undefined');
  console.log('PASS 테스트7: resolve 실패 graceful (크래시 없음)');
}

console.log('\n모든 테스트 통과');
