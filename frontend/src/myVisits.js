// 내 방문 기록 (별점·메모) 스토어
//
// 키: `${상호명}|${주소}` — 기존 visitKey 와 동일
// 값: { rating: 0-5, memo: string, date: ISO yyyy-mm-dd }
//
// 기존 'nopo-visited' Set 은 방문 여부만 관리하고 그대로 둔다.
// 별점/메모는 별도 'nopo-visits' 키에 객체 형태로 저장한다 (Map.entries 호환).

const STORAGE_KEY = 'nopo-visits';

export function loadVisits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

export function saveVisits(visitsObj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visitsObj));
  } catch {}
}

export function getVisit(visits, key) {
  return visits[key] || null;
}

export function updateVisit(visits, key, patch) {
  const prev = visits[key] || {};
  const merged = { ...prev, ...patch };

  // 별점/메모가 모두 비어있으면 항목 제거 (저장 공간 절약)
  const hasContent = (merged.rating && merged.rating > 0) || (merged.memo && merged.memo.trim().length > 0);
  const next = { ...visits };
  if (hasContent) {
    if (!merged.date) merged.date = new Date().toISOString().slice(0, 10);
    next[key] = merged;
  } else {
    delete next[key];
  }
  return next;
}
