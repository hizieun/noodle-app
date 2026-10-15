import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isOpenAt, formatRanges } from '../src/businessHours.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 무료 등급 한도는 프로젝트×모델 단위로 따로 잡힌다 (2026-09 실측: Flash 하루 20회, Flash-Lite 하루 500회).
// 앞 모델이 한도(429)·과부하(503)면 다음 모델로 넘어가 하루 처리량을 늘린다. GEMINI_MODELS(쉼표)로 교체 가능.
export const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.6-flash,gemini-3.5-flash-lite')
  .split(',').map(m => m.trim()).filter(Boolean);
const geminiUrl = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const REGIONS = [
  '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
  '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
  '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구',
];

let restaurants = [];
try {
  const dataPath = join(__dirname, '..', 'public', 'data.json');
  restaurants = JSON.parse(readFileSync(dataPath, 'utf-8'));
} catch (e) {
  console.error('data.json 로드 실패:', e.message);
}

// 영업 판정은 화면과 같은 함수 하나로(서울 시각·브레이크타임 처리). 예전엔 여기 복사본이 서버 시간대(UTC)로 판정했음.
// true/false/null 반환은 평가 채점기(eval/judges/rule.mjs) 호환용.
export function isOpenAtServer(hours, now) {
  return { open: true, closed: false, unknown: null }[isOpenAt(hours, now)];
}

// 흔히 쓰는 동네명 → 자치구 (사용자는 "강남구"보다 "강남"·"홍대"로 검색)
const REGION_ALIASES = {
  '홍대': '마포구', '연남': '마포구', '망원': '마포구', '합정': '마포구',
  '성수': '성동구', '이태원': '용산구', '한남': '용산구', '신촌': '서대문구',
  '여의도': '영등포구', '잠실': '송파구', '건대': '광진구', '노량진': '동작구',
};

// 질문에서 자치구 추출 → 항상 정식 구 이름 반환(없으면 null)
export function matchRegion(q) {
  // 1) 정식 이름 ("강남구")
  const full = REGIONS.find(r => q.includes(r));
  if (full) return full;
  // 2) 구 접미사 뗀 어간 ("강남", "종로"). "중구"→"중"은 1자라 오탐 위험 → 2자 이상만
  const stem = REGIONS.find(r => {
    const s = r.replace(/구$/, '');
    return s.length >= 2 && q.includes(s);
  });
  if (stem) return stem; // find는 정식 이름(r)을 반환
  // 3) 동네 별칭 ("홍대"→"마포구")
  const alias = Object.keys(REGION_ALIASES).find(a => q.includes(a));
  return alias ? REGION_ALIASES[alias] : null;
}

// 의도어 → 실제 데이터 신호(메뉴 키워드·카테고리·최소평점)로 변환.
// 데이터엔 "깔끔한/혼밥" 같은 단어가 없으므로 의도를 메뉴/카테고리로 옮겨 가점.
const INTENTS = [
  { test: /회식|단체|모임|회량/,               menus: ['고기','삼겹','갈비','곱창','막창','불고기','수육','전골'], category: '야장' },
  { test: /혼밥|혼자|혼술/,                     menus: ['국밥','국수','백반','덮밥','냉면','칼국수','라멘','우동','분식'] },
  { test: /부모님|어른|가족|모시|어르신|상견례|어버이/, menus: ['곰탕','설렁탕','정식','한정식','전골','수육','갈비','백반','추어탕'], minRating: 4.0 },
  { test: /술|한잔|안주|술집|포차|맥주|소주/,    menus: ['안주','전','파전','곱창','골뱅이','오뎅','탕','회','노가리'], category: '야장' },
  { test: /해장/,                              menus: ['해장국','국밥','콩나물','뼈해장','선지','북어','복'] },
  { test: /깔끔|정갈|분위기|데이트/,            minRating: 4.2 },
];

export function findRelevant(query) {
  const q = query.toLowerCase();
  const matchedRegion = matchRegion(q);
  const isYajang = /야장|포차|야외|노천/.test(q);
  const wantsOpenNow = /지금|영업중|오픈|문 열|열려|열린/.test(q);
  const activeIntents = INTENTS.filter(i => i.test.test(q));

  const now = new Date();
  const scored = restaurants.map(r => {
    let score = 0;
    const name = (r.상호명 || '').toLowerCase();
    const menus = (r.대표메뉴 || '').toLowerCase();
    const region = r.지역 || '';
    const category = r.카테고리 || '';

    if (matchedRegion && region === matchedRegion) score += 10;
    if (isYajang && category === '야장') score += 5;
    if (!isYajang && category === '노포') score += 2;

    const keywords = q.replace(/[^\w가-힣]/g, ' ').split(/\s+/).filter(k => k.length > 1);
    keywords.forEach(k => {
      if (name.includes(k)) score += 3;
      if (menus.includes(k)) score += 2;
    });

    const rating = parseFloat(r.평점);
    if (!isNaN(rating) && rating >= 4.0) score += 1;

    // 의도어 가점: 질문의 의도를 메뉴/카테고리/평점 신호로 반영
    activeIntents.forEach(i => {
      if (i.menus && i.menus.some(k => menus.includes(k) || name.includes(k))) score += 4;
      if (i.category && category === i.category) score += 3;
      if (i.minRating && !isNaN(rating) && rating >= i.minRating) score += 2;
    });

    const openStatus = isOpenAtServer(r.영업시간, now);
    if (wantsOpenNow) {
      if (openStatus === true) score += 8;
      else if (openStatus === false) score -= 100; // 휴무 식당 사실상 제외
    }

    return { ...r, _score: score, _isOpen: openStatus };
  });

  const relevant = scored
    .filter(r => r._score > 0)
    .sort((a, b) => b._score - a._score || (parseFloat(b.평점) || 0) - (parseFloat(a.평점) || 0))
    .slice(0, 40); // 3.6 Flash 컨텍스트 여유 — 후보 폭 넓혀 추천 품질↑

  if (relevant.length < 3) {
    return scored
      .sort((a, b) => (parseFloat(b.평점) || 0) - (parseFloat(a.평점) || 0))
      .slice(0, 20);
  }
  return relevant;
}

function formatHours(hours) {
  if (!hours) return null;
  const dayKo = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  return ['mon','tue','wed','thu','fri','sat','sun']
    .map(k => {
      const v = hours[k];
      if (v == null) return null;
      const txt = v === 'closed' ? '휴무' : v === '24h' ? '24시간' : formatRanges(v);
      return `${dayKo[k]} ${txt}`;
    })
    .filter(Boolean)
    .join(', ');
}

// 후보 ID는 이번 요청에서만 쓰는 c1..cN — data.json에 고정 ID가 없고, 다음 턴엔 답이 평문으로 이력에 들어가므로 충분.
const candidateIds = (relevant) => relevant.map((_, i) => `c${i + 1}`);

function buildSystemPrompt(relevant) {
  const ids = candidateIds(relevant);
  const list = relevant.map((r, i) => {
    const hoursTxt = formatHours(r.영업시간);
    const statusTxt = r._isOpen === true ? '지금 영업중' : r._isOpen === false ? '지금 영업종료/휴무' : null;
    const parts = [
      `[${ids[i]}] 【${r.상호명}】`,
      `지역: ${r.지역}`,
      `카테고리: ${r.카테고리}`,
      r.평점 && r.평점 !== '정보 없음' ? `평점: ${r.평점}` : null,
      r.대표메뉴 ? `메뉴: ${r.대표메뉴}` : null,
      r.주소 ? `주소: ${r.주소}` : null,
      hoursTxt ? `영업시간: ${hoursTxt}` : null,
      statusTxt,
    ].filter(Boolean).join(' | ');
    return parts;
  }).join('\n');

  const nowTxt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit' });

  return `당신은 서울 노포·야장 맛집 전문 AI 추천 도우미입니다.
현재 시각(서울): ${nowTxt}
아래 식당 데이터를 바탕으로 사용자 질문에 친근하고 자연스럽게 답해주세요.

답변 규칙:
- 반드시 아래 데이터에 있는 식당만 추천하세요
- 사용자가 "지금 영업중" 같은 시간 관련 요청을 했다면, 데이터의 '지금 영업중' 표시를 활용해 영업하는 곳만 추천하세요
- 추천은 후보 ID로 고르고, reason에 이 질문에 맞는 이유를 데이터 근거(메뉴·영업시간 등)로 한 문장씩 쓰세요
- 2~4곳이 적당합니다
- 요청 조건 일부를 데이터로 맞출 수 없으면(서울 밖 지역, 데이터에 없는 메뉴) caveat에 밝히고, 나머지 조건에 맞는 서울 식당을 대안으로 고를 수 있습니다. 이때 intro에서 대안이라고 말하세요
- 확인할 수 없는 전제(유명인 추천·방송 출연 등)는 caveat에 밝히고, intro에서 사실처럼 반복하지 마세요
- 맞는 곳이 하나도 없으면 picks를 비우고, intro에서 추천을 약속하지 마세요
- 데이터에 없는 정보는 절대 추측하지 마세요
- 한국어로 답하세요

참고 식당 데이터:
${list}`;
}

const MAX_PICKS = 4;

// 응답 형식: picks.id를 이번 후보 ID로만 고르게 enum으로 제한 → 목록 밖 식당은 형식상 나올 수 없다.
// picks 0개 허용 + caveat 필드: 실험에서 형식만 강제하면 '틀린 전제'(유명인 추천 등)를 그대로 받아들이고
// 엉뚱한 후보를 골랐다 — 맞는 곳이 없을 때 비워 둘 출구를 형식에 만들어 둔다.
export function buildResponseSchema(ids) {
  return {
    type: 'OBJECT',
    required: ['intro', 'picks', 'caveat'],
    properties: {
      intro: { type: 'STRING', description: '한두 문장 도입. 질문의 전제를 사실처럼 반복하지 말 것' },
      picks: {
        type: 'ARRAY',
        maxItems: MAX_PICKS,
        items: {
          type: 'OBJECT',
          required: ['id', 'reason'],
          properties: {
            id: { type: 'STRING', enum: ids },
            reason: { type: 'STRING', description: '이 질문에 맞는 이유 한 문장 (메뉴·영업시간 등 데이터 근거)' },
          },
        },
      },
      caveat: { type: 'STRING', description: '데이터로 확인할 수 없거나 없는 요청(서울 밖 지역, 없는 메뉴, 확인 불가 전제). 없으면 빈 문자열' },
    },
  };
}

// 모델 출력(JSON) → 후보 식당으로 매핑. enum이 막아도 ID는 다시 검증(중복·미지 ID 제거)한다.
export function parseStructured(text, relevant) {
  let o;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const byId = new Map(candidateIds(relevant).map((id, i) => [id, relevant[i]]));
  const seen = new Set();
  const picks = (Array.isArray(o.picks) ? o.picks : [])
    .filter(p => byId.has(p?.id) && !seen.has(p.id) && seen.add(p.id))
    .slice(0, MAX_PICKS)
    .map(p => ({ r: byId.get(p.id), reason: String(p.reason ?? '').trim() }));
  const intro = String(o.intro ?? '').trim(), caveat = String(o.caveat ?? '').trim();
  // 추천이 0곳이면 intro 대신 caveat를 본문으로: 규칙으로 금지해도 Lite가 "대신 추천해 드립니다"라고
  // 고르지 않은 추천을 약속했다(엣지 25문항 중 1차 8건 → 규칙 수정 후 2건). 지시로 안 되는 건 코드로 막는다.
  if (picks.length === 0 && caveat) return { intro: caveat, caveat: '', picks };
  return { intro, caveat, picks };
}

// 대화 이력·평가에 쓰는 평문 (화면은 구조화 필드로 그림)
export function renderText({ intro, caveat, picks }) {
  return [intro, caveat, ...picks.map((p, i) => `${i + 1}. ${p.r.상호명} (${p.r.지역}): ${p.reason}`)]
    .filter(Boolean).join('\n');
}

// Gemini 3는 답을 여러 part로 쪼개 보낸다 — parts[0]만 읽으면 답이 잘리거나(9자) 비어서 '빈 응답'이 됐음.
// 생각(thought) part는 빼고 텍스트 part를 모두 이어 붙인다.
export function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { message, history = [] } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ error: 'message 필요' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  const relevant = findRelevant(message);
  const systemPrompt = buildSystemPrompt(relevant);

  // 식당 데이터는 systemInstruction으로 항상 주입 — 이전엔 첫 턴 메시지에만 넣어
  // 후속 질문에선 grounding 데이터가 사라져 모델이 환각했음.
  const contents = history.map(({ role, text }) => ({ role, parts: [{ text }] }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        // 생각 토큰도 이 예산을 같이 쓴다 — 1024에선 생각이 989토큰을 먹고 답이 잘리거나 사라졌음.
        maxOutputTokens: 4096,
        // Gemini 3.x는 thinkingBudget(숫자) 폐기 → thinkingLevel(enum) 사용.
        // 완전 끄기 미지원이라 맛집 추천용으로 가장 가벼운 'low'.
        thinkingConfig: { thinkingLevel: 'low' },
        responseMimeType: 'application/json',
        responseSchema: buildResponseSchema(candidateIds(relevant)),
      },
    });
    let geminiRes, model;
    for (model of MODELS) {
      geminiRes = await fetch(`${geminiUrl(model)}?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      });
      // 한도·과부하는 모델별이라 다음 모델로. 그 외 오류(400 등)는 모델을 바꿔도 같아서 바로 실패 처리.
      if (geminiRes.status !== 429 && geminiRes.status !== 503) break;
      console.warn(`${model} ${geminiRes.status} → 다음 모델`);
    }

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini 오류:', geminiRes.status, err.slice(0, 300));
      // 429 = 무료 등급 한도(분당/일일) 초과 — 화면에서 원인을 구분해 안내하도록 그대로 전달
      if (geminiRes.status === 429) return res.status(429).json({ error: 'quota' });
      return res.status(502).json({ error: '모델 응답 오류' });
    }

    const data = await geminiRes.json();
    const text = extractText(data);
    if (!text) {
      console.error('빈 응답:', data.candidates?.[0]?.finishReason, data.usageMetadata);
      return res.status(502).json({ error: '빈 응답' });
    }

    const structured = parseStructured(text, relevant);
    if (structured) {
      const picks = structured.picks.map(({ r, reason }) => ({
        상호명: r.상호명, 주소: r.주소 || '', 지역: r.지역, 카테고리: r.카테고리,
        평점: r.평점, open: r._isOpen, reason,
      }));
      return res.status(200).json({
        text: renderText(structured),   // 대화 이력·평가용 평문
        intro: structured.intro,
        caveat: structured.caveat,
        picks,
        restaurants: picks.map(p => ({ 상호명: p.상호명, 주소: p.주소 })), // 이전 화면 호환
        model,
      });
    }

    // JSON이 깨진 드문 경우: 예전 방식 — 후보 중 본문에 이름이 나온 곳만 (전체 DB 파싱 금지, 오탐↓)
    const seenNames = new Set();
    const mentioned = relevant
      .filter(r => {
        if (!r.상호명 || !text.includes(r.상호명)) return false;
        if (seenNames.has(r.상호명)) return false;
        seenNames.add(r.상호명);
        return true;
      })
      .map(r => ({ 상호명: r.상호명, 주소: r.주소 || '' }));

    return res.status(200).json({ text, restaurants: mentioned, model });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
