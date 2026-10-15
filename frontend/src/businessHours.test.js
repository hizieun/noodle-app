// 자정 넘김 등 비자명 로직 회귀 테스트. 프레임워크 없이 실행: `node src/businessHours.test.js`
/* global process */ // Node에서만 실행(시간대 무관 검증에 process.env.TZ 사용)
import assert from 'node:assert';
import { isOpenAt, isClosedToday, formatRanges, todayHoursText } from './businessHours.js';

// 고정 시각 헬퍼: "서울 벽시계로 그 요일·시각"인 순간 (판정이 서울 기준이라 기기 시간대와 무관하게)
// 2024-01-07 = 일요일, dayIdx 0=일 … 1=월
const at = (dayIdx, h, m = 0) => new Date(Date.UTC(2024, 0, 7 + dayIdx, h, m) - 9 * 3600e3);

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

// 떨어진 두 구간 (점심·저녁 따로): 11-15, 17-22
const brk = { mon: ['11:00-15:00', '17:00-22:00'] };
assert.equal(isOpenAt(brk, at(1, 13)), 'open');
assert.equal(isOpenAt(brk, at(1, 16)), 'closed'); // 브레이크
assert.equal(isOpenAt(brk, at(1, 18)), 'open');

// 크롤러가 저장한 브레이크타임: 둘째 구간이 첫 구간 안 → 그 시간엔 닫힘 (139곳이 이 형태)
const nested = { mon: ['11:30-23:00', '15:00-17:00'] };
assert.equal(isOpenAt(nested, at(1, 12)), 'open');
assert.equal(isOpenAt(nested, at(1, 16)), 'closed'); // 예전엔 '15:00-17:00'도 영업으로 봐서 open
assert.equal(isOpenAt(nested, at(1, 18)), 'open');
assert.equal(formatRanges(nested.mon), '11:30-23:00 (브레이크 15:00-17:00)');
assert.equal(formatRanges(brk.mon), '11:00-15:00 / 17:00-22:00');

// 시간대 무관: 같은 순간이면 기기·서버 시간대가 달라도 같은 판정 (Vercel=UTC에서 9시간 어긋나던 버그)
const prevTZ = process.env.TZ;
for (const tz of ['UTC', 'Asia/Seoul', 'America/Los_Angeles']) {
  process.env.TZ = tz;
  assert.equal(isOpenAt(wk, at(1, 12)), 'open', tz);     // 서울 월 12시
  assert.equal(isOpenAt(wk, at(1, 23)), 'closed', tz);   // 서울 월 23시
  assert.equal(isClosedToday({ 영업시간: { mon: 'closed' } }, at(1, 12)), true, tz);
  assert.equal(todayHoursText(nested, at(1, 12)), '오늘 11:30-23:00 (브레이크 15:00-17:00)', tz);
}
if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ;

console.log('✓ businessHours 테스트 통과');
