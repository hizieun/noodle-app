import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

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

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseHm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

export function isOpenAtServer(hours, now) {
  if (!hours || typeof hours !== 'object') return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayKey = DAY_KEYS[now.getDay()];
  const yesterdayKey = DAY_KEYS[(now.getDay() + 6) % 7];

  const matches = (range, cursor) => {
    const [s, e] = range.split('-').map(parseHm);
    const end = e === 0 ? 1440 : e;
    if (end > s) return cursor === 'today' && minutes >= s && minutes < end;
    if (cursor === 'today') return minutes >= s;
    if (cursor === 'yesterday') return minutes < end;
    return false;
  };

  const checkRanges = (val, cursor) => {
    if (val === 'closed') return false;
    if (val === '24h') return true;
    if (typeof val === 'string') return matches(val, cursor);
    if (Array.isArray(val)) return val.some(r => matches(r, cursor));
    return null;
  };

  const today = checkRanges(hours[todayKey], 'today');
  if (today === true) return true;
  const yesterday = checkRanges(hours[yesterdayKey], 'yesterday');
  if (yesterday === true) return true;
  if (today === false || yesterday === false) return false;
  return null;
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
      const txt = v === 'closed' ? '휴무' : v === '24h' ? '24시간' : Array.isArray(v) ? v.join('/') : v;
      return `${dayKo[k]} ${txt}`;
    })
    .filter(Boolean)
    .join(', ');
}

function buildSystemPrompt(relevant) {
  const list = relevant.map(r => {
    const hoursTxt = formatHours(r.영업시간);
    const statusTxt = r._isOpen === true ? '지금 영업중' : r._isOpen === false ? '지금 영업종료/휴무' : null;
    const parts = [
      `【${r.상호명}】`,
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
- 영업시간 정보가 있으면 답변에 함께 알려주세요 (없으면 추측 금지)
- 식당명, 지역, 추천 이유를 간결하게 설명하세요
- 2~4개 식당 추천이 적당합니다
- 데이터에 없는 정보는 절대 추측하지 마세요
- 한국어로 답하세요

참고 식당 데이터:
${list}`;
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
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          // Gemini 3.x는 thinkingBudget(숫자) 폐기 → thinkingLevel(enum) 사용.
          // 완전 끄기 미지원이라 맛집 추천용으로 가장 가벼운 'low'.
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error('Gemini 오류:', err);
      return res.status(502).json({ error: '모델 응답 오류' });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: '빈 응답' });

    // relevant(grounded set) 중 응답 텍스트에 상호명이 등장하는 것만 추출
    // 전체 DB 파싱 금지 — grounded set으로 한정해 오탐↓
    const seenNames = new Set();
    const mentioned = relevant
      .filter(r => {
        if (!r.상호명 || !text.includes(r.상호명)) return false;
        if (seenNames.has(r.상호명)) return false;
        seenNames.add(r.상호명);
        return true;
      })
      .map(r => ({ 상호명: r.상호명, 주소: r.주소 || '' }));

    return res.status(200).json({ text, restaurants: mentioned });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류' });
  }
}
