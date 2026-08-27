// 추천 추출기 — 응답 텍스트에서 "추천된 식당"을 뽑는다.
// 핵심: 순수 substring은 "제외 언급"을 오탐하므로(억조·영춘옥 사례) 위치/문맥으로 분류.
//   - recommended: 리스트-헤더/볼드 위치의 실존(DB) 이름
//   - excluded:    제외/미확인 문장 안의 실존 이름
//   - unclassified: 실존 이름이지만 헤더도 제외도 아닌 애매한 위치 (신뢰도 저하 신호 — 삼키지 않고 카운트)
//   - hallucinated: 헤더 위치인데 DB에 매칭 안 되는 이름 (grounding 위반)
import { namesByLength, lookupByName } from './lib/data.mjs';

// 도메인 일반어와 충돌하는 상호명(예: 실제로 "야장"이란 식당이 서대문구에 존재) — 카테고리 단어로
// 매 응답에 등장하므로 상호명 매칭에서 제외. 오탐(카테고리 단어를 추천으로) 차단.
const STOP_NAMES = new Set(['야장', '노포', '포차', '맛집', '식당']);

const EXCLUSION_CUES = ['제외', '확인되지 않', '포함되어 있지 않', '포함되지 않', '데이터에 없',
  '안내에서 제외', '아쉽게도', '찾을 수 없', '정보가 없', '실시간 영업 정보'];
// 헤더 텍스트가 상호명이 아니라 라벨("강남 노포 추천")일 때 걸러냄
const LABEL_CUES = ['추천', '맛집', '리스트', 'best', 'top', '소개', '정리', '지역', '노포', '야장', '메뉴', '참고'];

// 추천 헤더 = 마크다운 제목(###) 또는 번호 리스트(1.). 속성 불릿("- **특징**:")은 제외 —
// 그걸 헤더로 보면 특징/주소/영업시간 같은 라벨이 환각으로 오탐됨(fixture가 잡음).
const isRecHeader = (line) =>
  /^\s*#{1,6}\s/.test(line) || /^\s*\d+[.)]\s/.test(line);

const isKorean = (ch) => /[가-힣]/.test(ch || '');

// 헤더 라인에서 대표 이름 토큰 추출(볼드 우선, 뒤 부연 컷)
function headerNameToken(line) {
  let s = line;
  const bold = s.match(/\*\*(.+?)\*\*/);
  if (bold) s = bold[1];
  else s = s.replace(/^\s*#{1,6}\s*/, '').replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '');
  s = s.replace(/\*\*/g, '').replace(/^\s*\d+[.)]\s*/, '');
  s = s.split(/[(（:：|]/)[0];        // (지역)/: 설명 컷
  return s.trim();
}

const looksLikeLabel = (tok) => {
  const t = tok.toLowerCase();
  return LABEL_CUES.some((c) => t.includes(c)) && !lookupByName(tok);
};

// 텍스트에서 name의 인덱스 주변 "문장"이 제외 문맥인지
function inExclusionContext(text, idx) {
  const start = Math.max(0, text.lastIndexOf('\n', idx));
  let end = idx;
  for (const p of ['\n', '.', '。', '!', '?']) {
    const e = text.indexOf(p, idx);
    if (e !== -1) end = Math.max(end, Math.min(text.length, e + 1));
  }
  const sentence = text.slice(start, end === idx ? text.length : end);
  return EXCLUSION_CUES.some((c) => sentence.includes(c));
}

export function extract(text) {
  if (!text || typeof text !== 'string') {
    return { recommended: [], excluded: [], unclassified: [], hallucinated: [] };
  }
  const lines = text.split('\n');
  // 각 문자 인덱스가 추천 헤더 라인에 속하는지
  const headerRanges = [];
  { let pos = 0; for (const ln of lines) { if (isRecHeader(ln)) headerRanges.push([pos, pos + ln.length]); pos += ln.length + 1; } }
  const inHeader = (idx) => headerRanges.some(([a, b]) => idx >= a && idx <= b);

  // 1) 실존(DB) 이름 탐지 — 최장일치 + 경계검사(한글 연속이면 무효: "정"이 "정보" 안에서 매칭되는 오탐 차단)
  const seen = new Set();
  const found = []; // {name, idx}
  const claimed = []; // 이미 매칭된 구간(겹침 방지)
  for (const name of namesByLength) {
    if (name.length < 2 || STOP_NAMES.has(name)) continue; // 1자/도메인 일반어는 오탐 과다 → 제외
    let from = 0, idx;
    while ((idx = text.indexOf(name, from)) !== -1) {
      const before = idx > 0 ? text[idx - 1] : '';
      const after = text[idx + name.length] || '';
      const bounded = !isKorean(before) && !isKorean(after); // 앞뒤가 한글 연속이 아니어야 실제 이름
      const overlap = claimed.some(([a, b]) => idx < b && idx + name.length > a);
      if (bounded && !overlap && !seen.has(name)) {
        seen.add(name);
        found.push({ name, idx });
        claimed.push([idx, idx + name.length]);
        break;
      }
      from = idx + 1;
    }
  }

  const recommended = [], excluded = [], unclassified = [];
  for (const { name, idx } of found) {
    if (inHeader(idx)) recommended.push(name);
    else if (inExclusionContext(text, idx)) excluded.push(name);
    else unclassified.push(name);
  }

  // 2) 헤더 라인 중 실존 이름이 하나도 없는 것 → 미실존 이름 주장(환각) 후보
  const recSet = new Set(recommended);
  const hallucinated = [];
  { let pos = 0;
    for (const ln of lines) {
      if (isRecHeader(ln)) {
        const hasReal = [...recSet].some((n) => ln.includes(n)) || found.some((f) => f.idx >= pos && f.idx <= pos + ln.length);
        if (!hasReal) {
          const tok = headerNameToken(ln);
          if (tok && tok.length >= 2 && /[가-힣A-Za-z]/.test(tok) && !looksLikeLabel(tok) && !lookupByName(tok)) {
            hallucinated.push(tok);
          }
        }
      }
      pos += ln.length + 1;
    }
  }
  return { recommended, excluded, unclassified, hallucinated };
}
