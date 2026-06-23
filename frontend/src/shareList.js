// 즐겨찾기 식당 배열 ↔ URL 쿼리 변환 + 클립보드 도우미

const PARAM_KEY = 'list';
const SEPARATOR = '|';
// URL 길이 가드 — 일부 브라우저/서비스는 ~2000자에서 잘림. 80개 정도까지는 안전.
const MAX_ITEMS = 80;

// 식당명 배열을 단일 문자열로 직렬화 (URLSearchParams 가 자체 인코딩하므로 추가 인코딩 X)
export function joinShareList(restaurantNames) {
  const cleaned = restaurantNames
    .filter(n => typeof n === 'string' && n.trim().length > 0)
    .slice(0, MAX_ITEMS);
  if (cleaned.length === 0) return null;
  // 구분자가 식당명에 포함된 경우 방어적으로 치환
  return cleaned.map(n => n.replace(/\|/g, '/')).join(SEPARATOR);
}

export function splitShareList(joined) {
  if (!joined) return [];
  return joined
    .split(SEPARATOR)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

export function buildShareUrl(restaurantNames) {
  const joined = joinShareList(restaurantNames);
  if (!joined) return null;
  const url = new URL(window.location.href);
  url.searchParams.delete('r');
  url.searchParams.set(PARAM_KEY, joined);
  return url.toString();
}

export function readShareListFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return splitShareList(params.get(PARAM_KEY));
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  }
}

export { MAX_ITEMS, PARAM_KEY };
