// 자정 넘김 등 비자명 로직 회귀 테스트. 프레임워크 없이 실행: `node src/businessHours.test.js`
import assert from 'node:assert';
import { isOpenAt } from './businessHours.js';

// 고정 시각 헬퍼: 요일/시각만 의미 있음 (2024-01-01 = 월요일)
const at = (dayIdx, h, m = 0) => {
  const base = new Date(2024, 0, 7); // 2024-01-07 = 일요일
  base.setDate(base.getDate() + dayIdx); // 0=일 … 1=월
  base.setHours(h, m, 0, 0);
  return base;
};

// 데이터 없음 → unknown (배지/필터가 이걸로 graceful하게 숨김)
assert.equal(isOpenAt(null), 'unknown');
assert.equal(isOpenAt({}), 'unknown'); // 오늘/어제 키 모두 미정의 → unknown
assert.equal(isOpenAt({ mon: undefined }), 'unknown');

// 정상 영업 범위 (월 11:00-22:00)
const wk = { mon: '11:00-22:00' };
assert.equal(isOpenAt(wk, at(1, 12)), 'open');
assert.equal(isOpenAt(wk, at(1, 23)), 'closed');
assert.equal(isOpenAt(wk, at(1, 10)), 'closed');

// 휴무 / 24시간
assert.equal(isOpenAt({ mon: 'closed' }, at(1, 12)), 'closed');
assert.equal(isOpenAt({ mon: '24h' }, at(1, 3)), 'open');

// 자정 넘김: 월 18:00-02:00 → 화 01:00은 "어제(월)" 영업의 연장 → open
const late = { mon: '18:00-02:00' };
assert.equal(isOpenAt(late, at(1, 20)), 'open');   // 월 20시
assert.equal(isOpenAt(late, at(2, 1)), 'open');    // 화 새벽 1시 (월 영업 연장)
assert.equal(isOpenAt(late, at(2, 3)), 'closed');  // 화 새벽 3시 (이미 종료)

// 브레이크타임 (배열 다중 구간): 11-15, 17-22
const brk = { mon: ['11:00-15:00', '17:00-22:00'] };
assert.equal(isOpenAt(brk, at(1, 13)), 'open');
assert.equal(isOpenAt(brk, at(1, 16)), 'closed'); // 브레이크
assert.equal(isOpenAt(brk, at(1, 18)), 'open');

console.log('✓ businessHours 테스트 통과');
