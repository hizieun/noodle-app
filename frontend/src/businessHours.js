// 영업시간 판정 유틸 — App.jsx 등에서 import해 사용
//
// 데이터 스키마 (data.json 식당 객체):
//   영업시간:  { mon: "11:00-22:00", tue: "closed", wed: ["11:00-15:00","17:00-22:00"], ... }
//   휴무일:    ["일", "공휴일"]                // 사람이 읽는 문자열 배열 (옵션)
//   결제수단:  ["현금","카드"]                  // ["현금"] 이면 현금만
//   정보검증일: ISO datetime 문자열
//
// 한 요일 값의 가능한 형태:
//   "HH:MM-HH:MM"  단일 영업시간
//   ["HH:MM-HH:MM", "HH:MM-HH:MM"]  다중 구간 — 첫 구간 안에 들어간 구간은 브레이크타임(크롤러가 함께 저장).
//                                   떨어진 구간(점심·저녁 따로)은 각각 영업.
//   "closed"  휴무
//   "24h"     24시간 영업

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// 식당이 지금 열었는지는 서울 시각으로 정한다 — 기기·서버 시간대와 무관하게.
// getHours()/getDay()를 쓰면 Vercel 서버(UTC)에선 9시간 어긋났다(실측: 목 10:01 KST를 01:01로 판정 →
// 영업중 119곳이어야 할 걸 180곳). 한국은 서머타임이 없어 +9h 고정.
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
export function seoulClock(now = new Date()) {
  const s = new Date(now.getTime() + SEOUL_OFFSET_MS);
  return { day: s.getUTCDay(), minutes: s.getUTCHours() * 60 + s.getUTCMinutes() };
}
export const seoulDayKey = (now) => DAYS[seoulClock(now).day];

function parseHm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

// [시작, 끝] 분 — 끝이 시작보다 작거나 같으면 자정 넘김(+1440)
function span(range) {
  const [a, b] = range.split('-').map(parseHm);
  return [a, b <= a ? b + 1440 : b];
}

// 크롤러가 "브레이크타임 15:00~17:00"을 영업 구간으로 함께 저장했다(구간 2개인 141곳 중 139곳이 둘째 구간이 첫 구간 안).
// 첫 구간 안에 들어간 구간은 브레이크로, 떨어진 구간은 영업으로 나눈다.
export function splitBreaks(ranges) {
  const [main, ...rest] = ranges;
  const [s0, e0] = span(main);
  const opens = [main], breaks = [];
  for (const r of rest) {
    let [s, e] = span(r);
    if (s < s0) { s += 1440; e += 1440; } // 자정 넘긴 영업 안의 새벽 브레이크
    (s >= s0 && e <= e0 ? breaks : opens).push(r);
  }
  return { opens, breaks };
}

function intervalContains(range, now, dayCursor) {
  // range: "HH:MM-HH:MM" — 종료가 시작보다 작으면 자정 넘김
  const [start, end] = range.split('-');
  const s = parseHm(start);
  let e = parseHm(end);
  // "00:00" 종료는 24:00 으로 취급
  if (e === 0) e = 24 * 60;

  // 자정 안 넘는 정상 범위 — 오늘 cursor에서만 매치 (어제 영업시간을 오늘 매치하면 안 됨)
  if (e > s) {
    return dayCursor === 'today' && now >= s && now < e;
  }
  // 자정 넘김: 오늘 = 시작 이후 ~ 자정 직전, 어제 = 0 ~ 다음날 종료
  if (dayCursor === 'today') return now >= s;
  if (dayCursor === 'yesterday') return now < e;
  return false;
}

/**
 * 주어진 시각에 식당이 영업중인지 판정.
 * @param hours business_hours 객체 (한국어 키 "영업시간"으로도 입력 가능)
 * @param now Date — 기본값은 현재시각
 * @returns "open" | "closed" | "unknown"
 */
export function isOpenAt(hours, now = new Date()) {
  if (!hours || typeof hours !== 'object') return 'unknown';

  const { day, minutes } = seoulClock(now);
  const todayKey = DAYS[day];
  const yesterdayKey = DAYS[(day + 6) % 7];

  const checkRanges = (val, cursor) => {
    if (val === 'closed') return false;
    if (val === '24h') return true;
    if (typeof val === 'string') return intervalContains(val, minutes, cursor);
    if (Array.isArray(val)) {
      const { opens, breaks } = splitBreaks(val);
      return opens.some(r => intervalContains(r, minutes, cursor)) && !breaks.some(r => intervalContains(r, minutes, cursor));
    }
    return null;
  };

  const today = checkRanges(hours[todayKey], 'today');
  if (today === true) return 'open';
  // 어제 영업이 자정을 넘겨 오늘로 이어진 케이스 확인
  const yesterday = checkRanges(hours[yesterdayKey], 'yesterday');
  if (yesterday === true) return 'open';

  // 둘 다 false (확정 휴무/영업종료) — 오늘 데이터가 존재할 때만 'closed' 확정
  if (today === false || yesterday === false) return 'closed';
  return 'unknown';
}

// data.json 식당 객체에서 영업시간 추출 (한국어/영어 키 모두 허용)
export function getBusinessHours(restaurant) {
  if (!restaurant) return null;
  return restaurant.영업시간 || restaurant.business_hours || null;
}

export function isOpenNow(restaurant, now) {
  return isOpenAt(getBusinessHours(restaurant), now);
}

// 오늘이 정기 휴무일인지 (영업시간의 오늘 값이 'closed'). "영업종료"와 구분해 "오늘 휴무" 표시용.
export function isClosedToday(restaurant, now = new Date()) {
  const hours = getBusinessHours(restaurant);
  if (!hours || typeof hours !== 'object') return false;
  return hours[seoulDayKey(now)] === 'closed';
}

// 결제수단이 현금만인지 (UI 배지에서 사용)
export function isCashOnly(restaurant) {
  const p = restaurant?.결제수단 || restaurant?.payment;
  if (!Array.isArray(p) || p.length === 0) return false;
  return p.length === 1 && p[0] === '현금';
}

// 사람이 읽는 형태로 변환: "월 11:00-22:00 / 화 휴무 …"
const DAY_KO = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
export function formatHoursForDisplay(hours) {
  if (!hours) return [];
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(k => {
    const v = hours[k];
    let text;
    if (v == null) text = '정보 없음';
    else if (v === 'closed') text = '휴무';
    else if (v === '24h') text = '24시간';
    else text = formatRanges(v);
    return { day: DAY_KO[k], key: k, text };
  });
}

// 한 요일 영업시간 → "11:30-23:00 (브레이크 15:00-17:00)" (예전엔 "11:30-23:00 / 15:00-17:00"로 브레이크가 영업처럼 보였음)
export function formatRanges(v) {
  if (!Array.isArray(v)) return v;
  const { opens, breaks } = splitBreaks(v);
  return opens.join(' / ') + (breaks.length ? ` (브레이크 ${breaks.join(', ')})` : '');
}

// 오늘(서울) 영업시간 한 줄 — 챗 카드·평문용. 정보 없으면 null
export function todayHoursText(hours, now = new Date()) {
  const v = hours?.[seoulDayKey(now)];
  if (v == null) return null;
  if (v === 'closed') return '오늘 휴무';
  if (v === '24h') return '오늘 24시간';
  return `오늘 ${formatRanges(v)}`;
}
