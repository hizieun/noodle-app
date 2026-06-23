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
//   ["HH:MM-HH:MM", "HH:MM-HH:MM"]  브레이크타임 등 다중 구간
//   "closed"  휴무
//   "24h"     24시간 영업

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseHm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
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

  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = DAYS[now.getDay()];
  const yesterdayKey = DAYS[(now.getDay() + 6) % 7];

  const checkRanges = (val, cursor) => {
    if (val === 'closed') return false;
    if (val === '24h') return true;
    if (typeof val === 'string') return intervalContains(val, minutes, cursor);
    if (Array.isArray(val)) return val.some(r => intervalContains(r, minutes, cursor));
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
    else if (Array.isArray(v)) text = v.join(' / ');
    else text = v;
    return { day: DAY_KO[k], key: k, text };
  });
}
